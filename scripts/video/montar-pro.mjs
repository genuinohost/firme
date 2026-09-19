/**
 * El montaje de Genuino.
 *
 * ── Lo que cambió tras puntuar el primer intento con un 6 ─────────────────
 *
 * Se midieron los cortes del vídeo anterior: **plano medio de 7,7 segundos**
 * en todo el cuerpo, cuando lo que funciona en formato corto está entre 1,5 y
 * 3. El vídeo se paraba en cuanto Alex empezaba a hablar.
 *
 * Tres arreglos, y ninguno necesitó volver a grabar:
 *
 * 1. **Encuadres distintos sacados de la misma toma.** De un plano abierto se
 *    recortan un medio y un primer plano. Cortando entre ellos cada dos o tres
 *    segundos, una sola toma parece rodada con tres cámaras — y de paso se
 *    arregla que él salía pequeño en una pantalla de móvil.
 *
 * 2. **Abre su cara y su voz**, no un amanecer. El primer fotograma del
 *    montaje anterior era casi negro, y los datos son claros: el mismo vídeo
 *    con aperturas distintas mueve el coste por instalación de dos a cuatro
 *    veces. Su mejor frase la tenía grabada y sin usar.
 *
 * 3. **Rótulos que no parten las frases**, y en dorado cuando llevan la
 *    palabra que importa.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { agrupar } from "./subtitulos.mjs";

const BASE = "C:/Users/InvitadosPro/OneDrive/Desktop/videos-genuino";
const LISTOS = join(BASE, ".trabajo", "listos");
const BROLL = join(BASE, "broll");
const CAPTURAS = "C:/Users/InvitadosPro/developer/firme/docs/tienda/capturas/listas";
const MUSICA = join(BASE, "musica", "3-triunfal.mp3");
const ICONO = "C:/Users/InvitadosPro/developer/firme/docs/tienda/icono-play-512.png";
const T = join(BASE, ".trabajo", "pro");
mkdirSync(T, { recursive: true });

const FONDO = "0x0b0d10";
const ORO = "0xc9a227";
const FUERTE = "C\\:/Windows/Fonts/segoeuib.ttf";
const CITA = "C\\:/Windows/Fonts/georgiai.ttf";

const ff = (a) =>
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: "inherit" });
const esc = (t) =>
  t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

// El pulso de la música: 136 por minuto, medido con librosa.
const PULSO = 60 / 136;

const COLOR =
  "curves=r='0/0 0.25/0.22 0.75/0.79 1/1':g='0/0 0.25/0.23 0.75/0.78 1/1':b='0/0.01 0.25/0.25 0.75/0.76 1/0.99'," +
  "eq=contrast=1.06:saturation=1.14:gamma=0.99," +
  "colorbalance=rs=-0.03:bs=0.04:rh=0.04:bh=-0.03";

/**
 * Los tres encuadres, sacados del mismo plano.
 *
 * El centro vertical **sube** al acercarse porque la cara de Alex está en el
 * tercio superior: recortando por el medio geométrico, el primer plano le
 * cortaría la frente.
 *
 * El acercamiento máximo es 1,45 y no más. La fuente es 1080×1920: a 1,7 se
 * muestrean 635 píxeles de ancho y se ve blando. A 1,45 aguanta, y el enfoque
 * de después lo sostiene.
 */
const ENCUADRES = {
  abierto: { zoom: 1.0, cy: 0.5, nitidez: 0.4 },
  medio: { zoom: 1.22, cy: 0.42, nitidez: 0.7 },
  cerca: { zoom: 1.45, cy: 0.36, nitidez: 1.0 },
};

/**
 * Un plano con su encuadre y un movimiento lento de cámara.
 *
 * `fps=30` va **antes** de zoompan y `d=1` siempre: con `d` alto zoompan
 * genera esa cantidad de cuadros por cada cuadro de entrada, y con `fps`
 * detrás el filtro siguiente se queda rellenando huecos para siempre.
 */
