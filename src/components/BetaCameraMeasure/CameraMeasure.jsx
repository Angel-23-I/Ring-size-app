import { useRef, useState } from 'react';
import ImagePreview from './ImagePreview.jsx';
import AnalysisStatus from './AnalysisStatus.jsx';
import MeasurementResult from './MeasurementResult.jsx';
import { analyzeImage } from '../../services/geminiMeasurementService.js';
import { estimateDiameterMm, UNRELIABLE_MESSAGE } from '../../utils/imageMeasurement.js';
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

/** Reduce la foto en el navegador (menos peso, sin almacenar nada). */
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
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
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
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhoto(null);
    setPhase('idle');
    setError(null);
    setEstimate(null);
    setSize(null);
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
      setPhoto(await downscale(file));
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
      const est = estimateDiameterMm(detection, w, h);
      if (!est.ok) {
        setError(est.userMessage || UNRELIABLE_MESSAGE);
        setPhase('idle');
        return;
      }
      // ÚNICA vía hacia una talla: el calculador existente + tabla T1-T36.
      const r = calculateSize(est.diameterMm.toFixed(2));
      if (!r.ok) {
        setError(`Diámetro estimado ${est.diameterMm.toFixed(2)} mm fuera del rango T1–T36. ${UNRELIABLE_MESSAGE}`);
        setPhase('idle');
        return;
      }
      setEstimate(est);
      setSize(r);
      setPhase('done');
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
      <MeasurementResult estimate={estimate} size={size} />
    </div>
  );
}
