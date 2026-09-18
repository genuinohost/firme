import { useEffect, useState } from "react";
import type { Ajustes, Datos } from "@/datos/tipos";
import { exportar, importar } from "@/datos/almacen";
import { pedirPermisoAvisos } from "@/logica/alarmas";
import {
  abrirAjustesDeLaApp,
  estadoDespertador,
  hayDespertador,
  pararDespertador,
  pedirAccesoNoMolestar,
  pedirPantallaCompleta,
  pedirExencionBateria,
  abrirInicioAutomatico,
  copiarAlReloj,
  pedirPermisoExactas,
  probarDespertador,
  sonarYa,
  type EstadoDespertador,
} from "@/logica/despertador";
import {
  guardarClave,
  guardarModelo,
  leerClave,
  leerModelo,
  MODELO_POR_DEFECTO,
} from "@/logica/generador";
import { activarFirma, firmaActiva, leerFirma } from "@/logica/compartir";
import { Clipboard } from "@capacitor/clipboard";
import { esNativo } from "@/logica/alarmasNativas";
import { consejoDelFabricante, redactarParte } from "@/logica/parte";
import {
  hayVersionNueva,
  nombreInstalado,
  type VersionPublicada,
} from "@/logica/actualizacion";
import { parar, sonar } from "@/logica/sonido";
import { abrirEnlace } from "@/logica/enlaces";
import {
  acierta,
  graciaDeLaCerradura,
  hayCodigo,
  ponerCodigo,
  quitarCodigo,
} from "@/logica/cerradura";
import { AreaTexto, Boton, Campo, Entrada, Etiqueta, Selector, Tarjeta } from "./piezas";

