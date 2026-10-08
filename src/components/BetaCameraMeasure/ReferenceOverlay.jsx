/**
 * Overlay de verificación humana: muestra la foto con la propuesta de la IA
 * (marcas de regla con sus mm + líneas del diámetro) y permite marcar dos
 * puntos manualmente. Coordenadas en % del área de la imagen (imagen a ancho
 * completo sin deformar, mapeo lineal a 0-1000).
 */
export default function ReferenceOverlay({ src, ticks, ring, manual, points, onPick }) {
  const edge = ring?.inner_edge_points;

  function handleClick(e) {
    if (!manual || !onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
    if (x < 0 || x > 1000 || y < 0 || y > 1000) return;
    onPick({ x, y });
  }

  return (
    <div className="beta-overlay" onClick={handleClick} role={manual ? 'button' : undefined} tabIndex={manual ? 0 : undefined} aria-label={manual ? 'Toca dos marcas de la regla en la foto' : undefined}>
      <img src={src} alt="Foto para verificar la referencia métrica" className="beta-overlay-img" draggable={false} />
      {!manual && Array.isArray(ticks) && ticks.map((t, k) => (
        <span key={k} className="beta-tick" style={{ left: `${t.x / 10}%`, top: `${t.y / 10}%` }} aria-hidden="true">
          {typeof t.mm === 'number' ? t.mm : '?'}
        </span>
      ))}
      {!manual && edge && ['left', 'right', 'top', 'bottom'].every((kk) => edge[kk]) && (
        <>
          <span
            className="beta-line beta-line-h"
            aria-hidden="true"
            style={{
              left: `${edge.left.x / 10}%`,
              top: `${edge.left.y / 10}%`,
              width: `${(edge.right.x - edge.left.x) / 10}%`,
            }}
          />
          <span
            className="beta-line beta-line-v"
            aria-hidden="true"
            style={{
              left: `${edge.top.x / 10}%`,
              top: `${edge.top.y / 10}%`,
              height: `${(edge.bottom.y - edge.top.y) / 10}%`,
            }}
          />
        </>
      )}
      {manual && points?.A && (
        <span className="beta-point beta-point-a" style={{ left: `${points.A.x / 10}%`, top: `${points.A.y / 10}%` }} aria-hidden="true">A</span>
      )}
      {manual && points?.B && (
        <span className="beta-point beta-point-b" style={{ left: `${points.B.x / 10}%`, top: `${points.B.y / 10}%` }} aria-hidden="true">B</span>
      )}
    </div>
  );
}
