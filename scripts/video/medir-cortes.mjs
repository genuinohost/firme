/**
 * Comprueba que cada corte cae encima de un golpe de la música.
 *
 * Un corte medio segundo fuera del pulso se siente flojo aunque nadie sepa
 * decir por qué. El montaje los calcula multiplicando pulsos por la duración
 * del pulso, así que en teoría caen bordados; esto lo comprueba contra los
 * golpes que midió librosa de la pista de verdad, que es distinto.
 *
 *     node scripts/video/medir-cortes.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "C:/Users/InvitadosPro/OneDrive/Desktop/videos-genuino";
const GOLPES = join(BASE, "musica", "3-triunfal-golpes.txt");
const PULSO = 60 / 136;
const VOZ_DUR = 39.9;
// El mismo desfase que aplica el montaje: la rejilla de golpes de la pista no
// empieza en cero, así que la música entra 82 ms más tarde para que sus golpes
// caigan encima de nuestros cortes y no 82 ms antes.
const DESFASE = 0.082;

// Los mismos pulsos del guion de montar-pro.mjs.
const PULSOS = [6, 6, 5, 3, 3, 5, 3, 3, 3, 3, 6, 6, 5, 6, 5, 3, 2, 5, 6, null];

const golpes = readFileSync(GOLPES, "utf8")
  .trim().split("\n").map(Number).filter((g) => g < VOZ_DUR + 2);

// ⚠️ La pista elegida **no tiene golpe detectable hasta el segundo 15,4**:
// arranca suave a propósito, que es por lo que se eligió. Durante el primer
// tercio del vídeo no hay pulso al que ajustarse, y los cortes de ahí salen
// con desvíos enormes en esta medición. No es un fallo del montaje.
const PRIMER_GOLPE = golpes[0];

let t = 0;
let usado = 0;
for (const p of PULSOS) if (p !== null) usado += p * PULSO;

console.log(`${golpes.length} golpes medidos · pulso ${PULSO.toFixed(4)}s (136 ppm)\n`);
console.log(" corte    segundo   golpe más cerca   desvío");
console.log("-".repeat(50));

const desvios = [];
PULSOS.forEach((p, i) => {
  if (i === 0) return; // el primer corte es el principio del vídeo
  t += (PULSOS[i - 1] === null ? VOZ_DUR - usado : PULSOS[i - 1] * PULSO);
  let cerca = golpes[0];
  for (const g of golpes) {
    if (Math.abs(g + DESFASE - t) < Math.abs(cerca + DESFASE - t)) cerca = g;
  }
  const d = (t - (cerca + DESFASE)) * 1000;
  if (t >= PRIMER_GOLPE) desvios.push(Math.abs(d));
  const aviso = t < PRIMER_GOLPE
    ? "  (la pista aún no tiene pulso)"
    : (Math.abs(d) > 60 ? "  <-- fuera" : "");
  console.log(
    `${String(i).padStart(4)}  ${t.toFixed(3).padStart(9)}  ` +
    `${cerca.toFixed(3).padStart(11)}  ${d.toFixed(0).padStart(7)} ms${aviso}`
  );
});

const medio = desvios.reduce((a, b) => a + b, 0) / desvios.length;
const peor = Math.max(...desvios);
console.log("-".repeat(50));
console.log(`desvío medio  ${medio.toFixed(0)} ms`);
console.log(`peor desvío   ${peor.toFixed(0)} ms`);
console.log(`fuera de 60 ms: ${desvios.filter((d) => d > 60).length} de ${desvios.length}`);
