import { useCallback, useEffect, useRef, useState } from "react";
import { vars } from "@/componentes/piezas";
import { reducido } from "@/logica/resorte";

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
 *   0 ms     Un halo de luz empieza a abrirse detrás de todo.
 *   0–520    La gema SE TALLA (6.34): primero las facetas, finas, como líneas de
 *            luz; después el filo, de oro a cielo, y al final la barra.
 *   640      Un destello la remata y un rayo cruza (la claridad de Dios, Ap 21:23).
 *   480–1140 «Genuino», letra a letra, en Syne.
 *   820      El lema, más suave.
 *   1150     Empieza a irse: crece un 8 % y se disuelve sobre Hoy, que en ese
 *            mismo instante vuelve a entrar debajo (`onSaliendo`).
 *   1500     Fin.
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
 *
 * **Con «menos movimiento», no hay intro.** Un saludo que no se mueve es sólo
 * una espera de un segundo y una capa invisible que se traga el primer toque.
 * Y mientras se disuelve, deja pasar los toques: Hoy ya está debajo.
 */

/** Si ya se saludó en esta ejecución. Vive con el proceso, no con React. */
let yaSaludo = false;

/** Cuánto dura todo, contando la salida. */
const DURA_MS = 1500;
const SALIDA_MS = 350;

const LETRAS = "Genuino".split("");

// La gema (Genuino Cristal): ocho caras abiertas arriba a la derecha, con su barra.
const FILO = "M66 9.9 L50 4 L18 16 L4 50 L18 84 L50 96 L82 84 L96 50 L94 45";
const FACETAS = "M50 4 L50 52 L18 16 M50 52 L4 50 M50 52 L18 84 M50 52 L50 96 M50 52 L82 84 M50 52 L96 50";

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
    // Aquí `reducido()` ya ve `data-movimiento`: el efecto de disposición de
    // App.tsx que lo pone corre antes que este efecto.
    if (reducido()) {
      onFin();
      return;
    }
    const id = window.setTimeout(salir, DURA_MS - SALIDA_MS);
    return () => clearTimeout(id);
    // Sólo al montar: `salir` no cambia de identidad mientras esto vive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={salir}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center bg-fondo ${
        saliendo ? "intro-fuera pointer-events-none" : ""
      }`}
      aria-label="Genuino"
      role="img"
    >
      <div className="intro-pila size-28">
        <span className="intro-halo" aria-hidden />
        <svg viewBox="0 0 100 100" className="intro-gema size-28 overflow-visible" fill="none" aria-hidden>
          <defs>
            <linearGradient id="intro-v" gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="96" y2="96">
              <stop offset="0" stopColor="#e9c878" />
              <stop offset="0.5" stopColor="#d9a84a" />
              <stop offset="1" stopColor="#8fb7e8" />
            </linearGradient>
          </defs>
          {/* Las facetas se tallan primero, finas; luego el filo, y al final la barra. */}
          <path className="intro-faceta" pathLength={1} d={FACETAS} stroke="url(#intro-v)" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
          <path className="intro-filo" pathLength={1} d={FILO} stroke="url(#intro-v)" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
          <path className="intro-barra" pathLength={1} d="M50 52 H80" stroke="url(#intro-v)" strokeWidth="7" strokeLinecap="round" />
        </svg>
        <span className="intro-rayo" aria-hidden />
      </div>
      <p className="mt-7 font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[0.14em] text-acento-tinta" aria-hidden>
        {LETRAS.map((letra, i) => (
          <span key={i} className="intro-letra" style={vars({ "--i": i })}>
            {letra}
          </span>
        ))}
      </p>
      <p className="intro-lema mt-2 text-[13px] tracking-wide text-texto">disciplina cristiana</p>
    </div>
  );
}

/** Para que `App.tsx` sepa si toca saludar. */
export function tocaSaludar(): boolean {
  return !yaSaludo;
}
