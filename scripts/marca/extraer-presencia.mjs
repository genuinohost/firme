/**
 * Saca de la Reina-Valera 1909 (dominio público) los versículos de «Dios contigo»
 * y escribe src/datos/presencia.ts. Literales: el texto sale del archivo, no de memoria.
 *
 *   node scripts/marca/extraer-presencia.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const LIBROS = { REV: "Apocalipsis", PSA: "Salmos", ISA: "Isaías", EXO: "Éxodo", DEU: "Deuteronomio", JOS: "Josué", MAT: "Mateo", JOH: "Juan", HEB: "Hebreos", ZEP: "Sofonías", JER: "Jeremías", PRO: "Proverbios", ROM: "Romanos", LAM: "Lamentaciones" };
// [código, capítulo, versículo]; los de Apocalipsis 21–22 van primero: la ciudad es la idea de la marca.
const ELEGIDOS = [
  ["REV", 21, 3], ["REV", 21, 4], ["REV", 21, 5], ["REV", 21, 23], ["REV", 22, 1], ["REV", 22, 5], ["REV", 22, 17],
  ["PSA", 139, 7], ["PSA", 23, 4], ["PSA", 16, 11], ["PSA", 46, 1], ["PSA", 34, 18], ["PSA", 145, 18],
  ["PSA", 36, 9], ["PSA", 27, 1], ["PSA", 84, 11], ["ISA", 41, 10], ["ISA", 43, 2], ["ISA", 26, 3], ["ISA", 60, 19],
  ["EXO", 33, 14], ["DEU", 31, 6], ["JOS", 1, 9], ["MAT", 28, 20], ["JOH", 14, 27], ["JOH", 8, 12], ["MAT", 1, 23], ["ISA", 9, 2],
  ["ZEP", 3, 17], ["JER", 29, 13], ["PRO", 3, 5],
];
const mapa = new Map();
for (const linea of readFileSync("privado/biblia/spaRV1909_vpl.txt", "utf8").split(/\r?\n/)) {
  const m = /^(\w{3}) (\d+):(\d+) (.*)$/.exec(linea);
  if (m) mapa.set(`${m[1]} ${m[2]}:${m[3]}`, m[4].trim());
}
const filas = [];
for (const [l, c, v] of ELEGIDOS) {
  const t = mapa.get(`${l} ${c}:${v}`);
  if (!t) throw new Error(`No está ${l} ${c}:${v}`);
  // Los corchetes de la 1909 marcan palabras añadidas por los traductores: se quitan
  // los corchetes (no las palabras) para que se lea de corrido.
  filas.push({ ref: `${LIBROS[l]} ${c}:${v}`, texto: t.replace(/[\[\]]/g, "") });
}
const cuerpo = filas.map((f) => `  { ref: ${JSON.stringify(f.ref)}, texto: ${JSON.stringify(f.texto)} },`).join("\n");
writeFileSync(
  "src/datos/presencia.ts",
  `/**
 * «Dios contigo»: versículos de su presencia, de la Reina-Valera 1909 (dominio
 * público), literales. Los primeros siete son de la ciudad de Apocalipsis 21–22,
 * la idea de la identidad Cristal. GENERADO por scripts/marca/extraer-presencia.mjs:
 * no se edita a mano.
 */
export type Versiculo = { ref: string; texto: string };

export const PRESENCIA: Versiculo[] = [
${cuerpo}
];
`,
);
console.log(filas.length, "versículos");
filas.forEach((f) => console.log(f.ref.padEnd(18), f.texto.length));
