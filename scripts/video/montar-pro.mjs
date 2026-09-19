/**
 * El montaje bueno de verdad.
 *
 * Alex: «lo quiero muchísimo mejor… que atrape de principio a fin». Esto es lo
 * que se añadió sobre el montaje simple, por orden de cuánto cambia el
 * resultado:
 *
 * 1. **Subtítulos que se encienden al hablar.** Las palabras salen de dos en
 *    dos o de tres en tres, cada grupo en su segundo exacto, sacado de Whisper.
 *    Es lo que hace que un vídeo hablado no se sienta parado. Sin esto, todo
 *    lo demás sobra.
 *
 * 2. **Cortes sobre el golpe de la música.** Un corte medio segundo antes del
 *    pulso se siente flojo y nadie sabe decir por qué. La rejilla de golpes
 *    sale del tempo medido (136 ppm) y todos los cortes de la apertura caen
 *    encima.
 *
 * 3. **Corrección de color.** El metraje de móvil sale plano. Se le da curva de
 *    contraste, se calientan las luces y se enfrían las sombras un punto, y
 *    sube algo la saturación. Es la diferencia entre «grabado con el teléfono»
 *    y «rodado».
 *
 * 4. **Nada está quieto.** Cada plano lleva un empuje o un retroceso de zoom
 *    del 4 al 7 %. Una toma fija de dos segundos parece una foto; con ese
 *    movimiento, respira.
 *
 * 5. **La música con arco.** Se eligió midiendo: de tres pistas, la que sube
 *    +0,76 de principio a fin y deja el pico justo en la llamada a descargar.
 *
 * 6. **B-roll de apoyo**, muy poco y muy corto: un amanecer y una Biblia,
 *    donde las palabras lo piden. Más de eso convertiría un testimonio propio
 *    en un anuncio genérico.
 *
 * 7. **Sonido.** Golpes de aire en las transiciones, sintetizados aquí — ni un
 *    archivo de terceros, ni una licencia que revisar.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "C:/Users/InvitadosPro/OneDrive/Desktop/videos-genuino";
const LISTOS = join(BASE, ".trabajo", "listos");
const PANTALLAS = join(BASE, "pantallas");
const BROLL = join(BASE, "broll");
const MUSICA = join(BASE, "musica", "3-triunfal.mp3");
const T = join(BASE, ".trabajo", "pro");
const ICONO = "C:/Users/InvitadosPro/developer/firme/docs/tienda/icono-play-512.png";
mkdirSync(T, { recursive: true });

const FONDO = "0x0b0d10";
const ORO = "0xc9a227";
const FUERTE = "C\\:/Windows/Fonts/segoeuib.ttf";
const CITA = "C\\:/Windows/Fonts/georgiai.ttf";

const ff = (a) =>
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: "inherit" });
const esc = (t) =>
  t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

// ── La rejilla de golpes ───────────────────────────────────────────────────
//
// El primer golpe detectado cae en 15.37 s y el tempo es de 136 por minuto.
// De ahí se saca hacia atrás dónde caen todos los demás, incluidos los del
// principio, que la detección no ve porque la pista abre sin percusión.
const PULSO = 60 / 136;
const FASE = 15.37 - Math.floor(15.37 / PULSO) * PULSO;
const golpe = (n) => +(FASE + n * PULSO).toFixed(3);

// ── El color ───────────────────────────────────────────────────────────────
//
// Curva en S suave para dar cuerpo sin quemar las luces, sombras un punto más
// frías y luces un punto más cálidas. Es discreto a propósito: un grado
// exagerado envejece mal y aquí hay caras, que es lo que peor perdona.
const COLOR =
  "curves=r='0/0 0.25/0.22 0.75/0.79 1/1':g='0/0 0.25/0.23 0.75/0.78 1/1':b='0/0.01 0.25/0.25 0.75/0.76 1/0.99'," +
  "eq=contrast=1.06:saturation=1.14:gamma=0.99," +
  "colorbalance=rs=-0.03:bs=0.04:rh=0.04:bh=-0.03," +
  "unsharp=5:5:0.5:5:5:0.0";

/**
 * Un empuje (o retroceso) de zoom, para que ningún plano esté quieto.
 *
 * ── La trampa de `zoompan`, que costó dos intentos ────────────────────────
 *
 * **`d` es cuántos cuadros saca por CADA cuadro de entrada**, no la duración
 * del plano. Puesto a `d=53` sobre un vídeo de 53 cuadros, ffmpeg genera 2.809
 * — un plano de 1,76 segundos tardaba siete minutos y pesaba 28 MB, y el
 * resultado además iba a cámara lentísima.
 *
 * Con vídeo va siempre **`d=1`**: un cuadro entra, un cuadro sale, y `zoom`
 * se va acumulando solo de uno al siguiente. El `d` grande sólo tiene sentido
 * cuando la entrada es **una imagen fija**, como en `pantallas.mjs`.
 *
 * ── Y por qué 1,4× y no 4K ────────────────────────────────────────────────
 *
 * La primera versión escalaba a 2160×3840 «por calidad». Para un zoom del 4 al
 * 7 % basta con tener ese margen de sobra: 1512×2688 es 1,4× el destino, más
 * que suficiente para que al ampliar no se vea blando, y cuesta una fracción.
 */
