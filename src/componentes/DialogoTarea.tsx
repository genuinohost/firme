import { useState } from "react";
import { idNuevo } from "@/datos/almacen";
import { CATEGORIAS, TIMBRES, type Categoria, type Tarea, type Timbre } from "@/datos/tipos";
import { Boton, Campo, Entrada, Etiqueta, Selector, Tarjeta, colorDe } from "./piezas";

/** "HH:MM" de dentro de `minutos`, en hora local. */
function desdeAhora(minutos: number): string {
  const f = new Date();
  f.setMinutes(f.getMinutes() + minutos, 0, 0);
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

export function DialogoTarea({
  fecha,
  onGuardar,
  onCerrar,
}: {
  fecha: string;
  onGuardar: (tarea: Tarea) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [conHora, setConHora] = useState(true);
  const [hora, setHora] = useState(() => desdeAhora(30));
  const [duracionMin, setDuracion] = useState(30);
  const [categoria, setCategoria] = useState<Categoria>("trabajo");
  const [timbre, setTimbre] = useState<Timbre>("pulso");

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-fondo/90 p-4 backdrop-blur-sm sm:items-center">
      <Tarjeta className="entrar w-full max-w-md !bg-superficie-alta">
        <div className="flex items-center justify-between">
          <Etiqueta>tarea de hoy</Etiqueta>
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
              autoFocus
            />
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
        </div>

        <div className="mt-5">
          <Boton
            variante="fuerte"
            ancho
            deshabilitado={!nombre.trim()}
            onClick={() =>
              onGuardar({
                id: idNuevo(),
                fecha,
                nombre: nombre.trim(),
                hora: conHora ? hora : null,
                duracionMin,
                categoria,
                timbre: conHora ? timbre : "ninguno",
              })
            }
          >
            Añadir al día
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}
