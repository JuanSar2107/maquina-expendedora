import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'ethers';
import { CADENA_REMOTA, URL_RPC, comprobarCadena, describirError, proveedor } from './cadena.js';
import { PERSONAJES } from './usuarios.js';
import Billeteras from './componentes/Billeteras.jsx';
import Maquina from './componentes/Maquina.jsx';
import Bolsillo from './componentes/Bolsillo.jsx';
import PanelDueno from './componentes/PanelDueno.jsx';
import ZonaAtacante from './componentes/ZonaAtacante.jsx';
import Actividad from './componentes/Actividad.jsx';
import Encender from './componentes/Encender.jsx';
import PixelArte from './componentes/Pixel.jsx';
import { leerMaquina } from './lectura.js';

const CLAVE = 'maquina-expendedora.direccion';

// La máquina se recuerda solo mientras la pestaña esté abierta (sobrevive a recargar).
// Al cerrar la página se olvida y vuelve a mostrarse el botón para encenderla.
localStorage.removeItem(CLAVE); // limpia lo que guardaban versiones anteriores

export default function App() {
  const [conectado, setConectado] = useState(null);
  const [bloque, setBloque] = useState(null);
  const [billeteras, setBilleteras] = useState([]);
  const [activa, setActiva] = useState(1);
  const [tick, setTick] = useState(0);
  const [direccion, setDireccion] = useState(() => sessionStorage.getItem(CLAVE) ?? '');
  const [maquina, setMaquina] = useState(null);
  const [actividad, setActividad] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  const refrescar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const id = setInterval(refrescar, 2500);
    return () => clearInterval(id);
  }, [refrescar]);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        await comprobarCadena();
        const [cuentas, numero] = await Promise.all([proveedor.send('eth_accounts', []), proveedor.send('eth_blockNumber', [])]);
        const lista = await Promise.all(
          PERSONAJES.slice(0, cuentas.length).map(async (p, i) => {
            const d = getAddress(cuentas[i]);
            return { ...p, direccion: d, saldo: await proveedor.getBalance(d) };
          }),
        );
        // Si la dirección guardada no es una máquina (p. ej. se reinició la cadena), se pide desplegar otra.
        const estado = direccion ? await leerMaquina(direccion, lista).catch(() => null) : null;
        if (!vigente) return;
        setBilleteras(lista);
        setBloque(Number(numero));
        setMaquina(estado);
        setConectado(true);
      } catch {
        if (vigente) setConectado(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [tick, direccion]);

  function guardarDireccion(d) {
    sessionStorage.setItem(CLAVE, d);
    setDireccion(d);
  }

  /**
   * Firma una transacción con la billetera indicada (por defecto la activa) y la anota.
   * Devuelve { ok, recibo, error } para que cada panel reaccione a su manera.
   */
  async function ejecutar(titulo, accion, { usuario = billeteras[activa], silencioso = false } = {}) {
    const anotar = (e) =>
      setActividad((prev) => [{ id: crypto.randomUUID(), titulo, usuario, hora: new Date(), ...e }, ...prev].slice(0, 40));
    setOcupado(true);
    try {
      const firmante = await proveedor.getSigner(usuario.direccion);
      const resultado = await accion(firmante);
      const tx = resultado.wait ? resultado : resultado.deploymentTransaction();
      const recibo = await tx.wait();
      if (!silencioso) anotar({ exito: true, detalle: `Confirmada en el bloque ${recibo.blockNumber}`, hash: recibo.hash });
      return { ok: true, recibo, resultado };
    } catch (e) {
      const error = describirError(e, billeteras);
      if (!silencioso) anotar({ exito: false, detalle: error.nombre ? `${error.nombre}: ${error.texto}` : error.texto });
      return { ok: false, error };
    } finally {
      setOcupado(false);
      refrescar();
    }
  }

  const actual = billeteras[activa];
  const listo = conectado && maquina && actual;

  return (
    <div className="pagina">
      <header className="encabezado">
        <div className="logo">
          <PixelArte sprite="moneda" tamano={36} />
          <div>
            <h1>MÁQUINA PIXEL</h1>
            <p>Expendedora en tu cadena local</p>
          </div>
        </div>
        <span className={`estado ${conectado ? 'ok' : 'mal'}`}>
          {conectado === null ? 'CONECTANDO…' : conectado ? `● EN LÍNEA · BLOQUE ${bloque}` : '● SIN CONEXIÓN'}
        </span>
      </header>

      {conectado === false && (
        <section className="caja aviso">
          <h2>{CADENA_REMOTA ? 'La cadena no responde' : 'La cadena local no responde'}</h2>
          {CADENA_REMOTA ? (
            <p>
              La cadena del servidor está arrancando o se reinició. Espera unos segundos: esta página vuelve a conectarse
              sola a <code>{URL_RPC}</code>.
            </p>
          ) : (
            <p>
              Abre una terminal en <code>maquina-expendedora</code>, ejecuta <code>npm run cadena</code> y déjala abierta.
              Esta página se conecta sola a <code>{URL_RPC}</code>.
            </p>
          )}
        </section>
      )}

      {conectado && !maquina && billeteras.length > 0 && (
        <Encender billeteras={billeteras} ocupado={ocupado} ejecutar={ejecutar} onDesplegada={guardarDireccion} huboAntes={!!direccion} />
      )}

      {listo && (
        <>
          <Billeteras billeteras={billeteras} activa={activa} onElegir={setActiva} maquina={maquina} />
          <main className="escenario">
            <Maquina maquina={maquina} usuario={actual} ocupado={ocupado} ejecutar={ejecutar} />
            <aside className="lateral">
              {actual.dueno && <PanelDueno maquina={maquina} ocupado={ocupado} ejecutar={ejecutar} onNueva={() => guardarDireccion('')} />}
              {!actual.dueno && !actual.atacante && (
                <Bolsillo maquina={maquina} usuario={actual} ocupado={ocupado} ejecutar={ejecutar} />
              )}
              {/* Se mantiene montado (solo oculto) para no perder los resultados al cambiar de billetera. */}
              <ZonaAtacante
                key={maquina.direccion}
                visible={!!actual.atacante}
                atacante={billeteras.find((b) => b.atacante)}
                billeteras={billeteras}
                maquina={maquina}
                ocupado={ocupado}
                ejecutar={ejecutar}
              />
            </aside>
          </main>
          <Actividad actividad={actividad} />
        </>
      )}
    </div>
  );
}
