import { RING_SIZES } from '../data/ringSizes.js';

export default function SizeTable({ selectedCode }) {
  return (
    <div className="table-wrapper" tabIndex="0" aria-label="Tabla de tallas T1 a T36 con desplazamiento horizontal si es necesario">
      <table>
        <caption>Tabla de referencia T1&#8211;T36: talla, di&#225;metro en mm y equivalencia USA.</caption>
        <thead>
          <tr>
            <th scope="col">Talla</th>
            <th scope="col">Di&#225;metro (mm)</th>
            <th scope="col">USA</th>
          </tr>
        </thead>
        <tbody>
          {RING_SIZES.map((row) => (
            <tr
              key={row.code}
              className={selectedCode === row.code ? 'selected' : ''}
              aria-current={selectedCode === row.code ? 'true' : undefined}
            >
              <td>
                <strong>{row.code}</strong>
              </td>
              <td>{row.diameter.toFixed(2)}</td>
              <td>{row.usa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
