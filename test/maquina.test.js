const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

const eth = (v) => ethers.parseEther(v);

const NOMBRES = ['Agua', 'Soda', 'Papas', 'Chocolate'];
const PRECIOS = [eth('0.012'), eth('0.018'), eth('0.025'), eth('0.031')];
const EXISTENCIAS = [5, 5, 1, 3];

async function desplegar(usuarios) {
  const Maquina = await ethers.getContractFactory('MaquinaExpendedora');
  return Maquina.deploy(NOMBRES, PRECIOS, EXISTENCIAS, usuarios);
}

async function conMaquina() {
  const [dueno, ana, beto, caro, dani, hacker] = await ethers.getSigners();
  const maquina = await desplegar([ana.address, beto.address, caro.address, dani.address]);
  return { maquina, dueno, ana, beto, caro, dani, hacker };
}

// Máquina con 3 usuarios y el contrato atacante "infiltrado" como 4º usuario,
// para probar la defensa contra reentrada aunque el atacante logre registrarse.
async function conInfiltrado() {
  const [dueno, ana, beto, caro, hacker] = await ethers.getSigners();
  const maquina = await desplegar([ana.address, beto.address, caro.address]);
  const atacante = await (await ethers.getContractFactory('AtacanteMaquina'))
    .connect(hacker)
    .deploy(await maquina.getAddress());
  await maquina.registrarUsuario(await atacante.getAddress());
  // Otros usuarios compran para que la máquina tenga dinero que robar.
  await maquina.connect(ana).comprar(3, { value: PRECIOS[3] });
  await maquina.connect(beto).comprar(3, { value: PRECIOS[3] });
  return { maquina, atacante, dueno, ana, beto, caro, hacker };
}

