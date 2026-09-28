import { useCallback, useEffect, useRef, useState } from "react";
import { vars } from "@/componentes/piezas";

/**
 * Un segundo y pico de saludo al abrir la app, y a Hoy.
 *
 * ── Lo que pidió Alex, el 27-09-2026 ──────────────────────────────────────
 *
 * > «Una muy breve intro cuando la abras, algo muy sutil, muy breve, bonito,
 * > con una transición suave, algo de quizás un segundo.»
 *
 * Y por la noche, sobre la primera versión: «casi no se notan los efectos y
 * el dinamismo: quiero más power». De ahí ésta.
 *
 * ── Lo que pasa, en orden ─────────────────────────────────────────────────
 *
 *   0 ms     Un halo de oro empieza a abrirse detrás de todo.
 *   0–620    El logo ENFOCA: una copia borrosa y grande se disuelve mientras
 *            la nítida llega con resorte, y a los 480 ms un destello la remata.
 *            Es lo que hace una cámara al encontrar el foco.
 *   360–870  «Genuino», letra a letra, cada una 38 ms después de la anterior.
 *   640      El lema, más suave.
 *   1050     Empieza a irse: crece un 8 % y se disuelve sobre Hoy, que en ese
 *            mismo instante vuelve a entrar debajo (`onSaliendo`).
 *   1400     Fin.
 *
 * ── Tres decisiones ───────────────────────────────────────────────────────
 *
 * **Sólo al arrancar en frío.** Una intro que sale cada vez que se vuelve a la
 * app deja de ser un saludo y pasa a ser un peaje. Se recuerda en memoria del
 * proceso —no en disco—: si el sistema mata la app y vuelve a arrancar, toca
 * otra vez, que es lo correcto.
 *
 * **Se puede saltar con un toque, desde el primer instante.** Nadie que abre
 * la app a las cinco de la mañana con la alarma sonando quiere ver un logo. Y
 * si hay una alarma o una llamada en pantalla, esto ni se pinta: lo decide
 * `App.tsx`.
 *
 * **Mismo fondo que la app.** El splash nativo de Android es del mismo color;
 * del uno al otro no hay salto, y de esto a Hoy tampoco.
 */

/** Si ya se saludó en esta ejecución. Vive con el proceso, no con React. */
let yaSaludo = false;

/** Cuánto dura todo, contando la salida. */
const DURA_MS = 1400;
const SALIDA_MS = 350;

const LETRAS = "Genuino".split("");

export function Intro({
  onFin,
  onSaliendo,
}: {
  onFin: () => void;
  /** Cuando empieza a disolverse: App.tsx hace entrar Hoy debajo justo ahí. */
  onSaliendo?: () => void;
}) {
  const [saliendo, setSaliendo] = useState(false);
  const yendose = useRef(false);

  const salir = useCallback(() => {
    if (yendose.current) return;
    yendose.current = true;
    setSaliendo(true);
    onSaliendo?.();
    window.setTimeout(onFin, SALIDA_MS);
  }, [onFin, onSaliendo]);

  useEffect(() => {
    yaSaludo = true;
    const id = window.setTimeout(salir, DURA_MS - SALIDA_MS);
    return () => clearTimeout(id);
    // Sólo al montar: `salir` no cambia de identidad mientras esto vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={salir}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-fondo ${
        saliendo ? "intro-fuera" : ""
      }`}
      aria-label="Genuino"
      role="img"
    >
      <div className="intro-pila size-24">
        <span className="intro-halo" aria-hidden />
        <img src="/icono.svg" alt="" className="intro-borroso size-24" draggable={false} aria-hidden />
        <img src="/icono.svg" alt="" className="intro-logo size-24" draggable={false} />
        <img src="/icono.svg" alt="" className="intro-destello size-24" draggable={false} aria-hidden />
      </div>
      <p className="mt-6 text-2xl font-semibold tracking-[0.12em] text-acento" aria-hidden>
        {LETRAS.map((letra, i) => (
          <span key={i} className="intro-letra" style={vars({ "--i": i })}>
            {letra}
          </span>
        ))}
      </p>
      <p className="intro-lema mt-2 text-[13px] text-texto">disciplina cristiana</p>
    </div>
  );
}

/** Para que `App.tsx` sepa si toca saludar. */
export function tocaSaludar(): boolean {
  return !yaSaludo;
}
