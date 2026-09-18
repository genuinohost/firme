import { useState } from "react";
import type { Datos } from "@/datos/tipos";
import { avisarDeUnFallo, encoger, MAX_CAPTURAS } from "@/logica/fallos";
import { BotonDictar } from "./BotonDictar";
import { AreaTexto, Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * Avisar de un fallo, con capturas.
 *
 * Alex: «los hermanos deberían tener un botón especial para escribir y mandar
 * capturas de los errores de la app».
 *
 * ── Lo que esta pantalla intenta conseguir ────────────────────────────────
 *
 * Que alguien que se ha topado con algo roto **cuente qué esperaba y qué pasó**,
 * que es lo único que hace falta para arreglarlo. La app pone sola la parte
 * técnica —versión, teléfono, cuántas cosas tiene— para que nadie tenga que
 * buscarla ni sepa que existe.
 *
 * No pide cuenta. Los dos peores fallos de este proyecto fueron fallos de
 * entrar, y quien más necesita avisar es justo el que no puede.
 */
export function PantallaFallo({ datos }: { datos: Datos }) {
  const [texto, setTexto] = useState("");
  const [capturas, setCapturas] = useState<string[]>([]);
  const [mandando, setMandando] = useState(false);
  const [mandado, setMandado] = useState(false);
  const [error, setError] = useState("");

  const añadir = async (archivos: FileList | null) => {
    if (!archivos) return;
    setError("");
    const sitio = MAX_CAPTURAS - capturas.length;
    const nuevas: string[] = [];
    for (const archivo of [...archivos].slice(0, sitio)) {
      const encogida = await encoger(archivo);
      if (encogida) nuevas.push(encogida);
      // Una imagen que no se pudo encoger se dice, no se traga en silencio.
      else setError("Una de las imágenes no se pudo preparar. Prueba con otra.");
    }
    setCapturas((v) => [...v, ...nuevas]);
  };

  if (mandado) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Tarjeta>
          <Etiqueta>gracias</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Tu aviso llegó. Casi todo lo que funciona bien en esta app está así
            porque alguien se molestó en contar lo que no funcionaba.
          </p>
          <div className="mt-3">
            <Boton
              ancho
              onClick={() => {
                setTexto("");
                setCapturas([]);
                setMandado(false);
              }}
            >
              Avisar de otra cosa
            </Boton>
          </div>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Avisar de un fallo</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Si algo no hace lo que debería, cuéntalo aquí. No hace falta que sepas
          explicarlo bien.
        </p>
      </header>

      <Tarjeta>
        <Etiqueta>qué pasó</Etiqueta>
        <div className="mt-2">
          <AreaTexto
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Toqué el nombre de un hermano y no se abrió nada..."
          />
        </div>
        <div className="mt-2">
          <BotonDictar valor={texto} onTexto={setTexto} etiqueta="Dictarlo" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-tenue">
          Lo que más ayuda: <strong>qué esperabas</strong> y <strong>qué pasó en
          su lugar</strong>.
        </p>
      </Tarjeta>

      <Tarjeta>
        <Etiqueta>capturas · {capturas.length} de {MAX_CAPTURAS}</Etiqueta>
        <p className="mt-2 text-xs leading-relaxed text-tenue">
          Una foto de la pantalla vale más que un párrafo. Puedes añadir hasta {MAX_CAPTURAS}.
        </p>

        {capturas.length > 0 ? (
          <div className="mt-3 flex gap-2">
            {capturas.map((c, i) => (
              <div key={i} className="relative">
                <img
                  src={c}
                  alt={`Captura ${i + 1}`}
                  className="h-24 w-16 rounded-lg border border-borde object-cover"
                />
                <button
                  onClick={() => setCapturas((v) => v.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 rounded-full border border-borde bg-superficie-alta px-1.5 text-xs"
                  aria-label={`Quitar la captura ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {capturas.length < MAX_CAPTURAS ? (
          <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-borde px-3 py-3 text-center text-sm transition hover:border-acento">
            + Añadir una captura
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void añadir(e.target.files);
                // Se limpia para que elegir la misma imagen otra vez vuelva a
                // disparar el evento.
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
      </Tarjeta>

      <Tarjeta>
        <Etiqueta>qué se manda</Etiqueta>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-tenue">
          <li>Lo que escribas y las capturas que añadas.</li>
          <li>
            La versión de la app, tu modelo de teléfono y <strong>cuántos</strong> planes,
            tareas y notas tienes.
          </li>
          <li>
            <strong>Nada de lo que escribes.</strong> Ni el diario, ni las notas, ni los
            repasos. Sólo los números.
          </li>
        </ul>
      </Tarjeta>

      {error ? (
        <p className="rounded-xl border border-fallo/40 bg-fallo/5 px-3 py-2.5 text-xs leading-relaxed">
          {error}
        </p>
      ) : null}

      <Boton
        variante="fuerte"
        ancho
        deshabilitado={texto.trim().length < 5 || mandando}
        onClick={async () => {
          setMandando(true);
          setError("");
          try {
            await avisarDeUnFallo(texto, capturas, datos);
            setMandado(true);
          } catch {
            setError(
              "No se pudo mandar. Mira tu conexión y prueba otra vez; lo que escribiste sigue aquí.",
            );
          } finally {
            setMandando(false);
          }
        }}
      >
        {mandando ? "Mandando…" : "Mandar el aviso"}
      </Boton>
    </div>
  );
}
