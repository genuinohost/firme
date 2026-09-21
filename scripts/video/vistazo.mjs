/**
 * Saca las hojas de fotogramas del vídeo terminado, para MIRARLO.
 *
 *     node scripts/video/vistazo.mjs <carpeta-del-proyecto>
 *
 * Todos los números pueden salir bien y el vídeo estar mal. Los tres rótulos
 * pisándose, el «DESCARGALA» sin tilde, la marca duplicada al final y los tres
 * encuadres que no se aplicaban se vieron MIRANDO, no midiendo. Y ese paso era
 * el único del método sin script: se hacía a mano, con una orden de ffmpeg
 * distinta cada vez, y por eso es el que se saltaba.
 *
 * Deja cuatro cosas en `.trabajo/vistazo/`:
 *
 *    1-arranque.png    los tres primeros segundos, cuadro a cuadro cada 0,4 s
 *    2-cortes-N.png    los dos lados de CADA corte, para ver el salto
 *    3-cierre.png      los tres últimos segundos
 *    4-recorrido.png   el vídeo entero, uno cada cinco segundos
 *
 * A **escala de móvil** (270 px de ancho), que es donde se va a ver. Un rótulo
 * que a 1080 se lee y a 270 no, no se lee: el que mira no tiene la pantalla de
 * un ordenador.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CARPETA = resolve(process.argv[2] ?? ".");
const P = (await import(pathToFileURL(join(CARPETA, "proyecto.mjs")).href)).default;
const FINAL = join(CARPETA, `${P.nombre}.mp4`);
const SALIDA = join(CARPETA, ".trabajo", "vistazo");
const TEMP = join(SALIDA, "sueltos");

if (!existsSync(FINAL)) { console.error(`No está ${FINAL}. Montar primero.`); process.exit(1); }
rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(TEMP, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
const dur = Number(execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", FINAL],
  { encoding: "utf8" }).trim());

// La hora va escrita en cada fotograma: sin eso, al ver un fallo en la hoja no
// se sabe a qué segundo ir, y se acaba buscándolo a ojo por todo el vídeo.
// La unidad del disco lleva la barra delante o ffmpeg parte la ruta por los
// dos puntos y dice «No option name», que no lleva a esto por ningun lado.
const FUENTE = "C:/Windows/Fonts/ariblk.ttf".replace(/^([A-Za-z]):/, "$1\\:");
let n = 0;
const sacar = (t, etiqueta) => {
  const ruta = join(TEMP, `${String(n++).padStart(3, "0")}.png`);
  // Pedir un fotograma pasado el final NO da error: ffmpeg sale con 0 y no
  // escribe nada, y quien revienta es el `xstack` de después buscando un png
  // que no existe. Por eso se recorta el tiempo y se comprueba el archivo.
  ff(["-ss", Math.max(0, Math.min(t, dur - 0.2)).toFixed(3), "-i", FINAL, "-frames:v", "1",
    "-vf", `scale=270:-2,drawtext=fontfile='${FUENTE}':text='${etiqueta}':fontcolor=white:` +
           `fontsize=15:box=1:boxcolor=black@0.75:boxborderw=4:x=5:y=5`, ruta]);
  return existsSync(ruta) ? ruta : null;
};

// `tile` deja huecos negros si le faltan fotogramas para llenar la rejilla, y
// eso está bien: se ve que la hoja acabó, no que falta algo.
const hoja = (rutas, cols, filas, nombre) => {
  const entradas = rutas.flatMap((r) => ["-i", r]);
  const filtro = rutas.map((_, i) => `[${i}:v]`).join("") +
    `xstack=inputs=${rutas.length}:layout=` +
    rutas.map((_, i) => {
      const c = i % cols, f = Math.floor(i / cols);
      return `${c ? Array.from({ length: c }, (_, k) => `w${k}`).join("+") : "0"}_` +
             `${f ? Array.from({ length: f }, (_, k) => `h${k * cols}`).join("+") : "0"}`;
    }).join("|") + ":fill=black";
  ff([...entradas, "-filter_complex", filtro, join(SALIDA, nombre)]);
  console.log(`  ${nombre.padEnd(20)} ${rutas.length} fotogramas`);
};

const cortes = existsSync(join(CARPETA, ".trabajo", "pro", "cortes.json"))
  ? JSON.parse(readFileSync(join(CARPETA, ".trabajo", "pro", "cortes.json"), "utf8"))
  : [];

console.log(`\nVistazo de ${P.nombre} · ${dur.toFixed(1)} s\n`);

// 1 · El arranque. Los tres primeros segundos deciden si alguien se queda, y
// el primer montaje abría con un fotograma casi negro sin que nadie lo viera.
hoja([0.05, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8].map((t) => sacar(t, `${t.toFixed(1)}s`)).filter(Boolean),
  4, 2, "1-arranque.png");

// 2 · Los dos lados de cada corte. Aquí se ve si el salto de encuadre es
// brusco («los acercamientos son MUY BRUSCOS»), si el rótulo cambia a
// destiempo o si un plano repite al anterior.
if (cortes.length) {
  const POR_HOJA = 6;                       // 6 cortes = 12 fotogramas por hoja
  for (let i = 0; i < cortes.length - 1; i += POR_HOJA) {
    const trozo = cortes.slice(i, i + POR_HOJA);
    const rutas = trozo.flatMap((c) => [
      sacar(c.hasta - 0.12, `${c.hasta.toFixed(1)} ANTES ${c.enc}`),
      sacar(c.hasta + 0.12, `${c.hasta.toFixed(1)} DESPUES`),
    ].filter(Boolean));
    hoja(rutas, 4, Math.ceil(rutas.length / 4), `2-cortes-${String(i / POR_HOJA + 1).padStart(2, "0")}.png`);
  }
}

// 3 · El cierre. La marca duplicada del vídeo de la app estaba justo aquí.
hoja([3.0, 2.4, 1.8, 1.2, 0.8, 0.6, 0.4, 0.25].map((r) => sacar(dur - r, `-${r.toFixed(2)}s`)).filter(Boolean),
  4, 2, "3-cierre.png");

// 4 · El recorrido entero, para leer el vídeo de un golpe de vista: si hay un
// tramo sin nada que cambie, se ve como una fila de fotogramas iguales.
const cada = 5;
const pasos = Math.min(20, Math.floor(dur / cada) + 1);
hoja(Array.from({ length: pasos }, (_, i) => sacar(i * cada + 0.5, `${(i * cada).toFixed(0)}s`)).filter(Boolean),
  5, Math.ceil(pasos / 5), "4-recorrido.png");

rmSync(TEMP, { recursive: true, force: true });
console.log(`\n  en ${SALIDA}\n`);
