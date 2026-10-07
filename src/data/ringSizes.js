/**
 * RingSize · UDES — Tabla maestra T1-T36.
 *
 * ÚNICA fuente de datos de tallas (RN-01). Colección inmutable.
 * Cada registro: { code: 'T1'..'T36', diameter: mm, usa: equivalencia USA }.
 *
 * ADVERTENCIA DE VERIFICACIÓN (Etapa 2, punto 2 y punto 4):
 * La tabla T1-T36 del material del examen es la ÚNICA fuente de verdad.
 * Los 21 diámetros ancla (14.0–22.2 mm con su USA) provienen de la tabla
 * previa del proyecto. Los 15 valores intermedios son puntos medios
 * provisionales para completar 36 registros con la estructura exigida
 * (orden ascendente, sin duplicados, USA del registro superior).
 * EL ESTUDIANTE DEBE contrastar los 36 registros contra el PDF del examen
 * y corregir este archivo antes de la entrega final. No entregar sin verificar.
 */

export const RING_SIZES = Object.freeze([
  { code: 'T1', diameter: 14.0, usa: '3' },
  { code: 'T2', diameter: 14.2, usa: '3.5' },
  { code: 'T3', diameter: 14.4, usa: '3.5' },
  { code: 'T4', diameter: 14.65, usa: '4' },
  { code: 'T5', diameter: 14.9, usa: '4' },
  { code: 'T6', diameter: 15.1, usa: '4.5' },
  { code: 'T7', diameter: 15.3, usa: '4.5' },
  { code: 'T8', diameter: 15.5, usa: '5' },
  { code: 'T9', diameter: 15.7, usa: '5' },
  { code: 'T10', diameter: 15.9, usa: '5.5' },
  { code: 'T11', diameter: 16.1, usa: '5.5' },
  { code: 'T12', diameter: 16.3, usa: '6' },
  { code: 'T13', diameter: 16.5, usa: '6' },
  { code: 'T14', diameter: 16.7, usa: '6.5' },
  { code: 'T15', diameter: 16.9, usa: '6.5' },
  { code: 'T16', diameter: 17.1, usa: '7' },
  { code: 'T17', diameter: 17.3, usa: '7' },
  { code: 'T18', diameter: 17.5, usa: '7.5' },
  { code: 'T19', diameter: 17.7, usa: '7.5' },
  { code: 'T20', diameter: 17.9, usa: '8' },
  { code: 'T21', diameter: 18.1, usa: '8' },
  { code: 'T22', diameter: 18.3, usa: '8.5' },
  { code: 'T23', diameter: 18.5, usa: '8.5' },
  { code: 'T24', diameter: 18.75, usa: '9' },
  { code: 'T25', diameter: 19.0, usa: '9' },
  { code: 'T26', diameter: 19.2, usa: '9.5' },
  { code: 'T27', diameter: 19.4, usa: '9.5' },
  { code: 'T28', diameter: 19.6, usa: '10' },
  { code: 'T29', diameter: 19.8, usa: '10' },
  { code: 'T30', diameter: 20.0, usa: '10.5' },
  { code: 'T31', diameter: 20.2, usa: '10.5' },
  { code: 'T32', diameter: 20.6, usa: '11' },
  { code: 'T33', diameter: 21.0, usa: '11.5' },
  { code: 'T34', diameter: 21.4, usa: '12' },
  { code: 'T35', diameter: 21.8, usa: '12.5' },
  { code: 'T36', diameter: 22.2, usa: '13' },
]);

export const MIN_DIAMETER = RING_SIZES[0].diameter;
export const MAX_DIAMETER = RING_SIZES[RING_SIZES.length - 1].diameter;

/** Tolerancia para coincidencia exacta (evita errores de representación decimal). */
export const EXACT_TOLERANCE = 0.009;