function plano(dur, enc, deriva = 0.04) {
  const e = ENCUADRES[enc] ?? ENCUADRES.abierto;
  const cuadros = Math.max(1, Math.round(dur * 30));
  // El zoom se calcula desde el número de cuadro, **no acumulando `zoom`**.
  //
  // En `zoompan` la variable `zoom` empieza siempre en 1,0 y va sumando lo que
  // se le diga. Con `min(zoom+paso, 1.45)` un plano corto nunca llega a 1,45:
  // sube 0,04 y se queda ahí. Los tres encuadres estaban escritos, calculados
  // y **no se aplicaban**; los planos salían todos iguales y sólo parecían
  // distintos porque Alex se mueve. No dio ningún error: se vio mirando
  // fotogramas uno al lado de otro.
  //
  // Con `on` —el número de cuadro de salida— el zoom parte del valor que toca
  // y deriva desde ahí.
  const z = `${e.zoom}+${deriva}*on/${cuadros}`;
  return (
    `fps=30,scale=1512:2688:force_original_aspect_ratio=increase,crop=1512:2688,` +
    `zoompan=z='${z}':d=1` +
    `:x='iw*0.5-(iw/zoom*0.5)':y='ih*${e.cy}-(ih/zoom*${e.cy})':s=1080x1920,` +
    `${COLOR},unsharp=5:5:${e.nitidez}:5:5:0.0`
  );
}

// ═════════════════════════════════════════════════ 1 · planos de la app
console.log("\nPlanos de la app…");
for (const p of [
  { n: "s-alarma", img: "02-alarma-bloqueado.png", seg: 2.2 },
  { n: "s-mensaje", img: "06-mensaje-del-dia.png", seg: 2.4 },
  { n: "s-racha", img: "04-plan-racha-y-batalla.png", seg: 2.4 },
]) {
  const cuadros = Math.round(p.seg * 30);
  ff(["-loop", "1", "-i", join(CAPTURAS, p.img), "-t", String(p.seg),
    "-vf", `scale=1350:2400:force_original_aspect_ratio=decrease,pad=1350:2400:(ow-iw)/2:(oh-ih)/2:${FONDO},` +
      `zoompan=z='min(zoom+${(0.1 / cuadros).toFixed(6)},1.10)':d=${cuadros}` +
      `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,vignette=PI/6`,
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
    join(T, p.n + ".mp4")]);
  console.log(`  ok  ${p.n}`);
}

// ═════════════════════════════════════════════════ 2 · la voz
const CENTRAL = join(LISTOS, "5.1-video-de-base-central.mp4");
const VOZ_DESDE = 0.45;
const VOZ_DUR = 39.9;

console.log("\nLa voz, entera…");
ff(["-ss", String(VOZ_DESDE), "-i", CENTRAL, "-t", String(VOZ_DUR),
  "-vn", "-af", "highpass=f=90,acompressor=threshold=0.09:ratio=3:attack=12:release=180,loudnorm=I=-15:TP=-1.5",
  "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", join(T, "voz.wav")]);

// ═════════════════════════════════════════════════ 3 · el guion de planos
//
// Cada bloque dura un número entero de pulsos, así que **todos los cortes caen
// sobre la música**. Los insertos van donde las palabras los piden: la alarma
// en «es un despertador», la Biblia en «leer tu Palabra», la vida diaria en
// «cumplir con todo lo que el Padre te ha entregado», los mensajes en «una
// preciosa comunidad», la racha en «creciendo cada día más disciplinado».
const GUION = [
  { pulsos: 6, enc: "cerca" },
  { pulsos: 6, enc: "medio" },
  { pulsos: 5, enc: "abierto" },
  { pulsos: 6, enc: "cerca" },
  { pulsos: 5, inserto: "s-alarma" },
  { pulsos: 3, broll: join(BROLL, "biblia-paginas.mp4"), desde: 6.0, enc: "abierto" },
  { pulsos: 3, broll: join(LISTOS, "4.1-trabajo.mp4"), desde: 3.0, enc: "medio" },
  { pulsos: 6, enc: "medio" },
  { pulsos: 6, enc: "cerca" },
  { pulsos: 6, enc: "abierto" },
  { pulsos: 5, inserto: "s-mensaje" },
  { pulsos: 6, enc: "cerca" },
  { pulsos: 5, enc: "abierto" },
  { pulsos: 5, enc: "medio" },
  { pulsos: 5, inserto: "s-racha" },
  { pulsos: 6, enc: "cerca" },
  { pulsos: null, enc: "medio" }, // el último absorbe lo que quede
];

// Se reparte el tiempo y se comprueba al milisegundo: si no cuadra, la voz
// acabaría desplazada y se vería en los labios.
let usado = 0;
for (const b of GUION) {
  if (b.pulsos === null) continue;
  b.dur = +(b.pulsos * PULSO).toFixed(3);
  usado += b.dur;
}
const ultimo = GUION[GUION.length - 1];
ultimo.dur = +(VOZ_DUR - usado).toFixed(3);
if (ultimo.dur < 1.0) {
  console.error(`Al último bloque le quedan ${ultimo.dur}s. Ajusta el guion.`);
  process.exit(1);
}

