/**
 * RingSize · Módulo BETA — Pipeline compartido de medición con Gemini.
 * Lógica pura (sin HTTP ni dotenv): la usan tanto `server/beta-proxy.mjs`
 * (desarrollo local) como `api/measure.js` (Vercel serverless).
 * Gemini es SOLO asistente de visión: jamás devuelve una talla.
 */

export function getBetaConfig(env = process.env) {
  return {
    apiKey: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    maxMb: Number(env.BETA_MAX_MB || 6),
    timeoutMs: Number(env.BETA_TIMEOUT_MS || 45000),
    corsOrigins: (env.BETA_CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export const PROMPT_RULER = `You are a vision assistant. Look ONLY at the ruler in this photo. Ignore any ring.
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

export const PROMPT_RING = `You are a vision assistant. Look ONLY at the ring's inner opening (the hole) in this photo. Ignore any ruler.
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

export const SCHEMA_RULER = {
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

export const SCHEMA_RING = {
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

/** Valida el cuerpo de la petición. Retorna datos o un error mapeado. */
export function validateMeasureBody(body, maxMb) {
  const fail = (status, code, message) => ({ ok: false, status, code, message });
  const { image = '', mimeType = '' } = body || {};
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (typeof image !== 'string' || !image) return fail(400, 'NO_IMAGE', 'No se recibió ninguna imagen.');
  if (!allowed.includes(mimeType)) return fail(415, 'UNSUPPORTED_TYPE', 'Formato no soportado. Usa JPG, PNG o WebP.');
  if (Math.floor(image.length * 0.75) > maxMb * 1024 * 1024) {
    return fail(413, 'IMAGE_TOO_LARGE', `Imagen demasiado grande (máximo ${maxMb} MB).`);
  }
  return { ok: true, image, mimeType };
}

async function callStage(imageB64, mimeType, prompt, schema, { apiKey, model, timeoutMs }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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

/** Dos etapas enfocadas; combina en una detección. La talla NUNCA se calcula aquí. */
export async function analyzeTwoStages(imageB64, mimeType, cfg) {
  const ruler = await callStage(imageB64, mimeType, PROMPT_RULER, SCHEMA_RULER, cfg);
  const ring = await callStage(imageB64, mimeType, PROMPT_RING, SCHEMA_RING, cfg);
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

/** Mapea errores del pipeline a {status, code, message} para el cliente. */
export function mapMeasureError(e) {
  if (e?.code === 'INVALID_AI_JSON') return { status: 502, code: 'INVALID_AI_JSON', message: 'Respuesta de IA no válida. Intenta de nuevo.' };
  if (e?.code === 'INVALID_AI_RESPONSE') return { status: 502, code: 'INVALID_AI_RESPONSE', message: 'Respuesta de IA incompleta. Intenta de nuevo.' };
  if (e?.name === 'AbortError') return { status: 504, code: 'TIMEOUT', message: 'El análisis tardó demasiado. Intenta de nuevo.' };
  if (e?.status === 429) return { status: 429, code: 'RATE_LIMIT', message: 'Límite de solicitudes alcanzado. Espera e intenta de nuevo.' };
  if (e?.status === 400) return { status: 502, code: 'AI_REJECTED', message: 'La IA no pudo procesar la imagen. Prueba con otra foto.' };
  if (e?.status === 401 || e?.status === 403) return { status: 503, code: 'AI_AUTH', message: 'Beta temporalmente no disponible.' };
  return { status: 502, code: 'AI_ERROR', message: 'Error al analizar la imagen. Intenta de nuevo.' };
}

/** Headers CORS restrictivos (sin '*') para un origen dado. */
export function corsHeadersFor(origin, origins) {
  const h = { Vary: 'Origin' };
  if (origin && origins.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