export function PantallaAjustes({
  datos,
  onCambiarAjustes,
  onReemplazar,
  proximo,
  onProbar,
}: {
  datos: Datos;
  onCambiarAjustes: (ajustes: Ajustes) => void;
  onReemplazar: (datos: Datos) => void;
  /** El siguiente aviso de hoy, ya redactado. Null si no queda ninguno. */
  proximo: { nombre: string; hora: string; falta: string } | null;
  onProbar: () => void;
}) {
  const a = datos.ajustes;
  const cambiar = <C extends keyof Ajustes>(campo: C, valor: Ajustes[C]) =>
    onCambiarAjustes({ ...a, [campo]: valor });

  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default");
  const [instalable, setInstalable] = useState<Event | null>(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    setPermiso("Notification" in window ? Notification.permission : "no-soportado");
    const alInstalar = (e: Event) => {
      e.preventDefault();
      setInstalable(e);
    };
    window.addEventListener("beforeinstallprompt", alInstalar);
    return () => window.removeEventListener("beforeinstallprompt", alInstalar);
  }, []);

  const yaInstalada = window.matchMedia("(display-mode: standalone)").matches;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Ajustes</h1>
      </header>

      <Comprobacion
        permiso={permiso}
        yaInstalada={yaInstalada}
        proximo={proximo}
        onProbar={onProbar}
      />

      <ComprobacionSistema />

      <Version />

      <ParteDelDespertador />

      <Tarjeta>
        <Etiqueta>avisos y alarma</Etiqueta>
        <div className="mt-3 flex flex-col gap-3">
          {/* Fuera del APK: dentro, el permiso que manda es el de Android y lo
              informa «ComprobacionSistema». Aquí saldría siempre en rojo. */}
          {esNativo() ? null : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">Notificaciones del sistema</p>
              <p className="text-xs text-tenue">
                {permiso === "granted"
                  ? "Concedidas."
                  : permiso === "denied"
                    ? "Bloqueadas. Hay que activarlas en los ajustes del navegador."
                    : permiso === "no-soportado"
                      ? "Este navegador no las admite."
                      : "Sin conceder: la alarma solo sonará con la app abierta."}
              </p>
            </div>
            {permiso === "default" ? (
              <Boton
                variante="fuerte"
                onClick={async () => setPermiso(await pedirPermisoAvisos())}
              >
                Activar
              </Boton>
            ) : null}
          </div>
          )}

          {!esNativo() && !yaInstalada ? (
            <div className="flex items-center justify-between gap-3 border-t border-borde pt-3">
              <div className="min-w-0">
                <p className="text-sm">Instalar en el móvil</p>
                <p className="text-xs text-tenue">
                  Instalada funciona sin conexión y las alarmas aguantan mucho mejor.
                </p>
              </div>
              {instalable ? (
                <Boton
                  variante="fuerte"
                  onClick={() => {
                    void (instalable as Event & { prompt: () => Promise<void> }).prompt();
                    setInstalable(null);
                  }}
                >
                  Instalar
                </Boton>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-borde pt-3">
            <Campo etiqueta={`Volumen · ${Math.round(a.volumen * 100)} %`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={a.volumen}
                onChange={(e) => cambiar("volumen", Number(e.target.value))}
                onMouseUp={() => {
                  sonar("campana", a.volumen);
                  window.setTimeout(parar, 1800);
                }}
                onTouchEnd={() => {
                  sonar("campana", a.volumen);
                  window.setTimeout(parar, 1800);
                }}
                className="w-full accent-[var(--color-acento)]"
              />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Posponer (min)">
              <Selector
                value={a.posponerMin}
                onChange={(e) => cambiar("posponerMin", Number(e.target.value))}
              >
                {[2, 5, 10, 15].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Margen de gracia">
              <Selector
                value={a.graciaMin}
                onChange={(e) => cambiar("graciaMin", Number(e.target.value))}
              >
                {[0, 10, 20, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "sin margen" : `${m} min`}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
          <p className="text-xs leading-relaxed text-tenue">
            Pasado el margen, un bloque sin marcar cuenta como caída. Ponlo corto: el
            margen ancho es la puerta trasera de la disciplina.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta>
        <Etiqueta>frases de ánimo</Etiqueta>
        <div className="mt-3 flex flex-col gap-3">
          <Interruptor
            titulo="Versículos"
            detalle="Reina-Valera 1909."
            valor={a.usarVersiculos}
            onCambiar={(v) => cambiar("usarVersiculos", v)}
          />
          <Interruptor
            titulo="Estoicos y refranes"
            detalle="Séneca, Marco Aurelio, Epicteto."
            valor={a.usarEstoicos}
            onCambiar={(v) => cambiar("usarEstoicos", v)}
          />
          <FirmaAlCompartir />

          <div className="border-t border-borde pt-3">
            <Campo etiqueta="Tus propias frases (una por línea)">
              <AreaTexto
                rows={5}
                value={a.frasesPropias.join("\n")}
                onChange={(e) => cambiar("frasesPropias", e.target.value.split("\n"))}
                placeholder={"Acuérdate de por qué empezaste.\nNadie va a hacerlo por ti."}
              />
            </Campo>
            <p className="mt-1.5 text-xs text-tenue">
              Las tuyas salen con el doble de frecuencia que las del banco.
            </p>
          </div>
        </div>
      </Tarjeta>

      <ClaveOpenRouter />

      <RespaldoEnElReloj rutina={datos.rutina} />

      <Cerradura />

      <Tarjeta>
        <Etiqueta>tus datos</Etiqueta>
        <p className="mt-2 text-xs leading-relaxed text-tenue">
          Todo se guarda solo en este dispositivo. No hay servidor ni cuenta. Para
          pasarlo a otro móvil, o para no perderlo si borras el navegador, exporta una
          copia de vez en cuando.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Campo etiqueta="Tu nombre (opcional)">
            <Entrada
              value={a.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              placeholder="Tu nombre de pila"
            />
          </Campo>
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              <Boton
                ancho
                onClick={() => {
                  const blob = new Blob([exportar(datos)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const enlace = document.createElement("a");
                  enlace.href = url;
                  enlace.download = `firme-copia-${new Date().toISOString().slice(0, 10)}.json`;
                  enlace.click();
                  URL.revokeObjectURL(url);
                  setMensaje("Copia descargada.");
                }}
              >
                Exportar copia
              </Boton>
            </div>
            <div className="flex-1">
              <label className="block cursor-pointer rounded-xl border border-borde bg-superficie-alta px-4 py-3 text-center text-sm transition hover:border-tenue">
                Importar
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const archivo = e.target.files?.[0];
                    if (!archivo) return;
                    const importados = importar(await archivo.text());
                    if (importados) {
                      onReemplazar(importados);
                      setMensaje("Datos importados.");
                    } else {
                      setMensaje("Ese archivo no vale.");
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          {mensaje ? <p className="text-xs text-acento">{mensaje}</p> : null}
        </div>
      </Tarjeta>
    </div>
  );
}

/**
 * El panel que contesta a «¿por qué no me sonó?».
 *
 * Tres cosas tienen que estar bien para que suene una alarma: permiso del
 * sistema, la app instalada, y que haya un aviso programado. Aquí se ven las
 * tres de un vistazo, y el botón dispara la alarma de verdad para separar «no
 * suena» de «no llegó a programarse».
 */
function Comprobacion({
  permiso,
  yaInstalada,
  proximo,
  onProbar,
}: {
  permiso: NotificationPermission | "no-soportado";
  yaInstalada: boolean;
  proximo: { nombre: string; hora: string; falta: string } | null;
  onProbar: () => void;
}) {
  /**
   * Dentro del APK, dos de estas comprobaciones son mentira y asustan.
   *
   * «Permiso de notificaciones» mira `Notification.permission`, el permiso de
   * la web, que en una vista incrustada no se concede nunca — mientras el de
   * Android, que es el que manda, está dado. Y «App instalada» pregunta si la
   * web corre en modo aplicación, que dentro del APK es falso por definición.
   *
   * Las dos salían en rojo en un móvil perfectamente configurado. Un panel que
   * da falsas alarmas es peor que no tener panel: enseña a no creerle.
   * En la app nativa manda `ComprobacionSistema`, que le pregunta al sistema.
   */
  const enLaApp = esNativo();

  const filas: { bien: boolean; titulo: string; detalle: string }[] = [
    ...(enLaApp ? [] : [{
      bien: permiso === "granted",
      titulo: "Permiso de notificaciones",
      detalle:
        permiso === "granted"
          ? "Concedido."
          : permiso === "denied"
            ? "Bloqueado. Actívalo en los ajustes del sistema para esta app."
            : "Sin conceder. Pulsa «Activar» más abajo.",
    },
    {
      bien: yaInstalada,
      titulo: "App instalada",
      detalle: yaInstalada
        ? "Abierta desde el icono."
        : "Estás en el navegador. Instálala: las alarmas aguantan mucho mejor.",
    }]),
    {
      bien: proximo !== null,
      titulo: "Hay un aviso programado",
      detalle: proximo
        ? `«${proximo.nombre}» a las ${proximo.hora} · ${proximo.falta}`
        : "Hoy ya no queda ninguno. Añade una tarea con hora desde la pantalla Hoy.",
    },
  ];

  return (
    <Tarjeta>
      <Etiqueta>comprobar la alarma</Etiqueta>
      <div className="mt-3 flex flex-col gap-2.5">
        {filas.map((f) => (
          <div key={f.titulo} className="flex gap-2.5">
            <span
              className={`mt-0.5 shrink-0 text-sm ${f.bien ? "text-logro" : "text-fallo"}`}
              aria-hidden
            >
              {f.bien ? "✓" : "✕"}
            </span>
            <span className="min-w-0">
              <span className="block text-sm">{f.titulo}</span>
              <span className="block text-xs text-tenue">{f.detalle}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Boton variante="fuerte" ancho onClick={onProbar}>
          Probar la alarma ahora
        </Boton>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Debe llenarse la pantalla y sonar el timbre. Si suena aquí pero no te sonó a su
        hora, el problema es la programación, no la alarma.
      </p>
    </Tarjeta>
  );
}

/**
 * Lo que Android dice de sus propias alarmas.
 *
 * Sin esto, cuando una alarma no suena no hay forma de saber si es que no se
 * llegó a programar o es que el móvil la silenció. Son dos fallos distintos y
 * se arreglan en sitios distintos.
 */
function ComprobacionSistema() {
  const [estado, setEstado] = useState<EstadoDespertador | null>(null);
  const [aviso, setAviso] = useState("");

  const refrescar = async () => setEstado(await estadoDespertador());

  useEffect(() => {
    void refrescar();
    const id = window.setInterval(refrescar, 5000);
    return () => clearInterval(id);
  }, []);

  if (!hayDespertador() || !estado) return null;

  const reloj = (ms: number) => {
    const f = new Date(ms);
    return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
  };

  const volumenBien = estado.volumenAlarma > 0;
  const porcentaje =
    estado.volumenAlarmaMaximo > 0
      ? Math.round((estado.volumenAlarma / estado.volumenAlarmaMaximo) * 100)
      : 0;

  return (
    <Tarjeta>
      <Etiqueta>el despertador</Etiqueta>
      <p className="mt-1 text-xs leading-relaxed text-tenue">
        Las alarmas van por el canal de alarma del teléfono, el mismo que usa el
        despertador. No molestar no lo silencia.
      </p>

      {/*
        Esto va arriba del todo y en rojo porque es lo único de esta pantalla
        que ninguna app puede arreglar por su cuenta. El modo ultra está hecho
        para cerrar aplicaciones; con él puesto, el sistema retira las alarmas y
        no hay nada que programar que lo evite.
      */}
      {estado.ahorroDeEnergia ? (
        <div className="mt-3 rounded-xl border border-fallo/40 bg-fallo/[0.08] px-3 py-3">
          <p className="text-sm font-semibold text-fallo">
            El ahorro de batería está activo
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            Con el <b>modo ultra</b>, el teléfono cierra las aplicaciones y les retira
            las alarmas. Ninguna app puede evitarlo: está hecho justo para eso, y sólo
            sobrevive el reloj del propio sistema.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Si duermes con ese modo puesto, añade Genuino a sus aplicaciones permitidas
            — o apágalo por la noche.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2.5">
        <Linea
          bien={estado.puedeExactas}
          titulo="Puede despertar a la hora exacta"
          detalle={
            estado.puedeExactas
              ? "Sí. Android no puede retrasarlas."
              : "No. Sin esto el sistema las agrupa y las retrasa."
          }
        />
        <Linea
          bien={estado.exentaDeBateria}
          titulo="Fuera del ahorro de batería"
          detalle={
            estado.exentaDeBateria
              ? "Sí. El sistema no puede congelar la app."
              : "No, y esto es lo que más alarmas mata. Tócalo abajo."
          }
        />
        <Linea
          bien={volumenBien}
          titulo={`Volumen de alarma al ${porcentaje} %`}
          detalle={
            volumenBien
              ? "Sonará. Y si lo dejas a cero, la app lo sube sola al llegar la hora."
              : "Está a cero, pero la app lo subirá al sonar."
          }
        />
        {/*
          Esta es la línea que antes no existía y por la que un fallo podía
          pasar desapercibido: hasta ahora se contaba lo que nosotros creíamos
          haber programado, no lo que el sistema tiene de verdad.
        */}
        {/*
          Ojo con lo que aquí se considera «bien».

          A Android **no se le entregan las 141 de golpe a propósito**: se le
          dan las próximas 24 y, cada vez que una suena, se arman las
          siguientes. Comparar contra la lista entera pintaba en rojo el
          funcionamiento normal — «24 de 141» con una cruz roja, y Alex
          pensando que su teléfono estaba tirando alarmas.

          El mismo error estaba en el parte y allí se corrigió; aquí se quedó.
          Un diagnóstico que grita cuando no pasa nada se deja de leer, y
          entonces no sirve el día que sí pasa.
        */}
        <Linea
          bien={estado.confirmadas > 0 && estado.confirmadas >= esperadas(estado)}
          titulo={`${estado.confirmadas} alarmas puestas en el sistema`}
          detalle={
            estado.confirmadas === 0
              ? "Ninguna. Revisa que tu rutina tenga bloques con timbre."
              : estado.confirmadas < esperadas(estado)
                ? `Android solo guardó ${estado.confirmadas} de las ${esperadas(estado)} que tocaban.`
                : estado.enCola > estado.confirmadas
                  ? `Las ${estado.confirmadas} siguientes. Quedan ${estado.enCola} en la lista y se van armando solas.`
                  : estado.proxima > 0
                    ? `La próxima, a las ${reloj(estado.proxima)}.`
                    : "Confirmadas por Android, una a una."
          }
        />
        {/*
          El permiso que enciende la pantalla. Android 14 lo sacó aparte y se lo
          niega a las apps instaladas después, **sin avisar**: el
          `setFullScreenIntent` no falla, simplemente no hace nada. Alex lo vio
          como «sonó pero no encendió la pantalla sola».
        */}
        <Linea
          bien={estado.puedePantallaCompleta}
          titulo="Puede encender la pantalla al sonar"
          detalle={
            estado.puedePantallaCompleta
              ? "Sí. La alarma se abre sola con el móvil bloqueado."
              : "No. Sonará, pero tendrás que desbloquear y buscarla en la bandeja."
          }
        />
        <Linea
          bien={estado.avisosActivos && estado.canalActivo}
          titulo="Los avisos están permitidos"
          detalle={
            estado.avisosActivos && estado.canalActivo
              ? "Sí."
              : "No. Sin esto la alarma no puede asomarse a la pantalla."
          }
        />
      </div>

      {estado.ultimoFallo ? (
        <p className="mt-3 rounded-xl border border-fallo/30 bg-fallo/[0.06] px-3 py-2.5 text-xs leading-relaxed">
          Último tropiezo del sistema al sonar:{" "}
          <b>{estado.ultimoFallo.split("|").slice(1).join("|")}</b>
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <Boton
          variante="fuerte"
          ancho
          onClick={async () => {
            const fallo = await sonarYa();
            setAviso(
              fallo
                ? `No arrancó: ${fallo}`
                : "Debería estar sonando ya. Púlsalo en «Parar» cuando lo oigas.",
            );
            void refrescar();
          }}
        >
          Hacerla sonar ahora mismo
        </Boton>
        {estado.sonandoAhora ? (
          <Boton variante="fallo" ancho onClick={() => void pararDespertador().then(refrescar)}>
            Parar
          </Boton>
        ) : null}
        <Boton
          ancho
          onClick={async () => {
            const cuando = await probarDespertador(60);
            setAviso(
              cuando
                ? `Sonará a las ${reloj(cuando.getTime())}. Bloquea el móvil y no lo toques.`
                : "No se pudo programar la prueba.",
            );
            void refrescar();
          }}
        >
          Probar con la pantalla apagada (1 min)
        </Boton>
        {!estado.exentaDeBateria ? (
          <Boton ancho onClick={() => void pedirExencionBateria()}>
            Sacar Genuino del ahorro de batería
          </Boton>
        ) : null}
        {!estado.puedeExactas ? (
          <Boton ancho onClick={() => void pedirPermisoExactas()}>
            Conceder alarmas exactas
          </Boton>
        ) : null}
        {!estado.accesoNoMolestar ? (
          <Boton ancho onClick={() => void pedirAccesoNoMolestar()}>
            Permitir saltarse No molestar
          </Boton>
        ) : null}
        {!estado.puedePantallaCompleta ? (
          <Boton variante="fuerte" ancho onClick={() => void pedirPantallaCompleta()}>
            Permitir que encienda la pantalla
          </Boton>
        ) : null}
        {/*
          El «inicio automático» del fabricante: el ajuste que más alarmas mata
          en Xiaomi, Huawei y Oppo, y que no aparece en ninguna lista de
          permisos de Android. Las instrucciones por escrito ya se probaron y no
          funcionaron —«no lo conseguí»—, así que aquí se abre la pantalla.
        */}
        {consejoDelFabricante(estado.fabricante) ? (
          <Boton
            ancho
            onClick={async () => {
              const fue = await abrirInicioAutomatico();
              setAviso(
                fue
                  ? "Busca Genuino en la lista y actívalo."
                  : consejoDelFabricante(estado.fabricante) ?? "",
              );
            }}
          >
            Abrir «inicio automático» de {estado.fabricante}
          </Boton>
        ) : null}
        <Boton ancho onClick={() => void abrirAjustesDeLaApp()}>
          Abrir los ajustes de Genuino en Android
        </Boton>
      </div>

      {aviso ? <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p> : null}

      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Si aun así falla: en Xiaomi hay que activar el inicio automático, y en Samsung
        quitar Genuino de «Aplicaciones en suspensión». Son ajustes del fabricante y
        ninguna app puede tocarlos por su cuenta.
      </p>
    </Tarjeta>
  );
}

function Linea({ bien, titulo, detalle }: { bien: boolean; titulo: string; detalle: string }) {
  return (
    <div className="flex gap-2.5">
      <span
        className={`mt-0.5 shrink-0 text-sm ${bien ? "text-logro" : "text-fallo"}`}
        aria-hidden
      >
        {bien ? "✓" : "✕"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{titulo}</span>
        <span className="block text-xs text-tenue">{detalle}</span>
      </span>
    </div>
  );
}

/**
 * La clave para generar mensajes por internet.
 *
 * Se guarda solo en el móvil, como el resto. Conviene que sea una clave aparte
 * con su propio límite de crédito: si comparte tope con otra cosa, un descuido
 * aquí puede dejar sin saldo aquello.
 */
function ClaveOpenRouter() {
  const [clave, setClave] = useState(() => leerClave());
  const [modelo, setModelo] = useState(() => leerModelo());
  const [guardado, setGuardado] = useState(false);
  const [verla, setVerla] = useState(false);

  const guardar = () => {
    guardarClave(clave);
    guardarModelo(modelo);
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 2200);
  };

  return (
    <Tarjeta>
      <Etiqueta>generar mensajes por internet</Etiqueta>
      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Opcional. Sin clave, el banco de mensajes funciona entero y sin conexión; la
        clave solo hace falta para escribir uno nuevo sobre un tema que no esté.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <Campo etiqueta="Clave de OpenRouter">
          <div className="flex gap-2">
            <div className="flex-1">
              <Entrada
                type={verla ? "text" : "password"}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="sk-or-v1-…"
                autoComplete="off"
                className="w-full"
              />
            </div>
            <button
              onClick={() => setVerla((v) => !v)}
              className="shrink-0 rounded-xl border border-borde px-3 text-xs text-tenue transition hover:text-texto"
            >
              {verla ? "ocultar" : "ver"}
            </button>
          </div>
        </Campo>

        <Campo etiqueta="Modelo">
          <Entrada
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder={MODELO_POR_DEFECTO}
          />
        </Campo>
        <p className="-mt-1 text-xs leading-relaxed text-tenue">
          El de por defecto cuesta unos nueve céntimos por cada mil mensajes.
        </p>

        <Boton variante="fuerte" ancho onClick={guardar}>
          {guardado ? "Guardada ✓" : "Guardar"}
        </Boton>

        <p className="rounded-xl border border-acento/25 bg-acento/[0.05] px-3 py-2 text-xs leading-relaxed">
          ⚠️ Usa una clave <b>aparte</b>, con su propio límite de crédito en OpenRouter.
          Si compartes la del agente de WhatsApp, un descuido aquí puede dejarlo sin
          saldo y mudo.
        </p>
      </div>
    </Tarjeta>
  );
}

/**
 * La firma que va al pie de lo que se comparte.
 *
 * Es lo que hace que una frase compartida traiga gente nueva: quien la recibe
 * ve de quién viene y por dónde se descarga. El enlace no está escrito en el
 * código, viene de `comunidad.json`, para poder cambiarlo por el de Google Play
 * sin publicar una versión nueva.
 */
function FirmaAlCompartir() {
  const [activa, setActiva] = useState(() => firmaActiva());
  const firma = leerFirma();

  return (
    <div className="border-t border-borde pt-3">
      <Interruptor
        titulo="Firmar lo que comparto"
        detalle="Para que quien lo reciba sepa de dónde viene y pueda instalarla"
        valor={activa}
        onCambiar={(v) => {
          activarFirma(v);
          setActiva(v);
        }}
      />
      {activa ? (
        <pre className="mt-2 rounded-xl bg-superficie-alta px-3 py-2 font-sans text-xs leading-relaxed whitespace-pre-wrap text-tenue">
          {`…\n\n${firma.usuario}\n📲 ${firma.enlaceApp}`}
        </pre>
      ) : null}
    </div>
  );
}

function Interruptor({
  titulo,
  detalle,
  valor,
  onCambiar,
}: {
  titulo: string;
  detalle: string;
  valor: boolean;
  onCambiar: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm">{titulo}</span>
        <span className="block text-xs text-tenue">{detalle}</span>
      </span>
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onCambiar(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--color-acento)]"
      />
    </label>
  );
}

/**
 * La versión instalada, y un botón para buscar una nueva al momento.
 *
 * El aviso de versión nueva aparece solo, pero **sólo pregunta cada cuatro
 * horas**: si acabas de actualizar por la mañana, no vuelve a enterarse de nada
 * hasta la tarde. Mientras la app se instala a mano y se publica varias veces al
 * día, hacía falta poder preguntar a mano. Esto es eso.
 */
function Version() {
  const [estado, setEstado] = useState<"quieto" | "buscando" | "aldia">("quieto");
  const [nueva, setNueva] = useState<VersionPublicada | null>(null);

  const buscar = async () => {
    setEstado("buscando");
    const hay = await hayVersionNueva(true);
    setNueva(hay);
    setEstado(hay ? "quieto" : "aldia");
  };

  return (
    <Tarjeta>
      <Etiqueta>versión</Etiqueta>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">
            Genuino <span className="cifras">{nombreInstalado()}</span>
          </p>
          <p className="text-xs text-tenue">
            {estado === "aldia"
              ? "Estás al día."
              : nueva
                ? `Hay una versión nueva: la ${nueva.nombre}.`
                : "Las actualizaciones se instalan a mano hasta que esté en Google Play."}
          </p>
        </div>
        <Boton onClick={() => void buscar()}>
          {estado === "buscando" ? "Buscando…" : "Buscar"}
        </Boton>
      </div>

      {nueva ? (
        <div className="mt-3 border-t border-borde pt-3">
          <ul className="flex flex-col gap-1">
            {nueva.novedades.map((n, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-tenue">
                <span aria-hidden>·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Boton variante="fuerte" ancho onClick={() => void abrirEnlace(nueva.enlace)}>
              Descargar la {nueva.nombre}
            </Boton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Se descarga el archivo y Android pregunta si quieres instalarlo encima.
            No se pierde nada: tu rutina, tu porqué y tus rachas siguen donde están.
          </p>
        </div>
      ) : null}
    </Tarjeta>
  );
}

/**
 * El parte del despertador.
 *
 * Cuando una alarma de madrugada no suena, preguntar «¿tienes los permisos
 * bien?» no lleva a ninguna parte: lo que mata las alarmas casi nunca es un
 * permiso, sino el cajón de reposo del sistema, la restricción de segundo plano
 * o un ajuste del fabricante que Android ni siquiera expone.
 *
 * Esto vuelca todo lo que el móvil sabe de sus propias alarmas —incluido qué
 * llegó a sonar de verdad y cuándo— en un texto que se copia de un toque. Un
 * «no sonó» se convierte en datos.
 */
function ParteDelDespertador() {
  const [texto, setTexto] = useState("");
  const [consejo, setConsejo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const levantar = async () => {
    const e = await estadoDespertador();
    if (!e) return;
    setTexto(redactarParte(e));
    setConsejo(consejoDelFabricante(e.fabricante));
  };

  useEffect(() => {
    void levantar();
  }, []);

  if (!hayDespertador()) return null;

  return (
    <Tarjeta>
      <Etiqueta>parte del despertador</Etiqueta>
      <p className="mt-2 text-sm leading-relaxed text-tenue">
        Si una alarma no suena, esto dice por qué. Cópialo y mándalo: lleva lo que
        el móvil sabe de sus propias alarmas, incluido qué llegó a sonar de verdad.
      </p>

      {consejo ? (
        <div className="mt-3 rounded-xl border border-acento/25 bg-acento/[0.06] px-3 py-2.5">
          <Etiqueta>tu móvil en concreto</Etiqueta>
          <p className="mt-1 text-xs leading-relaxed">{consejo}</p>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Esto no lo puede hacer ninguna aplicación por ti: es un ajuste del
            fabricante, fuera de lo que Android deja tocar.
          </p>
        </div>
      ) : null}

      <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-superficie-alta px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre">
        {texto || "Leyendo…"}
      </pre>

      <div className="mt-3 flex flex-col gap-2">
        <Boton
          variante="fuerte"
          ancho
          onClick={async () => {
            await Clipboard.write({ string: texto });
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2500);
          }}
        >
          {copiado ? "Copiado ✓" : "Copiar el parte"}
        </Boton>
        <Boton ancho onClick={() => void levantar()}>
          Volver a leer
        </Boton>
      </div>
    </Tarjeta>
  );
}

/**
 * El código que protege lo que se escribe.
 *
 * Alex: «para que nadie pueda leer las cosas privadas». El diario y el repaso
 * de santidad son lo más íntimo que guarda esta app —ahí se anota una caída y
 * lo que se le dijo a Dios por ella—, y hoy los lee cualquiera que coja el
 * teléfono desbloqueado.
 *
 * Lo que aquí se promete se cumple exactamente, ni más ni menos: impide abrir
 * la app y ponerse a leer. No cifra el almacenamiento. Prometer una caja fuerte
 * donde hay un pestillo sería peor que no poner nada, porque entonces se
 * escribiría confiando en algo que no es.
 */
function Cerradura() {
  const [puesto, setPuesto] = useState(() => hayCodigo());
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [repetido, setRepetido] = useState("");
  const [gracia, setGracia] = useState(() => graciaDeLaCerradura());
  const [aviso, setAviso] = useState("");

  const limpiar = () => {
    setActual("");
    setNuevo("");
    setRepetido("");
  };

  const soloNumeros = (v: string) => v.replace(/D/g, "").slice(0, 4);

  const guardar = async () => {
    if (puesto && !(await acierta(actual))) {
      setAviso("El código de ahora no es ese.");
      return;
    }
    if (nuevo.length !== 4) {
      setAviso("El código son cuatro números.");
      return;
    }
    if (nuevo !== repetido) {
      setAviso("Los dos no coinciden.");
      return;
    }
    await ponerCodigo(nuevo, gracia);
    setPuesto(true);
    setAbierto(false);
    limpiar();
    setAviso("Código guardado.");
  };

  const quitar = async () => {
    if (!(await quitarCodigo(actual))) {
      setAviso("Para quitarlo hay que saberlo.");
      return;
    }
    setPuesto(false);
    setAbierto(false);
    limpiar();
    setAviso("Ya no pide código.");
  };

  return (
    <Tarjeta>
      <Etiqueta>código de seguridad</Etiqueta>
      <p className="mt-2 text-xs leading-relaxed text-tenue">
        {puesto
          ? `La app pide un código al abrirse, y otra vez si pasan más de ${gracia} min fuera.`
          : "Pide cuatro números al abrir la app. Tu diario y tus repasos son lo más íntimo que hay aquí dentro."}
      </p>

      {!abierto ? (
        <div className="mt-3">
          <Boton
            ancho
            onClick={() => {
              setAbierto(true);
              setAviso("");
              limpiar();
            }}
          >
            {puesto ? "Cambiar o quitar el código" : "Poner un código"}
          </Boton>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {puesto ? (
            <Campo etiqueta="el código de ahora">
              <Entrada
                inputMode="numeric"
                type="password"
                value={actual}
                onChange={(e) => setActual(soloNumeros(e.target.value))}
                placeholder="····"
              />
            </Campo>
          ) : null}

          <Campo etiqueta={puesto ? "el nuevo" : "cuatro números"}>
            <Entrada
              inputMode="numeric"
              type="password"
              value={nuevo}
              onChange={(e) => setNuevo(soloNumeros(e.target.value))}
              placeholder="····"
            />
          </Campo>

          <Campo etiqueta="otra vez, para estar seguros">
            <Entrada
              inputMode="numeric"
              type="password"
              value={repetido}
              onChange={(e) => setRepetido(soloNumeros(e.target.value))}
              placeholder="····"
            />
          </Campo>

          <Campo etiqueta="volver a pedirlo tras estar fuera">
            <Selector value={String(gracia)} onChange={(e) => setGracia(Number(e.target.value))}>
              <option value="0">siempre, al volver</option>
              <option value="2">2 minutos</option>
              <option value="5">5 minutos</option>
              <option value="15">15 minutos</option>
              <option value="60">1 hora</option>
            </Selector>
          </Campo>

          <div className="flex gap-2">
            <div className="flex-1">
              <Boton variante="fuerte" ancho onClick={guardar}>
                Guardar
              </Boton>
            </div>
            <Boton
              onClick={() => {
                setAbierto(false);
                limpiar();
                setAviso("");
              }}
            >
              Dejarlo
            </Boton>
          </div>

          {puesto ? (
            <Boton variante="fantasma" ancho onClick={quitar}>
              Quitar el código
            </Boton>
          ) : null}
        </div>
      )}

      {aviso ? <p className="mt-2 text-xs text-tenue">{aviso}</p> : null}

      <p className="mt-3 text-xs leading-relaxed text-tenue">
        Esto impide que alguien abra la app y se ponga a leer. No cifra lo
        guardado, y <strong>no hay forma de recuperarlo si lo olvidas</strong>:
        elige uno que no se te vaya.
      </p>
    </Tarjeta>
  );
}

/**
 * Duplicar las alarmas de madrugada en el reloj del móvil.
 *
 * **La red de seguridad, y hay que explicarla bien.** Por bien hecho que esté
 * nuestro despertador, vive dentro de una app de terceros — y MIUI, EMUI y
 * ColorOS se reservan el derecho de congelar esas apps de madrugada. El reloj
 * del teléfono no: es del sistema, y ninguna capa del fabricante lo mata.
 *
 * Sólo se ofrecen **las de antes de las 7**. No es una cifra caprichosa: son
 * las que fallan, las que nadie puede recuperar después, y las únicas por las
 * que merece la pena aguantar que suenen dos cosas a la vez. Copiar la rutina
 * entera llenaría el reloj de diez alarmas y acabaría desactivándolas todas.
 */
function RespaldoEnElReloj({ rutina }: { rutina: import("@/datos/tipos").BloqueRutina[] }) {
  const [aviso, setAviso] = useState("");
  const [copiando, setCopiando] = useState(false);

  const madrugada = rutina.filter((b) => {
    if (!b.activo || b.timbre === "ninguno") return false;
    const h = Number(b.hora.split(":")[0]);
    return h < 7;
  });

  if (!esNativo() || madrugada.length === 0) return null;

  return (
    <Tarjeta>
      <Etiqueta>respaldo en el reloj del móvil</Etiqueta>
      <p className="mt-2 text-sm leading-relaxed">
        Tu móvil puede congelar las apps de madrugada, y contra eso no hay permiso
        que valga. <strong>El reloj del propio teléfono no lo congela nadie</strong>,
        porque es del sistema.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        Esto copia al reloj tus{" "}
        <strong>
          {madrugada.length} {madrugada.length === 1 ? "alarma" : "alarmas"} de antes de
          las 7
        </strong>
        , como red por si la nuestra falla.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {madrugada.map((b) => (
          <div key={b.id} className="flex items-baseline gap-3 text-sm">
            <span className="cifras w-12 shrink-0 text-acento">{b.hora}</span>
            <span className="min-w-0 flex-1 truncate">{b.nombre}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Boton
          ancho
          deshabilitado={copiando}
          onClick={async () => {
            setCopiando(true);
            setAviso("");
            const n = await copiarAlReloj(
              madrugada.map((b) => ({ hora: b.hora, nombre: b.nombre, dias: b.dias })),
            );
            setCopiando(false);
            setAviso(
              n === 0
                ? "No se pudo. Ponlas a mano en el reloj del móvil."
                : `Copiadas ${n}. Míralas en la app Reloj de tu móvil.`,
            );
          }}
        >
          {copiando ? "Copiando…" : "Copiar al reloj del móvil"}
        </Boton>
      </div>

      {aviso ? <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p> : null}

      <p className="mt-3 text-xs leading-relaxed text-tenue">
        <strong>Van a sonar las dos</strong>, la nuestra y la del reloj. Es feo, y es a
        propósito: más vale un pitido de más que un silencio a las tres. Cuando la
        nuestra lleve semanas sin fallarte, borra estas desde la app Reloj.
      </p>
    </Tarjeta>
  );
}

/**
 * Cuántas alarmas deberían estar puestas en el sistema ahora mismo.
 *
 * No son todas las de la lista: a Android se le entregan las próximas
 * `ventana` —24— y las demás se arman solas según van sonando. `setAlarmClock`
 * es la alarma más cara que existe para el sistema, y registrar 141 de golpe es
 * pedirle algo que ningún despertador de verdad le pide.
 */
function esperadas(estado: EstadoDespertador): number {
  return Math.min(estado.enCola, estado.ventana || estado.enCola);
}
