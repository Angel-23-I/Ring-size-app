/**
 * RingSize · UDES — Lógica de negocio pura (RN-01..RN-08).
 * Sin dependencias de UI. Funciones puras y testeables.
 * Unidad exclusiva: milímetros (RN-07). Tallas en mayúsculas T1..T36 (RN-08).
 */
import { RING_SIZES, MIN_DIAMETER, MAX_DIAMETER, EXACT_TOLERANCE } from '../data/ringSizes.js';

/** Convierte coma decimal a punto y recorta espacios (RN-06). */
export function normalizeInput(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(',', '.');
}

/** Valida formato numérico: positivo, máximo 2 decimales (RN-06). */
export function validateFormat(normalized) {
  if (normalized === '') {
    return { ok: false, error: 'Ingresa el diámetro interno en milímetros.' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return {
      ok: false,
      error: 'Valor inválido. Usa solo números positivos con máximo 2 decimales (ej.: 18.10 o 18,10).',
    };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Ingresa un valor numérico válido.' };
  }
  if (value <= 0) {
    return { ok: false, error: 'El diámetro debe ser mayor que 0 mm.' };
  }
  return { ok: true, value };
}

/** Verifica si está dentro del rango T1..T36 (RN-05). */
export function isInRange(value) {
  return value >= MIN_DIAMETER - EXACT_TOLERANCE && value <= MAX_DIAMETER + EXACT_TOLERANCE;
}

/** Busca coincidencia exacta con tolerancia (RN-03). */
export function findExact(value) {
  return RING_SIZES.find((r) => Math.abs(r.diameter - value) <= EXACT_TOLERANCE) || null;
}

/**
 * Talla inmediatamente superior para valores intermedios (RN-04).
 * Retorna el primer registro con diámetro >= valor.
 */
export function findUpper(value) {
  return RING_SIZES.find((r) => r.diameter + EXACT_TOLERANCE >= value) || null;
}

/** Validación completa del diámetro crudo. Retorna { ok, value, error }. */
export function validateDiameter(raw) {
  const normalized = normalizeInput(raw);
  const fmt = validateFormat(normalized);
  if (!fmt.ok) return fmt;
  const { value } = fmt;
  if (value < MIN_DIAMETER - EXACT_TOLERANCE) {
    return {
      ok: false,
      error: `Valor inferior a T1. El mínimo es ${MIN_DIAMETER.toFixed(2)} mm.`,
    };
  }
  if (value > MAX_DIAMETER + EXACT_TOLERANCE) {
    return {
      ok: false,
      error: `Valor superior a T36. El máximo es ${MAX_DIAMETER.toFixed(2)} mm.`,
    };
  }
  return { ok: true, value };
}

/**
 * Cálculo principal. Retorna resultado estructurado:
 * { ok, type: 'exacta'|'aproximada', input, size, referenceDiameter, usa }
 * o { ok: false, error, input } si fuera de rango / inválido (RN-05).
 */
export function calculateSize(raw) {
  const normalized = normalizeInput(raw);
  const validation = validateDiameter(raw);
  if (!validation.ok) {
    return { ok: false, error: validation.error, input: normalized };
  }
  const value = validation.value;

  const exact = findExact(value);
  if (exact) {
    return {
      ok: true,
      type: 'exacta',
      input: value,
      size: exact.code,
      referenceDiameter: exact.diameter,
      usa: exact.usa,
    };
  }

  const upper = findUpper(value);
  if (!upper) {
    return {
      ok: false,
      error: `Sin talla asignable para ${value.toFixed(2)} mm.`,
      input: normalized,
    };
  }
  return {
    ok: true,
    type: 'aproximada',
    input: value,
    size: upper.code,
    referenceDiameter: upper.diameter,
    usa: upper.usa,
  };
}
