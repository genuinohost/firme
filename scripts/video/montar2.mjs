/**
 * El motor de montaje, segunda generación.
 *
 *     node scripts/video/montar2.mjs <carpeta-del-proyecto>
 *
 * La carpeta lleva un `proyecto.mjs` que describe TODO lo particular de ese
 * vídeo: el clip, la transcripción, la cara, los planos, la música, el cierre.
 * Aquí no hay nada de ningún vídeo concreto. Lo que cambió respecto a
 * `montar-pro.mjs`, y por qué:
 *
 * 1. **Cada vídeo en su carpeta.** El motor anterior tenía las rutas fijas y
 *    volver a correrlo pisaba el vídeo anterior.
 *
 * 2. **Los cortes caen sobre los golpes DETECTADOS, no sobre una rejilla.**
 *    Con una pista electrónica la rejilla `k × pulso` vale (16 ms de error).
 *    Con un piano, no: los golpes medidos se apartan de la rejilla 109 ms de
 *    media. Aquí cada corte se lleva al golpe real más cercano y después al
 *    cuadro más cercano, así que la suma de cuadros es exacta y la voz no se
 *    desplaza ni un cuadro por acumulación de redondeos.
 *
 * 3. **El encuadre sale de la cara medida** (`encuadrar.py`): centro
 *    horizontal incluido. En el vídeo de Filipenses la cara está en x=0,641 y
 *    un recorte centrado en 0,5 la dejaba pegada al borde.
 *
 * 4. **Exporta las pistas por separado** (`m-voz.wav`, `m-musica.wav`) y la
 *    lista de cortes (`cortes.json`) para que `comprobar.mjs` mida el
 *    resultado sin rehacer nada.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { agrupar, ajustar, ancho, usarAnchos } from "./subtitulos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = resolve(process.argv[2] ?? ".");
const RUTA_PROYECTO = join(CARPETA, "proyecto.mjs");
if (!existsSync(RUTA_PROYECTO)) {
  console.error(`No hay proyecto.mjs en ${CARPETA}`);
  process.exit(1);
}
const P = (await import(pathToFileURL(RUTA_PROYECTO).href)).default;
const T = join(CARPETA, ".trabajo", "pro");
mkdirSync(T, { recursive: true });
const en = (r) => (r.startsWith("/") || /^[A-Za-z]:/.test(r) ? r : resolve(CARPETA, r));

const FONDO = "0x0b0d10";
const ORO = "0xc9a227";
const TENUE = "0x8b949e";
// La fuente de los rótulos la decide el proyecto (Alex no quiso Segoe para
// Filipenses: eligió Arial Black). Va con su tabla de anchos, generada con
// `anchos.mjs <ttf>`, y con su tamaño, porque el reparto mide con los dos.
const FUENTE_ROTULOS = P.fuente?.archivo ?? "C:/Windows/Fonts/segoeuib.ttf";
const TAMANO_ROTULO = P.fuente?.tamano ?? 74;
if (P.fuente?.anchos) usarAnchos(join(AQUI, P.fuente.anchos), TAMANO_ROTULO);
const FUERTE = FUENTE_ROTULOS.replace(/^([A-Za-z]):/, "$1\\:");
const CITA = "C\\:/Windows/Fonts/georgiai.ttf";

// El estilo de los rótulos. Por defecto, el de Genuino: hasta siete palabras
// en dos líneas, a 0,72 de alto, con caja negra y la palabra clave en dorado.
// Los estilos medidos el 20-09-2026 (`estilos/jordi-segues.md` y
// `daniela-polofi.md`) van al revés: 1–4 palabras, más arriba, sin caja y sin
// ninguna palabra en color. Cambiarlo es cosa del proyecto, no del motor.
const R = P.rotulos ?? {};
const ALTURA_ROTULO = R.altura ?? 0.72;
const CON_CAJA = R.caja !== false;
if (R.maxPalabras || R.anchoIdeal || R.maxDur || R.maxAncho || R.maxLinea) ajustar(R);

const ff = (a) =>
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: "inherit" });
const esc = (t) =>
  t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");
const cuadro = (s) => Math.round(s * 30) / 30;

// El color lo mide `color.py` sobre el clip y lo escribe el proyecto en
// `color`: balance de blancos por ganancias de canal, una subida suave de luz
// y una S leve. La corrección antigua (curvas + colorbalance calentando las
// altas luces) dejaba la cara de Alex amarilla — «no natural» — y se queda
// sólo como reserva para proyectos sin `color`.
// El B-roll NO lleva la corrección de la cara. La de Alex está medida sobre
// SU piel bajo el sol de Caracas: aplicada a un plano de fruta o de bosque lo
// deja turbio y gris, y se ve en la hoja de fotogramas a la primera. Por
// defecto el B-roll va sin tocar; `colorBroll` en el proyecto pone lo que se
// quiera (un punto de contraste suele bastar para casarlo con el resto).
const COLOR_BROLL = P.colorBroll ?? "null";
const COLOR = P.color ??
  "curves=r='0/0 0.25/0.22 0.75/0.79 1/1':g='0/0 0.25/0.23 0.75/0.78 1/1':b='0/0.01 0.25/0.25 0.75/0.76 1/0.99'," +
  "eq=contrast=1.06:saturation=1.14:gamma=0.99," +
  "colorbalance=rs=-0.03:bs=0.04:rh=0.04:bh=-0.03";

// ═════════════════════════════════════════════ 0 · los golpes de la música
// Un vídeo puede ir SIN música: los dos estilos medidos el 20-09-2026 van con
// la voz sola. Entonces no hay golpes que seguir y los cortes caen donde los
// puso el plan, redondeados al cuadro y nada más.
const SIN_MUSICA = !P.musica || P.musica.sinMusica === true;
const golpes = SIN_MUSICA ? [] : readFileSync(en(P.musica.golpes), "utf8")
  .trim().split("\n").map(Number);

/** El golpe detectado más cercano a un instante; si no hay ninguno a menos de
 *  medio segundo (la pista aún no ha arrancado), se deja donde estaba. */
