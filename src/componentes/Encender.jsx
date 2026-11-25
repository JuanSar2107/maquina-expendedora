import { ContractFactory, parseEther } from 'ethers';
import { ABI_MAQUINA, BYTECODE_MAQUINA } from '../cadena.js';
import { CATALOGO } from '../catalogo.js';
import PixelArte from './Pixel.jsx';

/** Pantalla inicial: el dueño despliega la máquina con el catálogo y registra a los 4 usuarios. */
export default function Encender({ billeteras, ocupado, ejecutar, onDesplegada, huboAntes }) {
  const dueno = billeteras.find((b) => b.dueno);
  const usuarios = billeteras.filter((b) => !b.dueno && !b.atacante).slice(0, 4);

  async function desplegar() {
    const r = await ejecutar(
      'Desplegar la máquina',
      (firmante) =>
        new ContractFactory(ABI_MAQUINA, BYTECODE_MAQUINA, firmante).deploy(
          CATALOGO.map((p) => p.nombre),
          CATALOGO.map((p) => parseEther(p.precio)),
          CATALOGO.map((p) => p.existencias),
          usuarios.map((u) => u.direccion),
        ),
      { usuario: dueno },
    );
    if (r.ok) onDesplegada(await r.resultado.getAddress());
  }

  return (
    <section className="caja encender">
      <div className="encender-sprites">
        {CATALOGO.map((p) => (
          <PixelArte key={p.nombre} sprite={p.sprite} tamano={40} className="flota" />
        ))}
      </div>
      <h2>{huboAntes ? 'La máquina guardada ya no existe' : 'La máquina está apagada'}</h2>
      <p>
        {huboAntes && 'Parece que la cadena se reinició. '}
        <b>{dueno?.nombre}</b> desplegará la máquina con {CATALOGO.length} productos de precios distintos y registrará a{' '}
        {usuarios.map((u) => u.nombre).join(', ')} como sus 4 usuarios.
      </p>
      <button className="boton grande verde" onClick={desplegar} disabled={ocupado || !dueno}>
        {ocupado ? 'ENCENDIENDO…' : '▶ ENCENDER MÁQUINA'}
      </button>
    </section>
  );
}
