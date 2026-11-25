// Copia el ABI y el bytecode compilados a src/contratos para que el frontend los use.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
for (const nombre of ['MaquinaExpendedora', 'AtacanteMaquina']) {
  const origen = path.join(raiz, 'artifacts', 'contracts', `${nombre}.sol`, `${nombre}.json`);
  const { abi, bytecode } = JSON.parse(fs.readFileSync(origen, 'utf8'));
  const destino = path.join(raiz, 'src', 'contratos', `${nombre}.json`);
  fs.writeFileSync(destino, JSON.stringify({ contractName: nombre, abi, bytecode }, null, 2) + '\n');
  console.log(`✔ ${path.relative(raiz, destino)}`);
}