function movimiento(dur, { desde = 1.0, hasta = 1.06, x = "0.5", y = "0.5" } = {}) {
  const cuadros = Math.max(1, Math.round(dur * 30));
  const paso = (Math.abs(hasta - desde) / cuadros).toFixed(6);
  const z =
    hasta > desde ? `min(zoom+${paso},${hasta})` : `max(zoom-${paso},${hasta})`;
  // `fps=30` va **antes** de zoompan, nunca después.
  //
  // Detrás, el montaje se colgaba para siempre: zoompan anuncia 30 cuadros por
  // segundo pero la fuente va a 25, las marcas de tiempo salen descuadradas, y
  // el `fps` siguiente se queda intentando rellenar huecos que no acaban nunca.
  // Sin error, sin aviso: el proceso se come la memoria hasta que alguien mira.
  return (
    `fps=30,scale=1512:2688:force_original_aspect_ratio=increase,crop=1512:2688,` +
    `zoompan=z='${z}':d=1:x='iw*${x}-(iw/zoom*${x})':y='ih*${y}-(ih/zoom*${y})':s=1080x1920`
  );
}

/** Rótulo grande con sombra: el estilo que eligió Alex. */
function rotulo(lineas, { tam = 82, desde = 0.15 } = {}) {
  const alto = lineas.length === 1 ? [0.70] : [0.655, 0.735];
  return lineas
    .map(
      (l, i) =>
        `drawtext=fontfile='${FUERTE}':text='${esc(l)}'` +
        `:fontcolor=${i === lineas.length - 1 && lineas.length > 1 ? ORO : "white"}` +
        `:fontsize=${tam}:x=(w-text_w)/2:y=h*${alto[i]}` +
        `:shadowcolor=black@0.85:shadowx=4:shadowy=4` +
        `:alpha='min(1,(t-${desde})*6)'`,
    )
    .join(",");
}

// ═══════════════════════════════════════════════ 1 · efectos de sonido
//
// Un golpe de aire y un impacto grave, hechos aquí con ruido filtrado y un
// seno que cae. Suenan bien, pesan nada y no hay ninguna licencia que mirar.
console.log("\nSonido…");
ff(["-f", "lavfi", "-i", "anoisesrc=d=0.5:c=pink:a=0.5",
  "-af", "highpass=f=300,lowpass=f=6000,volume='min(1,t*8)*max(0,1-(t-0.12)*4)':eval=frame,volume=0.5",
  "-ar", "48000", "-ac", "2", join(T, "aire.wav")]);
ff(["-f", "lavfi", "-i", "sine=frequency=110:duration=1.1",
  "-af", "volume='exp(-t*5)':eval=frame,volume=0.7,lowpass=f=200",
  "-ar", "48000", "-ac", "2", join(T, "impacto.wav")]);
console.log("  ok  aire · impacto");

