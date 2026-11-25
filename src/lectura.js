import { Contract, getAddress } from 'ethers';
import { ABI_MAQUINA, proveedor } from './cadena.js';

/** Lee todo lo que la interfaz necesita de la máquina en una sola pasada. */
export async function leerMaquina(direccion, billeteras) {
  if ((await proveedor.getCode(direccion)) === '0x') return null;
  const c = new Contract(direccion, ABI_MAQUINA, proveedor);
  const [productos, ganancias, pausada, totalVentas, balance, usuarios, dueno] = await Promise.all([
    c.verProductos(),
    c.ganancias(),
    c.pausada(),
    c.totalVentas(),
    proveedor.getBalance(direccion),
    c.verUsuarios(),
    c.dueno(),
  ]);
  const porUsuario = await Promise.all(
    billeteras.map(async (b) => [b.direccion, await c.inventarioDe(b.direccion), await c.reembolsos(b.direccion)]),
  );
  return {
    direccion,
    productos: productos.map((p) => ({ nombre: p.nombre, precio: p.precio, existencias: Number(p.existencias) })),
    ganancias,
    pausada,
    totalVentas: Number(totalVentas),
    balance,
    usuarios: usuarios.map((u) => getAddress(u)),
    dueno: getAddress(dueno),
    inventarios: Object.fromEntries(porUsuario.map(([d, inv]) => [d, inv.map(Number)])),
    reembolsos: Object.fromEntries(porUsuario.map(([d, , r]) => [d, r])),
  };
}
