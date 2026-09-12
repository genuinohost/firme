import { useEffect, useState } from "react";
import type { Ajustes, Datos } from "@/datos/tipos";
import { exportar, importar } from "@/datos/almacen";
import { pedirPermisoAvisos } from "@/logica/alarmas";
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
