export default function HelpGuide() {
  return (
    <div>
      <ol className="steps">
        <li>Mide el di&#225;metro interno del anillo (de borde a borde interior).</li>
        <li>Utiliza mil&#237;metros como &#250;nica unidad.</li>
        <li>Introduce el valor obtenido en el campo de di&#225;metro.</li>
        <li>Presiona &#8220;Calcular talla&#8221;.</li>
        <li>
          Interpreta el resultado: si es &#8220;Aproximada&#8221;, corresponde a la talla
          inmediatamente superior.
        </li>
      </ol>
      <p className="muted small">
        Esta aplicaci&#243;n no mide f&#237;sicamente el anillo ni utiliza la c&#225;mara.
        Solo calcula la talla a partir del di&#225;metro que ingreses.
      </p>
    </div>
  );
}
