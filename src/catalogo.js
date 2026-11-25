// Catálogo con el que se despliega la máquina. Todos los precios son distintos
// (el contrato lo exige) y se escriben en ETH.
export const CATALOGO = [
  { nombre: 'Agua', precio: '0.012', existencias: 6, sprite: 'agua' },
  { nombre: 'Soda', precio: '0.018', existencias: 5, sprite: 'soda' },
  { nombre: 'Papas', precio: '0.025', existencias: 4, sprite: 'papas' },
  { nombre: 'Chocolate', precio: '0.031', existencias: 4, sprite: 'chocolate' },
  { nombre: 'Galleta', precio: '0.009', existencias: 8, sprite: 'galleta' },
  { nombre: 'Dona', precio: '0.044', existencias: 3, sprite: 'dona' },
  { nombre: 'Cafe', precio: '0.037', existencias: 5, sprite: 'cafe' },
  { nombre: 'Manzana', precio: '0.006', existencias: 7, sprite: 'manzana' },
  { nombre: 'Sandwich', precio: '0.052', existencias: 1, sprite: 'sandwich' },
];

export const spriteDe = (nombre) => CATALOGO.find((p) => p.nombre === nombre)?.sprite ?? 'caja';

export const codigoDe = (i) => `${'ABC'[Math.floor(i / 3)] ?? 'D'}${(i % 3) + 1}`;
