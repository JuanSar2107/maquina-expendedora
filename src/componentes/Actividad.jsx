import PixelArte from './Pixel.jsx';

/** Registro de transacciones: lo que pasó y lo que el contrato rechazó. */
export default function Actividad({ actividad }) {
  return (
    <section className="caja actividad">
      <h2>REGISTRO</h2>
      {actividad.length === 0 ? (
        <p className="nota">Aquí aparecerá cada transacción, aceptada o rechazada.</p>
      ) : (
        <ol>
          {actividad.map((a) => (
            <li key={a.id} className={a.exito ? 'ok' : 'mal'}>
              <PixelArte sprite={a.usuario.avatar} avatar tamano={20} />
              <span className="hora">{a.hora.toLocaleTimeString('es-CO')}</span>
              <span className="titulo">{a.titulo}</span>
              <span className="detalle">
                {a.exito ? '✔ ' : '✖ '}
                {a.detalle}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