function alGolpe(t) {
  let mejor = t;
  let dist = 0.5;
  for (const g of golpes) {
    const d = Math.abs(g - t);
    if (d < dist) { dist = d; mejor = g; }
  }
  return mejor;
}

// ═════════════════════════════════════════════ 1 · los planos, en segundos
//
// `P.planos` da el instante en que ACABA cada plano (`hasta`); el primero
// empieza en 0. Cada frontera se lleva al golpe más cercano y luego al cuadro
// más cercano, para que la suma de cuadros sea exacta.
const VOZ_DUR = cuadro(P.voz.dur);
const fronteras = [];
let anterior = 0;
for (let i = 0; i < P.planos.length; i++) {
  const b = P.planos[i];
  const ultimo = i === P.planos.length - 1;
  let hasta = ultimo ? VOZ_DUR : cuadro(alGolpe(b.hasta));
  if (hasta - anterior < 0.9) {
    console.error(`El plano ${i} (${b.enc}) se queda en ${(hasta - anterior).toFixed(2)}s tras ajustarlo al golpe.`);
    process.exit(1);
  }
  fronteras.push({ ...b, desde: anterior, hasta, dur: +(hasta - anterior).toFixed(3) });
  anterior = hasta;
}

// ═════════════════════════════════════════════ 2 · el encuadre, desde la cara
//
// Para que los ojos queden al 38 % del alto del recorte, el centro del recorte
// va un poco por debajo de la cara: cy = cara_y + (0,5 − 0,38)/zoom. Y se
// acota para que el recorte nunca se salga del cuadro, mirando el zoom MÁS
// ABIERTO del plano (el final si sale, el principio si entra).
const OJOS = 0.38;

// La pista de la cara que deja `encuadrar.py` (una muestra cada segundo y
// pico). Con ella cada plano se centra en la cara DE ESE PLANO: Alex entra
// caminando y está en x=0,50 los primeros 17 s y en 0,64 después. Si no hay
// pista, se usa el centro único del proyecto.
const RUTA_CARA = join(dirname(en(P.central)), "cara.json");
const pistaCara = existsSync(RUTA_CARA) ? JSON.parse(readFileSync(RUTA_CARA, "utf8")) : null;
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
function caraEn(desde, hasta) {
  if (!pistaCara) return { ...P.cara, cyMin: P.cara.cy, h: P.cara.cabeza ?? 0.1 };
  // Las muestras del plano, con un margen de un segundo a cada lado para que
  // un plano corto no se quede sin ninguna.
  let m = pistaCara.filter((s) => s.t >= desde - 1 && s.t <= hasta + 1);
  if (m.length < 2) m = pistaCara.filter((s) => s.t >= desde - 3 && s.t <= hasta + 3);
  if (!m.length) return { ...P.cara, cyMin: P.cara.cy, h: P.cara.cabeza ?? 0.1 };
  return {
    cx: mediana(m.map((s) => s.cx)),
    cy: mediana(m.map((s) => s.cy)),
    // La cara más alta del plano: es la que decide que no se corte la cabeza.
    cyMin: Math.min(...m.map((s) => s.cy)),
    h: mediana(m.map((s) => s.h)),
  };
}

