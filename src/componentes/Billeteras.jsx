import { enEth } from '../cadena.js';
import PixelArte from './Pixel.jsx';

/** Selector de personaje: cada uno firma con su propia billetera de la cadena local. */
export default function Billeteras({ billeteras, activa, onElegir, maquina }) {
  return (
    <section className="jugadores">
      {billeteras.map((b, i) => {
        const registrado = maquina.usuarios.includes(b.direccion);
        const etiqueta = b.dueno ? 'DUEÑO' : b.atacante ? 'ATACANTE' : registrado ? 'REGISTRADO' : 'SIN REGISTRO';
        return (
          <button
            key={b.direccion}
            className={`jugador ${i === activa ? 'activo' : ''} ${b.atacante ? 'malo' : ''}`}
            style={{ '--color': b.color }}
            onClick={() => onElegir(i)}
            title={b.direccion}
          >
            <PixelArte sprite={b.avatar} avatar tamano={44} />
            <span className="jugador-datos">
              <span className="jugador-nombre">{b.nombre}</span>
              <span className="jugador-rol">{b.rol}</span>
              <span className="jugador-saldo">
                <PixelArte sprite="moneda" tamano={10} /> {enEth(b.saldo, 3)} ETH
              </span>
              <span className={`chip ${b.atacante ? 'rojo' : b.dueno ? 'oro' : registrado ? 'verde' : ''}`}>{etiqueta}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
