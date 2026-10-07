export default function ResultCard({ result }) {
  if (!result) return null;
  const isExact = result.type === 'exacta';

  return (
    <div className="resultado" aria-live="polite">
      <h3>Tu talla recomendada</h3>
      <p className="talla-grande">{result.size}</p>
      <dl className="datos">
        <div>
          <dt>Di&#225;metro{isExact ? '' : ' de referencia'}</dt>
          <dd>{result.referenceDiameter.toFixed(2)} mm</dd>
        </div>
        <div>
          <dt>Talla USA</dt>
          <dd>{result.usa}</dd>
        </div>
        <div>
          <dt>Tipo de resultado</dt>
          <dd>{isExact ? 'Exacta' : 'Aproximada'}</dd>
        </div>
      </dl>
      {isExact ? (
        <p className="nota ok">&#10003; Coincidencia exacta.</p>
      ) : (
        <p className="nota aprox">
          &#8776; Aproximada. Se seleccion&#243; la talla inmediatamente superior.
        </p>
      )}
    </div>
  );
}
