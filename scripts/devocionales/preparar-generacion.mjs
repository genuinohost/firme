/**
 * Prepara los días que faltan del plan (272-365) para generarlos con el
 * prompt maestro: las lecturas del calendario de YouVersion, con el texto de
 * la Reina-Valera 1909 (dominio público) ya partido en trozos de 5 versículos,
 * como en el grupo.
 *
 *   node scripts/devocionales/preparar-generacion.mjs
 *
 * Lee:
 *   privado/devocionales/calendario-272-365.json   (título y lecturas de cada día)
 *   privado/biblia/spaRV1909_vpl.txt               (eBible.org, «Public Domain»)
 * Escribe:
 *   privado/devocionales/generar/dia-NNN.json      (lo que necesita quien redacta)
 *
 * ── Por qué la 1909 ────────────────────────────────────────────────────────
 *
 * El grupo lee la RVR1960, que tiene derechos (Sociedades Bíblicas Unidas).
 * Para llevar el devocional a muchas comunidades hace falta licencia, o una
 * versión libre. Alex eligió la 1909 el 28-09-2026. Se deja tal cual, con su
 * ortografía de entonces («fué», «á»): es el texto de dominio público.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CALENDARIO = "privado/devocionales/calendario-272-365.json";
const BIBLIA = "privado/biblia/spaRV1909_vpl.txt";
const SALIDA = "privado/devocionales/generar";

for (const f of [CALENDARIO, BIBLIA]) {
  if (!existsSync(f)) {
    console.error(`Falta ${f}.`);
    process.exit(1);
  }
}

/** El nombre del libro en el plan → su código en eBible. */
export const LIBROS = {
  "Génesis": "GEN", "Éxodo": "EXO", "Levítico": "LEV", "Números": "NUM", "Deuteronomio": "DEU",
  "Josué": "JOS", "Jueces": "JDG", "Rut": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
  "1 Reyes": "1KI", "2 Reyes": "2KI", "1 Crónicas": "1CH", "2 Crónicas": "2CH", "Esdras": "EZR",
  "Nehemías": "NEH", "Ester": "EST", "Job": "JOB", "Salmos": "PSA", "Proverbios": "PRO",
  "Eclesiastés": "ECC", "Cantares": "SOL", "Isaías": "ISA", "Jeremías": "JER", "Lamentaciones": "LAM",
  "Ezequiel": "EZE", "Daniel": "DAN", "Oseas": "HOS", "Joel": "JOE", "Amós": "AMO", "Abdías": "OBA",
  "Jonás": "JON", "Miqueas": "MIC", "Nahúm": "NAH", "Habacuc": "HAB", "Sofonías": "ZEP", "Hageo": "HAG",
  "Zacarías": "ZEC", "Malaquías": "MAL", "Mateo": "MAT", "Marcos": "MAR", "Lucas": "LUK", "Juan": "JOH",
  "Hechos": "ACT", "Romanos": "ROM", "1 Corintios": "1CO", "2 Corintios": "2CO", "Gálatas": "GAL",
  "Efesios": "EPH", "Filipenses": "PHI", "Colosenses": "COL", "1 Tesalonicenses": "1TH",
  "2 Tesalonicenses": "2TH", "1 Timoteo": "1TI", "2 Timoteo": "2TI", "Tito": "TIT", "Filemón": "PHM",
  "Hebreos": "HEB", "Santiago": "JAM", "1 Pedro": "1PE", "2 Pedro": "2PE", "1 Juan": "1JO",
  "2 Juan": "2JO", "3 Juan": "3JO", "Judas": "JUD", "Apocalipsis": "REV",
};

// La Biblia: código → capítulo → [ { n, t } ].
const biblia = new Map();
for (const linea of readFileSync(BIBLIA, "utf8").split(/\r?\n/)) {
  const m = /^(\w{3}) (\d+):(\d+) (.*)$/.exec(linea);
  if (!m) continue;
  const [, libro, cap, n, t] = m;
  if (!biblia.has(libro)) biblia.set(libro, new Map());
  const caps = biblia.get(libro);
  if (!caps.has(+cap)) caps.set(+cap, []);
  caps.get(+cap).push({ n: +n, t: t.trim() });
}

function versiculos(lectura) {
  const m = /^(.*?)\s+(\d+)(?::(\d+)-(\d+))?$/.exec(lectura);
  if (!m) throw new Error(`Lectura rara: ${lectura}`);
  const [, nombre, cap, desde, hasta] = m;
  const codigo = LIBROS[nombre];
  if (!codigo) throw new Error(`Libro sin código: ${nombre}`);
  const todos = biblia.get(codigo)?.get(+cap);
  if (!todos?.length) throw new Error(`No está ${nombre} ${cap}`);
  const vs = desde ? todos.filter((v) => v.n >= +desde && v.n <= +hasta) : todos;
  return { nombre, cap: +cap, vs };
}

/** De 5 en 5 desde el 1 (o desde donde empiece): 1-5, 6-10… como en el grupo. */
function trozosDe({ nombre, cap, vs }) {
  const trozos = [];
  for (let i = 0; i < vs.length; i += 5) {
    const grupo = vs.slice(i, i + 5);
    const a = grupo[0].n;
    const b = grupo[grupo.length - 1].n;
    trozos.push({
      ref: `${nombre} ${cap}:${a}${b !== a ? `-${b}` : ""}`,
      texto: grupo.map((v) => `${v.n} ${v.t}`).join("\n"),
    });
  }
  return trozos;
}

const cal = JSON.parse(readFileSync(CALENDARIO, "utf8"));
mkdirSync(SALIDA, { recursive: true });
let n = 0;
for (const d of cal.dias) {
  const fecha = new Date(2026, 0, d.dia);
  const lecturas = d.lecturas.map(versiculos);
  const salida = {
    dia: d.dia,
    fecha: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`,
    tema: d.titulo.toUpperCase(),
    lecturas: d.lecturas,
    version: "Reina-Valera 1909 (dominio público)",
    capitulos: lecturas.map((l) => ({
      ref: `${l.nombre} ${l.cap}`,
      rango: l.vs.length ? `${l.vs[0].n}-${l.vs[l.vs.length - 1].n}` : "",
      texto: l.vs.map((v) => `${v.n} ${v.t}`).join("\n"),
      trozos: trozosDe(l),
    })),
  };
  writeFileSync(join(SALIDA, `dia-${String(d.dia).padStart(3, "0")}.json`), JSON.stringify(salida, null, 1));
  n++;
}
console.log(`${n} días preparados en ${SALIDA}/ (ignorado por Git).`);
