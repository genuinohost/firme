import { useEffect, useState } from "react";
import { PRESENCIA, type Versiculo } from "@/datos/presencia";
import { Boton, Capa } from "./piezas";

/**
 * «Dios contigo»: la presencia de Dios, a la vista en la pantalla de Hoy.
 *
 * Alex, 2-10-2026: «que en todo momento se vea y se sienta la presencia de
 * Dios… muy moderna y futurista, fiel a la Biblia en la nueva Jerusalén del
 * Apocalipsis». La ciudad no tiene templo, ni sol, ni noche: Dios mismo es su luz
 * y habita con su pueblo («el tabernáculo de Dios con los hombres», 21:3). Así
 * que aquí hay luz que respira y su Palabra, nunca una imagen de Él.
 *
 * Un versículo por día, literal (Reina-Valera 1909). Tocarlo abre la pausa
 * «Estar con Dios»: un momento en silencio, sin nada que marcar ni contar.
 */

/** El día del año, para que cada día toque un versículo y el mismo todo el día. */
function diaDelAnio(f = new Date()): number {
  const inicio = new Date(f.getFullYear(), 0, 0).getTime();
  return Math.floor((f.getTime() - inicio) / 86_400_000);
}

export function versiculoDeHoy(f = new Date()): Versiculo {
  return PRESENCIA[diaDelAnio(f) % PRESENCIA.length];
}

export function DiosContigo() {
  const [abierta, setAbierta] = useState(false);
  const v = versiculoDeHoy();
  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        className="aparece cristal toque w-full rounded-2xl border border-borde p-4 text-left"
        aria-label="Dios contigo. Tocar para estar un momento con Él"
      >
        <span className="flex items-center gap-2">
          <span className="orbe-vivo" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-acento">
            Dios contigo
          </span>
        </span>
        <span className="font-cita mt-2 block text-[15px] leading-relaxed italic">«{v.texto}»</span>
        <span className="mt-1.5 flex items-center justify-between gap-3 text-xs text-tenue">
          <span>{v.ref}</span>
          <span className="text-acento">Estar con Él ›</span>
        </span>
      </button>
      {abierta ? <PausaConDios versiculo={v} alCerrar={() => setAbierta(false)} /> : null}
    </>
  );
}

/**
 * La pausa: un orbe de luz que respira (8 s), la frase «Dios está aquí» y el
 * versículo. Va siempre de noche, como la alarma. Sin cuenta atrás ni nada que
 * lograr: se cierra cuando la persona quiere.
 */
function PausaConDios({ versiculo, alCerrar }: { versiculo: Versiculo; alCerrar: () => void }) {
  // La guía de la respiración, cada cuatro segundos: sólo texto, sin sonido.
  const [inhala, setInhala] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => setInhala((x) => !x), 4000);
    return () => window.clearInterval(id);
  }, []);
  // Atrás del móvil cierra la pausa, no la app.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  return (
    <Capa>
      <div
        data-tema="noche"
        role="dialog"
        aria-label="Estar con Dios"
        className="zona-segura-arriba zona-segura-abajo fixed inset-0 z-[70] flex flex-col items-center justify-between overflow-y-auto bg-fondo px-6 pt-14 pb-10 text-texto"
        style={{
          background:
            "radial-gradient(90vmax 60vmax at 50% 38%, rgba(233,200,120,0.16), transparent 70%), var(--color-fondo)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-acento">
          Estar con Dios
        </p>

        <div className="flex flex-col items-center gap-8">
          <div className="relative grid place-items-center" aria-hidden>
            <span className="aro" />
            <span className="aro" />
            <span className="aro" />
            <div className="orbe" />
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold">Dios está aquí.</h2>
            <p className="mt-2 text-sm text-tenue" aria-live="polite">
              {inhala ? "Inhala despacio…" : "Exhala…"}
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
          <p className="font-cita text-[17px] leading-relaxed italic">«{versiculo.texto}»</p>
          <p className="-mt-3 text-xs text-tenue">{versiculo.ref}</p>
          <Boton variante="fuerte" ancho onClick={alCerrar}>
            Amén
          </Boton>
        </div>
      </div>
    </Capa>
  );
}
