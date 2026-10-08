import { useState } from 'react';
import Header from './components/Header.jsx';
import SizeForm from './components/SizeForm.jsx';
import ResultCard from './components/ResultCard.jsx';
import SizeTable from './components/SizeTable.jsx';
import HelpGuide from './components/HelpGuide.jsx';
import CameraMeasure from './components/BetaCameraMeasure/CameraMeasure.jsx';
import { calculateSize } from './utils/ringCalculator.js';
import './App.css';
import './styles/responsive.css';

/** Módulo experimental aislado: se oculta con VITE_BETA_ENABLED=false. */
const BETA_ENABLED = import.meta.env.VITE_BETA_ENABLED !== 'false';

export default function App() {
  const [diametro, setDiametro] = useState('');
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const r = calculateSize(diametro);
    if (!r.ok) {
      setError(r.error);
      setResultado(null);
      return;
    }
    setError(null);
    setResultado(r);
  }

  function handleLimpiar() {
    setDiametro('');
    setError(null);
    setResultado(null);
  }

  return (
    <>
      <Header />
      <main className="container">
        <section id="calculadora" className="card" aria-labelledby="calc-title">
          <h2 id="calc-title">Determinar talla por di&#225;metro interno</h2>
          <p className="muted">
            Ingresa el <strong>di&#225;metro interno del anillo en mil&#237;metros</strong> y
            obt&#233;n la talla T1&#8211;T36 con su equivalencia USA.
          </p>
          <SizeForm
            value={diametro}
            onChange={setDiametro}
            onSubmit={handleSubmit}
            onClear={handleLimpiar}
            error={error}
          />
          <ResultCard result={resultado} />
        </section>

        <section id="ayuda" className="card" aria-labelledby="ayuda-title">
          <h2 id="ayuda-title">C&#243;mo medir tu anillo</h2>
          <HelpGuide />
        </section>

        <section id="tabla" className="card" aria-labelledby="tabla-title">
          <h2 id="tabla-title">Tabla de referencia T1&#8211;T36</h2>
          <p className="muted">36 registros: talla, di&#225;metro (mm) y equivalencia USA.</p>
          <SizeTable selectedCode={resultado ? resultado.size : null} />
        </section>

        <section id="thumb-zone" className="card" aria-labelledby="thumb-title">
          <h2 id="thumb-title">Zona de pulgar (Thumb Zone)</h2>
          <p className="muted">
            La Thumb Zone es el &#225;rea de la pantalla alcanzable con comodidad usando una
            sola mano en el m&#243;vil. Se prioriz&#243; aqu&#237; por ser una app mobile-first
            de consulta r&#225;pida.
          </p>
          <ul className="small">
            <li>
              <strong>&#8220;Calcular talla&#8221;</strong> y <strong>&#8220;Limpiar&#8221;</strong>:
              barra inferior fija en m&#243;vil (botones de 54px, con &#225;rea segura),
              siempre al alcance del pulgar mientras se hace scroll.
            </li>
            <li>
              <strong>Navegaci&#243;n</strong> (Calculadora / Tabla / C&#243;mo medir): enlaces
              amplios en el encabezado y secciones apiladas para avance con una mano.
            </li>
            <li>
              <strong>Resultado y tabla</strong>: aparecen justo debajo del formulario para no
              exigir estiramiento del pulgar.
            </li>
          </ul>
        </section>

        {BETA_ENABLED && (
          <section id="beta" className="card beta-card" aria-labelledby="beta-title">
            <h2 id="beta-title">
              Medici&#243;n con c&#225;mara <span className="beta-tag">BETA</span>
            </h2>
            <p className="muted">
              Funci&#243;n experimental y aproximada: estima el di&#225;metro desde una foto del
              anillo junto a una regla. El calculador manual sigue siendo la v&#237;a principal.
            </p>
            <CameraMeasure />
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            <strong>RingSize</strong> &#183; Examen Ingenier&#237;a de Software &#183; UDES
          </p>
        </div>
      </footer>
    </>
  );
}
