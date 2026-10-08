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
    // Presupuesto global explícito: ninguna petición espera más que esto.
    // (Se respeta el antiguo BETA_TIMEOUT_MS si existe.)
    totalTimeoutMs: Number(env.BETA_TOTAL_TIMEOUT_MS || env.BETA_TIMEOUT_MS || 55000),
    // Timeout independiente por etapa e intento (NO se aumentó el global para "tapar" el problema).
    stageTimeoutMs: Number(env.BETA_STAGE_TIMEOUT_MS || 25000),
    // Como máximo UN reintento por etapa, solo transitorios.
    maxRetries: 1,
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

/** Log de instrumentación: tiempos por etapa, sin secretos ni imágenes. */
function errTag(e) {
  if (typeof e?.code === 'string') return e.code;
  if (typeof e?.status === 'number') return e.status;
  return e?.name || 'error';
}
function tlog(event, extra = {}) {
  const parts = Object.entries(extra).map(([k, v]) => `${k}=${v}`);
  console.log(`[beta:measure] ${event}${parts.length ? ' ' + parts.join(' ') : ''}`);
}

function isTransient(e) {
  if (e?.name === 'AbortError') return true;
  if (e?.status === 429) return true;
  if (typeof e?.status === 'number' && e.status >= 500) return true;
  return false;
}

async function callStageOnce(imageB64, mimeType, prompt, schema, cfg, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
  const r = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
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
}

/**
 * Una etapa con timeout propio y COMO MÁXIMO un reintento solo ante errores
 * transitorios (timeout, 429, 5xx). Los funcionales (4xx, JSON inválido,
 * forma inválida) no se reintentan.
 */
async function callStageWithRetry(tag, imageB64, mimeType, prompt, schema, cfg, globalSignal) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    if (globalSignal.aborted) {
      const err = new Error('global-budget');
      err.name = 'AbortError';
      throw err;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.stageTimeoutMs);
    const combined = globalSignal.aborted
      ? ctrl.signal
      : AbortSignal.any([ctrl.signal, globalSignal]);
    const t0 = Date.now();
    tlog('stage-start', { stage: tag, attempt });
    try {
      const out = await callStageOnce(imageB64, mimeType, prompt, schema, cfg, combined);
      tlog('stage-end', { stage: tag, attempt, ms: Date.now() - t0, result: 'ok' });
      return out;
    } catch (e) {
      tlog('stage-end', { stage: tag, attempt, ms: Date.now() - t0, result: errTag(e) });
      const canRetry = attempt <= cfg.maxRetries && isTransient(e) && !globalSignal.aborted;
      if (!canRetry) throw e;
      tlog('stage-retry', { stage: tag, nextAttempt: attempt + 1, cause: e?.status || e?.name });
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Dos etapas enfocadas; combina en una detección. La talla NUNCA se calcula aquí.
 *
 * Las etapas son INDEPENDIENTES (cada una usa solo la imagen + su propio
 * prompt/esquema), por lo que se ejecutan en paralelo: el total tiende a
 * max(etapa1, etapa2) en lugar de la suma.
 */
export async function analyzeTwoStages(imageB64, mimeType, cfg) {
  const t0 = Date.now();
  tlog('request-start', { model: cfg.model, mime: mimeType, bytes: imageB64.length });
  const globalCtrl = new AbortController();
  const globalTimer = setTimeout(() => globalCtrl.abort(), cfg.totalTimeoutMs);
  try {
    const [ruler, ring] = await Promise.all([
      callStageWithRetry('ruler', imageB64, mimeType, PROMPT_RULER, SCHEMA_RULER, cfg, globalCtrl.signal),
      callStageWithRetry('ring', imageB64, mimeType, PROMPT_RING, SCHEMA_RING, cfg, globalCtrl.signal),
    ]);
    if (typeof ruler?.detected !== 'boolean' || typeof ring?.detected !== 'boolean') {
      const err = new Error('bad-shape');
      err.status = 502;
      err.code = 'INVALID_AI_RESPONSE';
      throw err;
    }
    const qualities = [ruler.quality, ring.quality].filter(Boolean);
    const worst = qualities.includes('poor') ? 'poor' : qualities.includes('fair') ? 'fair' : 'good';
    const confs = [ruler.confidence, ring.confidence].filter((v) => typeof v === 'number');
    tlog('combine', { ms: Date.now() - t0 });
    const out = {
      detected: ruler.detected && ring.detected,
      quality: worst,
      ring: ring.ring || {},
      reference: ruler.reference || { type: 'unknown', tick_points: [] },
      confidence: confs.length ? Math.min(...confs) : null,
      warnings: [...(ruler.warnings || []), ...(ring.warnings || [])],
      stages: { ruler: ruler.detected, ring: ring.detected },
    };
    tlog('request-end', { ms: Date.now() - t0, result: 'ok' });
    return out;
  } catch (e) {
    tlog('request-end', { ms: Date.now() - t0, result: errTag(e) });
    throw e;
  } finally {
    clearTimeout(globalTimer);
  }
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
