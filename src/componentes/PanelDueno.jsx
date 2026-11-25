import { useState } from 'react';
import { Contract, formatEther } from 'ethers';
import { ABI_MAQUINA, direccionCorta } from '../cadena.js';
import { codigoDe, spriteDe } from '../catalogo.js';
import PixelArte from './Pixel.jsx';

/** Herramientas del dueño: retirar ganancias, reponer, pausar. */
export default function PanelDueno({ maquina, ocupado, ejecutar, onNueva }) {
  const [id, setId] = useState(0);
  const [cantidad, setCantidad] = useState('3');
  const contrato = (f) => new Contract(maquina.direccion, ABI_MAQUINA, f);

  return (
    <section className="caja dueno">
      <h2>
        <PixelArte sprite="dueno" avatar tamano={28} /> PANEL DEL DUEÑO
      </h2>

      <div className="fila-dato">
        <span>GANANCIAS</span>
        <b>{formatEther(maquina.ganancias)} ETH</b>
      </div>
      <button
        className="boton oro ancho"
        disabled={ocupado || maquina.ganancias === 0n}
        onClick={() => ejecutar('El dueño retira las ganancias', (f) => contrato(f).retirarGanancias())}
      >
        RETIRAR GANANCIAS
      </button>

      <div className="separador" />
      <label className="etiqueta">REPONER</label>
      <div className="reponer">
        <select value={id} onChange={(e) => setId(Number(e.target.value))}>
          {maquina.productos.map((p, i) => (
            <option key={p.nombre} value={i}>
              {codigoDe(i)} {p.nombre} (x{p.existencias})
            </option>
          ))}
        </select>
        <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="numeric" />
        <button
          className="boton mini"
          disabled={ocupado || !/^\d+$/.test(cantidad)}
          onClick={() =>
            ejecutar(`El dueño repone ${cantidad} de ${maquina.productos[id].nombre}`, (f) => contrato(f).reponer(id, BigInt(cantidad)))
          }
        >
          <PixelArte sprite={spriteDe(maquina.productos[id].nombre)} tamano={16} /> +
        </button>
      </div>

      <div className="separador" />
      <button
        className={`boton ancho ${maquina.pausada ? 'verde' : 'rojo'}`}
        disabled={ocupado}
        onClick={() =>
          ejecutar(maquina.pausada ? 'El dueño reanuda la máquina' : 'El dueño pausa la máquina', (f) =>
            contrato(f).cambiarPausa(!maquina.pausada),
          )
        }
      >
        {maquina.pausada ? '▶ REANUDAR VENTAS' : '❚❚ PAUSAR VENTAS'}
      </button>

      <div className="separador" />
      <p className="nota">
        Contrato: <code title={maquina.direccion}>{direccionCorta(maquina.direccion)}</code> · Usuarios {maquina.usuarios.length}/4
      </p>
      <button className="boton mini ancho" disabled={ocupado} onClick={onNueva}>
        DESPLEGAR UNA MÁQUINA NUEVA
      </button>
    </section>
  );
}
