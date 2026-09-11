import { useState } from "react";
import { idNuevo } from "@/datos/almacen";
import { CATEGORIAS, TIMBRES, type BloqueRutina, type Categoria, type Timbre } from "@/datos/tipos";
import { DIAS_CORTOS, aMinutos } from "@/logica/dia";
import { sonar, parar } from "@/logica/sonido";
import {
  AreaTexto, Boton, Campo, Entrada, Etiqueta, Punto, Selector, Tarjeta, Vacio, colorDe,
} from "./piezas";

const TODOS = [0, 1, 2, 3, 4, 5, 6];
const LABORABLES = [1, 2, 3, 4, 5];

function bloqueVacio(): BloqueRutina {
  return {
    id: idNuevo(),
    nombre: "",
    hora: "07:00",
    duracionMin: 30,
    dias: [...TODOS],
    categoria: "trabajo",
    porque: "",
    timbre: "campana",
    avisoPrevioMin: 0,
    activo: true,
  };
}

export function PantallaRutina({
  rutina,
  volumen,
  onCambiar,
}: {
  rutina: BloqueRutina[];
  volumen: number;
  onCambiar: (rutina: BloqueRutina[]) => void;
}) {
  const [editando, setEditando] = useState<BloqueRutina | null>(null);

  const ordenada = [...rutina].sort((a, b) => aMinutos(a.hora) - aMinutos(b.hora));

  const guardar = (bloque: BloqueRutina) => {
    const existe = rutina.some((b) => b.id === bloque.id);
    onCambiar(existe ? rutina.map((b) => (b.id === bloque.id ? bloque : b)) : [...rutina, bloque]);
    setEditando(null);
  };

  const borrar = (id: string) => {
    onCambiar(rutina.filter((b) => b.id !== id));
    setEditando(null);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Mi rutina</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Los bloques fijos que se repiten. Ponle a cada uno su hora, sus días y el
          motivo por el que está ahí.
        </p>
      </header>

      {ordenada.length === 0 ? <Vacio>Rutina vacía. Empieza por la hora de levantarte.</Vacio> : null}

      <div className="flex flex-col gap-2">
        {ordenada.map((b) => (
          <button
            key={b.id}
            onClick={() => setEditando(b)}
            className={`flex items-center gap-3 rounded-xl border border-borde bg-superficie px-3 py-3 text-left transition hover:border-tenue ${
              b.activo ? "" : "opacity-45"
            }`}
          >
            <span className="cifras w-11 shrink-0 text-sm text-tenue">{b.hora}</span>
            <Punto categoria={b.categoria} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{b.nombre || "(sin nombre)"}</span>
              <span className="block text-xs text-tenue">
                {b.dias.length === 7
                  ? "todos los días"
                  : b.dias.length === 5 && LABORABLES.every((d) => b.dias.includes(d))
                    ? "de lunes a viernes"
                    : b.dias.map((d) => DIAS_CORTOS[d]).join(" ")}
                {" · "}
                {b.duracionMin} min
              </span>
            </span>
            <span className="shrink-0 text-tenue">›</span>
          </button>
        ))}
      </div>

      <Boton variante="fuerte" ancho onClick={() => setEditando(bloqueVacio())}>
        + Nuevo bloque
      </Boton>

      {editando ? (
        <EditorBloque
          bloque={editando}
          esNuevo={!rutina.some((b) => b.id === editando.id)}
          volumen={volumen}
          onGuardar={guardar}
          onBorrar={() => borrar(editando.id)}
          onCerrar={() => {
            parar();
            setEditando(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EditorBloque({
  bloque,
  esNuevo,
  volumen,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  bloque: BloqueRutina;
  esNuevo: boolean;
  volumen: number;
  onGuardar: (b: BloqueRutina) => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const [b, setB] = useState(bloque);
  const cambiar = <C extends keyof BloqueRutina>(campo: C, valor: BloqueRutina[C]) =>
    setB((previo) => ({ ...previo, [campo]: valor }));

  const alternarDia = (d: number) =>
    cambiar("dias", b.dias.includes(d) ? b.dias.filter((x) => x !== d) : [...b.dias, d].sort());

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-fondo/90 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto flex min-h-full max-w-lg flex-col justify-center p-4">
        <Tarjeta className="entrar !bg-superficie-alta">
          <div className="flex items-center justify-between">
            <Etiqueta>{esNuevo ? "nuevo bloque" : "editar bloque"}</Etiqueta>
            <button onClick={onCerrar} className="px-2 text-tenue transition hover:text-texto">
              ✕
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <Campo etiqueta="Nombre">
              <Entrada
                value={b.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                placeholder="Ejercicio"
                autoFocus={esNuevo}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Hora">
                <Entrada type="time" value={b.hora} onChange={(e) => cambiar("hora", e.target.value)} />
              </Campo>
              <Campo etiqueta="Duración (min)">
                <Entrada
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={b.duracionMin}
                  onChange={(e) => cambiar("duracionMin", Math.max(5, Number(e.target.value) || 5))}
                />
              </Campo>
            </div>

            <div>
              <Etiqueta>Días</Etiqueta>
              <div className="mt-1.5 flex gap-1.5">
                {DIAS_CORTOS.map((letra, i) => (
                  <button
                    key={i}
                    onClick={() => alternarDia(i)}
                    className={`size-10 rounded-xl border text-sm transition ${
                      b.dias.includes(i)
                        ? "border-acento bg-acento text-fondo font-semibold"
                        : "border-borde text-tenue"
                    }`}
                  >
                    {letra}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-xs text-tenue">
                <button onClick={() => cambiar("dias", [...TODOS])} className="hover:text-acento">
                  todos
                </button>
                <button onClick={() => cambiar("dias", [...LABORABLES])} className="hover:text-acento">
                  L-V
                </button>
                <button onClick={() => cambiar("dias", [0, 6])} className="hover:text-acento">
                  fin de semana
                </button>
              </div>
            </div>

            <div>
              <Etiqueta>Área</Etiqueta>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CATEGORIAS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => cambiar("categoria", c.id as Categoria)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      b.categoria === c.id ? "text-fondo font-medium" : "border-borde text-tenue"
                    }`}
                    style={
                      b.categoria === c.id
                        ? { background: colorDe(c.id), borderColor: colorDe(c.id) }
                        : undefined
                    }
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>

            <Campo etiqueta="Por qué este bloque (sale en la alarma)">
              <AreaTexto
                rows={2}
                value={b.porque}
                onChange={(e) => cambiar("porque", e.target.value)}
                placeholder="Un cuerpo fuerte sostiene todo lo demás."
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Timbre">
                <Selector
                  value={b.timbre}
                  onChange={(e) => {
                    const t = e.target.value as Timbre;
                    cambiar("timbre", t);
                    sonar(t, volumen);
                    window.setTimeout(parar, 2600);
                  }}
                >
                  {TIMBRES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Aviso previo (min)">
                <Selector
                  value={b.avisoPrevioMin}
                  onChange={(e) => cambiar("avisoPrevioMin", Number(e.target.value))}
                >
                  {[0, 5, 10, 15, 30].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "sin aviso" : `${m} min antes`}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-borde px-3 py-2.5">
              <span className="text-sm">Bloque activo</span>
              <input
                type="checkbox"
                checked={b.activo}
                onChange={(e) => cambiar("activo", e.target.checked)}
                className="size-5 accent-[var(--color-acento)]"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <div className="flex-1">
              <Boton
                variante="fuerte"
                ancho
                deshabilitado={!b.nombre.trim() || b.dias.length === 0}
                onClick={() => {
                  parar();
                  onGuardar(b);
                }}
              >
                Guardar
              </Boton>
            </div>
            {!esNuevo ? (
              <Boton variante="fallo" onClick={onBorrar}>
                Borrar
              </Boton>
            ) : null}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
