import { useRef, useState } from 'react';
import ImagePreview from './ImagePreview.jsx';
import AnalysisStatus from './AnalysisStatus.jsx';
import MeasurementResult from './MeasurementResult.jsx';
import ReferenceOverlay from './ReferenceOverlay.jsx';
import { analyzeImage } from '../../services/geminiMeasurementService.js';
import { estimateDiameterMm, UNRELIABLE_MESSAGE, laplacianVariance, SHARPNESS_THRESHOLD, BLURRY_MESSAGE } from '../../utils/imageMeasurement.js';
import { calculateSize } from '../../utils/ringCalculator.js';

const MAX_FILE_MB = 6;
const MAX_SIDE = 1600;

function readDims(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Parsea un valor en mm (acepta coma decimal). Retorna número o null si inválido. */
function parseMm(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const v = Number(text);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Reduce la foto en el navegador (menos peso, sin almacenar nada) y mide su nitidez. */
function downscale(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let sharpness = null;
      try {
        const data = ctx.getImageData(0, 0, w, h).data;
        const gray = new Float64Array(w * h);
        for (let i = 0; i < w * h; i++) {
          gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
        }
        sharpness = laplacianVariance(gray, w, h);
      } catch {
        sharpness = null;
      }
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), sharpness });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('BAD_FILE'));
    };
    img.src = url;
  });
}

