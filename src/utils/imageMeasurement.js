/**
 * RingSize · Módulo BETA — Geometría píxeles → milímetros (funciones puras).
 * NO decide tallas: devuelve un diámetro en mm que el llamador pasa a
 * src/utils/ringCalculator.js (única vía para obtener una talla T1-T36).
 * Coordenadas de la IA en espacio normalizado 0-1000 (origen arriba-izquierda).
 */

export const UNRELIABLE_MESSAGE =
  'No fue posible realizar una medición confiable. Intenta tomar la fotografía desde arriba, con buena iluminación y colocando el anillo junto a una regla.';

export const BLURRY_MESSAGE =
  'No fue posible realizar una estimación confiable porque la fotografía no tiene suficiente nitidez.';

/**
 * Nitidez determinística: varianza del Laplaciano sobre grises (0-255).
 * Heurística calibrada con fotos sintéticas de control (nítidas ≈ 500-2600,
 * borrosa de control ≈ 106). Umbral 200 con margen ~2x en ambos lados.
 * NO es una medida científica de precisión; solo decide nítida/borrosa.
 * Las fotos reales deberán recalibrarlo (documentado como limitación).
 */
export const SHARPNESS_THRESHOLD = 200;

export function laplacianVariance(gray, w, h) {
  let n = 0, mean = 0, m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = gray[(y - 1) * w + x] + gray[y * w + x - 1] - 4 * gray[y * w + x] + gray[y * w + x + 1] + gray[(y + 1) * w + x];
      n++;
      const d = v - mean;
      mean += d / n;
      m2 += d * (v - mean);
    }
  }
  return n > 0 ? m2 / n : 0;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function denorm(p, w, h) {
  return { x: (p.x / 1000) * w, y: (p.y / 1000) * h };
}

function inRange(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000;
}

/** Diámetro del hueco interior en píxeles.
 * Estrategia Alpha 2: 4 puntos extremos (izq/der/arriba/abajo) + coherencia con la caja.
 * Respaldo: par de puntos opuestos o promedio de la caja (con advertencia).
 * Retorna {px, method, horizontalPx, verticalPx} o null.
 */
export function innerDiameterPx(detection, imgW, imgH) {
  const edge = detection?.ring?.inner_edge_points;
  if (edge && ['left', 'right', 'top', 'bottom'].every((k) => inRange(edge[k]?.x) && inRange(edge[k]?.y))) {
    const L = denorm(edge.left, imgW, imgH);
    const R = denorm(edge.right, imgW, imgH);
    const T = denorm(edge.top, imgW, imgH);
    const B = denorm(edge.bottom, imgW, imgH);
    const dh = dist(L, R);
    const dv = dist(T, B);
    if (dh > 0 && dv > 0) return { px: (dh + dv) / 2, method: '4-points', horizontalPx: dh, verticalPx: dv };
  }
  const pts = detection?.ring?.inner_diameter_points;
  if (Array.isArray(pts) && pts.length >= 2 && pts.slice(0, 2).every((p) => inRange(p?.x) && inRange(p?.y))) {
    const [a, b] = pts.slice(0, 2).map((p) => denorm(p, imgW, imgH));
    const d = dist(a, b);
    if (d > 0) return { px: d, method: 'points', horizontalPx: d, verticalPx: null };
  }
  const box = detection?.ring?.inner_box_2d;
  if (Array.isArray(box) && box.length === 4 && box.every((v) => typeof v === 'number')) {
    const [ymin, xmin, ymax, xmax] = box;
    const wpx = ((xmax - xmin) / 1000) * imgW;
    const hpx = ((ymax - ymin) / 1000) * imgH;
    if (wpx > 0 && hpx > 0) return { px: (wpx + hpx) / 2, method: 'box-average', horizontalPx: wpx, verticalPx: hpx };
  }
  return null;
}

/** Escala px/mm desde marcas de regla con valor en mm (mediana de pares). */
export function scaleFromTicks(detection, imgW, imgH) {
  const ticks = (detection?.reference?.tick_points || []).filter(
    (t) => inRange(t?.x) && inRange(t?.y) && typeof t?.mm === 'number' && Number.isFinite(t.mm)
  );
  if (ticks.length < 2) return null;
  const pts = ticks.map((t) => ({ ...denorm(t, imgW, imgH), mm: t.mm })).sort((a, b) => a.mm - b.mm);
  const pairs = [];
  for (let k = 0; k < pts.length; k++) {
    for (let j = k + 1; j < pts.length; j++) {
      const dmm = Math.abs(pts[j].mm - pts[k].mm);
      if (dmm < 1) continue;
      const dpx = dist(pts[k], pts[j]);
      if (dpx <= 0) continue;
      pairs.push({ pxPerMm: dpx / dmm, dmm, dpx });
    }
  }
  if (!pairs.length) return null;
  const med = median(pairs.map((p) => p.pxPerMm));
  const dev = Math.max(...pairs.map((p) => Math.abs(p.pxPerMm - med) / med));
  const spanPx = Math.max(...pairs.map((p) => p.dpx));
  return { pxPerMm: med, pairs: pairs.length, spread: dev, spanPx };
}

export function confidenceLevel(aiConfidence, quality) {
  if (typeof aiConfidence === 'number' && aiConfidence >= 0.75 && quality === 'good') return 'Alta';
  if (typeof aiConfidence === 'number' && aiConfidence >= 0.45 && quality !== 'poor') return 'Media';
  return 'Baja';
}

