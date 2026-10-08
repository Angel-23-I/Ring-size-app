export default function ImagePreview({ src, onRemove }) {
  if (!src) return null;
  return (
    <div className="beta-preview">
      <img src={src} alt="Vista previa del anillo junto a la regla para análisis Beta" />
      <button type="button" className="btn btn-secondary" onClick={onRemove}>
        Quitar foto
      </button>
    </div>
  );
}
