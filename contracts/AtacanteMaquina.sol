// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

interface IMaquina {
    function comprar(uint256 id) external payable;
    function devolver(uint256 id) external;
    function retirarReembolso() external;
    function retirarGanancias() external;
}

/// @title AtacanteMaquina
/// @notice Perfil del atacante. Intenta robar a la máquina de varias formas:
///         - Reentrada: al cobrar un reembolso, vuelve a llamar a retirarReembolso()
///           desde receive() para cobrar dos veces el mismo saldo.
///         - Robar ganancias: llama a retirarGanancias() sin ser el dueño.
/// @dev Solo para pruebas en una cadena local.
contract AtacanteMaquina {
    IMaquina public immutable maquina;
    address public immutable jefe;

    uint256 public intentosReentrada;
    bool public reentradaExitosa;
    bytes public errorReentrada; // error con el que la máquina frenó la reentrada

    error SoloJefe();

    constructor(address maquina_) {
        maquina = IMaquina(maquina_);
        jefe = msg.sender;
    }

    modifier soloJefe() {
        if (msg.sender != jefe) revert SoloJefe();
        _;
    }

    /// @notice Compra, devuelve y cobra el reembolso intentando cobrarlo dos veces.
    function atacarReembolso(uint256 id) external payable soloJefe {
        intentosReentrada = 0;
        reentradaExitosa = false;
        maquina.comprar{value: msg.value}(id);
        maquina.devolver(id);
        maquina.retirarReembolso();
    }

    function robarGanancias() external soloJefe {
        maquina.retirarGanancias();
    }

    receive() external payable {
        if (intentosReentrada == 0) {
            intentosReentrada = 1;
            try maquina.retirarReembolso() {
                reentradaExitosa = true;
            } catch (bytes memory motivo) {
                errorReentrada = motivo;
            }
        }
    }

    /// @notice Devuelve al jefe lo que tenga el contrato.
    function recuperar() external soloJefe {
        (bool ok, ) = jefe.call{value: address(this).balance}("");
        require(ok);
    }
}
