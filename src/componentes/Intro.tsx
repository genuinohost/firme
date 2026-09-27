import { useEffect, useState } from "react";

/**
 * Un segundo de saludo al abrir la app, y a Hoy.
 *
 * ── Lo que pidió Alex, el 27-09-2026 ──────────────────────────────────────
 *
 * > «Una muy breve intro cuando la abras, algo muy sutil, muy breve, bonito,
 * > con una transición suave, algo de quizás un segundo.»
 *
 * ── Tres decisiones ───────────────────────────────────────────────────────
 *
 * **Sólo al arrancar en frío.** Una intro que sale cada vez que se vuelve a la
 * app deja de ser un saludo y pasa a ser un peaje. Se recuerda en memoria del
 * proceso —no en disco—: si el sistema mata la app y vuelve a arrancar, toca
 * otra vez, que es lo correcto.
 *
 * **Se puede saltar con un toque.** Nadie que abre la app a las cinco de la
 * mañana con la alarma sonando quiere ver un logo. Y si hay una alarma o una
 * llamada en pantalla, esto ni se pinta: lo decide `App.tsx`.
 *
 * **Mismo fondo que la app.** El splash nativo de Android es del mismo color;
 * del uno al otro no hay salto, y de esto a Hoy tampoco: se disuelve encima de
 * la app ya pintada.
 */

/** Si ya se saludó en esta ejecución. Vive con el proceso, no con React. */
let yaSaludo = false;

/** Cuánto dura todo, contando la salida. Alex pidió «quizás un segundo». */
const DURA_MS = 1050;
const SALIDA_MS = 320;

export function Intro({ onFin }: { onFin: () => void }) {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    yaSaludo = true;
    const salir = window.setTimeout(() => setSaliendo(true), DURA_MS - SALIDA_MS);
    const fin = window.setTimeout(onFin, DURA_MS);
    return () => {
      clearTimeout(salir);
      clearTimeout(fin);
    };
    // Sólo al montar: `onFin` no cambia de identidad mientras esto vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={() => {
        setSaliendo(true);
        window.setTimeout(onFin, SALIDA_MS);
      }}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-fondo ${
        saliendo ? "intro-fuera" : ""
      }`}
      aria-label="Genuino"
      role="img"
    >
      <img src="/icono.svg" alt="" className="intro-logo size-24" draggable={false} />
      <p className="intro-marca mt-6 text-2xl font-semibold text-acento">Genuino</p>
      <p className="intro-lema mt-2 text-[13px] text-texto">disciplina cristiana</p>
    </div>
  );
}

/** Para que `App.tsx` sepa si toca saludar. */
export function tocaSaludar(): boolean {
  return !yaSaludo;
}
