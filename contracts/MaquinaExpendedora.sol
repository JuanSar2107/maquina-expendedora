// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

/// @title MaquinaExpendedora
/// @notice Máquina expendedora con varios productos de precios distintos y hasta 4 usuarios.
///         Cada usuario paga con su propia billetera y debe enviar EXACTAMENTE el precio:
///         si envía de menos o de más, la compra se rechaza y no pierde nada.
/// @dev Defensas aplicadas:
///      - Control de acceso: solo el dueño administra; solo usuarios registrados compran.
///      - Pago exacto: PagoInsuficiente / PagoExcesivo.
///      - Candado anti-reentrada en toda función que mueve dinero.
///      - Patrón checks-effects-interactions: el estado cambia antes de enviar ETH.
///      - Retiro por "pull": cada quien cobra lo suyo; nadie puede cobrar por otro.
///      - Contabilidad propia (`ganancias`, `reembolsos`): el ETH enviado a la fuerza
///        no altera lo que cada parte puede retirar.
///      - Sin receive/fallback que acepten dinero: no se puede "regalar" ETH por error.
contract MaquinaExpendedora {
    // --- CONSTANTES ---
    uint256 public constant MAX_USUARIOS = 4;
    uint256 public constant MAX_PRODUCTOS = 12;
    uint256 public constant MAX_EXISTENCIAS = 99;

    // --- TIPOS ---
    struct Producto {
        string nombre;
        uint256 precio; // en wei
        uint256 existencias;
    }

    // --- ERRORES ---
    error SoloDueno(address llamador);
    error UsuarioNoRegistrado(address llamador);
    error UsuarioYaRegistrado(address usuario);
    error CupoLleno(uint256 maximo);
    error DireccionInvalida();
    error CatalogoInvalido();
    error PrecioInvalido(uint256 id);
    error PrecioRepetido(uint256 precio);
    error CantidadInvalida();
    error ProductoInexistente(uint256 id);
    error SinExistencias(uint256 id);
    error PagoInsuficiente(uint256 enviado, uint256 precio);
    error PagoExcesivo(uint256 enviado, uint256 precio);
    error MaquinaPausada();
    error SinCompras(uint256 id);
    error FondosInsuficientes(uint256 disponible, uint256 requerido);
    error SinGanancias();
    error SinReembolso();
    error TransferenciaFallida();
    error Reentrada();
    error PagoDirectoNoPermitido();

    // --- ESTADO ---
    address public immutable dueno;
    bool public pausada;
    uint256 public ganancias; // lo que el dueño puede retirar
    uint256 public totalVentas;

    Producto[] private _productos;
    address[] private _usuarios;
    mapping(address => bool) public esUsuario;
    mapping(address => mapping(uint256 => uint256)) public compras; // usuario => id => unidades
    mapping(address => uint256) public reembolsos; // saldo devuelto pendiente de cobrar

    uint256 private _candado = 1;

    // --- EVENTOS ---
    event UsuarioRegistrado(address indexed usuario);
    event Compra(address indexed usuario, uint256 indexed id, uint256 precio, uint256 idVenta);
    event Devolucion(address indexed usuario, uint256 indexed id, uint256 precio);
    event ReembolsoCobrado(address indexed usuario, uint256 monto);
    event GananciasRetiradas(address indexed dueno, uint256 monto);
    event Repuesto(uint256 indexed id, uint256 cantidad, uint256 existencias);
    event Pausa(bool pausada);

    // --- MODIFICADORES ---
    modifier soloDueno() {
        if (msg.sender != dueno) revert SoloDueno(msg.sender);
        _;
    }

    modifier soloUsuario() {
        if (!esUsuario[msg.sender]) revert UsuarioNoRegistrado(msg.sender);
        _;
    }

    modifier sinReentrada() {
        if (_candado == 2) revert Reentrada();
        _candado = 2;
        _;
        _candado = 1;
    }

    modifier existe(uint256 id) {
        if (id >= _productos.length) revert ProductoInexistente(id);
        _;
    }

    /// @param nombres Nombres de los productos.
    /// @param precios Precio de cada producto en wei: mayor que cero y todos distintos.
    /// @param existencias Unidades iniciales de cada producto (máximo MAX_EXISTENCIAS).
    /// @param usuariosIniciales Hasta 4 billeteras que podrán comprar.
    constructor(
        string[] memory nombres,
        uint256[] memory precios,
        uint256[] memory existencias,
        address[] memory usuariosIniciales
    ) {
        uint256 total = nombres.length;
        if (total == 0 || total > MAX_PRODUCTOS || precios.length != total || existencias.length != total) {
            revert CatalogoInvalido();
        }
        dueno = msg.sender;

        for (uint256 i = 0; i < total; i++) {
            if (precios[i] == 0) revert PrecioInvalido(i);
            if (existencias[i] > MAX_EXISTENCIAS) revert CantidadInvalida();
            for (uint256 j = 0; j < i; j++) {
                if (precios[j] == precios[i]) revert PrecioRepetido(precios[i]);
            }
            _productos.push(Producto(nombres[i], precios[i], existencias[i]));
        }

        for (uint256 i = 0; i < usuariosIniciales.length; i++) {
            _registrar(usuariosIniciales[i]);
        }
    }

    // --- ADMINISTRACIÓN (solo dueño) ---

    function registrarUsuario(address usuario) external soloDueno {
        _registrar(usuario);
    }

    function reponer(uint256 id, uint256 cantidad) external soloDueno existe(id) {
        if (cantidad == 0) revert CantidadInvalida();
        Producto storage p = _productos[id];
        if (p.existencias + cantidad > MAX_EXISTENCIAS) revert CantidadInvalida();
        p.existencias += cantidad;
        emit Repuesto(id, cantidad, p.existencias);
    }

    function cambiarPausa(bool pausar) external soloDueno {
        pausada = pausar;
        emit Pausa(pausar);
    }

    function retirarGanancias() external soloDueno sinReentrada {
        uint256 monto = ganancias;
        if (monto == 0) revert SinGanancias();
        ganancias = 0; // efecto antes de la interacción

        (bool ok, ) = dueno.call{value: monto}("");
        if (!ok) revert TransferenciaFallida();
        emit GananciasRetiradas(dueno, monto);
    }

    // --- USUARIOS ---

    /// @notice Compra una unidad. Debes enviar exactamente el precio del producto.
    function comprar(uint256 id) external payable sinReentrada soloUsuario existe(id) {
        if (pausada) revert MaquinaPausada();
        Producto storage p = _productos[id];
        if (p.existencias == 0) revert SinExistencias(id);
        if (msg.value < p.precio) revert PagoInsuficiente(msg.value, p.precio);
        if (msg.value > p.precio) revert PagoExcesivo(msg.value, p.precio);

        p.existencias -= 1;
        compras[msg.sender][id] += 1;
        ganancias += msg.value;
        totalVentas += 1;
        emit Compra(msg.sender, id, msg.value, totalVentas);
    }

    /// @notice Devuelve una unidad comprada. El precio queda como reembolso para cobrar.
    function devolver(uint256 id) external sinReentrada soloUsuario existe(id) {
        if (compras[msg.sender][id] == 0) revert SinCompras(id);
        uint256 precio = _productos[id].precio;
        if (ganancias < precio) revert FondosInsuficientes(ganancias, precio);

        compras[msg.sender][id] -= 1;
        _productos[id].existencias += 1;
        ganancias -= precio;
        reembolsos[msg.sender] += precio;
        emit Devolucion(msg.sender, id, precio);
    }

    /// @notice Cobra el saldo de devoluciones. Cada quien solo puede cobrar el suyo.
    function retirarReembolso() external sinReentrada {
        uint256 monto = reembolsos[msg.sender];
        if (monto == 0) revert SinReembolso();
        reembolsos[msg.sender] = 0; // efecto antes de la interacción

        (bool ok, ) = msg.sender.call{value: monto}("");
        if (!ok) revert TransferenciaFallida();
        emit ReembolsoCobrado(msg.sender, monto);
    }

    // --- CONSULTAS ---

    function verProductos() external view returns (Producto[] memory) {
        return _productos;
    }

    function verUsuarios() external view returns (address[] memory) {
        return _usuarios;
    }

    /// @notice Unidades que tiene un usuario de cada producto, en el orden del catálogo.
    function inventarioDe(address usuario) external view returns (uint256[] memory unidades) {
        unidades = new uint256[](_productos.length);
        for (uint256 i = 0; i < _productos.length; i++) {
            unidades[i] = compras[usuario][i];
        }
    }

    // --- RECHAZO DE PAGOS DIRECTOS ---

    receive() external payable {
        revert PagoDirectoNoPermitido();
    }

    fallback() external payable {
        revert PagoDirectoNoPermitido();
    }

    // --- INTERNO ---

    function _registrar(address usuario) private {
        if (usuario == address(0) || usuario == address(this)) revert DireccionInvalida();
        if (esUsuario[usuario]) revert UsuarioYaRegistrado(usuario);
        if (_usuarios.length >= MAX_USUARIOS) revert CupoLleno(MAX_USUARIOS);
        esUsuario[usuario] = true;
        _usuarios.push(usuario);
        emit UsuarioRegistrado(usuario);
    }
}
