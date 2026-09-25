/**
 * Propone el guion de planos a partir de la transcripción.
 *
 *     node scripts/video/planificar.mjs <palabras.json> <segundos-de-voz> [--doradas=A,B,C]
 *
 * Es el criterio del jurado de Filipenses 4:13 convertido en código, para
 * cuando no hay jurado (la cuota de agentes se acaba) o para tener un punto de
 * partida en segundos y no en una hora:
 *
 * - **Cortar donde el discurso corta.** Un corte que cae en un punto o una
 *   coma se siente natural; uno en mitad de una frase, no. Se puntúan todos
 *   los repartos y se elige el mejor del conjunto (misma idea que los rótulos).
 * - **Planos de 1,6 a 3,4 s**, con 2,3 de media. Ni más largos (se para) ni
 *   más cortos (marea).
 * - **Sólo al encuadre vecino**: abierto↔medio↔cerca, nunca abierto→cerca de
 *   un corte. Alex los vio «MUY BRUSCOS» cuando saltaban.
 * - **Cerca en lo que pesa**: preguntas retóricas y palabras clave. Abierto
 *   como respiro después de un pico.
 * - **La deriva alterna de signo** y es pequeña (3–5 %).
 *
 * Imprime el bloque `planos: [...]` listo para pegar en `proyecto.mjs`, con
 * las palabras de cada plano como comentario. Después hay que LEERLO: esto
 * propone, no decide.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [ruta, durArg, ...resto] = process.argv.slice(2);
if (!ruta || !durArg) {
  console.error("uso: planificar.mjs <palabras.json> <segundos> [--doradas=A,B]");
  process.exit(1);
}
const VOZ_DUR = Number(durArg);
const doradas = (resto.find((a) => a.startsWith("--doradas="))?.slice(10) ?? "")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

const w = JSON.parse(readFileSync(ruta, "utf8")).filter((x) => x.p.trim());
const n = w.length;

const IDEAL = 2.3, MIN = 1.6, MAX = 3.4;

/** Cuánto cuesta cortar justo ANTES de la palabra i. */
function frontera(i) {
  if (i <= 0 || i >= n) return 0;
  const antes = w[i - 1].p;
  const hueco = w[i].t - w[i - 1].fin;
  if (/[.!?]$/.test(antes)) return 0;          // punto: el sitio natural
  if (/[,;:]$/.test(antes)) return 8;          // coma: casi
  if (hueco >= 0.3) return 6;                  // respiración larga
  if (/^[¿¡]/.test(w[i].p)) return 4;          // arranca una pregunta
  return 40;                                   // mitad de frase
}

/** Cuánto cuesta un plano de la palabra i a la j (j no entra). */
function costePlano(i, j) {
  const desde = i === 0 ? 0 : w[i].t;
  const hasta = j === n ? VOZ_DUR : w[j].t;
  const dur = hasta - desde;
  if (dur < 1.0 || dur > 4.2) return Infinity;
  let c = Math.abs(dur - IDEAL) * 12;
  if (dur < MIN) c += (MIN - dur) * 60;
  if (dur > MAX) c += (dur - MAX) * 60;
  return c + frontera(j);
}

// Reparto óptimo de atrás hacia delante.
const mejor = new Array(n + 1).fill(Infinity);
const corte = new Array(n + 1).fill(-1);
mejor[n] = 0;
for (let i = n - 1; i >= 0; i--) {
  for (let j = i + 1; j <= n; j++) {
    const hasta = j === n ? VOZ_DUR : w[j].t;
    const desde = i === 0 ? 0 : w[i].t;
    if (hasta - desde > 4.2) break;
    const c = costePlano(i, j);
    if (c === Infinity || mejor[j] === Infinity) continue;
    if (c + mejor[j] < mejor[i]) { mejor[i] = c + mejor[j]; corte[i] = j; }
  }
}

const planos = [];
for (let i = 0; i < n;) {
  const j = corte[i] > i ? corte[i] : n;
  const texto = w.slice(i, j).map((x) => x.p).join(" ");
  planos.push({ desde: i === 0 ? 0 : w[i].t, hasta: j === n ? VOZ_DUR : w[j].t, texto });
  i = j;
}

// ── Encuadres: sólo vecinos, cerca en lo que pesa.
const VECINOS = { abierto: ["medio"], medio: ["cerca", "abierto"], cerca: ["medio"] };
const pesa = (t) => {
  const T = t.toUpperCase();
  if (/[¿?]/.test(t)) return true;
  return doradas.some((d) => new RegExp(`(?<![A-ZÁÉÍÓÚÑ])${d}(?![A-ZÁÉÍÓÚÑ])`).test(T));
};

let anterior = null;
let ultimoExtremo = "abierto"; // para que desde «medio» se alterne a cerca y abierto
planos.forEach((p, k) => {
  let enc;
  if (k === 0) enc = "cerca";
  else {
    const permitidos = VECINOS[anterior];
    if (permitidos.length === 1) enc = permitidos[0];
    else if (pesa(p.texto)) enc = "cerca";
    else if (k + 1 < planos.length && pesa(planos[k + 1].texto)) enc = "abierto"; // respiro antes del pico
    else enc = ultimoExtremo === "cerca" ? "abierto" : "cerca";
  }
  if (enc !== "medio") ultimoExtremo = enc;
  p.enc = enc;
  p.deriva = (k % 2 === 0 ? 1 : -1) * (pesa(p.texto) && enc === "cerca" ? 0.05 : 0.04);
  anterior = enc;
});

const durs = planos.map((p) => p.hasta - p.desde);
console.log(`// ${planos.length} planos · media ${(VOZ_DUR / planos.length).toFixed(2)} s · ` +
  `más corto ${Math.min(...durs).toFixed(2)} · más largo ${Math.max(...durs).toFixed(2)}`);
console.log("  planos: [");
for (const p of planos) {
  const t = p.texto.length > 58 ? p.texto.slice(0, 55) + "…" : p.texto;
  console.log(`    { hasta: ${p.hasta.toFixed(2)}, enc: "${p.enc}", deriva: ${p.deriva > 0 ? "" : ""}${p.deriva.toFixed(2)} }, // ${t}`);
}
console.log("  ],");

// `--json=<ruta>`: el mismo plan a un archivo, para que un proyecto lo lea.
const rutaJson = resto.find((a) => a.startsWith("--json="))?.slice(7);
if (rutaJson) {
  writeFileSync(rutaJson, JSON.stringify(planos.map((p) => ({
    hasta: +p.hasta.toFixed(2), enc: p.enc, deriva: p.deriva, texto: p.texto })), null, 1));
}

// Pistas para la tarjeta: citas bíblicas que nombre.
const cita = w.map((x) => x.p).join(" ").match(/\b(Génesis|Éxodo|Salmos?|Proverbios|Isaías|Jeremías|Mateo|Marcos|Lucas|Juan|Hechos|Romanos|Corintios|Gálatas|Efesios|Filipenses|Colosenses|Tesalonicenses|Timoteo|Hebreos|Santiago|Pedro|Apocalipsis)\b[^.]{0,20}/gi);
if (cita) console.log(`\n// Cita que nombra: ${cita.join(" · ")}`);
