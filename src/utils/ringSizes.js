/**
 * RingSize · UDES — Lógica de conversión diámetro (mm) → talla.
 *
 * Fuente tabla: estándares internacionales ISO 8653 (circunferencia),
 * BS EN 28653 (UK) y tablas de joyería US/CA, EU, JP.
 * - Diámetro interno (mm) medido de borde a borde interior.
 * - Circunferencia (mm) = diámetro × π
 * - Talla Europea (EU) = circunferencia redondeada al entero.
 * - US / UK / JP según tabla de equivalencias.
 */

/** Tabla base ordenada por diámetro. */
export const RING_TABLE = [
  { diametro: 14.0, us: '3',   uk: 'F', eu: '44', jp: '4'  },
  { diametro: 14.4, us: '3.5', uk: 'G', eu: '45', jp: '5'  },
  { diametro: 14.9, us: '4',   uk: 'H', eu: '47', jp: '7'  },
  { diametro: 15.3, us: '4.5', uk: 'I', eu: '48', jp: '8'  },
  { diametro: 15.7, us: '5',   uk: 'J', eu: '49', jp: '9'  },
  { diametro: 16.1, us: '5.5', uk: 'K', eu: '51', jp: '10' },
  { diametro: 16.5, us: '6',   uk: 'L', eu: '52', jp: '11' },
  { diametro: 16.9, us: '6.5', uk: 'M', eu: '53', jp: '12' },
  { diametro: 17.3, us: '7',   uk: 'N', eu: '54', jp: '14' },
  { diametro: 17.7, us: '7.5', uk: 'O', eu: '56', jp: '15' },
  { diametro: 18.1, us: '8',   uk: 'P', eu: '57', jp: '16' },
  { diametro: 18.5, us: '8.5', uk: 'Q', eu: '58', jp: '17' },
  { diametro: 19.0, us: '9',   uk: 'R', eu: '60', jp: '18' },
  { diametro: 19.4, us: '9.5', uk: 'S', eu: '61', jp: '19' },
  { diametro: 19.8, us: '10',  uk: 'T', eu: '62', jp: '20' },
  { diametro: 20.2, us: '10.5', uk: 'U', eu: '63', jp: '22' },
  { diametro: 20.6, us: '11',  uk: 'V', eu: '65', jp: '23' },
  { diametro: 21.0, us: '11.5', uk: 'W', eu: '66', jp: '24' },
  { diametro: 21.4, us: '12',  uk: 'X', eu: '67', jp: '25' },
  { diametro: 21.8, us: '12.5', uk: 'Y', eu: '68', jp: '26' },
  { diametro: 22.2, us: '13',  uk: 'Z', eu: '70', jp: '27' },
];

export const MIN_DIAMETRO = 13.0;
export const MAX_DIAMETRO = 23.5;

/** Circunferencia a partir del diámetro. */
export function circunferencia(diametro) {
  return diametro * Math.PI;
}

/** Valida el diámetro. Retorna mensaje de error o null si es válido. */
export function validarDiametro(valor) {
  if (valor === '' || valor === null || Number.isNaN(Number(valor))) {
    return 'Ingresa un valor numérico en milímetros (Ej: 17.3).';
  }
  const d = Number(valor);
  if (!Number.isFinite(d)) {
    return 'Ingresa un valor numérico válido.';
  }
  if (d < MIN_DIAMETRO || d > MAX_DIAMETRO) {
    return `Fuera de rango: ingresa un diámetro entre ${MIN_DIAMETRO.toFixed(1)} y ${MAX_DIAMETRO.toFixed(1)} mm.`;
  }
  return null;
}

/**
 * Busca la talla más cercana al diámetro ingresado.
 * Retorna { entrada, diferencia, exacta, circunferencia, euCalculada }
 */
export function buscarTalla(diametroInput) {
  const d = Number(diametroInput);
  let mejor = RING_TABLE[0];
  let menorDiff = Math.abs(d - mejor.diametro);

  for (const row of RING_TABLE) {
    const diff = Math.abs(d - row.diametro);
    if (diff < menorDiff) {
      menorDiff = diff;
      mejor = row;
    }
  }

  const exacta = menorDiff <= 0.15;
  const circ = circunferencia(d);
  const euCalculada = String(Math.round(circ));

  return {
    entrada: mejor,
    diferencia: menorDiff,
    exacta,
    circunferencia: circ,
    euCalculada,
    diametroIngresado: d,
  };
}