console.log(`\n${GUION.length} planos, cortando sobre el pulso…`);
const trozos = [];
let reloj = VOZ_DESDE; // por dónde va la voz dentro del clip original
GUION.forEach((b, i) => {
  const salida = join(T, `c${String(i).padStart(2, "0")}.mp4`);
  if (b.inserto) {
    ff(["-i", join(T, b.inserto + ".mp4"), "-an",
      "-vf", "fps=30,scale=1080:1920,setsar=1", "-t", String(b.dur), "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", salida]);
    console.log(`  ok  app      ${b.dur}s`);
  } else {
    const origen = b.broll ?? CENTRAL;
    const desde = b.broll ? b.desde : reloj;
    ff(["-ss", String(desde), "-i", origen, "-an",
      "-vf", plano(b.dur, b.enc), "-t", String(b.dur), "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", salida]);
    console.log(`  ok  ${(b.broll ? "broll" : b.enc).padEnd(8)} ${b.dur}s`);
  }
  trozos.push(salida);
  reloj = +(reloj + b.dur).toFixed(3);
});

writeFileSync(join(T, "centro.txt"),
  trozos.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", join(T, "centro.txt"), "-an", "-c", "copy",
  join(T, "mudo.mp4")]);

// ═════════════════════════════════════════════════ 4 · los rótulos
// El modelo grande puntúa; el pequeño no. Y la puntuación es lo que decide
// dónde corta cada rótulo, así que si está la transcripción grande, manda.
const GRANDE = join(BASE, ".trabajo", "palabras-grande.json");
const FUENTE_PALABRAS = existsSync(GRANDE)
  ? GRANDE
  : join(BASE, ".trabajo", "palabras.json");
console.log(`Palabras: ${basename(FUENTE_PALABRAS)}`);
const palabras = JSON.parse(readFileSync(FUENTE_PALABRAS, "utf8"));

/**
 * Lo que Whisper oyó mal.
 *
 * Los rótulos van grabados en la imagen: una palabra mal escrita se queda ahí
 * para siempre. Se sustituye respetando el número de palabras para no mover
 * ningún tiempo; una cadena vacía hace que no se pinte.
 */
const ARREGLOS = [
  // Los dos modelos oyen «fallar en». Alex confirmó el 19-09-2026 que dijo
  // «fallarle a», así que esto no es una conjetura: es su frase.
  { mal: ["fallar", "en"], bien: ["fallarle", "a"] },
  // Aquí acaba una oración y empieza otra, y ningún modelo pone el punto. Sin
  // él, el agrupador junta «DIOS» con «Y ES QUE EL PADRE»: dos frases en un
  // mismo rótulo.
  { mal: ["perfecto", "dios"], bien: ["perfecto", "Dios."] },
];
for (const a of ARREGLOS) {
  for (let i = 0; i <= palabras.length - a.mal.length; i++) {
    if (!a.mal.every((m, j) => palabras[i + j].p.toLowerCase() === m.toLowerCase())) continue;
    a.bien.forEach((b, j) => (palabras[i + j].p = b));
    break;
  }
}

const grupos = agrupar(palabras, VOZ_DESDE).filter((g) => g.t < VOZ_DUR);

/**
 * Las palabras que van en dorado.
 *
 * El rótulo entero cambia de color cuando lleva una de éstas. Da ritmo visual
 * y subraya lo que el vídeo vende, sin colorear palabra por palabra — que en
 * un texto centrado obliga a calcular anchuras y se acaba desalineando.
 */
const CLAVE = /DIOS|DESPERTADOR|PALABRA|ORAR|HERMANOS|COMUNIDAD|DISCIPLIN|DESCÁRGALA|GLORIA|PADRE/;

