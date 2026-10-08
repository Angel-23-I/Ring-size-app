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

const PORT = Number(process.env.PORT || 3001);
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MAX_MB = Number(process.env.BETA_MAX_MB || 6);
const TIMEOUT_MS = Number(process.env.BETA_TIMEOUT_MS || 45000);

const PROMPT_RULER = `You are a vision assistant. Look ONLY at the ruler in this photo. Ignore any ring.
List every clearly legible printed number on the ruler together with the position of its tick mark.
Coordinates are normalized 0-1000, origin top-left (x right, y down).
If NO printed numbers are legible, return an empty tick_points array and explain why in warnings.
NEVER guess a number that you cannot read. NEVER return any ring size.
Return EXACTLY this JSON and nothing else:
{"detected": true|false (a ruler with legible numbers is visible),
 "quality": "good"|"fair"|"poor",
 "reference": {"type": "ruler"|"unknown",
   "tick_points": [{"x": <0-1000>, "y": <0-1000>, "mm": <printed number>}...]},
 "confidence": <0-1 about this visual detection only>,
 "warnings": ["short text per problem: blur, glare, cropped ruler, tilted ruler, unreadable numbers, etc."]}`;

const PROMPT_RING = `You are a vision assistant. Look ONLY at the ring's inner opening (the hole) in this photo. Ignore any ruler.
Mark the FOUR extreme points of the inner edge: leftmost, rightmost, topmost, bottommost.
Also give the bounding box of the inner opening as [ymin,xmin,ymax,xmax].
All coordinates normalized 0-1000, origin top-left (x right, y down).
If the inner opening is not clearly visible, return empty points and explain why in warnings.
NEVER guess coordinates. NEVER calculate or return any ring size (no USA/EU/UK/JP).
Return EXACTLY this JSON and nothing else:
{"detected": true|false (the inner opening is clearly visible),
 "quality": "good"|"fair"|"poor",
 "ring": {"inner_box_2d": [ymin,xmin,ymax,xmax] integers or null,
   "inner_edge_points": {"left": {"x":..,"y":..}, "right": {"x":..,"y":..}, "top": {"x":..,"y":..}, "bottom": {"x":..,"y":..}} or null},
 "confidence": <0-1 about this visual detection only>,
 "warnings": ["short text per problem: blur, glare, tilt, cropped ring, reflections, etc."]}`;

const SCHEMA_RULER = {
  type: 'object',
  properties: {
    detected: { type: 'boolean' },
    quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    reference: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        tick_points: {
          type: 'array',
          items: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' }, mm: { type: 'number' } },
            required: ['x', 'y', 'mm'],
          },
        },
      },
      required: ['type', 'tick_points'],
    },
    confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['detected', 'quality', 'reference', 'confidence', 'warnings'],
};

