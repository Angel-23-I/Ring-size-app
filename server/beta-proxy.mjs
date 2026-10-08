/**
 * RingSize · Módulo BETA — Proxy aislado para Gemini (NO forma parte del núcleo aprobado).
 *
 * - La GEMINI_API_KEY vive SOLO aquí (variable de entorno del servidor).
 * - El frontend NUNCA ve la clave: llama a POST /api/measure de este proxy.
 * - Gemini actúa SOLO como asistente de visión: devuelve detección estructurada
 *   (cajas/puntos 0-1000, calidad, advertencias). NUNCA devuelve una talla.
 * - El cálculo píxeles→mm y la talla final ocurren en el frontend con
 *   src/utils/imageMeasurement.js + src/utils/ringCalculator.js + tabla T1-T36.
 * - Las fotos NO se almacenan: se procesan en memoria y se descartan.
 *
 * Uso:
 *   GEMINI_API_KEY=... node server/beta-proxy.mjs
 *   Opcional: PORT=3001 GEMINI_MODEL=gemini-3.5-flash-lite BETA_MAX_MB=6
 * Salud: GET /api/beta/health
 */
import http from 'node:http';
// Carga .env local (solo servidor; nunca exponer estas variables al frontend).
import 'dotenv/config';
import {
  getBetaConfig,
  validateMeasureBody,
  analyzeTwoStages,
  mapMeasureError,
  corsHeadersFor,
} from './measurePipeline.js';

const CFG = getBetaConfig(process.env);
const PORT = Number(process.env.PORT || 3001);
const { apiKey: API_KEY, model: MODEL, maxMb: MAX_MB } = CFG;

function corsHeaders(req) {
  return corsHeadersFor(req.headers?.origin, CFG.corsOrigins);
}

function send(res, code, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...extra });
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { reject(Object.assign(new Error('too-large'), { code: 'TOO_LARGE' })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const cors = corsHeaders(req);
  // Todas las respuestas /api llevan el origen permitido (sin '*').
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
  // Preflight CORS para /api/* (navegadores lo exigen antes del POST con JSON).
  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    res.writeHead(204, {
      ...cors,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Content-Length': '0',
    });
    res.end();
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/beta/health') {
    send(res, 200, { ok: true, beta: 'camera-measure', model: MODEL, keyConfigured: Boolean(API_KEY), maxMb: MAX_MB }, cors);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/measure') {
    if (!API_KEY) { send(res, 503, { ok: false, code: 'NO_API_KEY', message: 'Beta no configurada en el servidor (falta GEMINI_API_KEY).' }); return; }
    let body;
    try {
      body = JSON.parse(await readBody(req, (MAX_MB + 1) * 1024 * 1024));
    } catch (e) {
      if (e?.code === 'TOO_LARGE') { send(res, 413, { ok: false, code: 'IMAGE_TOO_LARGE', message: `Imagen demasiado grande (máximo ${MAX_MB} MB).` }); return; }
      send(res, 400, { ok: false, code: 'BAD_REQUEST', message: 'Solicitud inválida.' }); return;
    }
    const valid = validateMeasureBody(body, MAX_MB);
    if (!valid.ok) { send(res, valid.status, { ok: false, code: valid.code, message: valid.message }); return; }
    try {
      const detection = await analyzeTwoStages(valid.image, valid.mimeType, CFG);
      // La talla NO se calcula aquí: el frontend usa ringCalculator.js + tabla T1-T36.
      send(res, 200, { ok: true, detection });
    } catch (e) {
      const m = mapMeasureError(e);
      send(res, m.status, { ok: false, code: m.code, message: m.message }); return;
    }
    return;
  }
  send(res, 404, { ok: false, code: 'NOT_FOUND', message: 'Ruta no encontrada.' });
});

server.listen(PORT, () => console.log(`[beta] proxy en http://localhost:${PORT} (modelo ${MODEL}, clave ${API_KEY ? 'configurada' : 'AUSENTE'})`));