/**
 * Estimación completa con validación determinística (Alpha 2.2):
 * La escala SOLO proviene de una referencia confirmada por el humano
 * (options.reference: [{x,y,mm}...] en 0-1000, leída por el usuario en la foto).
 * Los tick_points de la IA son únicamente una PROPUESTA visual para el overlay
 * y JAMÁS se usan para calcular. Sin referencia confirmada:
 * {ok:false, code:'NEEDS_REFERENCE_CONFIRMATION'} — nunca una talla.
 * Validaciones: 1 coordenadas en imagen, 2 puntos suficientes, 3 distancias>0,
 * 4 ≥2 mm distintos, 5 escala>0 y tramo≥40px, 6 spread≤0.5, 7 diámetro<100,
 * 8 elipse≤0.2 y coherencia caja↔puntos≤0.5, 9 nitidez opcional ≥ umbral.
 */
export function estimateDiameterMm(detection, imgW, imgH, options = {}) {
  const warnings = [...(detection?.warnings || [])];
  if (!detection || detection.detected !== true) {
    return { ok: false, code: 'NOT_DETECTED', userMessage: UNRELIABLE_MESSAGE };
  }
  if (typeof options.sharpness === 'number' && options.sharpness < SHARPNESS_THRESHOLD) {
    return { ok: false, code: 'BLURRY', userMessage: BLURRY_MESSAGE };
  }
  if (!(imgW > 0 && imgH > 0)) {
    return { ok: false, code: 'NO_DIMS', userMessage: UNRELIABLE_MESSAGE };
  }
  // Referencia humana obligatoria: sin ella no hay escala y por tanto no hay talla.
  const ref = Array.isArray(options.reference) ? options.reference : null;
  if (!ref || ref.length < 2) {
    return {
      ok: false,
      code: 'NEEDS_REFERENCE_CONFIRMATION',
      userMessage: 'Confirma en la fotografía los valores de la regla antes de medir.',
    };
  }
  const detectionWithRef = { ...detection, reference: { ...(detection.reference || {}), tick_points: ref } };
  // 2-3. Puntos suficientes y distancias > 0.
  const dia = innerDiameterPx(detection, imgW, imgH);
  if (!dia || !(dia.px >= 20)) {
    return { ok: false, code: 'RING_UNCLEAR', userMessage: UNRELIABLE_MESSAGE };
  }
  // 4-5. Escala desde la referencia CONFIRMADA (nunca desde la propuesta de la IA).
  const scale = scaleFromTicks(detectionWithRef, imgW, imgH);
  if (!scale || !(scale.pxPerMm > 0) || !(scale.spanPx >= 40)) {
    return { ok: false, code: 'NO_SCALE', userMessage: UNRELIABLE_MESSAGE };
  }
  // 6. Consistencia entre referencias.
  if (scale.spread > 0.5) {
    return { ok: false, code: 'INCONSISTENT_SCALE', userMessage: UNRELIABLE_MESSAGE };
  }
  if (scale.spread > 0.3) warnings.push('Las marcas de la regla no son consistentes: posible perspectiva o inclinación.');
  if (scale.pairs < 2) warnings.push('Escala basada en un solo par de marcas: verifica el resultado con el calculador manual.');
  // 8a. Coherencia horizontal↔vertical (elipse = perspectiva/inclinación).
  // Herramienta orientativa: se rechaza desde 20 % (IMG-02 con 25 % daba tallas
  // claramente erróneas) y se advierte desde 10 %.
  if (dia.verticalPx != null) {
    const ell = Math.abs(dia.horizontalPx - dia.verticalPx) / dia.px;
    if (ell > 0.2) {
      return { ok: false, code: 'ELLIPSE', userMessage: UNRELIABLE_MESSAGE };
    }
    if (ell > 0.1) warnings.push('El hueco se ve ovalado: posible inclinación de cámara o anillo.');
  }
  // 8b. Coherencia caja↔puntos cuando hay ambas fuentes.
  const box = detection?.ring?.inner_box_2d;
  if (Array.isArray(box) && box.length === 4 && dia.method !== 'box-average') {
    const bw = ((box[3] - box[1]) / 1000) * imgW;
    const bh = ((box[2] - box[0]) / 1000) * imgH;
    if (bw > 0 && bh > 0) {
      const dev = Math.max(Math.abs(bw - dia.px), Math.abs(bh - dia.px)) / dia.px;
      if (dev > 0.5) {
        return { ok: false, code: 'BOX_MISMATCH', userMessage: UNRELIABLE_MESSAGE };
      }
      if (dev > 0.25) warnings.push('El recuadro y los puntos del borde no coinciden del todo.');
    }
  }
  if (dia.method !== '4-points') {
    warnings.push(
      dia.method === 'box-average'
        ? 'Diámetro aproximado desde el recuadro detectado, no desde bordes medidos.'
        : 'Diámetro desde un solo par de puntos: menos fiable que 4 extremos.'
    );
  }
  const diameterMm = Math.round((dia.px / scale.pxPerMm) * 100) / 100;
  // 7. Diámetro razonable.
  if (!(diameterMm > 0 && diameterMm < 100)) {
    return { ok: false, code: 'ABSURD', userMessage: UNRELIABLE_MESSAGE };
  }
  return {
    ok: true,
    diameterMm,
    pixelsPerMm: Math.round(scale.pxPerMm * 100) / 100,
    method: dia.method,
    referenceSource: 'human-confirmed',
    confidence: typeof detection.confidence === 'number' ? detection.confidence : null,
    level: confidenceLevel(detection.confidence, detection.quality),
    warnings,
  };
}