function centro(zoom, cara) {
  const v = 1 / zoom;
  const cx = Math.min(Math.max(cara.cx, v / 2), 1 - v / 2);
  let cy = cara.cy + (0.5 - OJOS) * v;
  // La cabeza no se corta NUNCA. Con la mediana del plano los ojos caen al
  // 38 %, pero si en algún momento del plano levanta la cabeza —mirada
  // arriba en «para Él es posible»— el pelo se salía por arriba. El borde
  // superior del recorte tiene que quedar por encima de la cara más alta del
  // plano, con el pelo y dos dedos de aire.
  // Una cabeza entera de margen y no 0,8: la pista muestrea cada segundo y
  // entre muestra y muestra Alex levanta la cabeza más de lo que la pista ve.
  const techoMinimo = (cara.cyMin ?? cara.cy) - 1.0 * (cara.h ?? 0.1) - 0.04;
  if (cy - v / 2 > techoMinimo) cy = techoMinimo + v / 2;
  cy = Math.min(Math.max(cy, v / 2), 1 - v / 2);
  return { cx, cy };
}

function plano(b) {
  const e = P.encuadres[b.enc];
  if (!e) { console.error(`Encuadre desconocido: ${b.enc}`); process.exit(1); }
  const deriva = b.deriva ?? 0.07;
  const cuadros = Math.max(1, Math.round(b.dur * 30));
  // Un plano puede pedir su propio zoom: el gancho, con Alex aún lejos,
  // necesita más acercamiento que el «cerca» normal aunque se ablande un poco.
  const zInicio = b.zoom ?? e.zoom;
  const zFin = zInicio + deriva;
  if (Math.min(zInicio, zFin) < 1.0) {
    console.error(`El plano "${b.enc}" con deriva ${deriva} baja de 1,0.`);
    process.exit(1);
  }
  const c = centro(Math.min(zInicio, zFin), b.broll ? P.cara : caraEn(b.desde, b.hasta));
  const cx = e.cx ?? c.cx;
  const cy = e.cy ?? c.cy;
  b.centro = { cx: +cx.toFixed(3), cy: +cy.toFixed(3) };
  const z = `${zInicio}+${deriva}*on/${cuadros}`;
  // El B-roll entra y sale con un fundido de seis cuadros: es una ventana
  // cálida contra una sala blanca, y el corte seco se siente como un salto.
  // El B-roll entra y sale EN SECO. Llevaba un fundido de seis cuadros, y en
  // la hoja de fotogramas se veia como si el plano entrara negro: el corte
  // cae en un golpe de musica y el primer cuarto de segundo estaba a oscuras.
  // Los tres estilos medidos cortan en seco, ninguno funde. `fundeBroll` en
  // el proyecto lo devuelve si alguna vez hace falta.
  const fundido = b.broll && P.fundeBroll
    ? `,fade=t=in:d=${P.fundeBroll},fade=t=out:st=${Math.max(0, b.dur - P.fundeBroll).toFixed(2)}:d=${P.fundeBroll}`
    : "";
  return (
    `fps=30,scale=1512:2688:force_original_aspect_ratio=increase,crop=1512:2688,` +
    `zoompan=z='${z}':d=1:fps=30` +
    `:x='iw*${cx.toFixed(4)}-(iw/zoom)*0.5':y='ih*${cy.toFixed(4)}-(ih/zoom)*0.5':s=1080x1920,` +
    `${b.broll ? COLOR_BROLL : COLOR},unsharp=5:5:${e.nitidez ?? 0.7}:5:5:0.0${fundido}`
  );
}

// ═════════════════════════════════════════════ 3 · la voz, entera
console.log("\nLa voz…");
ff(["-ss", String(P.voz.desde), "-i", en(P.central), "-t", String(VOZ_DUR),
  "-vn", "-af", "highpass=f=90,acompressor=threshold=0.09:ratio=3:attack=12:release=180,loudnorm=I=-15:TP=-1.5",
  "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", join(T, "voz.wav")]);

