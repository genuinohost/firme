import { useState } from "react";
import { idNuevo } from "@/datos/almacen";
import { CATEGORIAS, TIMBRES, type Categoria, type Tarea, type Timbre } from "@/datos/tipos";
import { BotonDictar } from "./BotonDictar";
import { Boton, Campo, Entrada, Etiqueta, Selector, Tarjeta, colorDe } from "./piezas";

/**
 * "HH:MM" de dentro de `minutos`, en hora local.
 *
 * Una alarma solo tiene hora y minuto, así que al poner los segundos a cero se
 * perdía lo que quedaba del minuto en curso: a las 18:15:45, «2 min» daba las
 * 18:17, o sea minuto y cuarto. Se redondea hacia arriba para que «2 min» nunca
 * sea menos de dos minutos.
 */
function desdeAhora(minutos: number): string {
  const f = new Date();
  const extra = f.getSeconds() > 0 ? 1 : 0;
  f.setMinutes(f.getMinutes() + minutos + extra, 0, 0);
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/** Una fecha "AAAA-MM-DD" desplazada unos días, sin tocar husos horarios. */
function dentroDeDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(
    f.getDate(),
  ).padStart(2, "0")}`;
}

export function DialogoTarea({
  fecha,
  tarea,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  fecha: string;
  /** La tarea que se está editando. Si falta, se crea una nueva. */
  tarea?: Tarea;
  onGuardar: (tarea: Tarea) => void;
  onBorrar?: () => void;
  onCerrar: () => void;
}) {
  const editando = tarea !== undefined;
  const [nombre, setNombre] = useState(tarea?.nombre ?? "");
  const [conHora, setConHora] = useState(tarea ? tarea.hora !== null : true);
  const [hora, setHora] = useState(tarea?.hora ?? (() => desdeAhora(30)));
  const [duracionMin, setDuracion] = useState(tarea?.duracionMin ?? 30);
  const [categoria, setCategoria] = useState<Categoria>(tarea?.categoria ?? "trabajo");
  const [repeticion, setRepeticion] = useState<"uno" | "varios" | "siempre">(
    !tarea?.repiteHasta ? "uno" : tarea.repiteHasta === "siempre" ? "siempre" : "varios",
  );
  // Por defecto, una semana: es el plazo con el que la gente piensa.
  const [hasta, setHasta] = useState(
    tarea?.repiteHasta && tarea.repiteHasta !== "siempre"
      ? tarea.repiteHasta
      : dentroDeDias(tarea?.fecha ?? fecha, 7),
  );
  const [timbre, setTimbre] = useState<Timbre>(
    tarea?.timbre && tarea.timbre !== "ninguno" ? tarea.timbre : "pulso",
  );

  /*
   * El pegado abajo se hace con `mt-auto`, no con `items-end`.
   *
   * Parece lo mismo y no lo es: con `align-items: flex-end`, si la tarjeta es
   * más alta que la pantalla, el borde de arriba se sale y no hay forma de
   * llegar a él — ni con scroll. Un margen automático empuja igual hacia abajo
   * pero deja el desbordamiento accesible.
   *
   * Importa desde que la tarjeta creció con lo de repetir la tarea: en una
   * pantalla corta, el nombre y la hora quedaban fuera de alcance y editar se
   * volvía imposible.
   */
  return (
    <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-fondo/90 p-4 backdrop-blur-sm">
      <Tarjeta className="entrar mt-auto mb-0 h-fit w-full max-w-md !bg-superficie-alta sm:my-auto">
        <div className="flex items-center justify-between">
          <Etiqueta>{editando ? "editar tarea" : "tarea de hoy"}</Etiqueta>
          <button onClick={onCerrar} className="px-2 text-tenue transition hover:text-texto">
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Campo etiqueta="Qué hay que hacer">
            <Entrada
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Llamar al proveedor"
              autoFocus={!editando}
            />
            {/*
              Dictar la tarea. Alex: «hay veces donde no puedo escribir» — y una
              tarea se apunta justo cuando uno está con las manos ocupadas, que
              es cuando se le ocurre y cuando se le olvida.
            */}
            <div className="mt-2">
              <BotonDictar valor={nombre} onTexto={setNombre} etiqueta="Dictar la tarea" />
            </div>
          </Campo>

          <label className="flex items-center justify-between rounded-xl border border-borde px-3 py-2.5">
            <span className="text-sm">Con hora y alarma</span>
            <input
              type="checkbox"
              checked={conHora}
              onChange={(e) => setConHora(e.target.checked)}
              className="size-5 accent-[var(--color-acento)]"
            />
          </label>

          {conHora ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Hora">
                  <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </Campo>
                <Campo etiqueta="Duración (min)">
                  <Entrada
                    type="number"
                    min={5}
                    step={5}
                    value={duracionMin}
                    onChange={(e) => setDuracion(Math.max(5, Number(e.target.value) || 5))}
                  />
                </Campo>
              </div>
              {/* Atajos: sin ellos hay que pelearse con el selector de hora para
                  poner algo dentro de dos minutos, que es lo que hace falta para
                  probar que la alarma suena. */}
              <div className="-mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-tenue">dentro de</span>
                {[2, 5, 15, 30, 60].map((min) => (
                  <button
                    key={min}
                    onClick={() => setHora(desdeAhora(min))}
                    className="rounded-full border border-borde px-2.5 py-1 text-xs text-tenue transition hover:border-acento hover:text-acento"
                  >
                    {min < 60 ? `${min} min` : "1 h"}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div>
            <Etiqueta>Área</Etiqueta>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoria(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    categoria === c.id ? "text-fondo font-medium" : "border-borde text-tenue"
                  }`}
                  style={
                    categoria === c.id
                      ? { background: colorDe(c.id), borderColor: colorDe(c.id) }
                      : undefined
                  }
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          {conHora ? (
            <Campo etiqueta="Timbre">
              <Selector value={timbre} onChange={(e) => setTimbre(e.target.value as Timbre)}>
                {TIMBRES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          ) : null}

          {/*
            Cuánto dura la tarea en el calendario, no en el reloj.

            Se guarda una sola tarea y se proyecta sobre los días que le tocan.
            Por eso cambiar la hora la cambia en todos: es la misma tarea, no
            copias. Y el historial de cada día sigue siendo suyo.
          */}
          <div>
            <Etiqueta>¿cuántos días?</Etiqueta>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "uno", nombre: "Un día" },
                  { id: "varios", nombre: "Varios días" },
                  { id: "siempre", nombre: "Cada día" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRepeticion(r.id)}
                  className={`rounded-xl border px-2 py-2.5 text-xs transition ${
                    repeticion === r.id ? "border-acento bg-acento/[0.08]" : "border-borde"
                  }`}
                  aria-pressed={repeticion === r.id}
                >
                  {r.nombre}
                </button>
              ))}
            </div>

            {repeticion === "varios" ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-tenue">Hasta el</span>
                <input
                  type="date"
                  value={hasta}
                  min={tarea?.fecha ?? fecha}
                  onChange={(e) => setHasta(e.target.value)}
                  className="rounded-lg border border-borde bg-superficie-alta px-2 py-1 text-sm outline-none focus:border-acento"
                />
              </div>
            ) : null}

            <p className="mt-1.5 text-xs leading-relaxed text-tenue">
              {repeticion === "uno"
                ? "Solo aparece este día."
                : repeticion === "siempre"
                  ? "Aparecerá cada día, con su alarma, hasta que la borres."
                  : `Aparecerá cada día desde hoy hasta el ${hasta}, con su alarma.`}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <div className="flex-1">
            <Boton
              variante="fuerte"
              ancho
              deshabilitado={!nombre.trim()}
              onClick={() =>
                onGuardar({
                  id: tarea?.id ?? idNuevo(),
                  fecha: tarea?.fecha ?? fecha,
                  nombre: nombre.trim(),
                  hora: conHora ? hora : null,
                  duracionMin,
                  categoria,
                  timbre: conHora ? timbre : "ninguno",
                  ...(repeticion === "uno"
                    ? {}
                    : { repiteHasta: repeticion === "siempre" ? "siempre" : hasta }),
                })
              }
            >
              {editando ? "Guardar" : "Añadir al día"}
            </Boton>
          </div>
          {editando && onBorrar ? (
            <Boton variante="fallo" onClick={onBorrar}>
              Borrar
            </Boton>
          ) : null}
        </div>
      </Tarjeta>
    </div>
  );
}
