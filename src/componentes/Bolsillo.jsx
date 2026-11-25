import { Contract, formatEther } from 'ethers';
import { ABI_MAQUINA } from '../cadena.js';
import { spriteDe } from '../catalogo.js';
import PixelArte from './Pixel.jsx';

/** Inventario del usuario activo: lo que compró, devoluciones y reembolso por cobrar. */
export default function Bolsillo({ maquina, usuario, ocupado, ejecutar }) {
  const registrado = maquina.usuarios.includes(usuario.direccion);
  const inventario = maquina.inventarios[usuario.direccion] ?? [];
  const reembolso = maquina.reembolsos[usuario.direccion] ?? 0n;
  const contrato = (f) => new Contract(maquina.direccion, ABI_MAQUINA, f);
  const tiene = inventario.some((n) => n > 0);

  return (
    <section className="caja bolsillo" style={{ '--color': usuario.color }}>
      <h2>
        <PixelArte sprite={usuario.avatar} avatar tamano={28} /> MOCHILA DE {usuario.nombre.toUpperCase()}
      </h2>
      {!registrado && <p className="nota mal">Esta billetera no está registrada: la máquina no le venderá.</p>}

      {tiene ? (
        <ul className="mochila">
          {inventario.map((n, i) =>
            n > 0 ? (
              <li key={i}>
                <PixelArte sprite={spriteDe(maquina.productos[i].nombre)} tamano={32} />
                <span className="mochila-nombre">
                  {maquina.productos[i].nombre} <b>x{n}</b>
                </span>
                <button
                  className="boton mini"
                  disabled={ocupado}
                  onClick={() =>
                    ejecutar(`${usuario.nombre} devuelve ${maquina.productos[i].nombre}`, (f) => contrato(f).devolver(i))
                  }
                  title={`Devuelve una unidad y acredita ${formatEther(maquina.productos[i].precio)} ETH`}
                >
                  DEVOLVER
                </button>
              </li>
            ) : null,
          )}
        </ul>
      ) : (
        <p className="nota">Mochila vacía. ¡Compra algo en la máquina!</p>
      )}

      <div className="reembolso">
        <span>
          REEMBOLSO: <b>{formatEther(reembolso)} ETH</b>
        </span>
        <button
          className="boton mini oro"
          disabled={ocupado || reembolso === 0n}
          onClick={() => ejecutar(`${usuario.nombre} cobra su reembolso`, (f) => contrato(f).retirarReembolso())}
        >
          COBRAR
        </button>
      </div>
    </section>
  );
}