// ═════════════════════════════════════════════ 4 · los planos
console.log(`\n${fronteras.length} planos…`);
const trozos = [];
// Reaprovechar los planos ya renderizados. Cortar los planos de un vídeo de
// 66 s tarda diez minutos y todo lo demás menos de uno; cuando lo que se está
// depurando es un rótulo, repetirlos es tiempo tirado. `SALTAR_PLANOS=1` los
// da por buenos si están todos y `mudo.mp4` existe. Es una ayuda para
// depurar: en un montaje de verdad no se usa.
const SALTAR = process.env.SALTAR_PLANOS === "1" && existsSync(join(T, "mudo.mp4"));
// Y lo mismo con los rotulos: cuando lo unico que cambia es el sonido —otra
// version de la voz, otro volumen de musica— volver a dibujar setenta
// rotulos sobre 200 MB de video son cuatro minutos tirados. El video con
// rotulos no depende del audio.
const SALTAR_ROT = process.env.SALTAR_ROTULOS === "1" && existsSync(join(T, "rotulado.mp4"));
// Si se rehace aunque sea un plano, hay que volver a pegar: saltarse el
// pegado dejaba `mudo.mp4` con el plano viejo dentro y el cambio no aparecia.
let rehechos = 0;
const A = P.apertura;
// El reparto NO es la mitad: en el vídeo de Daniela Pol ella ocupa el 65 % de
// arriba y la imagen el 35 % de abajo, con el titular apoyado en la costura.
const ARRIBA = A ? Math.round((1920 * (A.reparto ?? 0.65)) / 2) * 2 : 0;
const ABAJO = 1920 - ARRIBA;
// Y el recorte de arriba NO empieza en cero. El encuadre deja los ojos al
// 38 % de 1920; si se corta por arriba sin más, en la mitad de pantalla caen
// al 58 % y él sale pequeño y bajo, con media habitación encima. Se desplaza
// para que los ojos queden al 38 % DE LA MITAD, que es donde los busca el que
// mira. Medido en la primera prueba: 256 px de desplazamiento con reparto
// 0,65, y la diferencia entre un cartel y una foto de vigilancia.
const DESPLAZO = A
  ? Math.round(Math.max(0, Math.min(1920 - ARRIBA, 1920 * OJOS - ARRIBA * OJOS)) / 2) * 2
  : 0;
