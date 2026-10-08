/**
 * RingSize · Módulo BETA — Función serverless para Vercel (`POST /api/measure`).
 * Misma lógica que el proxy local: importa el pipeline compartido.
 * La GEMINI_API_KEY se configura en el dashboard de Vercel (nunca en el repo).
 */
import {
  getBetaConfig,
  validateMeasureBody,
  analyzeTwoStages,
  mapMeasureError,
  corsHeadersFor,
} from '../server/measurePipeline.js';

const CFG = getBetaConfig(process.env);

function applyCors(req, res) {
  const h = corsHeadersFor(req.headers?.origin, CFG.corsOrigins);
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  return h;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Usa POST.' });
  }
  if (!CFG.apiKey) {
    return res.status(503).json({ ok: false, code: 'NO_API_KEY', message: 'Beta no configurada en el servidor (falta GEMINI_API_KEY).' });
  }
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (body === null) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'Solicitud inválida.' });
  }
  const valid = validateMeasureBody(body, CFG.maxMb);
  if (!valid.ok) {
    return res.status(valid.status).json({ ok: false, code: valid.code, message: valid.message });
  }
  try {
    const detection = await analyzeTwoStages(valid.image, valid.mimeType, CFG);
    // La talla NO se calcula aquí: el frontend usa ringCalculator.js + tabla T1-T36.
    return res.status(200).json({ ok: true, detection });
  } catch (e) {
    const m = mapMeasureError(e);
    return res.status(m.status).json({ ok: false, code: m.code, message: m.message });
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
