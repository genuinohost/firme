/**
 * El vídeo grabado por tramos, de las tomas al archivo final, con un comando.
 *
 *     node scripts/video/montar-tomas.mjs <carpeta-del-proyecto> [--solo-medir]
 *
 * Nació con el vídeo de aliados (24-09-2026): siete tramos, una hoja del
 * teleprompter por toma. Encadena lo que en los vídeos de un tirón se hacía
 * paso a paso, y deja cada medida en un archivo que `proyecto.mjs` lee solo,
 * en vez de pegarla a mano:
 *
 *   1. tomas.py        → central.mp4, palabras-grande.json, tramos.json
 *   2. encuadrar.py    → cara.json, cara-resumen.json
 *   3. color.py        → color.json y el antes/después
 *   4. planificar.mjs  → planos.json
 *   5. montar2.mjs     → el vídeo y su copia ligera
 *   6. comprobar.mjs   → el veredicto con números
 *   7. vistazo.mjs     → las hojas a escala de móvil, para MIRARLO
 *
 * Con `--solo-medir` para después del paso 4: sirve para leer el informe de
 * tomas antes de gastar el tiempo del montaje.
 *
 * Cada paso se salta si su resultado ya existe y es más nuevo que lo que lo
 * produce, así que volver a ejecutarlo tras cambiar sólo el proyecto va
 * directo al montaje.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = resolve(process.argv[2] ?? ".");
const SOLO_MEDIR = process.argv.includes("--solo-medir");
const T = join(CARPETA, ".trabajo");
const central = join(T, "central.mp4");

const correr = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
};
const mtime = (r) => (existsSync(r) ? statSync(r).mtimeMs : 0);
const alDia = (salida, ...entradas) => mtime(salida) > Math.max(...entradas.map(mtime));

// 1 · Las tomas. Se rehace si hay una toma más nueva que el central o si
// cambió el guion; tomas.py ya guarda las transcripciones, así que repetirlo
// sólo cuesta los recortes.
const tomas = join(CARPETA, "tomas");
const ultimaToma = Math.max(0, ...readdirSync(tomas).map((a) => mtime(join(tomas, a))));
if (mtime(central) < Math.max(ultimaToma, mtime(join(CARPETA, "guion.json")))) {
  correr("python", [join(AQUI, "tomas.py"), CARPETA, "large-v3"]);
} else {
  console.log("\n✓ central.mp4 al día — tomas sin cambios");
  console.log(readFileSync(join(T, "tomas-informe.txt"), "utf8"));
}

// 2 · La cara, 3 · el color, 4 · los planos.
if (!alDia(join(T, "cara-resumen.json"), central)) correr("python", [join(AQUI, "encuadrar.py"), central, "80"]);
if (!alDia(join(T, "color.json"), central)) correr("python", [join(AQUI, "color.py"), central, "--frio=1"]);
const { duracion } = JSON.parse(readFileSync(join(T, "tramos.json"), "utf8"));
if (!alDia(join(T, "planos.json"), join(T, "palabras-grande.json"))) {
  correr("node", [join(AQUI, "planificar.mjs"), join(T, "palabras-grande.json"), String(duracion),
    `--json=${join(T, "planos.json")}`]);
}

if (SOLO_MEDIR) {
  console.log(`\nMedido. Mira ${join(T, "tomas-informe.txt")} y ${join(T, "color-antes-despues.png")}.`);
  process.exit(0);
}

// 5 · Montar, 6 · comprobar, 7 · mirar.
correr("node", [join(AQUI, "montar2.mjs"), CARPETA]);
try {
  correr("node", [join(AQUI, "comprobar.mjs"), CARPETA]);
} catch {
  console.error("\n⚠️ El comprobador encontró faltas (arriba). El vídeo está hecho, pero no se entrega así.");
}
correr("node", [join(AQUI, "vistazo.mjs"), CARPETA]);