fronteras.forEach((b, i) => {
  const salida = join(T, `c${String(i).padStart(2, "0")}.mp4`);
  // `plano(b)` se llama igualmente: es quien calcula y guarda `b.centro`,
  // que necesita `cortes.json` para que el comprobador mida.
  if (SALTAR && existsSync(salida)) { plano(b); trozos.push(salida); return; }
  rehechos++;
  const origen = b.broll ? en(b.broll) : en(P.central);
  const desde = b.broll ? b.desdeBroll ?? 0 : P.voz.desde + b.desde;
  if (A && b.hasta <= A.hasta + 0.001) {
    // Pantalla partida. Arriba va SU plano normal, recortado por el alto: el
    // encuadre ya pone los ojos al 38 %, así que quitando el tercio de abajo
    // queda cabeza y hombros, que es lo que se quiere. Abajo, la imagen que
    // cuenta lo mismo que él está diciendo, con la MISMA corrección de color
    // —si no, se ven dos vídeos pegados en vez de uno partido.
    ff(["-ss", String(desde), "-i", origen,
      "-ss", String(A.desdeAbajo ?? 0), "-i", en(A.abajo), "-an",
      "-filter_complex",
      `[0:v]${plano(b)},crop=1080:${ARRIBA}:0:${DESPLAZO}[arr];` +
      `[1:v]fps=30,scale=1080:${ABAJO}:force_original_aspect_ratio=increase,` +
      `crop=1080:${ABAJO},${COLOR}[aba];[arr][aba]vstack=inputs=2[v]`,
      "-map", "[v]", "-t", String(b.dur), "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", salida]);
    console.log(`  ok  ${String(i).padStart(2)}  partida   ${b.desde.toFixed(2).padStart(6)} → ${b.hasta.toFixed(2).padStart(6)}  ${b.dur.toFixed(2)}s`);
    trozos.push(salida);
    return;
  }
  ff(["-ss", String(desde), "-i", origen, "-an",
    "-vf", plano(b), "-t", String(b.dur), "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", salida]);
  console.log(`  ok  ${String(i).padStart(2)}  ${b.enc.padEnd(9)} ${b.desde.toFixed(2).padStart(6)} → ${b.hasta.toFixed(2).padStart(6)}  ${b.dur.toFixed(2)}s  cara x=${b.centro.cx} y=${b.centro.cy}`);
  trozos.push(salida);
});
if (!SALTAR || rehechos > 0) {
writeFileSync(join(T, "centro.txt"), trozos.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", join(T, "centro.txt"), "-an", "-c", "copy", join(T, "mudo.mp4")]);
}
writeFileSync(join(T, "cortes.json"), JSON.stringify(fronteras.map((b) => ({
  desde: b.desde, hasta: b.hasta, enc: b.enc, deriva: b.deriva ?? 0.07, centro: b.centro,
  // Para que el comprobador no busque la cara donde no tiene que estar.
  broll: !!b.broll,
})), null, 1));

// ═════════════════════════════════════════════ 5 · los rótulos y la tarjeta
const palabras = JSON.parse(readFileSync(en(P.palabras), "utf8"));
for (const a of P.arreglos ?? []) {
  for (let i = 0; i <= palabras.length - a.mal.length; i++) {
    if (!a.mal.every((m, j) => palabras[i + j].p.toLowerCase() === m.toLowerCase())) continue;
    a.bien.forEach((b, j) => (palabras[i + j].p = b));
    break;
  }
}
const grupos = agrupar(palabras, P.voz.desde).filter((g) => g.t < VOZ_DUR);
console.log(`\n${grupos.length} rótulos…`);
let anchoMax = 0;
for (const g of grupos) for (const l of g.lineas) anchoMax = Math.max(anchoMax, ancho(l));
if (anchoMax > 960) {
  console.error(`Hay un rótulo de ${Math.round(anchoMax)} px: no cabe.`);
  process.exit(1);
}

const capas = [];
for (const g of grupos) {
  // Mientras la tarjeta del versículo está en pantalla, los rótulos palabra a
  // palabra se callan: el texto ya está puesto, y dos textos a la vez se
  // pelean. Un rótulo que empieza dentro de la tarjeta no se pinta.
  if (P.tarjeta && g.t >= P.tarjeta.desde - 0.05 && g.t < P.tarjeta.hasta) continue;
  // Y mientras está el titular de la apertura tampoco: son cinco segundos de
  // cartel, y dos textos a la vez se pelean. Es la misma regla que la tarjeta.
  if (A?.titular && g.t < A.hasta) continue;
  // Y mientras hay un rótulo superpuesto (los PNG de la marca: el gancho, la
  // escalera, el cierre), igual. Si el subtítulo ya estaba y el rótulo entra
  // encima, el subtítulo se corta justo cuando entra.
  const sup = (P.superpuestos ?? []);
  if (sup.some((s) => g.t >= s.desde - 0.05 && g.t < s.hasta)) continue;
  const entra = sup.find((s) => s.desde > g.t && s.desde < g.fin);
  if (entra) g.fin = entra.desde;
  // `doradas` puede no existir: los estilos sin palabra en color no lo ponen.
  const dorado = P.doradas ? P.doradas.test(g.texto) : false;
  // Las dos líneas van pegadas: el paso entre ellas es la letra más el borde
  // de la caja, así que las dos cajas se tocan y se ven como un solo bloque.
  // Con 0,084 de separación (v3) Alex las vio «muy separadas».
  // La caja de `drawtext` mide el alto real del texto —unas 0,87 veces el
  // tamaño, con acentos y descendentes— más los dos bordes de 12. Medido en
  // la v4: a 74 px la caja tenía 88 px y quedaban 22 de hueco.
  const paso = (0.87 * TAMANO_ROTULO + 2 * 12) / 1920;
  const altos = g.lineas.length === 1
    ? [ALTURA_ROTULO]
    : [ALTURA_ROTULO - paso / 2, ALTURA_ROTULO + paso / 2];
  g.lineas.forEach((linea, i) => {
    const y = `h*${altos[i].toFixed(4)}-10*max(0\\,1-(t-${g.t.toFixed(2)})*12)`;
    capas.push(
      `drawtext=fontfile='${FUERTE}':text='${esc(linea)}'` +
      `:fontcolor=${dorado ? ORO : "white"}:fontsize=${TAMANO_ROTULO}` +
      `:x=(w-text_w)/2:y=${y}` +
      (CON_CAJA ? `:box=1:boxcolor=black@0.45:boxborderw=12` : "") +
      `:borderw=3:bordercolor=black@0.8:shadowcolor=black@0.85:shadowx=3:shadowy=4` +
      `:enable='between(t,${g.t.toFixed(2)},${g.fin.toFixed(2)})'`
    );
  });
}

// El titular de la apertura: dos o tres líneas QUIETAS, apoyadas en la
// costura de la pantalla partida, durante todo lo que dura la apertura. No se
// anima, no entra palabra a palabra: es un cartel. En el vídeo de Daniela son
// cinco segundos enteros, y ése es el gancho completo.
if (A?.titular) {
  const tam = A.tamano ?? 62;
  const paso = (0.87 * tam + 16) / 1920;
  const base = A.y ?? (A.reparto ?? 0.65) - 0.03;
  // Un velo oscuro detrás del titular. En el estudio de Daniela no hace falta
  // —el fondo ya es negro—, pero el salón de Alex tiene pared blanca y puerta
  // clara, y ahí el texto blanco con borde se lee a duras penas. `velo: 0` lo
  // quita.
  const velo = A.velo ?? 0.3;
  if (velo > 0) {
    const arribaVelo = base - A.titular.length * paso - 0.012;
    const altoVelo = A.titular.length * paso + 0.024;
    capas.push(
      // En `drawbox`, `w` y `h` son la caja que se está dibujando, no el
      // cuadro: hay que decir `ih`. Con `h*0,49` ffmpeg responde «Error when
      // evaluating the expression», que no lleva a esto por ningún lado.
      `drawbox=x=0:y=ih*${arribaVelo.toFixed(4)}:w=iw:h=ih*${altoVelo.toFixed(4)}` +
      `:color=black@${velo}:t=fill:enable='between(t,0,${A.hasta.toFixed(2)})'`
    );
  }
  A.titular.forEach((linea, i) => {
    const color = (A.colores ?? [])[i] === "oro" ? ORO
      : (A.colores ?? [])[i] === "tenue" ? TENUE : "white";
    const y = base - (A.titular.length - i) * paso;
    capas.push(
      `drawtext=fontfile='${FUERTE}':text='${esc(linea)}':fontcolor=${color}` +
      `:fontsize=${tam}:x=(w-text_w)/2:y=h*${y.toFixed(4)}` +
      `:borderw=3:bordercolor=black@0.85:shadowcolor=black@0.9:shadowx=3:shadowy=4` +
      `:enable='between(t,0,${A.hasta.toFixed(2)})'`
    );
  });
}

// El destello: dos cuadros de color sobre TODO el cuadro, en la frase que más
// pesa. Va delante de los rótulos en la cadena, así que el texto queda encima
// y se sigue leyendo — que es como lo hace Daniela Pol. Uno o dos por vídeo:
// el tercero ya no es un golpe, es un parpadeo.
for (const d of P.destellos ?? []) {
  const t = typeof d === "number" ? d : d.t;
  const color = (typeof d === "object" && d.color) || "red";
  const fuerza = (typeof d === "object" && d.fuerza) || 0.33;
  capas.unshift(`drawbox=x=0:y=0:w=iw:h=ih:color=${color}@${fuerza}:t=fill` +
    `:enable='between(t,${t.toFixed(2)},${(t + 0.07).toFixed(2)})'`);
}

// La tarjeta del versículo: UNA imagen con su caja (la dibuja `tarjeta.py`),
// superpuesta arriba, lejos de los rótulos, y fundida entera por el canal
// alfa. Con `drawtext` línea a línea salían tres cajas escalonadas.
// Las imágenes que van ENCIMA: la tarjeta del versículo y los rótulos de la
// marca (`superpuestos`: PNG de 1080×1920 con fondo transparente, cada uno
// con su tramo). Todas por la misma cadena de `overlay`, fundidas por el
// canal alfa. `subir` sube la imagen esos píxeles: los rótulos de la campaña
// de aliados traen la banda a 180 px del borde, dentro de los 320 que tapa
// Instagram, y así se usan sin volver a dibujarlos.
const encima = [];
if (!SALTAR_ROT && P.tarjeta) {
  const png = join(T, "tarjeta.png");
  const medidas = JSON.parse(execFileSync("python",
    [join(AQUI, "tarjeta.py"), png, P.tarjeta.cita, ...P.tarjeta.lineas],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8", TARJETA_TAMANO: String(P.tarjeta.tamano ?? 56) } }));
  encima.push({ png, x: Math.round((1080 - medidas.ancho) / 2), y: Math.round(1920 * (P.tarjeta.y ?? 0.13)),
    desde: P.tarjeta.desde, hasta: P.tarjeta.hasta, fundido: 0.4 });
}
for (const s of P.superpuestos ?? []) {
  if (!existsSync(en(s.png))) { console.error(`No existe el superpuesto ${s.png}`); process.exit(1); }
  encima.push({ png: en(s.png), x: 0, y: -(s.subir ?? 0), desde: s.desde, hasta: s.hasta, fundido: s.fundido ?? 0.25 });
}
if (!SALTAR_ROT) {
if (encima.length) {
  const entradas = encima.flatMap((o) => ["-loop", "1", "-framerate", "30", "-i", o.png]);
  let cadena = `[0:v]${capas.length ? capas.join(",") : "null"}[b0];`;
  encima.forEach((o, k) => {
    const A = o.desde.toFixed(2), B = o.hasta.toFixed(2), f = o.fundido;
    cadena += `[${k + 1}:v]format=rgba,fade=t=in:st=${A}:d=${f}:alpha=1,` +
      `fade=t=out:st=${(o.hasta - f).toFixed(2)}:d=${f}:alpha=1[o${k}];` +
      `[b${k}][o${k}]overlay=${o.x}:${o.y}:shortest=1:enable='between(t,${A},${B})'` +
      (k === encima.length - 1 ? "[v]" : `[b${k + 1}];`);
  });
  ff(["-i", join(T, "mudo.mp4"), ...entradas, "-filter_complex", cadena,
    "-map", "[v]", "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", join(T, "rotulado.mp4")]);
} else {
  ff(["-i", join(T, "mudo.mp4"), "-vf", capas.join(","), "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", join(T, "rotulado.mp4")]);
}
}
ff(["-i", join(T, "rotulado.mp4"), "-i", join(T, "voz.wav"),
  "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", join(T, "cuerpo.mp4")]);

// ═════════════════════════════════════════════ 6 · el cierre
console.log("\nCierre…");
ff(["-f", "lavfi", "-i", "sine=frequency=110:duration=1.1",
  "-af", "volume='exp(-t*5)':eval=frame,volume=0.7,lowpass=f=200",
  "-ar", "48000", "-ac", "2", join(T, "impacto.wav")]);
const C = P.cierre;
const CIERRE_DUR = C.dur ?? (C.sobreLaCara ? 2.4 : 4.6);

// Dos maneras de cerrar.
//
// La de siempre: una tarjeta sobre el fondo de la marca, 4,6 s AÑADIDOS al
// final. Medido el 20-09-2026: son el 6 % del vídeo en negro, justo donde se
// decide si vuelve a empezar. Ninguno de los dos estilos que le gustan a Alex
// hace eso; los dos acaban en su cara.
//
// `sobreLaCara: true` escribe las mismas líneas ENCIMA de los últimos
// segundos de imagen y funde a negro al final. No añade ni un segundo.
if (C.sobreLaCara) {
  const inicio = VOZ_DUR - CIERRE_DUR;
  const texto = C.lineas.map((l, i) => {
    const fuente = l.fuente === "cita" ? CITA : FUERTE;
    const color = l.color === "oro" ? ORO : l.color === "tenue" ? TENUE : "white";
    const nace = inicio + 0.2 * i;
    return `drawtext=fontfile='${fuente}':text='${esc(l.texto)}':fontcolor=${color}` +
      `:fontsize=${l.tamano}:x=(w-text_w)/2:y=h*${l.y}` +
      `:borderw=3:bordercolor=black@0.8:shadowcolor=black@0.85:shadowx=3:shadowy=4` +
      `:alpha='min(1,(t-${nace.toFixed(2)})*4)'` +
      `:enable='gte(t,${nace.toFixed(2)})'`;
  }).join(",");
  // Sin líneas es válido: el cierre lo pone un superpuesto (el rótulo de la
  // marca) y aquí sólo queda el fundido.
  ff(["-i", join(T, "cuerpo.mp4"),
    "-vf", [texto, `fade=t=out:st=${(VOZ_DUR - 0.6).toFixed(2)}:d=0.6`].filter(Boolean).join(","), "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "copy", join(T, "sin-musica.mp4")]);
} else {
let cadena = "";
let etiqueta = "0:v";
C.lineas.forEach((l, i) => {
  const fuente = l.fuente === "cita" ? CITA : FUERTE;
  const color = l.color === "oro" ? ORO : l.color === "tenue" ? TENUE : "white";
  const sig = `v${i + 1}`;
  cadena += `[${etiqueta}]drawtext=fontfile='${fuente}':text='${esc(l.texto)}':fontcolor=${color}:fontsize=${l.tamano}` +
    `:x=(w-text_w)/2:y=h*${l.y}:alpha='min(1,(t-${(0.2 + i * 0.25).toFixed(2)})*4)'[${sig}];`;
  etiqueta = sig;
});
cadena += `[${etiqueta}]fade=t=out:st=${(CIERRE_DUR - 0.6).toFixed(2)}:d=0.6[v];[1:a]apad=whole_dur=${CIERRE_DUR}[a]`;
ff(["-f", "lavfi", "-t", String(CIERRE_DUR), "-i", `color=c=${FONDO}:s=1080x1920:r=30`,
  "-i", join(T, "impacto.wav"), "-filter_complex", cadena,
  "-map", "[v]", "-map", "[a]", "-r", "30",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(T, "cierre.mp4")]);

writeFileSync(join(T, "todo.txt"),
  [join(T, "cuerpo.mp4"), join(T, "cierre.mp4")].map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", join(T, "todo.txt"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", join(T, "sin-musica.mp4")]);
}
const dur = Number(execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(T, "sin-musica.mp4")],
  { encoding: "utf8" }).trim());

// ═════════════════════════════════════════════ 7 · la música
//
// Los números vienen de medir con `medir-audio.py` en el vídeo anterior:
// compresor sobre la pista para aplanar su crecida, volumen 1,5 y agachado de
// ratio 4. Con eso la voz quedó 22,5 dB por encima de media y 9 en el peor
// momento. Aquí no hace falta desfase: los cortes ya están sobre los golpes.
console.log("\nMúsica…");
const M = P.musica;
const FINAL = join(CARPETA, `${P.nombre}.mp4`);

// Sin música no hay nada que mezclar ni nada que agachar: sólo la voz, puesta
// a la sonoridad de las redes. Se deja igualmente `m-voz.wav` para que
// `comprobar.mjs` mida sin tener que rehacer nada.
if (SIN_MUSICA) {
  ff(["-i", join(T, "sin-musica.mp4"),
    "-af", "alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", FINAL]);
  ff(["-i", FINAL, "-vn", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", join(T, "m-voz.wav")]);
} else {
// Bajadas puntuales: donde Alex baja la voz («Así que ya sabes, no puedes…»)
// ningún agachado global llega sin enterrar la música en el resto. Cada
// bajada es un tramo con rampas de medio segundo a cada lado.
const bajadas = (M.bajadas ?? []).map((b) =>
  `(1-${(1 - b.factor).toFixed(3)}*min(1\,max(0\,(t-${b.desde.toFixed(2)})/0.5))*min(1\,max(0\,(${b.hasta.toFixed(2)}-t)/0.5)))`
).join("*");
const cadenaMusica =
  `[1:a]atrim=${M.desde ?? 0}:${((M.desde ?? 0) + dur).toFixed(3)},asetpts=N/SR/TB,` +
  `acompressor=threshold=0.04:ratio=5:attack=25:release=500,volume=${M.volumen ?? 1.5},` +
  (bajadas ? `volume='${bajadas}':eval=frame,` : "") +
  `afade=t=in:st=0:d=1.2,afade=t=out:st=${(dur - 2.0).toFixed(2)}:d=2.0[mus];` +
  `[0:a]asplit=2[voz][llave];` +
  // El agachado va en el proyecto porque depende de la pista: el Trailer es
  // más denso que la Triunfal y con 4:1 dejaba la voz a 5 dB en el peor
  // momento; con 6:1 y umbral 0,02, a 10 dB. Se elige barriendo con
  // `medir-audio.py` sobre las pistas sueltas, no de oído.
  `[mus][llave]sidechaincompress=threshold=${M.umbral ?? 0.025}:ratio=${M.ratio ?? 4}:attack=8:release=320[baja];`;
ff(["-i", join(T, "sin-musica.mp4"), "-i", en(M.archivo),
  "-filter_complex",
  cadenaMusica +
  `[voz][baja]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,` +
  // TP −1,5 y no −1,0: en modo dinámico `loudnorm` se pasaba a −0,4 dBTP.
  `alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", FINAL]);

// Las dos pistas por separado, para medir el margen sin rehacer la mezcla.
ff(["-i", join(T, "sin-musica.mp4"), "-i", en(M.archivo),
  "-filter_complex", cadenaMusica.replace(/;$/, ""),
  "-map", "[voz]", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", join(T, "m-voz.wav"),
  "-map", "[baja]", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", join(T, "m-musica.wav")]);
}

// ═════════════════════════════════════════════ 8 · la copia ligera
const LIGERO = join(CARPETA, `${P.nombre}-ligero.mp4`);
ff(["-i", FINAL, "-vf", "scale=720:1280", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
  "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", LIGERO]);

console.log(`\n${FINAL}\n${dur.toFixed(1)} segundos · ${fronteras.length} planos · ` +
  `plano medio ${(VOZ_DUR / fronteras.length).toFixed(1)}s · rótulo más ancho ${Math.round(anchoMax)} px\n`);
