export default function MeasurementResult({ estimate, size }) {
  if (!estimate?.ok || !size?.ok) return null;
  return (
    <div className="resultado beta-result" aria-live="polite">
      <h3>Estimaci&#243;n aproximada mediante fotograf&#237;a asistida por IA</h3>
      <dl className="datos">
        <div>
          <dt>Di&#225;metro estimado</dt>
          <dd>{estimate.diameterMm.toFixed(2)} mm</dd>
        </div>
        <div>
          <dt>Talla USA aproximada</dt>
          <dd>
            {size.usa} ({size.size})
          </dd>
        </div>
        <div>
          <dt>Tipo de resultado</dt>
          <dd>{size.type === 'exacta' ? 'Exacta' : 'Aproximada'}</dd>
        </div>
      </dl>
      <p className="nota aprox">
        Estado: estimaci&#243;n aproximada, no una medici&#243;n exacta. Referencia m&#233;trica
        verificada por el usuario. Verifica siempre con el calculador manual.
      </p>
      <p className="muted small">
        Confianza de detecci&#243;n: {estimate.level}
        {typeof estimate.confidence === 'number'
          ? ` (${Math.round(estimate.confidence * 100)}% seg&#250;n la IA)`
          : ''}
      </p>
      {estimate.warnings.length > 0 && (
        <ul className="small">
          {estimate.warnings.map((w, k) => (
            <li key={k}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
