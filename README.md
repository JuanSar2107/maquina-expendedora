# Máquina Pixel · Expendedora en Solidity

Una máquina expendedora como contrato inteligente, con frontend en React estilo pixel art.

- **9 productos con precios distintos** (el contrato rechaza precios repetidos o en cero).
- **Hasta 4 usuarios** registrados; cada uno paga con su propia billetera y tiene su propia mochila (inventario).
- **Pago exacto**: si pagas de menos → `PagoInsuficiente`; si pagas de más → `PagoExcesivo`. La transacción se revierte y no pierdes nada.
- **Devoluciones**: devuelves un producto y su precio queda como reembolso para cobrar.
- **Dueño**: retira ganancias, repone existencias y puede pausar las ventas.
- **Atacante (Sombra)**: un panel con 8 intentos de robo que el contrato bloquea.

## Requisitos

Node.js 22 o superior.

## Cómo ejecutarlo

Desde la carpeta `maquina-expendedora`:

```bash
npm install          # solo la primera vez
npm test             # 27 pruebas del contrato
npm run cadena       # terminal 1: cadena local (déjala abierta)
npm run dev          # terminal 2: la página
```

Abre <http://127.0.0.1:5174> y pulsa **ENCENDER MÁQUINA**. La máquina se recuerda mientras la pestaña siga abierta (también al recargar); al cerrar la página se olvida y vuelve a aparecer el botón para encender una nueva. Si ya tienes otra cadena Hardhat corriendo en el puerto 8545 (por ejemplo la del otro frontend del taller), la página la usa y no hace falta `npm run cadena`.

Si cambias un contrato: `npm run compilar` (compila y copia ABI y bytecode a `src/contratos/`).

## Cuentas

| Cuenta | Personaje | Rol |
| --- | --- | --- |
| 0 | Don Pixel | Dueño: despliega y administra |
| 1–4 | Ana, Beto, Caro, Dani | Los 4 usuarios registrados |
| 5 | Sombra | Atacante, nunca registrado |

## Seguridad: qué intenta el atacante y por qué falla

| Ataque | Defensa | Error |
| --- | --- | --- |
| Comprar sin estar registrado | Solo usuarios registrados compran | `UsuarioNoRegistrado` |
| Registrarse a sí mismo / 5º usuario | Solo el dueño registra; cupo máximo 4 | `SoloDueno` / `CupoLleno` |
| Robar las ganancias | `retirarGanancias` es solo del dueño | `SoloDueno` |
| Cobrar reembolsos ajenos | Cada billetera cobra solo su propio saldo (patrón *pull*) | `SinReembolso` |
| Pausar o inflar el stock | `cambiarPausa` y `reponer` son solo del dueño | `SoloDueno` |
| Enviar ETH directo | `receive`/`fallback` lo rechazan | `PagoDirectoNoPermitido` |
| Contrato robot (`AtacanteMaquina`) | Para la máquina es otra dirección sin permisos | `SoloDueno` |
| Reentrada al cobrar reembolso | Candado `sinReentrada` + saldo en 0 antes de enviar ETH | `Reentrada` |

En la página, un ataque se marca **BLOQUEADO** solo si la máquina lo rechaza con el error esperado *y* su estado (dinero, stock, usuarios, reembolsos) no cambió.

La reentrada se prueba a fondo en `test/maquina.test.js` con un escenario en el que el dueño registra por error el contrato atacante: aun así solo recupera lo que pagó. En la página el robot no está registrado, así que lo frena antes `UsuarioNoRegistrado`.

La contabilidad usa variables propias (`ganancias`, `reembolsos`), no `address(this).balance`, así que el ETH forzado (por ejemplo con `selfdestruct`) no altera lo que cada parte puede retirar.

## Archivos

- `contracts/MaquinaExpendedora.sol`: el contrato.
- `contracts/AtacanteMaquina.sol`: contrato del atacante (robo de ganancias y reentrada).
- `test/maquina.test.js`: pruebas de compras, errores de pago, devoluciones, dueño y ataques.
- `src/`: frontend en React; los sprites pixel art están en `src/sprites.js`.
