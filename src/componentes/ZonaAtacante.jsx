import { useRef, useState } from 'react';
import { Contract, ContractFactory, parseEther } from 'ethers';
import { ABI_ATACANTE, ABI_MAQUINA, BYTECODE_ATACANTE } from '../cadena.js';
import { leerMaquina } from '../lectura.js';
import PixelArte from './Pixel.jsx';

// Huella del estado de la máquina: si cambia, el ataque tuvo algún efecto.
const huella = (m) =>
  JSON.stringify({
    balance: m.balance.toString(),
    ganancias: m.ganancias.toString(),
    ventas: m.totalVentas,
    pausada: m.pausada,
    usuarios: m.usuarios,
    stock: m.productos.map((p) => p.existencias),
    reembolsos: Object.values(m.reembolsos).map(String),
  });

/** Perfil del atacante: lanza intentos de robo y comprueba que el contrato los frena. */
export default function ZonaAtacante({ visible, atacante, billeteras, maquina, ocupado, ejecutar }) {
  const [resultados, setResultados] = useState({});
  const robot = useRef(null);

  const conMaquina = (f) => new Contract(maquina.direccion, ABI_MAQUINA, f);
  const como = { usuario: atacante };

  /** Despliega (una sola vez) el contrato AtacanteMaquina desde la billetera del atacante. */
  async function conRobot(titulo, usar) {
    if (!robot.current) {
      const r = await ejecutar(
        'Sombra despliega su contrato AtacanteMaquina',
        (f) => new ContractFactory(ABI_ATACANTE, BYTECODE_ATACANTE, f).deploy(maquina.direccion),
        como,
      );
      if (!r.ok) return r;
      robot.current = await r.resultado.getAddress();
    }
    return ejecutar(titulo, (f) => usar(new Contract(robot.current, ABI_ATACANTE, f)), como);
  }

  const precio0 = maquina.productos[0].precio;

  const ATAQUES = [
    {
      id: 'colarse',
      titulo: 'Comprar sin estar registrado',
      idea: 'Paga el precio exacto de un producto aunque no es uno de los 4 usuarios.',
      defensa: 'Solo las billeteras registradas pueden comprar.',
      esperado: ['UsuarioNoRegistrado'],
      correr: () => ejecutar('Ataque: comprar sin registro', (f) => conMaquina(f).comprar(0, { value: precio0 }), como),
    },
    {
      id: 'registrarse',
      titulo: 'Registrarse a sí mismo',
      idea: 'Llama a registrarUsuario con su propia dirección para colarse como 5º usuario.',
      defensa: 'Solo el dueño registra, y hay cupo máximo de 4.',
      esperado: ['SoloDueno'],
      correr: () => ejecutar('Ataque: auto-registro', (f) => conMaquina(f).registrarUsuario(atacante.direccion), como),
    },
    {
      id: 'ganancias',
      titulo: 'Robar las ganancias',
      idea: 'Llama a retirarGanancias para llevarse el dinero de las ventas.',
      defensa: 'retirarGanancias tiene control de acceso: solo el dueño.',
      esperado: ['SoloDueno'],
      correr: () => ejecutar('Ataque: robar ganancias', (f) => conMaquina(f).retirarGanancias(), como),
    },
    {
      id: 'reembolso',
      titulo: 'Cobrar reembolsos ajenos',
      idea: 'Llama a retirarReembolso esperando llevarse lo que devolvieron otros.',
      defensa: 'Cada billetera solo cobra su propio saldo (patrón pull).',
      esperado: ['SinReembolso'],
      correr: () => ejecutar('Ataque: cobrar reembolsos ajenos', (f) => conMaquina(f).retirarReembolso(), como),
    },
    {
      id: 'sabotaje',
      titulo: 'Sabotear: pausar y alterar stock',
      idea: 'Intenta pausar la máquina y reponer 50 unidades falsas.',
      defensa: 'cambiarPausa y reponer son solo del dueño.',
      esperado: ['SoloDueno'],
      correr: async () => {
        const r = await ejecutar('Ataque: pausar la máquina', (f) => conMaquina(f).cambiarPausa(true), como);
        if (r.ok) return r;
        const r2 = await ejecutar('Ataque: reponer stock falso', (f) => conMaquina(f).reponer(0, 50), como);
        return r2.ok || r2.error.nombre !== r.error.nombre ? r2 : r;
      },
    },
    {
      id: 'directo',
      titulo: 'Enviar ETH directo',
      idea: 'Manda 1 ETH al contrato sin llamar a comprar, para descuadrar la contabilidad.',
      defensa: 'receive/fallback rechazan cualquier pago directo.',
      esperado: ['PagoDirectoNoPermitido'],
      correr: () =>
        ejecutar('Ataque: enviar ETH directo', (f) => f.sendTransaction({ to: maquina.direccion, value: parseEther('1') }), como),
    },
    {
      id: 'robot',
      titulo: 'Contrato robot roba ganancias',
      idea: 'Despliega AtacanteMaquina y le pide llamar a retirarGanancias.',
      defensa: 'Para la máquina el robot es otra dirección sin permisos.',
      esperado: ['SoloDueno'],
      correr: () => conRobot('Ataque: robot roba ganancias', (r) => r.robarGanancias()),
    },
    {
      id: 'reentrada',
      titulo: 'Reentrada (cobrar dos veces)',
      idea: 'El robot compra, devuelve y al cobrar el reembolso vuelve a llamar a retirarReembolso desde receive().',
      defensa:
        'El robot no está registrado, así que ni compra. Si se infiltrara, el candado sinReentrada y poner el saldo en 0 antes de pagar lo frenan (lo prueba npm test).',
      esperado: ['UsuarioNoRegistrado', 'Reentrada'],
      correr: () => conRobot('Ataque: reentrada', (r) => r.atacarReembolso(0, { value: precio0 })),
    },
  ];

  async function lanzar(ataque) {
    setResultados((r) => ({ ...r, [ataque.id]: { estado: 'corriendo' } }));
    const antes = huella(await leerMaquina(maquina.direccion, billeteras));
    const r = await ataque.correr();
    const despues = huella(await leerMaquina(maquina.direccion, billeteras));
    const intacta = antes === despues;
    const bloqueado = !r.ok && ataque.esperado.includes(r.error.nombre) && intacta;
    setResultados((prev) => ({
      ...prev,
      [ataque.id]: {
        estado: bloqueado ? 'bloqueado' : 'vulnerable',
        texto: r.ok
          ? '¡La transacción pasó!'
          : `${r.error.nombre ?? 'Error'}: ${r.error.texto}${intacta ? '' : ' (¡pero el estado cambió!)'}`,
      },
    }));
  }

  async function lanzarTodos() {
    for (const a of ATAQUES) await lanzar(a);
  }

  if (!visible) return null;
  const hechos = Object.values(resultados).filter((r) => r.estado === 'bloqueado').length;

  return (
    <section className="caja atacante">
      <h2>
        <PixelArte sprite="sombra" avatar tamano={28} /> GUARIDA DE SOMBRA
      </h2>
      <p className="nota">
        Cada intento usa la billetera del atacante. Se marca <b className="verde-t">BLOQUEADO</b> solo si la máquina lo
        rechaza con el error esperado y su estado (dinero, stock, usuarios) no cambia.
      </p>
      <div className="marcador">
        <PixelArte sprite="candado" tamano={22} />
        <span>
          {hechos}/{ATAQUES.length} BLOQUEADOS
        </span>
        <button className="boton mini rojo" disabled={ocupado} onClick={lanzarTodos}>
          ☠ LANZAR TODOS
        </button>
      </div>
      <ul className="ataques">
        {ATAQUES.map((a) => {
          const r = resultados[a.id];
          return (
            <li key={a.id} className={r?.estado ?? ''}>
              <div className="ataque-cabeza">
                <PixelArte sprite={r?.estado === 'bloqueado' ? 'candado' : 'calavera'} tamano={18} />
                <b>{a.titulo}</b>
                <button className="boton mini rojo" disabled={ocupado} onClick={() => lanzar(a)}>
                  {r?.estado === 'corriendo' ? '…' : 'ATACAR'}
                </button>
              </div>
              <p>{a.idea}</p>
              {r && r.estado !== 'corriendo' && (
                <p className={`resultado ${r.estado}`}>
                  {r.estado === 'bloqueado' ? '🛡 BLOQUEADO · ' : '⚠ VULNERABLE · '}
                  {r.texto}
                </p>
              )}
              {r?.estado === 'bloqueado' && <p className="defensa">Defensa: {a.defensa}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
