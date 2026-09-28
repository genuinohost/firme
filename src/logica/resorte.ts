/**
 * Los resortes: las cuatro curvas con las que se mueve todo.
 *
 * ── Por qué resortes y no `ease-out` ──────────────────────────────────────
 *
 * Alex, 27-09-2026, sobre la primera versión: «casi no se notan los efectos y
 * el dinamismo: quiero más power». Lo que faltaba no era velocidad, era
 * **peso**: una curva Bézier frena y se para; un resorte se pasa un pelo y
 * vuelve, como algo que tiene masa. Es lo que hace que un botón parezca un
 * objeto y no un dibujo.
 *
 * Las cuatro curvas están muestreadas de un resorte real (masa, rigidez,
 * amortiguación) en 29 puntos y escritas como `linear()`, que el navegador
 * interpola. En CSS viven en `:root` (`--r-dedo`, `--r-firme`, `--r-vivo`,
 * `--r-snap`), con un Bézier de repuesto para navegadores viejos; aquí están
 * para lo que se anima con la Web Animations API —la marca de la barra, las
 * partículas del día completo—, **para que sea la misma mano**.
 *
 *   dedo   · sin rebote, corto: la respuesta al toque.
 *   firme  · sin rebote, se posa: lo que entra en pantalla.
 *   vivo   · se pasa un 5 % y vuelve: pantallas, iconos, lo que respira.
 *   snap   · se pasa un 24 % y vuelve: celebrar. El ✓, la marca al saltar.
 */
export const RESORTES = {
  dedo:
    "linear(0, .019, .075, .138, .211, .304, .381, .472, .542, .608, .678, .731, .777, .825, .859, .888, .917, .937, .953, .969, .979, .988, .994, .999, 1.003, 1.005, 1.006, 1.007, 1)",
  firme:
    "linear(0, .027, .085, .165, .254, .338, .425, .505, .573, .639, .696, .743, .786, .822, .853, .878, .9, .918, .932, .945, .955, .963, .97, .976, .98, .984, .987, .99, 1)",
  vivo:
    "linear(0, .032, .108, .212, .329, .449, .564, .669, .761, .84, .903, .953, .991, 1.018, 1.036, 1.046, 1.051, 1.052, 1.049, 1.045, 1.039, 1.033, 1.027, 1.021, 1.016, 1.011, 1.007, 1.004, 1)",
  snap:
    "linear(0, .085, .286, .549, .794, .997, 1.139, 1.216, 1.237, 1.213, 1.164, 1.104, 1.046, .999, .965, .948, .944, .95, .962, .976, .99, 1.001, 1.009, 1.013, 1.013, 1.012, 1.009, 1.005, 1)",
} as const;

/** Los mismos, en Bézier, para un WebView que no entienda `linear()`. */
const DE_REPUESTO = {
  dedo: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  firme: "cubic-bezier(0.22, 0.9, 0.25, 1)",
  vivo: "cubic-bezier(0.34, 1.3, 0.5, 1)",
  snap: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

let sabeLinear: boolean | null = null;

/** La curva lista para `easing` de la Web Animations API. */
export function resorte(cual: keyof typeof RESORTES): string {
  if (sabeLinear === null) {
    sabeLinear =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("animation-timing-function", "linear(0, 1)");
  }
  return sabeLinear ? RESORTES[cual] : DE_REPUESTO[cual];
}

/**
 * Si esta persona pidió menos movimiento.
 *
 * Dos vías, y basta con una: el ajuste del móvil («reducir movimiento», que
 * hay gente a la que las animaciones marean) o el interruptor de la app en
 * Ajustes, que `App.tsx` refleja en `<html data-movimiento="menos">`. El CSS
 * mira las dos mismas señales, así que lo que se apaga aquí se apaga allí.
 */
export function reducido(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.movimiento === "menos") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Que cada botón sepa dónde lo tocaron.
 *
 * Al pulsar, se guarda en el propio elemento el punto exacto del dedo
 * (`--x`, `--y`), y el CSS pinta ahí un destello que se apaga en 400 ms.
 * Un botón que se ilumina justo donde lo tocaste se siente **tuyo**; uno que
 * se hunde entero se siente de la máquina. Se escucha una sola vez, en
 * captura, para toda la app: cero listeners por botón.
 */
export function seguirElDedo(): void {
  if (typeof window === "undefined") return;
  window.addEventListener(
    "pointerdown",
    (e) => {
      const donde = (e.target as Element | null)?.closest?.(".toque");
      if (!(donde instanceof HTMLElement)) return;
      const caja = donde.getBoundingClientRect();
      donde.style.setProperty("--x", `${Math.round(e.clientX - caja.left)}px`);
      donde.style.setProperty("--y", `${Math.round(e.clientY - caja.top)}px`);
    },
    { capture: true, passive: true },
  );
}