// ═══════════════════════════════════════════════ 2 · la apertura, a golpe
//
// Tres planos cortísimos sobre los golpes de la música. La primera frase es el
// gancho: si en tres segundos no se ha reconocido, ya no se queda.
const CORTES = [golpe(0), golpe(4), golpe(8), golpe(12)];
const APERTURA = [
  {
    n: "ap1",
    clip: join(BROLL, "amanecer-ventana.mp4"),
    desde: 1.2,
    txt: ["Le dijiste a Dios", "que madrugabas."],
    mov: { desde: 1.0, hasta: 1.07 },
    mudo: true,
  },
  {
    n: "ap2",
    clip: join(LISTOS, "2.2-comiendo.mp4"),
    desde: 0.4,
    txt: ["Y se te fue."],
    mov: { desde: 1.06, hasta: 1.0 },
  },
  {
    n: "ap3",
    clip: join(LISTOS, "4.1-trabajo.mp4"),
    desde: 2.2,
    txt: ["Otra vez."],
    mov: { desde: 1.0, hasta: 1.07 },
  },
];

console.log("\nApertura, cortando sobre el golpe…");
const aperturas = [];
APERTURA.forEach((p, i) => {
  const dur = +(CORTES[i + 1] - CORTES[i]).toFixed(3);
  const salida = join(T, p.n + ".mp4");
  const args = ["-ss", String(p.desde), "-i", p.clip];
  if (p.mudo) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  args.push(
    "-vf", `${movimiento(dur, p.mov)},${COLOR},${rotulo(p.txt)},fade=t=in:st=0:d=0.12`,
    "-t", String(dur), "-r", "30",
  );
  if (p.mudo) args.push("-map", "0:v", "-map", "1:a");
  args.push(
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", salida,
  );
  ff(args);
  aperturas.push(salida);
  console.log(`  ok  ${p.n}  ${dur}s  ${p.txt.join(" / ")}`);
});

// ═══════════════════════════════════════════════ 3 · el centro
const VOZ_DESDE = 0.9;
const VOZ_DUR = 39.42;
const CENTRAL = join(LISTOS, "5.1-video-de-base-central.mp4");

console.log("\nLa voz, entera…");
ff(["-ss", String(VOZ_DESDE), "-t", String(VOZ_DUR), "-i", CENTRAL,
  "-vn", "-af", "highpass=f=90,acompressor=threshold=0.09:ratio=3:attack=12:release=180,loudnorm=I=-15:TP=-1.5",
  "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", join(T, "voz.wav")]);

// Los tramos, referidos al clip original. La suma tiene que dar VOZ_DUR.
const TRAMOS = [
  { de: CENTRAL, desde: 0.90, dur: 10.5, mov: { desde: 1.0, hasta: 1.05 } },
  { de: join(PANTALLAS, "p15-alarma.mp4"), desde: 0.4, dur: 1.8 },
  { de: join(BROLL, "leyendo-biblia.mp4"), desde: 3.0, dur: 1.7, mov: { desde: 1.06, hasta: 1.0 } },
  { de: CENTRAL, desde: 14.90, dur: 7.6, mov: { desde: 1.05, hasta: 1.0 } },
  { de: join(T, "s-mensaje.mp4"), desde: 0.0, dur: 2.5 },
  { de: CENTRAL, desde: 26.00, dur: 8.0, mov: { desde: 1.0, hasta: 1.05 } },
  { de: join(PANTALLAS, "p31-planes.mp4"), desde: 0.2, dur: 2.5 },
  { de: CENTRAL, desde: 35.50, dur: 4.82, mov: { desde: 1.04, hasta: 1.0 } },
];

const suma = TRAMOS.reduce((a, t) => a + t.dur, 0);
if (Math.abs(suma - VOZ_DUR) > 0.01) {
  console.error(`Los tramos suman ${suma.toFixed(2)} y la voz dura ${VOZ_DUR}. Se descuadraría.`);
  process.exit(1);
}

