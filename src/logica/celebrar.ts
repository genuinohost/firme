import { reducido, resorte } from "@/logica/resorte";

/**
 * El día completo: catorce motas de oro que salen del sitio y caen.
 *
 * Es la única vez que la app tira algo por el aire, y es a propósito: cumplir
 * el último bloque del día es lo más grande que pasa en ella. Todo lo demás se
 * posa; esto vuela.
 *
 * ── Cómo está hecho para que no cueste ────────────────────────────────────
 *
 * - Web Animations API, no CSS: catorce elementos con destino distinto en
 *   CSS serían catorce reglas o catorce estilos en línea recalculados.
 * - Sólo `transform` y `opacity`, y en una capa `fixed` propia que se quita
 *   entera a los 1100 ms: la página de debajo no se toca ni una vez.
 * - Cero si hay «menos movimiento»: ni la capa se crea.
 *
 * `desde` es de dónde salen —el botón que se acaba de tocar—; sin él, del
 * centro de la pantalla.
 */
export function celebrarDia(desde?: DOMRect): void {
  if (typeof document === "undefined" || reducido()) return;

  const capa = document.createElement("div");
  capa.setAttribute("aria-hidden", "true");
  capa.style.cssText =
    "position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden;contain:strict";

  const x0 = desde ? desde.left + desde.width / 2 : window.innerWidth / 2;
  const y0 = desde ? desde.top + desde.height / 2 : window.innerHeight / 2;
  const CUANTAS = 14;
  const easing = resorte("firme");

  for (let i = 0; i < CUANTAS; i++) {
    const mota = document.createElement("i");
    // Dos tamaños y dos tonos de oro, para que no parezcan estampadas.
    const grande = i % 3 === 0;
    const lado = grande ? 7 : 4;
    mota.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${lado}px;height:${lado}px;margin:-${lado / 2}px;border-radius:${grande ? "2px" : "50%"};background:${i % 2 ? "#e9c878" : "#8fb7e8"};will-change:transform,opacity`;
    capa.appendChild(mota);

    // Un abanico hacia arriba (entre −150° y −30°), cada una a su distancia.
    const angulo = (-150 + (120 * i) / (CUANTAS - 1)) * (Math.PI / 180);
    const alcance = 90 + ((i * 37) % 70);
    const dx = Math.cos(angulo) * alcance;
    const dy = Math.sin(angulo) * alcance;
    const giro = ((i * 53) % 180) - 90;

    mota.animate(
      [
        { transform: "translate3d(0,0,0) scale(.4) rotate(0)", opacity: 0 },
        { transform: `translate3d(${dx * 0.6}px,${dy * 0.7}px,0) scale(1) rotate(${giro / 2}deg)`, opacity: 1, offset: 0.3 },
        // Caen: la gravedad es lo que las hace parecer cosas y no píxeles.
        { transform: `translate3d(${dx}px,${dy + 70}px,0) scale(.7) rotate(${giro}deg)`, opacity: 0 },
      ],
      { duration: 900 + (i % 4) * 50, delay: (i % 5) * 18, easing, fill: "forwards" },
    );
  }

  document.body.appendChild(capa);
  window.setTimeout(() => capa.remove(), 1100);
}