const SCHEMA_RING = {
  type: 'object',
  properties: {
    detected: { type: 'boolean' },
    quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    ring: {
      type: 'object',
      properties: {
        inner_box_2d: { type: 'array', items: { type: 'integer' } },
        inner_edge_points: {
          type: 'object',
          properties: {
            left: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
            right: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
            top: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
            bottom: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
          },
          required: ['left', 'right', 'top', 'bottom'],
        },
      },
    },
    confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['detected', 'quality', 'confidence', 'warnings'],
};

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
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

async function callStage(imageB64, mimeType, prompt, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageB64 } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 2048, temperature: 0 },
      }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error(`gemini-${r.status}`);
      err.status = r.status;
      err.detail = data?.error?.message || '';
      throw err;
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    try {
      return JSON.parse(text);
    } catch {
      const err = new Error('bad-json');
      err.status = 502;
      err.code = 'INVALID_AI_JSON';
      throw err;
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * Estrategia en 2 etapas enfocadas (Alpha 2): cada llamada pide UNA sola cosa
 * para maximizar el cumplimiento del esquema. La talla NO se calcula aquí.
 */
async function analyzeTwoStages(imageB64, mimeType) {
  const ruler = await callStage(imageB64, mimeType, PROMPT_RULER, SCHEMA_RULER);
  const ring = await callStage(imageB64, mimeType, PROMPT_RING, SCHEMA_RING);
  if (typeof ruler?.detected !== 'boolean' || typeof ring?.detected !== 'boolean') {
    const err = new Error('bad-shape');
    err.status = 502;
    err.code = 'INVALID_AI_RESPONSE';
    throw err;
  }
  const qualities = [ruler.quality, ring.quality].filter(Boolean);
  const worst = qualities.includes('poor') ? 'poor' : qualities.includes('fair') ? 'fair' : 'good';
  const confs = [ruler.confidence, ring.confidence].filter((v) => typeof v === 'number');
  return {
    detected: ruler.detected && ring.detected,
    quality: worst,
    ring: ring.ring || {},
    reference: ruler.reference || { type: 'unknown', tick_points: [] },
    confidence: confs.length ? Math.min(...confs) : null,
    warnings: [...(ruler.warnings || []), ...(ring.warnings || [])],
    stages: { ruler: ruler.detected, ring: ring.detected },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/beta/health') {
    send(res, 200, { ok: true, beta: 'camera-measure', model: MODEL, keyConfigured: Boolean(API_KEY), maxMb: MAX_MB });
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
    const { image = '', mimeType = '' } = body || {};
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (typeof image !== 'string' || !image) { send(res, 400, { ok: false, code: 'NO_IMAGE', message: 'No se recibió ninguna imagen.' }); return; }
    if (!allowed.includes(mimeType)) { send(res, 415, { ok: false, code: 'UNSUPPORTED_TYPE', message: 'Formato no soportado. Usa JPG, PNG o WebP.' }); return; }
    const approxBytes = Math.floor(image.length * 0.75);
    if (approxBytes > MAX_MB * 1024 * 1024) { send(res, 413, { ok: false, code: 'IMAGE_TOO_LARGE', message: `Imagen demasiado grande (máximo ${MAX_MB} MB).` }); return; }
    try {
      const detection = await analyzeTwoStages(image, mimeType);
      // La talla NO se calcula aquí: el frontend usa ringCalculator.js + tabla T1-T36.
      send(res, 200, { ok: true, detection });
    } catch (e) {
      if (e?.code === 'INVALID_AI_JSON') { send(res, 502, { ok: false, code: 'INVALID_AI_JSON', message: 'Respuesta de IA no válida. Intenta de nuevo.' }); return; }
      if (e?.code === 'INVALID_AI_RESPONSE') { send(res, 502, { ok: false, code: 'INVALID_AI_RESPONSE', message: 'Respuesta de IA incompleta. Intenta de nuevo.' }); return; }
      if (e?.name === 'AbortError') { send(res, 504, { ok: false, code: 'TIMEOUT', message: 'El análisis tardó demasiado. Intenta de nuevo.' }); return; }
      if (e?.status === 429) { send(res, 429, { ok: false, code: 'RATE_LIMIT', message: 'Límite de solicitudes alcanzado. Espera e intenta de nuevo.' }); return; }
      if (e?.status === 400) { send(res, 502, { ok: false, code: 'AI_REJECTED', message: 'La IA no pudo procesar la imagen. Prueba con otra foto.' }); return; }
      if (e?.status === 401 || e?.status === 403) { send(res, 503, { ok: false, code: 'AI_AUTH', message: 'Beta temporalmente no disponible.' }); return; }
      send(res, 502, { ok: false, code: 'AI_ERROR', message: 'Error al analizar la imagen. Intenta de nuevo.' }); return;
    }
    return;
  }
  send(res, 404, { ok: false, code: 'NOT_FOUND', message: 'Ruta no encontrada.' });
});

server.listen(PORT, () => console.log(`[beta] proxy en http://localhost:${PORT} (modelo ${MODEL}, clave ${API_KEY ? 'configurada' : 'AUSENTE'})`));