console.log(`\n${grupos.length} rótulos…`);
const capas = grupos
  .map((g) => {
    const dorado = CLAVE.test(g.texto);
    // Sube dos dedos al aparecer: un movimiento cortísimo que el ojo registra
    // como «ha cambiado» sin llegar a distraer.
    // Una o dos líneas. Con dos, la de arriba sube para que el bloque quede
    // centrado donde estaría una sola: si no, el texto baila de altura entre
    // un rótulo y el siguiente, y eso cansa más que leer.
    // Las alturas están medidas contra la zona que tapan Instagram y TikTok:
    // el pie de la app se come los últimos 300 píxeles largos de los 1920, y
    // ahí abajo el rótulo queda debajo del texto del post y de los botones.
    const altos = g.lineas.length === 1 ? [0.720] : [0.687, 0.771];
    return g.lineas
      .map((linea, i) => {
        const y = `h*${altos[i]}-10*max(0\\,1-(t-${g.t.toFixed(2)})*12)`;
        return (
          `drawtext=fontfile='${FUERTE}':text='${esc(linea)}'` +
          `:fontcolor=${dorado ? ORO : "white"}:fontsize=74` +
          `:x=(w-text_w)/2:y=${y}` +
          // La banda oscura detrás no es adorno: sin ella, el rótulo dorado
          // encima de una captura de la app —fondo claro— no se lee. El borde
          // y la sombra solos no bastaban.
          `:box=1:boxcolor=black@0.45:boxborderw=18` +
          `:borderw=3:bordercolor=black@0.8:shadowcolor=black@0.85:shadowx=3:shadowy=4` +
          `:enable='between(t,${g.t.toFixed(2)},${g.fin.toFixed(2)})'`
        );
      })
      .join(",");
  })
  .join(",");

ff(["-i", join(T, "mudo.mp4"), "-vf", capas, "-r", "30",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  join(T, "rotulado.mp4")]);

ff(["-i", join(T, "rotulado.mp4"), "-i", join(T, "voz.wav"),
  "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest",
  join(T, "cuerpo.mp4")]);

// ═════════════════════════════════════════════════ 5 · el cierre
console.log("\nCierre…");
ff(["-f", "lavfi", "-i", "sine=frequency=110:duration=1.1",
  "-af", "volume='exp(-t*5)':eval=frame,volume=0.7,lowpass=f=200",
  "-ar", "48000", "-ac", "2", join(T, "impacto.wav")]);

ff(["-f", "lavfi", "-t", "4.6", "-i", `color=c=${FONDO}:s=1080x1920:r=30`,
  "-i", ICONO, "-i", join(T, "impacto.wav"),
  "-filter_complex",
  "[1:v]scale=340:340[ico];" +
  "[0:v][ico]overlay=(W-w)/2:H*0.29:enable='gte(t,0.08)'[v1];" +
  `[v1]drawtext=fontfile='${FUERTE}':text='Genuino':fontcolor=white:fontsize=106:x=(w-text_w)/2:y=h*0.475:alpha='min(1,(t-0.2)*4)'[v2];` +
  `[v2]drawtext=fontfile='${CITA}':text='Disciplina Cristiana':fontcolor=${ORO}:fontsize=54:x=(w-text_w)/2:y=h*0.545:alpha='min(1,(t-0.45)*4)'[v3];` +
  `[v3]drawtext=fontfile='${FUERTE}':text='DESCÁRGALA':fontcolor=white:fontsize=66:x=(w-text_w)/2:y=h*0.665:alpha='min(1,(t-0.8)*4)'[v4];` +
  `[v4]drawtext=fontfile='${CITA}':text='para la gloria de Dios':fontcolor=0x8b949e:fontsize=46:x=(w-text_w)/2:y=h*0.725:alpha='min(1,(t-1.15)*4)',fade=t=out:st=4.0:d=0.6[v];` +
  "[2:a]apad=whole_dur=4.6[a]",
  "-map", "[v]", "-map", "[a]", "-r", "30",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(T, "cierre.mp4")]);

// ═════════════════════════════════════════════════ 6 · todo junto
writeFileSync(join(T, "todo.txt"),
  [join(T, "cuerpo.mp4"), join(T, "cierre.mp4")]
    .map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", join(T, "todo.txt"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", join(T, "sin-musica.mp4")]);

const dur = Number(execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(T, "sin-musica.mp4")],
  { encoding: "utf8" }).trim());

console.log("\nMúsica…");
const FINAL = join(BASE, "Genuino-PRO-vertical.mp4");
ff(["-i", join(T, "sin-musica.mp4"), "-i", MUSICA,
  "-filter_complex",
  `[1:a]atrim=0:${dur.toFixed(2)},asetpts=N/SR/TB,volume=0.36,` +
  `afade=t=in:st=0:d=1.2,afade=t=out:st=${(dur - 2.0).toFixed(2)}:d=2.0[mus];` +
  `[0:a]asplit=2[voz][llave];` +
  `[mus][llave]sidechaincompress=threshold=0.015:ratio=9:attack=8:release=320[baja];` +
  `[voz][baja]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,` +
  `alimiter=limit=0.95,loudnorm=I=-14:TP=-1.0[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", FINAL]);

const planos = GUION.length;
console.log(
  `\n${FINAL}\n${dur.toFixed(1)} segundos · ${planos} planos · ` +
  `plano medio ${(VOZ_DUR / planos).toFixed(1)}s\n`,
);
