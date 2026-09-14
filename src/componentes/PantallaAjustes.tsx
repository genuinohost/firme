import { useEffect, useState } from "react";
import type { Ajustes, Datos } from "@/datos/tipos";
import { exportar, importar } from "@/datos/almacen";
import { pedirPermisoAvisos } from "@/logica/alarmas";
import {
  abrirAjustesDeLaApp,
  estadoDespertador,
  hayDespertador,
  pedirPermisoExactas,
  probarDespertador,
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
import { parar, sonar } from "@/logica/sonido";
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

      <Tarjeta>
        <Etiqueta>avisos y alarma</Etiqueta>
        <div className="mt-3 flex flex-col gap-3">
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

          {!yaInstalada ? (
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
              placeholder="Alex"
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
  const filas: { bien: boolean; titulo: string; detalle: string }[] = [
    {
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
    },
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
          bien={volumenBien}
          titulo={`Volumen de alarma al ${porcentaje} %`}
          detalle={
            volumenBien
              ? "Sonará."
              : "Está a cero. Súbelo con los botones del móvil mientras suena una alarma."
          }
        />
        <Linea
          bien={estado.enCola > 0}
          titulo={`${estado.enCola} alarmas programadas`}
          detalle={
            estado.enCola === 0
              ? "Ninguna. Revisa que tu rutina tenga bloques con timbre."
              : estado.proxima > 0
                ? `La próxima, a las ${reloj(estado.proxima)}.`
                : "Programadas."
          }
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Boton
          variante="fuerte"
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
        {!estado.puedeExactas ? (
          <Boton ancho onClick={() => void pedirPermisoExactas()}>
            Conceder alarmas exactas
          </Boton>
        ) : null}
        <Boton ancho onClick={() => void abrirAjustesDeLaApp()}>
          Abrir los ajustes de Firme en Android
        </Boton>
      </div>

      {aviso ? <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p> : null}

      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Si la prueba no suena con el móvil bloqueado, en los ajustes de Android hay que
        quitarle a Firme la restricción de batería y, en Xiaomi, activar el inicio
        automático.
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