describe('MaquinaExpendedora', () => {
  describe('despliegue', () => {
    it('guarda el catálogo, el dueño y los 4 usuarios', async () => {
      const { maquina, dueno, ana, dani } = await loadFixture(conMaquina);
      const productos = await maquina.verProductos();
      expect(productos.map((p) => p.nombre)).to.deep.equal(NOMBRES);
      expect(productos.map((p) => p.precio)).to.deep.equal(PRECIOS);
      expect(await maquina.dueno()).to.equal(dueno.address);
      expect(await maquina.verUsuarios()).to.have.length(4);
      expect(await maquina.esUsuario(ana.address)).to.equal(true);
      expect(await maquina.esUsuario(dani.address)).to.equal(true);
    });

    it('rechaza precios repetidos', async () => {
      const Maquina = await ethers.getContractFactory('MaquinaExpendedora');
      await expect(Maquina.deploy(['A', 'B'], [eth('0.01'), eth('0.01')], [1, 1], []))
        .to.be.revertedWithCustomError(Maquina, 'PrecioRepetido').withArgs(eth('0.01'));
    });

    it('rechaza precios en cero', async () => {
      const Maquina = await ethers.getContractFactory('MaquinaExpendedora');
      await expect(Maquina.deploy(['A'], [0], [1], []))
        .to.be.revertedWithCustomError(Maquina, 'PrecioInvalido').withArgs(0);
    });

    it('rechaza más de 4 usuarios', async () => {
      const s = await ethers.getSigners();
      const Maquina = await ethers.getContractFactory('MaquinaExpendedora');
      await expect(Maquina.deploy(NOMBRES, PRECIOS, EXISTENCIAS, s.slice(1, 6).map((x) => x.address)))
        .to.be.revertedWithCustomError(Maquina, 'CupoLleno').withArgs(4);
    });

    it('rechaza un catálogo con largos distintos', async () => {
      const Maquina = await ethers.getContractFactory('MaquinaExpendedora');
      await expect(Maquina.deploy(['A', 'B'], [1], [1, 1], [])).to.be.revertedWithCustomError(Maquina, 'CatalogoInvalido');
    });
  });

  describe('comprar', () => {
    it('vende al pagar el precio exacto y cobra a la billetera del usuario', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      const tx = maquina.connect(ana).comprar(1, { value: PRECIOS[1] });
      await expect(tx).to.emit(maquina, 'Compra').withArgs(ana.address, 1, PRECIOS[1], 1);
      await expect(tx).to.changeEtherBalances([ana, maquina], [-PRECIOS[1], PRECIOS[1]]);
      expect(await maquina.compras(ana.address, 1)).to.equal(1);
      expect((await maquina.verProductos())[1].existencias).to.equal(4);
      expect(await maquina.ganancias()).to.equal(PRECIOS[1]);
    });

    it('cada usuario tiene su propio inventario', async () => {
      const { maquina, ana, beto } = await loadFixture(conMaquina);
      await maquina.connect(ana).comprar(0, { value: PRECIOS[0] });
      await maquina.connect(beto).comprar(3, { value: PRECIOS[3] });
      expect(await maquina.inventarioDe(ana.address)).to.deep.equal([1n, 0n, 0n, 0n]);
      expect(await maquina.inventarioDe(beto.address)).to.deep.equal([0n, 0n, 0n, 1n]);
    });

    it('da error si paga de menos', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      const poco = PRECIOS[2] - 1n;
      await expect(maquina.connect(ana).comprar(2, { value: poco }))
        .to.be.revertedWithCustomError(maquina, 'PagoInsuficiente').withArgs(poco, PRECIOS[2]);
    });

    it('da error si paga de más', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      const mucho = PRECIOS[2] + 1n;
      await expect(maquina.connect(ana).comprar(2, { value: mucho }))
        .to.be.revertedWithCustomError(maquina, 'PagoExcesivo').withArgs(mucho, PRECIOS[2]);
    });

    it('da error si el producto se agotó', async () => {
      const { maquina, ana, beto } = await loadFixture(conMaquina);
      await maquina.connect(ana).comprar(2, { value: PRECIOS[2] });
      await expect(maquina.connect(beto).comprar(2, { value: PRECIOS[2] }))
        .to.be.revertedWithCustomError(maquina, 'SinExistencias').withArgs(2);
    });

    it('da error si el producto no existe', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      await expect(maquina.connect(ana).comprar(99, { value: 1 }))
        .to.be.revertedWithCustomError(maquina, 'ProductoInexistente').withArgs(99);
    });

    it('no vende con la máquina pausada', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      await maquina.cambiarPausa(true);
      await expect(maquina.connect(ana).comprar(0, { value: PRECIOS[0] }))
        .to.be.revertedWithCustomError(maquina, 'MaquinaPausada');
    });
  });

  describe('devolver y reembolso', () => {
    it('devuelve el producto y deja el reembolso para cobrar', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      await maquina.connect(ana).comprar(0, { value: PRECIOS[0] });
      await expect(maquina.connect(ana).devolver(0)).to.emit(maquina, 'Devolucion').withArgs(ana.address, 0, PRECIOS[0]);
      expect(await maquina.reembolsos(ana.address)).to.equal(PRECIOS[0]);
      expect(await maquina.ganancias()).to.equal(0);
      await expect(maquina.connect(ana).retirarReembolso()).to.changeEtherBalances([ana, maquina], [PRECIOS[0], -PRECIOS[0]]);
      expect(await maquina.reembolsos(ana.address)).to.equal(0);
    });

    it('no deja devolver lo que no compró', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      await expect(maquina.connect(ana).devolver(1)).to.be.revertedWithCustomError(maquina, 'SinCompras').withArgs(1);
    });

    it('no deja cobrar un reembolso inexistente', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      await expect(maquina.connect(ana).retirarReembolso()).to.be.revertedWithCustomError(maquina, 'SinReembolso');
    });

    it('no devuelve si el dueño ya retiró el dinero', async () => {
      const { maquina, ana } = await loadFixture(conMaquina);
      await maquina.connect(ana).comprar(0, { value: PRECIOS[0] });
      await maquina.retirarGanancias();
      await expect(maquina.connect(ana).devolver(0))
        .to.be.revertedWithCustomError(maquina, 'FondosInsuficientes').withArgs(0, PRECIOS[0]);
    });
  });

  describe('dueño', () => {
    it('retira solo las ganancias', async () => {
      const { maquina, dueno, ana } = await loadFixture(conMaquina);
      await maquina.connect(ana).comprar(3, { value: PRECIOS[3] });
      await expect(maquina.retirarGanancias()).to.changeEtherBalances([dueno, maquina], [PRECIOS[3], -PRECIOS[3]]);
      await expect(maquina.retirarGanancias()).to.be.revertedWithCustomError(maquina, 'SinGanancias');
    });

    it('repone existencias sin pasar del máximo', async () => {
      const { maquina } = await loadFixture(conMaquina);
      await expect(maquina.reponer(2, 4)).to.emit(maquina, 'Repuesto').withArgs(2, 4, 5);
      await expect(maquina.reponer(2, 95)).to.be.revertedWithCustomError(maquina, 'CantidadInvalida');
      await expect(maquina.reponer(2, 0)).to.be.revertedWithCustomError(maquina, 'CantidadInvalida');
    });
  });

  describe('atacante', () => {
    it('no puede comprar sin estar registrado', async () => {
      const { maquina, hacker } = await loadFixture(conMaquina);
      await expect(maquina.connect(hacker).comprar(0, { value: PRECIOS[0] }))
        .to.be.revertedWithCustomError(maquina, 'UsuarioNoRegistrado').withArgs(hacker.address);
    });

    it('no puede registrarse ni registrar a otros', async () => {
      const { maquina, hacker } = await loadFixture(conMaquina);
      await expect(maquina.connect(hacker).registrarUsuario(hacker.address))
        .to.be.revertedWithCustomError(maquina, 'SoloDueno').withArgs(hacker.address);
    });

    it('el dueño tampoco puede pasar del cupo de 4 usuarios', async () => {
      const { maquina, hacker } = await loadFixture(conMaquina);
      await expect(maquina.registrarUsuario(hacker.address)).to.be.revertedWithCustomError(maquina, 'CupoLleno').withArgs(4);
    });

    it('no puede retirar las ganancias del dueño', async () => {
      const { maquina, ana, hacker } = await loadFixture(conMaquina);
      await maquina.connect(ana).comprar(0, { value: PRECIOS[0] });
      await expect(maquina.connect(hacker).retirarGanancias())
        .to.be.revertedWithCustomError(maquina, 'SoloDueno').withArgs(hacker.address);
      expect(await maquina.ganancias()).to.equal(PRECIOS[0]);
    });

    it('no puede reponer, pausar ni cobrar reembolsos ajenos', async () => {
      const { maquina, ana, hacker } = await loadFixture(conMaquina);
      await expect(maquina.connect(hacker).reponer(0, 1)).to.be.revertedWithCustomError(maquina, 'SoloDueno');
      await expect(maquina.connect(hacker).cambiarPausa(true)).to.be.revertedWithCustomError(maquina, 'SoloDueno');
      await maquina.connect(ana).comprar(0, { value: PRECIOS[0] });
      await maquina.connect(ana).devolver(0);
      await expect(maquina.connect(hacker).retirarReembolso()).to.be.revertedWithCustomError(maquina, 'SinReembolso');
      expect(await maquina.reembolsos(ana.address)).to.equal(PRECIOS[0]);
    });

    it('no puede enviar ETH directo a la máquina', async () => {
      const { maquina, hacker } = await loadFixture(conMaquina);
      await expect(hacker.sendTransaction({ to: await maquina.getAddress(), value: eth('1') }))
        .to.be.revertedWithCustomError(maquina, 'PagoDirectoNoPermitido');
      await expect(hacker.sendTransaction({ to: await maquina.getAddress(), data: '0xdeadbeef' }))
        .to.be.revertedWithCustomError(maquina, 'PagoDirectoNoPermitido');
    });

    it('su contrato no puede robar las ganancias', async () => {
      const { maquina, atacante, hacker } = await loadFixture(conInfiltrado);
      await expect(atacante.connect(hacker).robarGanancias())
        .to.be.revertedWithCustomError(maquina, 'SoloDueno').withArgs(await atacante.getAddress());
    });

    it('la reentrada falla aunque el atacante se infiltre como usuario', async () => {
      const { maquina, atacante, hacker } = await loadFixture(conInfiltrado);
      const direccionMaquina = await maquina.getAddress();
      const antes = await ethers.provider.getBalance(direccionMaquina);
      const gananciasAntes = await maquina.ganancias();

      await atacante.connect(hacker).atacarReembolso(0, { value: PRECIOS[0] });

      expect(await atacante.intentosReentrada()).to.equal(1);
      expect(await atacante.reentradaExitosa()).to.equal(false);
      const selector = maquina.interface.getError('Reentrada').selector;
      expect(await atacante.errorReentrada()).to.equal(selector);
      // Solo recuperó lo que pagó: la máquina queda igual que antes.
      expect(await ethers.provider.getBalance(await atacante.getAddress())).to.equal(PRECIOS[0]);
      expect(await ethers.provider.getBalance(direccionMaquina)).to.equal(antes);
      expect(await maquina.ganancias()).to.equal(gananciasAntes);
    });

    it('tras el ataque no le queda saldo de reembolso por cobrar', async () => {
      const { maquina, atacante, hacker } = await loadFixture(conInfiltrado);
      await atacante.connect(hacker).atacarReembolso(0, { value: PRECIOS[0] });
      expect(await maquina.reembolsos(await atacante.getAddress())).to.equal(0);
    });
  });
});
