/**
 * RingSize · Módulo BETA — Cliente del proxy seguro (sin API key en el frontend).
 * Envía la foto al proxy local (server/beta-proxy.mjs) y recibe SOLO detección
 * estructurada. La talla se calcula después con ringCalculator.js + tabla T1-T36.
 */

const API_URL = ((import.meta.env && import.meta.env.VITE_BETA_API_URL) || 'http://localhost:3001').replace(/\/$/, '');

const FRIENDLY = {
  NO_IMAGE: 'No se recibió ninguna imagen. Selecciona una foto e intenta de nuevo.',
  UNSUPPORTED_TYPE: 'Formato no soportado. Usa JPG, PNG o WebP.',
  IMAGE_TOO_LARGE: 'La imagen es demasiado grande. Prueba con una foto más liviana.',
  NO_API_KEY: 'La función Beta no está configurada en este equipo (falta la clave del servidor).',
  RATE_LIMIT: 'Límite de solicitudes alcanzado. Espera unos minutos e intenta de nuevo.',
  TIMEOUT: 'El análisis tardó demasiado. Revisa tu conexión e intenta de nuevo.',
  AI_REJECTED: 'La IA no pudo procesar la imagen. Prueba con otra foto.',
  AI_AUTH: 'La función Beta no está disponible por el momento.',
  INVALID_AI_JSON: 'Respuesta de IA no válida. Intenta de nuevo.',
  INVALID_AI_RESPONSE: 'Respuesta de IA incompleta. Intenta de nuevo.',
  AI_ERROR: 'Error al analizar la imagen. Intenta de nuevo.',
  BAD_REQUEST: 'Solicitud inválida.',
  NOT_FOUND: 'Servicio Beta no encontrado. Inicia el servidor con `npm run beta:server`.',
};

export async function analyzeImage({ dataUrl, signal } = {}) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw Object.assign(new Error('NO_IMAGE'), { code: 'NO_IMAGE' });
  }
  const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) {
    const e = new Error('UNSUPPORTED_TYPE');
    e.code = 'UNSUPPORTED_TYPE';
    throw e;
  }
  let res;
  try {
    res = await fetch(`${API_URL}/api/measure`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: m[3], mimeType: m[1] }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    const err = new Error('NETWORK');
    err.code = 'NETWORK';
    err.userMessage = 'No se pudo contactar el servicio Beta. Verifica que el servidor esté en marcha (`npm run beta:server`).';
    throw err;
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    const code = payload?.code || `HTTP_${res.status}`;
    const err = new Error(code);
    err.code = code;
    err.userMessage = payload?.message || FRIENDLY[code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
    err.status = res.status;
    throw err;
  }
  return payload.detection;
}

export async function checkBetaHealth() {
  try {
    const res = await fetch(`${API_URL}/api/beta/health`);
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
