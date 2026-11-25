import { useEffect, useState } from 'react';
import { Contract, formatEther, parseEther } from 'ethers';
import { ABI_MAQUINA, enEth } from '../cadena.js';
import { codigoDe, spriteDe } from '../catalogo.js';
import PixelArte from './Pixel.jsx';

const PASO = parseEther('0.001');

/** Convierte lo escrito (en ETH) a wei, o devuelve null si no es un número válido. */
function leerMonto(texto) {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(limpio)) return null;
  try {
    return parseEther(limpio);
  } catch {
    return null;
  }
}

export default function Maquina({ maquina, usuario, ocupado, ejecutar }) {
  const [seleccion, setSeleccion] = useState(null);
  const [monto, setMonto] = useState('');
  const [pantalla, setPantalla] = useState({ tipo: 'normal', texto: 'ELIGE UN PRODUCTO' });
  const [caida, setCaida] = useState(null);

  const producto = seleccion === null ? null : maquina.productos[seleccion];

  // Al cambiar de personaje se limpia la pantalla.
  useEffect(() => {
    setPantalla({ tipo: 'normal', texto: `HOLA ${usuario.nombre.toUpperCase()} · ELIGE UN PRODUCTO` });
  }, [usuario.direccion]);

  function elegir(i) {
    const p = maquina.productos[i];
    setSeleccion(i);
    setMonto(formatEther(p.precio));
    setPantalla({
      tipo: p.existencias === 0 ? 'error' : 'normal',
      texto: p.existencias === 0 ? `${codigoDe(i)} ${p.nombre.toUpperCase()} · AGOTADO` : `${codigoDe(i)} ${p.nombre.toUpperCase()} · INSERTA ${formatEther(p.precio)} ETH`,
    });
  }

  function ajustar(delta) {
    const actual = leerMonto(monto) ?? 0n;
    const nuevo = actual + delta;
    setMonto(formatEther(nuevo < 0n ? 0n : nuevo));
  }

  async function comprar() {
    if (!producto) return setPantalla({ tipo: 'error', texto: 'PRIMERO ELIGE UN PRODUCTO' });
    const valor = leerMonto(monto);
    if (valor === null) return setPantalla({ tipo: 'error', texto: 'MONTO INVÁLIDO · ESCRIBE ETH, EJ. 0.012' });

    setPantalla({ tipo: 'normal', texto: 'PROCESANDO PAGO…' });
    const id = seleccion;
    const r = await ejecutar(`${usuario.nombre} compra ${producto.nombre} con ${formatEther(valor)} ETH`, (firmante) =>
      new Contract(maquina.direccion, ABI_MAQUINA, firmante).comprar(id, { value: valor }),
    );
    if (r.ok) {
      setCaida({ sprite: spriteDe(producto.nombre), clave: r.recibo.hash });
      setPantalla({ tipo: 'exito', texto: `¡DISFRUTA TU ${producto.nombre.toUpperCase()}!` });
    } else {
      const titulo = {
        PagoInsuficiente: 'PAGO INSUFICIENTE',
        PagoExcesivo: 'PAGO EXCESIVO',
        UsuarioNoRegistrado: 'USUARIO NO REGISTRADO',
        SinExistencias: 'AGOTADO',
        MaquinaPausada: 'MÁQUINA PAUSADA',
      }[r.error.nombre];
      setPantalla({ tipo: 'error', texto: `ERROR · ${titulo ?? r.error.nombre ?? 'FALLÓ'}`, detalle: r.error.texto });
    }
  }

  const valor = leerMonto(monto);
  const diferencia = producto && valor !== null ? valor - producto.precio : null;

  return (
    <section className={`maquina ${maquina.pausada ? 'pausada' : ''}`}>
      <div className="marquesina">
        <span>★ SNACKS ★ BEBIDAS ★ ETH ★</span>
      </div>

      <div className="cuerpo">
        <div className="vitrina">
          {maquina.productos.map((p, i) => (
            <button
              key={p.nombre}
              className={`casilla ${seleccion === i ? 'elegida' : ''} ${p.existencias === 0 ? 'agotada' : ''}`}
              onClick={() => elegir(i)}
              disabled={ocupado}
            >
              <span className="casilla-codigo">{codigoDe(i)}</span>
              <PixelArte sprite={spriteDe(p.nombre)} tamano={52} className={seleccion === i ? 'salta' : ''} />
              <span className="casilla-nombre">{p.nombre}</span>
              <span className="casilla-precio">{formatEther(p.precio)} Ξ</span>
              <span className="casilla-stock" title={`${p.existencias} unidades`}>
                {p.existencias === 0 ? 'AGOTADO' : `x${p.existencias}`}
              </span>
              <span className="espiral" />
            </button>
          ))}
          {maquina.pausada && <div className="sello">PAUSADA</div>}
        </div>

        <div className="controles">
          <div className={`lcd ${pantalla.tipo}`}>
            <div className="lcd-texto">{pantalla.texto}</div>
            {pantalla.detalle && <div className="lcd-detalle">{pantalla.detalle}</div>}
          </div>

          <div className="ranura">
            <label htmlFor="monto">MONEDAS (ETH)</label>
            <input id="monto" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.000" inputMode="decimal" spellCheck={false} />
            <div className="ajustes">
              <button className="boton mini" onClick={() => ajustar(-PASO)} disabled={!producto}>
                −0.001
              </button>
              <button className="boton mini" onClick={() => producto && setMonto(formatEther(producto.precio))} disabled={!producto}>
                EXACTO
              </button>
              <button className="boton mini" onClick={() => ajustar(PASO)} disabled={!producto}>
                +0.001
              </button>
            </div>
            {diferencia !== null && (
              <div className={`pista ${diferencia === 0n ? 'ok' : 'mal'}`}>
                {diferencia === 0n
                  ? '✔ MONTO EXACTO'
                  : diferencia < 0n
                    ? `✖ FALTAN ${formatEther(-diferencia)} ETH`
                    : `✖ SOBRAN ${formatEther(diferencia)} ETH`}
              </div>
            )}
          </div>

          <button className="boton grande verde comprar" onClick={comprar} disabled={ocupado}>
            {ocupado ? '…' : 'COMPRAR'}
          </button>

          <div className="info-maquina">
            <span>VENTAS: {maquina.totalVentas}</span>
            <span>CAJA: {enEth(maquina.balance)} Ξ</span>
          </div>
        </div>
      </div>

      <div className="bandeja">
        <span className="bandeja-letrero">EMPUJE</span>
        {caida && <PixelArte key={caida.clave} sprite={caida.sprite} tamano={48} className="cae" />}
      </div>
      <div className="patas">
        <span />
        <span />
      </div>
    </section>
  );
}
