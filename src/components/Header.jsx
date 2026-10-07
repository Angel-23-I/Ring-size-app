export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-ring" aria-hidden="true">
            &#9678;
          </span>
          <div>
            <h1>RingSize</h1>
            <p className="subtitle">Ingenier&#237;a de Software &#183; UDES</p>
          </div>
        </div>
        <nav aria-label="Navegaci&#243;n principal">
          <a href="#calculadora">Calculadora</a>
          <a href="#tabla">Tabla</a>
          <a href="#ayuda">C&#243;mo medir</a>
        </nav>
      </div>
    </header>
  );
}
