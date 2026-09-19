/**
 * El montaje bueno: los planos de la app caen sobre la palabra que los nombra.
 *
 * Esto sólo se pudo hacer después de transcribir la toma central. Antes los
 * planos de pantalla estaban todos amontonados al final porque no se sabía
 * cuándo hablaba Alex de cada cosa. Ahora se sabe al segundo:
 *
 *   11.40 - 17.20  «es un despertador para el momento de orar, de leer tu
 *                   Palabra»                        -> la alarma
 *   22.52 - 33.04  «disfrutar de una preciosa comunidad donde con tus
 *                   hermanos se animarán»           -> el mensaje del día
 *   33.04 - 40.32  «descarga, goza, creciendo cada día más disciplinado»
 *                                                   -> los planes y la racha
 *
 * ── Cómo se mantiene el audio intacto ─────────────────────────────────────
 *
 * Su voz va en **una sola pista continua** de los 0,9 s a los 40,32 s. El
 * vídeo se construye aparte, trozo a trozo, y cada inserto de pantalla ocupa
 * exactamente los mismos segundos que el trozo de cara que sustituye. Al
 * juntarlos, la voz no se mueve ni un cuadro: se sigue oyendo a Alex mientras
 * se ve la app.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "C:/Users/InvitadosPro/OneDrive/Desktop/videos-genuino";
const LISTOS = join(BASE, ".trabajo", "listos");
const PANTALLAS = join(BASE, "pantallas");
const CAPTURAS = "C:/Users/InvitadosPro/developer/firme/docs/tienda/capturas/listas";
const T = join(BASE, ".trabajo", "v2");
mkdirSync(T, { recursive: true });

const FONDO = "0x0b0d10";
const ORO = "0xc9a227";
const FUERTE = "C\\:/Windows/Fonts/segoeuib.ttf";
const CITA = "C\\:/Windows/Fonts/georgiai.ttf";

const ff = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
const limpiar = (t) => t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

/**
 * El rótulo, estilo ROTUNDO: el que eligió Alex.
 *
 * Sin barra de fondo. Letra grande con sombra dura, la primera línea en
 * blanco y la segunda en el dorado de la app. La sombra es lo que lo hace
 * legible sobre cualquier plano **sin tener que oscurecer la imagen**, y eso
 * importa aquí: el metraje tiene buena luz y una casa bonita, y taparla con
 * un degradado negro era desperdiciarla.
 */
const texto = (lineas, { tam = 80 } = {}) => {
  const sombra = "shadowcolor=black@0.85:shadowx=4:shadowy=4";
  const alto = lineas.length === 1 ? [0.70] : [0.655, 0.735];
  return lineas
    .map(
      (l, i) =>
        `drawtext=fontfile='${FUERTE}':text='${limpiar(l)}'` +
        `:fontcolor=${i === lineas.length - 1 && lineas.length > 1 ? ORO : "white"}` +
        `:fontsize=${tam}:x=(w-text_w)/2:y=h*${alto[i]}:${sombra}` +
        `:alpha='min(1,(t-0.2)*3)'`,
    )
    .join(",");
};

