import { useMemo, useState } from 'react';
import {
  RING_TABLE,
  buscarTalla,
  validarDiametro,
} from './utils/ringSizes.js';
import './index.css';

const SISTEMAS = [
  { value: 'US', label: 'USA (US)' },
  { value: 'EU', label: 'Europea (EU)' },
  { value: 'UK', label: 'Británica (UK)' },
  { value: 'JP', label: 'Japonesa (JP)' },
];

function tallaPrincipal(entrada, sistema) {
  switch (sistema) {
    case 'EU':
      return `EU ${entrada.eu}`;
    case 'UK':
      return `UK ${entrada.uk}`;
    case 'JP':
      return `JP ${entrada.jp}`;
    case 'US':
    default:
      return `US ${entrada.us}`;
  }
}

export default function App() {
  const [diametro, setDiametro] = useState('');
  const [sistema, setSistema] = useState('US');
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);

  const tamanoAnilloVisual = useMemo(() => {
    if (!resultado) return 120;
    // Escala visual proporcional: 14mm -> 90px, 22mm -> 170px
    const d = resultado.diametroIngresado;
    return Math.round(90 + ((d - 14) / (22 - 14)) * 80);
  }, [resultado]);

  function handleSubmit(e) {
    e.preventDefault();
    const msg = validarDiametro(diametro);
    if (msg) {
      setError(msg);
      setResultado(null);
      return;
    }
    setError(null);
    const r = buscarTalla(diametro);
    setResultado(r);
    setSeleccionada(r.entrada.diametro);
  }

  function handleLimpiar() {
    setDiametro('');
    setError(null);
    setResultado(null);
    setSeleccionada(null);
  }

  function handleEjemplo() {
    setDiametro('17.3');
    setError(null);
    setResultado(buscarTalla('17.3'));
    setSeleccionada(17.3);
  }

  function handleClickFila(row) {
    setDiametro(String(row.diametro));
    setError(null);
    setResultado(buscarTalla(row.diametro));
    setSeleccionada(row.diametro);
    document.getElementById('calculadora')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <div className="brand">
            <span className="brand-ring" aria-hidden="true">◎</span>
            <div>
              <h1>RingSize</h1>
              <p className="subtitle">Ingeniería de Software · Universidad de Santander (UDES)</p>
            </div>
          </div>
          <nav aria-label="Navegación principal">
            <a href="#calculadora">Calculadora</a>
            <a href="#tabla">Tabla de tallas</a>
            <a href="#ayuda">Cómo medir</a>
          </nav>
        </div>
      </header>

      <main className="container">
        <section id="calculadora" className="card" aria-labelledby="calc-title">
          <h2 id="calc-title">Determinar talla por diámetro interno</h2>
          <p className="muted">
            Ingresa el <strong>diámetro interno del anillo en milímetros (mm)</strong> y
            obtén la talla equivalente en los sistemas USA, Europeo, Británico y Japonés.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="diametro">Diámetro interno (mm)</label>
                <input
                  type="number"
                  id="diametro"
                  name="diametro"
                  placeholder="Ej: 17.3"
                  min="13"
                  max="23.5"
                  step="0.1"
                  inputMode="decimal"
                  value={diametro}
                  onChange={(e) => setDiametro(e.target.value)}
                  aria-describedby="hint error-msg"
                />
                <small id="hint" className="hint">
                  Rango válido: 13.0 – 23.5 mm. Usa punto decimal (Ej: 16.6).
                </small>
                {error && (
                  <p id="error-msg" className="error" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="sistema">Sistema de talla principal</label>
                <select
                  id="sistema"
                  name="sistema"
                  value={sistema}
                  onChange={(e) => setSistema(e.target.value)}
                >
                  {SISTEMAS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="actions">
              <button type="submit" className="btn btn-primary">
                Calcular talla
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleLimpiar}>
                Limpiar
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleEjemplo}>
                Probar ejemplo (17.3 mm)
              </button>
            </div>
          </form>

          {resultado && (
            <div className="resultado" aria-live="polite">
              <div className="resultado-header">
                <h3>Tu talla es:</h3>
                <span className="talla-principal">
                  {tallaPrincipal(resultado.entrada, sistema)}
                </span>
              </div>
              <div className="equivalencias">
                <div className="eq">
                  <span>Diámetro</span>
                  <strong>{resultado.diametroIngresado.toFixed(1)} mm</strong>
                </div>
                <div className="eq">
                  <span>Circunferencia</span>
                  <strong>{resultado.circunferencia.toFixed(1)} mm</strong>
                </div>
                <div className="eq">
                  <span>USA (US)</span>
                  <strong>{resultado.entrada.us}</strong>
                </div>
                <div className="eq">
                  <span>Europea (EU)</span>
                  <strong>{resultado.entrada.eu} (calc. {resultado.euCalculada})</strong>
                </div>
                <div className="eq">
                  <span>Británica (UK)</span>
                  <strong>{resultado.entrada.uk}</strong>
                </div>
                <div className="eq">
                  <span>Japonesa (JP)</span>
                  <strong>{resultado.entrada.jp}</strong>
                </div>
              </div>
              <p className="nota">
                {resultado.exacta
                  ? `✔ Medida exacta: ${resultado.diametroIngresado.toFixed(1)} mm corresponde a la talla US ${resultado.entrada.us}.`
                  : `⚠ Medida aproximada: la talla más cercana a ${resultado.diametroIngresado.toFixed(1)} mm es US ${resultado.entrada.us} (${resultado.entrada.diametro.toFixed(1)} mm, diferencia de ${resultado.diferencia.toFixed(2)} mm). Si estás entre dos tallas, elige la mayor.`}
                <br />
                Fórmula usada: <code>circunferencia = diámetro × π</code>. La talla EU
                equivale a la circunferencia en mm.
              </p>
              <div className="ring-visual" aria-hidden="true">
                <div
                  className="ring-circle"
                  style={{ width: tamanoAnilloVisual, height: tamanoAnilloVisual }}
                />
                <p className="muted small">Vista proporcional del diámetro ingresado</p>
              </div>
            </div>
          )}
        </section>

        <section id="tabla" className="card" aria-labelledby="tabla-title">
          <h2 id="tabla-title">Tabla de equivalencias</h2>
          <p className="muted">
            Diámetro interno (mm) → talla internacional. Haz clic en una fila para ver el
            detalle.
          </p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th scope="col">Diámetro (mm)</th>
                  <th scope="col">Circunf. (mm)</th>
                  <th scope="col">USA (US)</th>
                  <th scope="col">Europea (EU)</th>
                  <th scope="col">Británica (UK)</th>
                  <th scope="col">Japonesa (JP)</th>
                </tr>
              </thead>
              <tbody>
                {RING_TABLE.map((row) => (
                  <tr
                    key={row.diametro}
                    onClick={() => handleClickFila(row)}
                    className={seleccionada === row.diametro ? 'selected' : ''}
                  >
                    <td>{row.diametro.toFixed(1)}</td>
                    <td>{(row.diametro * Math.PI).toFixed(1)}</td>
                    <td>{row.us}</td>
                    <td>{row.eu}</td>
                    <td>{row.uk}</td>
                    <td>{row.jp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="ayuda" className="card" aria-labelledby="ayuda-title">
          <h2 id="ayuda-title">¿Cómo medir el diámetro interno?</h2>
          <ol className="steps">
            <li>Coloca el anillo sobre una regla o usa un calibrador (pie de rey).</li>
            <li>
              Mide <strong>solo el interior</strong>, de borde a borde, en milímetros.
            </li>
            <li>Ingresa ese valor en la calculadora (Ej: 17.3 mm = talla US 7).</li>
          </ol>
          <p className="muted small">
            Fórmula usada: <code>circunferencia = diámetro × π</code>. La talla Europea
            equivale a la circunferencia en mm redondeada.
          </p>
          <h3>Requisitos del proyecto (UDES)</h3>
          <ul className="small muted">
            <li>HTML5 semántico: header, main, section, table, footer.</li>
            <li>CSS3 responsive con variables, flexbox y grid.</li>
            <li>JavaScript: validación, cálculo y tabla dinámica.</li>
            <li>React + Vite como base del proyecto.</li>
          </ul>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            <strong>RingSize</strong> · Examen de Ingeniería de Software · Universidad de
            Santander (UDES) · HTML5 + CSS3 + JavaScript + React + Vite
          </p>
        </div>
      </footer>
    </>
  );
}
