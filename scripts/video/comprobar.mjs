/**
 * Comprueba un montaje terminado, con números.
 *
 *     node scripts/video/comprobar.mjs <carpeta-del-proyecto>
 *
 * Todo lo que falló en el primer vídeo falló en silencio: encuadres que no se
 * aplicaban, un rótulo que se salía del cuadro, música que no se oía, cortes
 * 82 ms tarde, un cuadro de cada seis repetido. Ninguno dio error. Ninguno se
 * veía en un fotograma suelto. Esto los mide todos, y se niega a dar el vídeo
 * por bueno si alguno vuelve.
 *
 * Corre después de `montar2.mjs`, que deja lo que hace falta en `.trabajo/pro`:
 * las pistas por separado, la lista de cortes y el vídeo final.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { agrupar, ancho, usarAnchos } from "./subtitulos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = resolve(process.argv[2] ?? ".");
const P = (await import(pathToFileURL(join(CARPETA, "proyecto.mjs")).href)).default;
const T = join(CARPETA, ".trabajo", "pro");
const FINAL = join(CARPETA, `${P.nombre}.mp4`);
const en = (r) => (/^[A-Za-z]:|^\//.test(r) ? r : resolve(CARPETA, r));

const py = (guion, ...args) =>
  execFileSync("python", [join(AQUI, guion), ...args],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });

const faltas = [];
const avisos = [];
const linea = (k, v) => console.log(`  ${k.padEnd(34)} ${v}`);

// ═══════════════════════════════════════ 1 · rótulos
console.log("\n1 · Rótulos");
const palabras = JSON.parse(readFileSync(en(P.palabras), "utf8"));
for (const a of P.arreglos ?? []) {
  for (let i = 0; i <= palabras.length - a.mal.length; i++) {
    if (!a.mal.every((m, j) => palabras[i + j].p.toLowerCase() === m.toLowerCase())) continue;
    a.bien.forEach((b, j) => (palabras[i + j].p = b));
    break;
  }
}
if (P.fuente?.anchos) usarAnchos(join(AQUI, P.fuente.anchos), P.fuente.tamano ?? 74);
const grupos = agrupar(palabras, P.voz.desde).filter((g) => g.t < P.voz.dur);
let anchoMax = 0, masCorto = 99, texto = "";
for (const g of grupos) {
  for (const l of g.lineas) anchoMax = Math.max(anchoMax, ancho(l));
  masCorto = Math.min(masCorto, g.fin - g.t);
  texto += g.texto + " ";
}
linea("rótulos", grupos.length);
linea("línea más ancha", `${Math.round(anchoMax)} px de 960`);
linea("rótulo más breve", `${masCorto.toFixed(2)} s`);
if (anchoMax > 960) faltas.push(`un rótulo mide ${Math.round(anchoMax)} px y no cabe`);
if (masCorto < 0.4) avisos.push(`hay un rótulo de ${masCorto.toFixed(2)} s: casi no da tiempo a leerlo`);
// Lo que no puede aparecer en un vídeo que no es de la app.
if (P.sinApp && /APLICACI|DESCARG|\bAPP\b/.test(texto)) faltas.push("los rótulos mencionan la app y este vídeo no es de la app");

// ═══════════════════════════════════════ 2 · cortes sobre el golpe
console.log("\n2 · Cortes");
const cortes = JSON.parse(readFileSync(join(T, "cortes.json"), "utf8"));
const golpes = readFileSync(en(P.musica.golpes), "utf8").trim().split("\n").map(Number);
const desvios = [];
let sinPulso = 0;
for (const c of cortes.slice(0, -1)) {
  let d = Infinity;
  for (const g of golpes) d = Math.min(d, Math.abs(g - c.hasta));
  if (c.hasta < golpes[0]) { sinPulso++; continue; }
  desvios.push(d * 1000);
}
const medio = desvios.reduce((a, b) => a + b, 0) / Math.max(1, desvios.length);
const peor = Math.max(...desvios);
const dur = cortes.map((c) => c.hasta - c.desde);
linea("planos", `${cortes.length} · medio ${(P.voz.dur / cortes.length).toFixed(2)} s · más corto ${Math.min(...dur).toFixed(2)} s · más largo ${Math.max(...dur).toFixed(2)} s`);
linea("desvío contra el golpe", `medio ${medio.toFixed(0)} ms · peor ${peor.toFixed(0)} ms${sinPulso ? ` · ${sinPulso} cortes antes del primer golpe` : ""}`);
if (peor > 40) faltas.push(`hay un corte a ${peor.toFixed(0)} ms del golpe`);
if (Math.max(...dur) > 4.0) avisos.push(`hay un plano de ${Math.max(...dur).toFixed(1)} s`);
// ¿Se repite el mismo encuadre dos veces seguidas?
let repetidos = 0;
for (let i = 1; i < cortes.length; i++) if (cortes[i].enc === cortes[i - 1].enc) repetidos++;
if (repetidos) avisos.push(`${repetidos} veces el mismo encuadre dos planos seguidos`);

// ═══════════════════════════════════════ 3 · movimiento
console.log("\n3 · Movimiento");
const muestras = [1, Math.floor(cortes.length / 3), Math.floor(cortes.length * 2 / 3)]
  .map((i) => cortes[i]).filter(Boolean);
for (const c of muestras) {
  const a = c.desde + 0.2, b = Math.min(c.hasta - 0.1, a + 1.0);
  const salida = py("medir-movimiento.py", FINAL, a.toFixed(2), b.toFixed(2));
  const quietos = Number(/casi quietos: (\d+)/.exec(salida)?.[1] ?? -1);
  const total = Number(/casi quietos: \d+ de (\d+)/.exec(salida)?.[1] ?? 0);
  linea(`plano ${c.enc} en ${a.toFixed(1)} s`, `${quietos} cuadros repetidos de ${total}`);
  if (quietos > total * 0.08) faltas.push(`el plano en ${a.toFixed(1)} s repite ${quietos} cuadros de ${total}`);
}

// ═══════════════════════════════════════ 4 · sonido
console.log("\n4 · Sonido");
const audio = py("medir-audio.py", join(T, "m-voz.wav"), join(T, "m-musica.wav"));
const mMedio = Number(/margen medio\s+([-\d.]+)/.exec(audio)?.[1]);
const mMin = Number(/margen minimo\s+([-\d.]+)/.exec(audio)?.[1]);
const tramos = Number(/tramos por debajo de 8 dB: (\d+)/.exec(audio)?.[1]);
linea("voz sobre la música", `media ${mMedio} dB · peor ${mMin} dB · tramos < 8 dB: ${tramos}`);
if (mMedio > 28) faltas.push(`la música va ${mMedio} dB por debajo: no se oye`);
if (mMin < 6) faltas.push(`en el peor momento la voz sólo va ${mMin} dB por encima de la música`);
if (tramos > 3) avisos.push(`${tramos} tramos con la música apretando`);

// ffmpeg escribe el informe de `loudnorm` por stderr, no por stdout: con
// `execFileSync` a secas llegaba vacío y salía «NaN LUFS» sin ningún error.
// `spawnSync` devuelve las dos salidas.
const salidaLoud = spawnSync("ffmpeg",
  ["-hide_banner", "-i", FINAL, "-af", "loudnorm=print_format=summary", "-f", "null", "-"],
  { encoding: "utf8" });
const loud = String(salidaLoud.stderr ?? "") + String(salidaLoud.stdout ?? "");
const lufs = Number(/Input Integrated:\s+([-\d.]+)/.exec(loud)?.[1]);
const pico = Number(/Input True Peak:\s+([-\d.]+)/.exec(loud)?.[1]);
linea("sonoridad del archivo", `${lufs} LUFS · pico ${pico} dBTP`);
if (lufs < -16.5 || lufs > -12.5) faltas.push(`sonoridad ${lufs} LUFS, fuera de lo que piden las redes (−14 ± 2)`);
if (pico > -0.5) faltas.push(`pico ${pico} dBTP: puede saturar`);

// ═══════════════════════════════════════ veredicto
console.log("\n" + "═".repeat(60));
for (const a of avisos) console.log(`  ⚠  ${a}`);
for (const f of faltas) console.log(`  ✗  ${f}`);
if (!faltas.length) console.log(`  ✓  ${avisos.length ? "sin fallos, con avisos" : "todo en orden"}`);
console.log("═".repeat(60) + "\n");
process.exit(faltas.length ? 1 : 0);