// El plano del mensaje del día, que hace falta antes de recortar tramos.
ff(["-loop", "1", "-i", "C:/Users/InvitadosPro/developer/firme/docs/tienda/capturas/listas/06-mensaje-del-dia.png",
  "-t", "3",
  "-vf", `scale=1350:2400:force_original_aspect_ratio=decrease,pad=1350:2400:(ow-iw)/2:(oh-ih)/2:${FONDO},` +
    `zoompan=z='min(zoom+0.0006,1.10)':d=90:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,vignette=PI/6`,
  "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  join(T, "s-mensaje.mp4")]);

console.log("\nEl centro, con sus insertos…");
const trozos = [];
TRAMOS.forEach((t, i) => {
  const salida = join(T, `c${String(i).padStart(2, "0")}.mp4`);
  // Los planos de pantalla ya vienen tratados; el metraje real lleva color.
  const esPantalla = t.de.includes("pantallas") || t.de.includes("s-mensaje");
  const filtros = esPantalla
    ? ["fps=30", "scale=1080:1920", "setsar=1"]
    : [movimiento(t.dur, t.mov), COLOR];
  ff(["-ss", String(t.desde), "-i", t.de,
    "-an", "-vf", filtros.join(","), "-t", String(t.dur), "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", salida]);
  trozos.push(salida);
  console.log(`  ok  ${esPantalla ? "app " : "vivo"}  ${t.dur}s`);
});

const listaC = join(T, "centro.txt");
writeFileSync(listaC, trozos.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", listaC, "-an", "-c", "copy", join(T, "centro-mudo.mp4")]);

// ═══════════════════════════════════════════ 4 · los subtítulos que hablan
//
// Las palabras se agrupan de dos en dos o de tres en tres y cada grupo aparece
// en su segundo. Se aplican al centro **ya montado**, porque el audio corre
// continuo por debajo de los insertos: si se pusieran antes, los rótulos se
// descolocarían justo donde entra la app.
const palabras = JSON.parse(readFileSync(join(BASE, ".trabajo", "palabras.json"), "utf8"));

/**
 * Lo que Whisper oyó mal, corregido a mano.
 *
 * **Esto no es opcional.** Los subtítulos van grabados en la imagen: una
 * palabra mal escrita se queda ahí para siempre, y en un vídeo sobre fidelidad
 * a Dios un «teciendo» donde dice «creciendo» resta más de lo que suma
 * cualquier efecto.
 *
 * Se sustituye respetando el número de palabras para no mover ni un tiempo;
 * una cadena vacía hace que esa palabra no se pinte.
 */
const ARREGLOS = [
  { mal: ["fallar", "en"], bien: ["fallarle", "a"] },
  { mal: ["todos", "los", "que"], bien: ["todo", "lo", "que"] },
  { mal: ["descarga", "la", "goza,"], bien: ["descárgala,", "", "goza,"] },
  { mal: ["teciendo"], bien: ["creciendo"] },
];

for (const a of ARREGLOS) {
  for (let i = 0; i <= palabras.length - a.mal.length; i++) {
    const coincide = a.mal.every(
      (m, j) => palabras[i + j].p.toLowerCase() === m.toLowerCase(),
    );
    if (!coincide) continue;
    a.bien.forEach((b, j) => (palabras[i + j].p = b));
    break;
  }
}

const grupos = [];
for (let i = 0; i < palabras.length; ) {
  const cuantas = palabras[i].p.length <= 4 ? 3 : 2;
  const trozo = palabras.slice(i, i + cuantas);
  const texto = trozo.map((w) => w.p).filter(Boolean).join(" ").toUpperCase();
  if (texto) {
    grupos.push({
      t: Math.max(0, trozo[0].t - VOZ_DESDE),
      fin: Math.max(0, trozo[trozo.length - 1].fin - VOZ_DESDE),
      texto,
    });
  }
  i += cuantas;
}

// Cada grupo dura **exactamente** hasta que empieza el siguiente.
//
// Con `Math.max` se arreglaba el parpadeo y se creaba algo peor: cuando
// Whisper da una palabra que acaba después de que empiece la siguiente -pasa
// al hablar rapido-, los dos rotulos se dibujaban encima y salia un amasijo
// ilegible. Fijarlo al inicio del siguiente cubre el hueco y ademas impide
// que se solapen.
grupos.forEach((g, i) => {
  if (grupos[i + 1]) g.fin = grupos[i + 1].t - 0.01;
});

console.log(`\n${grupos.length} grupos de palabras…`);
const capas = grupos
  .map(
    (g) =>
      `drawtext=fontfile='${FUERTE}':text='${esc(g.texto)}':fontcolor=white:fontsize=76` +
      `:x=(w-text_w)/2:y=h*0.775:shadowcolor=black@0.9:shadowx=5:shadowy=5` +
      `:borderw=3:bordercolor=black@0.55` +
      `:enable='between(t,${g.t.toFixed(2)},${g.fin.toFixed(2)})'`,
  )
  .join(",");

// Los 43 rótulos van en un solo `-vf`, no en un archivo aparte.
//
// `-filter_complex_script` **desapareció en ffmpeg 9** y el error que da —
// «Unrecognized option» — llega después de haber montado todo lo anterior, o
// sea en el peor momento. Se pasa la cadena tal cual: son unos ocho mil
// caracteres y `execFileSync` los entrega sin pasar por el intérprete de
// órdenes, así que no hay límite de longitud que valga.
writeFileSync(join(T, "capas.txt"), capas);
ff(["-i", join(T, "centro-mudo.mp4"), "-vf", capas,
  "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  join(T, "centro-rotulado.mp4")]);

ff(["-i", join(T, "centro-rotulado.mp4"), "-i", join(T, "voz.wav"),
  "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest",
  join(T, "centro.mp4")]);

// ═══════════════════════════════════════════════ 5 · el cierre
console.log("\nCierre…");
ff(["-f", "lavfi", "-t", "5.0", "-i", `color=c=${FONDO}:s=1080x1920:r=30`,
  "-i", ICONO,
  "-i", join(T, "impacto.wav"),
  "-filter_complex",
  "[1:v]scale=340:340[ico];" +
  "[0:v][ico]overlay=(W-w)/2:H*0.29:enable='gte(t,0.1)'[v1];" +
  `[v1]drawtext=fontfile='${FUERTE}':text='Genuino':fontcolor=white:fontsize=104:x=(w-text_w)/2:y=h*0.475:alpha='min(1,(t-0.25)*3)'[v2];` +
  `[v2]drawtext=fontfile='${CITA}':text='Disciplina Cristiana':fontcolor=${ORO}:fontsize=54:x=(w-text_w)/2:y=h*0.545:alpha='min(1,(t-0.5)*3)'[v3];` +
  `[v3]drawtext=fontfile='${FUERTE}':text='DESCÁRGALA':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.665:alpha='min(1,(t-0.9)*3)'[v4];` +
  `[v4]drawtext=fontfile='${CITA}':text='para la gloria de Dios':fontcolor=0x8b949e:fontsize=46:x=(w-text_w)/2:y=h*0.725:alpha='min(1,(t-1.3)*3)',fade=t=out:st=4.4:d=0.6[v];` +
  "[2:a]apad=whole_dur=5.0[a]",
  "-map", "[v]", "-map", "[a]", "-r", "30",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(T, "cierre.mp4")]);
console.log("  ok  cierre");

// ═══════════════════════════════════════════════ 6 · todo junto, con música
const ORDEN = [...aperturas, join(T, "centro.mp4"), join(T, "cierre.mp4")];
const lista = join(T, "todo.txt");
writeFileSync(lista, ORDEN.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", lista,
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", join(T, "sin-musica.mp4")]);

const dur = Number(
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
    join(T, "sin-musica.mp4")], { encoding: "utf8" }).trim(),
);

// La música entra por debajo y **se aparta cuando él habla**: `sidechaincompress`
// le baja el volumen en cuanto hay voz y se lo devuelve en los silencios. Sin
// eso hay que elegir entre no oír la música o no entenderle a él.
console.log("\nMezclando la música…");
const FINAL = join(BASE, "Genuino-PRO-vertical.mp4");
ff(["-i", join(T, "sin-musica.mp4"), "-i", MUSICA,
  "-filter_complex",
  `[1:a]atrim=0:${dur.toFixed(2)},asetpts=N/SR/TB,volume=0.38,` +
  `afade=t=in:st=0:d=1.5,afade=t=out:st=${(dur - 2.0).toFixed(2)}:d=2.0[mus];` +
  `[0:a]asplit=2[voz][llave];` +
  `[mus][llave]sidechaincompress=threshold=0.015:ratio=9:attack=8:release=320[musbaja];` +
  `[voz][musbaja]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,` +
  `alimiter=limit=0.95,loudnorm=I=-14:TP=-1.0[a]`,
  "-map", "0:v", "-map", "[a]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
  "-movflags", "+faststart", FINAL]);

const durF = execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", FINAL],
  { encoding: "utf8" }).trim();

console.log(`\n${FINAL}\n${Number(durF).toFixed(1)} segundos\n`);
