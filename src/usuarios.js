// Cada personaje usa, en orden, una cuenta de la cadena local (hardhat node).
// La cuenta 0 es el dueño que despliega la máquina; las 1–4 son los 4 usuarios
// registrados; la 5 es el atacante, que nunca queda registrado.
export const PERSONAJES = [
  { nombre: 'Don Pixel', rol: 'Dueño', avatar: 'dueno', color: '#ffd23f', dueno: true },
  { nombre: 'Ana', rol: 'Usuaria 1', avatar: 'ana', color: '#3fc1ff' },
  { nombre: 'Beto', rol: 'Usuario 2', avatar: 'beto', color: '#5cff7a' },
  { nombre: 'Caro', rol: 'Usuaria 3', avatar: 'caro', color: '#ff7ad9' },
  { nombre: 'Dani', rol: 'Usuario 4', avatar: 'dani', color: '#ff9f3f' },
  { nombre: 'Sombra', rol: 'Atacante', avatar: 'sombra', color: '#ff3f5a', atacante: true },
];
