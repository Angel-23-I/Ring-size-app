/**
 * RingSize · UDES — Tabla maestra T1-T36 (FUENTE ÚNICA Y OFICIAL).
 *
 * Fuente: tabla oficial entregada en la corrección bloqueante de Etapa 2.
 * Reemplaza completamente cualquier tabla anterior. Únicamente contiene
 * código de talla, diámetro en mm y equivalencia USA. Sin otras escalas
 * y sin conversiones físicas como funcionalidad de usuario.
 * Los valores USA (2.5, 3.75, etc.) son representación numérica interna;
 * la interfaz puede mostrarlos de forma amigable sin modificar el valor.
 */

export const RING_SIZES = Object.freeze([
  { code: 'T1', diameter: 13.0, usa: '1' },
  { code: 'T2', diameter: 13.4, usa: '2' },
  { code: 'T3', diameter: 13.7, usa: '2.5' },
  { code: 'T4', diameter: 14.0, usa: '3' },
  { code: 'T5', diameter: 14.3, usa: '3.5' },
  { code: 'T6', diameter: 14.6, usa: '3.75' },
  { code: 'T7', diameter: 15.0, usa: '4' },
  { code: 'T8', diameter: 15.3, usa: '4.5' },
  { code: 'T9', diameter: 15.6, usa: '5' },
  { code: 'T10', diameter: 15.9, usa: '5.5' },
  { code: 'T11', diameter: 16.2, usa: '5.75' },
  { code: 'T12', diameter: 16.5, usa: '6' },
  { code: 'T13', diameter: 16.8, usa: '6.5' },
  { code: 'T14', diameter: 17.2, usa: '7' },
  { code: 'T15', diameter: 17.5, usa: '7.5' },
  { code: 'T16', diameter: 17.8, usa: '7.75' },
  { code: 'T17', diameter: 18.1, usa: '8' },
  { code: 'T18', diameter: 18.4, usa: '8.5' },
  { code: 'T19', diameter: 18.8, usa: '8.75' },
  { code: 'T20', diameter: 19.1, usa: '9' },
  { code: 'T21', diameter: 19.4, usa: '9.5' },
  { code: 'T22', diameter: 19.7, usa: '10' },
  { code: 'T23', diameter: 20.0, usa: '10.5' },
  { code: 'T24', diameter: 20.3, usa: '10.75' },
  { code: 'T25', diameter: 20.6, usa: '11' },
  { code: 'T26', diameter: 21.0, usa: '11.5' },
  { code: 'T27', diameter: 21.3, usa: '12' },
  { code: 'T28', diameter: 21.6, usa: '12.5' },
  { code: 'T29', diameter: 22.0, usa: '12.75' },
  { code: 'T30', diameter: 22.3, usa: '13' },
  { code: 'T31', diameter: 22.6, usa: '13.5' },
  { code: 'T32', diameter: 22.9, usa: '13.75' },
  { code: 'T33', diameter: 23.2, usa: '14' },
  { code: 'T34', diameter: 23.5, usa: '14.5' },
  { code: 'T35', diameter: 23.9, usa: '15' },
  { code: 'T36', diameter: 24.2, usa: '15.5' },
]);

export const MIN_DIAMETER = RING_SIZES[0].diameter;
export const MAX_DIAMETER = RING_SIZES[RING_SIZES.length - 1].diameter;

/** Tolerancia para coincidencia exacta (evita errores de representación decimal). */
export const EXACT_TOLERANCE = 0.009;