// ─────────────────────────────────────────────────── 1. planos de pantalla
//
// Uno más que antes: el del mensaje del día, que es el que toca cuando Alex
// habla de la comunidad y los hermanos.
console.log("\nPlanos de pantalla…");
for (const p of [
  { n: "s-mensaje", img: "06-mensaje-del-dia.png", seg: 3.6, zoom: 1.12 },
]) {
  const cuadros = Math.round(p.seg * 30);
  const paso = ((p.zoom - 1) / cuadros).toFixed(6);
  ff(["-loop", "1", "-i", join(CAPTURAS, p.img), "-t", String(p.seg),
    "-vf", `scale=1350:2400:force_original_aspect_ratio=decrease,pad=1350:2400:(ow-iw)/2:(oh-ih)/2:${FONDO},` +
      `zoompan=z='min(zoom+${paso},${p.zoom})':d=${cuadros}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,vignette=PI/6`,
    "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    join(T, p.n + ".mp4")]);
  console.log(`  ok  ${p.n}`);
}

// ─────────────────────────────────────────── 2. la voz, en una sola pista
const VOZ_DESDE = 0.9;
const VOZ_DUR = 39.42;
console.log("\nLa voz, entera y sin cortes…");
ff(["-ss", String(VOZ_DESDE), "-t", String(VOZ_DUR), "-i", join(LISTOS, "5.1-video-de-base-central.mp4"),
  "-vn", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(T, "voz.m4a")]);

// ──────────────────────────────── 3. el vídeo del centro, con los insertos
//
// Los tramos van referidos al clip original; la suma de duraciones tiene que
// dar exactamente VOZ_DUR o la voz se descuadraría al final.
const TRAMOS = [
  { de: "central", desde: 0.90, dur: 10.5 },
  { de: join(PANTALLAS, "p15-alarma.mp4"), desde: 0.4, dur: 3.5 },
  { de: "central", desde: 14.90, dur: 7.6 },
  { de: join(T, "s-mensaje.mp4"), desde: 0.0, dur: 3.5 },
  { de: "central", desde: 26.00, dur: 7.0 },
  { de: join(PANTALLAS, "p31-planes.mp4"), desde: 0.2, dur: 3.5 },
  { de: "central", desde: 36.50, dur: 3.82 },
];

const suma = TRAMOS.reduce((a, t) => a + t.dur, 0);
if (Math.abs(suma - VOZ_DUR) > 0.01) {
  console.error(`Los tramos suman ${suma.toFixed(2)} y la voz dura ${VOZ_DUR}. Se descuadraría.`);
  process.exit(1);
}

console.log("\nEl centro, con los insertos en su sitio…");
const trozos = [];
TRAMOS.forEach((t, i) => {
  const salida = join(T, `c${String(i).padStart(2, "0")}.mp4`);
  const origen = t.de === "central" ? join(LISTOS, "5.1-video-de-base-central.mp4") : t.de;
  ff(["-ss", String(t.desde), "-t", String(t.dur), "-i", origen,
    "-an", "-vf", "fps=30,scale=1080:1920,setsar=1",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", salida]);
  trozos.push(salida);
  console.log(`  ok  ${t.de === "central" ? "cara" : "app "}  ${t.dur}s`);
});

const listaC = join(T, "centro.txt");
writeFileSync(listaC, trozos.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", listaC, "-an", "-c", "copy", join(T, "centro-mudo.mp4")]);
// Y se le devuelve la voz, que nunca se tocó.
ff(["-i", join(T, "centro-mudo.mp4"), "-i", join(T, "voz.m4a"),
  "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", join(T, "centro.mp4")]);

// ───────────────────────────────────────────────── 4. la apertura y el cierre
console.log("\nApertura y cierre…");
// La apertura, apretada de 11,6 s a 8,7 s.
//
// Se midieron los silencios dentro de la toma central y **no había nada que
// cortar**: Alex habla seguido, y las únicas pausas son respiraciones de dos
// décimas entre frases. Quitarlas habría ahorrado dos segundos a cambio de
// ocho saltos de imagen y de dejarle hablando sin respirar.
//
// La grasa estaba aquí: cuatro planos de tres segundos para plantear algo que
// se entiende en dos. Frases más cortas y planos más cortos.
const PIEZAS = [
  { n: "a1", clip: join(LISTOS, "01.2-viendo-tv.mp4"), desde: 0.3, dur: 2.6, txt: ["Le dijiste a Dios", "que madrugabas."] },
  { n: "a2", clip: join(LISTOS, "2.2-comiendo.mp4"), desde: 0.2, dur: 1.9, txt: ["Y se te fue."] },
  { n: "a3", clip: join(LISTOS, "4.1-trabajo.mp4"), desde: 2.0, dur: 1.7, txt: ["Otra vez."] },
  { n: "a4", clip: join(LISTOS, "6.1-celular-y-la-alarma.mp4"), desde: 4.6, dur: 2.5, txt: ["No era falta de ganas.", "Era la hora."] },
];

for (const p of PIEZAS) {
  ff(["-ss", String(p.desde), "-t", String(p.dur), "-i", p.clip,
    "-f", "lavfi", "-t", String(p.dur), "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", `fps=30,scale=1080:1920,setsar=1,${texto(p.txt)},fade=t=in:st=0:d=0.2,fade=t=out:st=${(p.dur - 0.2).toFixed(2)}:d=0.2`,
    "-map", "0:v", "-map", "1:a", "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(T, p.n + ".mp4")]);
  console.log(`  ok  ${p.n}  ${p.txt.join(" / ")}`);
}

// El cierre: el icono de la app sobre su fondo, y la llamada a descargar.
ff(["-f", "lavfi", "-t", "4.5", "-i", `color=c=${FONDO}:s=1080x1920:r=30`,
  "-i", "C:/Users/InvitadosPro/developer/firme/docs/tienda/icono-play-512.png",
  "-f", "lavfi", "-t", "4.5", "-i", "anullsrc=r=48000:cl=stereo",
  "-filter_complex",
  "[1:v]scale=330:330[ico];" +
  "[0:v][ico]overlay=(W-w)/2:H*0.30:enable='gte(t,0.15)'[v1];" +
  `[v1]drawtext=fontfile='${FUERTE}':text='Genuino':fontcolor=white:fontsize=92:x=(w-text_w)/2:y=h*0.48:alpha='min(1,(t-0.4)*2)'[v2];` +
  `[v2]drawtext=fontfile='${CITA}':text='Disciplina Cristiana':fontcolor=${ORO}:fontsize=52:x=(w-text_w)/2:y=h*0.545:alpha='min(1,(t-0.7)*2)'[v3];` +
  `[v3]drawtext=fontfile='${FUERTE}':text='Descargala':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=h*0.66:alpha='min(1,(t-1.2)*2)'[v4];` +
  `[v4]drawtext=fontfile='${CITA}':text='para la gloria de Dios':fontcolor=0x8b949e:fontsize=44:x=(w-text_w)/2:y=h*0.72:alpha='min(1,(t-1.6)*2)',fade=t=out:st=4.0:d=0.5[v]`,
  "-map", "[v]", "-map", "2:a", "-r", "30",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(T, "cierre.mp4")]);
console.log("  ok  cierre");

// ─────────────────────────────────────────────────────────── 5. todo junto
const ORDEN = [
  join(T, "a1.mp4"), join(T, "a2.mp4"), join(T, "a3.mp4"), join(T, "a4.mp4"),
  join(T, "centro.mp4"),
  join(T, "cierre.mp4"),
];
const lista = join(T, "todo.txt");
writeFileSync(lista, ORDEN.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));

const FINAL = join(BASE, "Genuino-v3-vertical.mp4");
ff(["-f", "concat", "-safe", "0", "-i", lista,
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", FINAL]);

const dur = execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", FINAL],
  { encoding: "utf8" }).trim();

console.log(`\n${FINAL}\n${Number(dur).toFixed(1)} segundos\n`);