export default function CameraMeasure() {
  const [photo, setPhoto] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [size, setSize] = useState(null);
  // Revisión humana de la referencia (Alpha 2.2): la IA propone, el humano confirma.
  const [proposal, setProposal] = useState(null);
  const [dims, setDims] = useState(null);
  const [manual, setManual] = useState(false);
  const [points, setPoints] = useState({ A: null, B: null });
  const [mmA, setMmA] = useState('');
  const [mmB, setMmB] = useState('');
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const sharpnessRef = useRef(null);

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    sharpnessRef.current = null;
    setPhoto(null);
    setPhase('idle');
    setError(null);
    setEstimate(null);
    setSize(null);
    setProposal(null);
    setDims(null);
    setManual(false);
    setPoints({ A: null, B: null });
    setMmA('');
    setMmB('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    reset();
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`La imagen es demasiado grande (máximo ${MAX_FILE_MB} MB).`);
      return;
    }
    try {
      const { dataUrl, sharpness } = await downscale(file);
      sharpnessRef.current = sharpness;
      setPhoto(dataUrl);
    } catch {
      setError('No se pudo leer la imagen. Prueba con otra foto.');
    }
  }

  async function onAnalyze() {
    if (!photo) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('analyzing');
    setError(null);
    setEstimate(null);
    setSize(null);
    try {
      const detection = await analyzeImage({ dataUrl: photo, signal: ctrl.signal });
      const { w, h } = await readDims(photo);
      // La detección es solo PROPUESTA: la medición exige referencia confirmada.
      setProposal(detection);
      setDims({ w, h });
      setManual(false);
      setPoints({ A: null, B: null });
      setPhase('review');
    } catch (e) {
      if (e?.name === 'AbortError') {
        setError('Análisis cancelado. Puedes intentarlo de nuevo.');
      } else {
        setError(e?.userMessage || 'Ocurrió un error inesperado. Intenta de nuevo.');
      }
      setPhase('idle');
    }
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  /** Medición determinística con referencia CONFIRMADA por el humano. */
  function measureWith(reference) {
    setError(null);
    setEstimate(null);
    setSize(null);
    const est = estimateDiameterMm(proposal, dims.w, dims.h, {
      sharpness: sharpnessRef.current,
      reference,
    });
    if (!est.ok) {
      setError(est.userMessage || UNRELIABLE_MESSAGE);
      setPhase('review');
      return;
    }
    // ÚNICA vía hacia una talla: el calculador existente + tabla T1-T36.
    const r = calculateSize(est.diameterMm.toFixed(2));
    if (!r.ok) {
      setError(`Diámetro estimado ${est.diameterMm.toFixed(2)} mm fuera del rango T1–T36. ${UNRELIABLE_MESSAGE}`);
      setPhase('review');
      return;
    }
    setEstimate(est);
    setSize(r);
    setPhase('done');
  }

  /** El humano confirma que los valores propuestos coinciden con su regla. */
  function onConfirmProposal() {
    const ticks = proposal?.reference?.tick_points;
    if (!Array.isArray(ticks) || ticks.length < 2) {
      setError('La IA no propuso una referencia utilizable. Indícala manualmente.');
      return;
    }
    measureWith(ticks);
  }

  function onPick(p) {
    setPoints((prev) => (prev.A && !prev.B ? { ...prev, B: p } : { A: p, B: null }));
  }

  /** Referencia totalmente manual: dos puntos tocados + valores leídos por el humano. */
  function onMeasureManual() {
    const a = parseMm(mmA);
    const b = parseMm(mmB);
    if (!points.A || !points.B) {
      setError('Toca dos marcas de la regla en la fotografía (A y B).');
      return;
    }
    if (a == null || b == null || a === b) {
      setError('Escribe los dos valores en mm que se leen en esas marcas (deben ser distintos).');
      return;
    }
    measureWith([
      { x: points.A.x, y: points.A.y, mm: a },
      { x: points.B.x, y: points.B.y, mm: b },
    ]);
  }

  return (
    <div className="beta">
      <ol className="steps">
        <li>Coloca el anillo junto a una regla, en el mismo plano.</li>
        <li>Captura una foto desde arriba, con buena iluminaci&#243;n.</li>
      </ol>
      <p className="muted small">
        Funci&#243;n experimental: la imagen ser&#225; procesada por un servicio de IA externo
        para realizar la estimaci&#243;n. No se almacena tu fotograf&#237;a.
      </p>
      <div className="form-group">
        <label htmlFor="beta-foto">Fotograf&#237;a del anillo junto a la regla</label>
        <input
          ref={inputRef}
          type="file"
          id="beta-foto"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          aria-describedby="beta-ayuda beta-error"
        />
        <small id="beta-ayuda" className="hint">
          Puedes elegir desde la galer&#237;a o usar la c&#225;mara si tu dispositivo lo permite.
        </small>
      </div>
      <ImagePreview src={photo} onRemove={reset} />
      {error && (
        <p id="beta-error" className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onAnalyze} disabled={!photo || phase === 'analyzing'}>
          Analizar foto
        </button>
        {phase === 'analyzing' ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Reintentar
          </button>
        )}
      </div>
      <AnalysisStatus phase={phase} />
      {phase === 'review' && proposal && dims && (
        <div className="beta-review">
          <h3>Confirma la referencia de tu regla</h3>
          <p className="muted small">
            La IA propone estas marcas. Comprueba en la foto que los n&#250;meros coinciden
            con lo impreso en tu regla. Sin esta confirmaci&#243;n no se calcula ninguna talla.
          </p>
          {typeof sharpnessRef.current === 'number' && sharpnessRef.current < SHARPNESS_THRESHOLD && (
            <p className="error" role="alert">
              {BLURRY_MESSAGE} Toma otra fotograf&#237;a con mejor nitidez antes de confirmar.
            </p>
          )}
          <ReferenceOverlay
            src={photo}
            ticks={proposal.reference?.tick_points}
            ring={proposal.ring}
            manual={manual}
            points={points}
            onPick={onPick}
          />
          {!manual ? (
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={onConfirmProposal} disabled={typeof sharpnessRef.current === 'number' && sharpnessRef.current < SHARPNESS_THRESHOLD}>
                Confirmar referencia y medir
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setManual(true); setPoints({ A: null, B: null }); }}>
                Corregir manualmente
              </button>
            </div>
          ) : (
            <div>
              <p className="muted small">Toca dos marcas visibles (A y B) y escribe el valor en mm que lees en cada una.</p>
              <div className="beta-mmgrid">
                <div className="form-group">
                  <label htmlFor="beta-mm-a">Marca A (mm)</label>
                  <input id="beta-mm-a" type="text" inputMode="decimal" value={mmA} onChange={(e) => setMmA(e.target.value)} placeholder="Ej.: 10" />
                </div>
                <div className="form-group">
                  <label htmlFor="beta-mm-b">Marca B (mm)</label>
                  <input id="beta-mm-b" type="text" inputMode="decimal" value={mmB} onChange={(e) => setMmB(e.target.value)} placeholder="Ej.: 20" />
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={onMeasureManual} disabled={typeof sharpnessRef.current === 'number' && sharpnessRef.current < SHARPNESS_THRESHOLD}>
                  Medir con esta referencia
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setManual(false)}>
                  Volver a la propuesta
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <MeasurementResult estimate={estimate} size={size} />
    </div>
  );
}
