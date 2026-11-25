import { Interface, JsonRpcProvider, formatEther } from 'ethers';
import Maquina from './contratos/MaquinaExpendedora.json';
import Atacante from './contratos/AtacanteMaquina.json';

export const URL_RPC = import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545';
export const CHAIN_ID = 31337;

export const proveedor = new JsonRpcProvider(URL_RPC, CHAIN_ID, {
  staticNetwork: true,
  cacheTimeout: -1,
});

export const ABI_MAQUINA = Maquina.abi;
export const ABI_ATACANTE = Atacante.abi;
export const BYTECODE_MAQUINA = Maquina.bytecode;
export const BYTECODE_ATACANTE = Atacante.bytecode;

// Una sola interfaz con los errores de ambos contratos para traducir cualquier fallo.
const errores = new Interface([...ABI_MAQUINA, ...ABI_ATACANTE].filter((f) => f.type === 'error'));

/** Verifica con una petición simple que la cadena local esté encendida. */
export async function comprobarCadena() {
  const respuesta = await fetch(URL_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
  });
  const { result } = await respuesta.json();
  if (Number(result) !== CHAIN_ID) {
    throw new Error(`La cadena en ${URL_RPC} no es la local (chainId ${CHAIN_ID}).`);
  }
}

export const direccionCorta = (d) => `${d.slice(0, 6)}…${d.slice(-4)}`;

export const enEth = (wei, decimales = 4) =>
  Number(formatEther(wei)).toLocaleString('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: decimales });

export function nombreDe(direccion, billeteras) {
  const usuario = billeteras.find((b) => b.direccion.toLowerCase() === String(direccion).toLowerCase());
  return usuario ? usuario.nombre : direccionCorta(direccion);
}

const MENSAJES = {
  SoloDueno: ([quien], b) => `${nombreDe(quien, b)} no es el dueño de la máquina.`,
  UsuarioNoRegistrado: ([quien], b) => `${nombreDe(quien, b)} no está registrado en la máquina.`,
  UsuarioYaRegistrado: ([quien], b) => `${nombreDe(quien, b)} ya estaba registrado.`,
  CupoLleno: ([max]) => `La máquina ya tiene ${max} usuarios: no caben más.`,
  DireccionInvalida: () => 'La dirección no es válida.',
  CatalogoInvalido: () => 'El catálogo no es válido.',
  PrecioInvalido: ([id]) => `El producto ${id} tiene precio cero.`,
  PrecioRepetido: ([p]) => `Hay dos productos con el mismo precio (${formatEther(p)} ETH).`,
  CantidadInvalida: () => 'La cantidad no es válida (máximo 99 por producto).',
  ProductoInexistente: ([id]) => `No existe el producto ${id}.`,
  SinExistencias: () => 'Producto agotado.',
  PagoInsuficiente: ([env, precio]) => `Pagaste ${formatEther(env)} ETH y el precio es ${formatEther(precio)} ETH. Falta dinero.`,
  PagoExcesivo: ([env, precio]) => `Pagaste ${formatEther(env)} ETH y el precio es ${formatEther(precio)} ETH. Sobra dinero.`,
  MaquinaPausada: () => 'La máquina está pausada por el dueño.',
  SinCompras: () => 'No tienes ese producto para devolver.',
  FondosInsuficientes: ([disp, req]) => `La máquina tiene ${formatEther(disp)} ETH y se necesitan ${formatEther(req)} ETH.`,
  SinGanancias: () => 'No hay ganancias para retirar.',
  SinReembolso: () => 'No hay reembolso para cobrar en esta billetera.',
  TransferenciaFallida: () => 'La transferencia de ETH falló.',
  Reentrada: () => 'Llamada reentrante bloqueada por el candado.',
  PagoDirectoNoPermitido: () => 'La máquina no acepta ETH enviado directamente.',
  SoloJefe: () => 'Solo quien desplegó el contrato atacante puede usarlo.',
};

/** Extrae el nombre y los argumentos del error del contrato, si los hay. */
export function leerErrorContrato(error) {
  const datos = [error?.data, error?.info?.error?.data?.data, error?.info?.error?.data, error?.error?.data].find(
    (d) => typeof d === 'string' && d.startsWith('0x') && d.length >= 10,
  );
  if (!datos) return null;
  try {
    return errores.parseError(datos);
  } catch {
    return null;
  }
}

/** Traduce un fallo de la cadena a un texto claro. */
export function describirError(error, billeteras) {
  const conocido = leerErrorContrato(error);
  if (conocido) {
    const explicar = MENSAJES[conocido.name];
    return { nombre: conocido.name, texto: explicar ? explicar(conocido.args, billeteras) : conocido.name };
  }
  return { nombre: null, texto: error?.shortMessage ?? error?.message ?? 'Error desconocido.' };
}
