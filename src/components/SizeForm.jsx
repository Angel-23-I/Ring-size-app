export default function SizeForm({ value, onChange, onSubmit, onClear, error }) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="diametro">Di&#225;metro interno (mm)</label>
        <div className="input-row">
          <input
            type="text"
            id="diametro"
            name="diametro"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 18.10"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby="diametro-ayuda diametro-error"
            aria-invalid={error ? 'true' : 'false'}
          />
          <span className="unit" aria-hidden="true">
            mm
          </span>
        </div>
        <small id="diametro-ayuda" className="hint">
          Solo mil&#237;metros. Acepta punto o coma (18.10 o 18,10). M&#225;ximo 2 decimales.
        </small>
        {error && (
          <p id="diametro-error" className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="actions thumb-actions">
        <button type="submit" className="btn btn-primary">
          Calcular talla
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClear}>
          Limpiar
        </button>
      </div>
    </form>
  );
}
