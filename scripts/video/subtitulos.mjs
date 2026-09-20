/**
 * Agrupar las palabras en rótulos que se lean bien.
 *
 * ── Por qué existe este archivo ───────────────────────────────────────────
 *
 * La primera versión cortaba de dos en dos sin mirar el sentido, y salían
 * rótulos como «HA PERMITIDO QUE», «TODO LO QUE», «TIENES QUE». Alex:
 * «es imperdonable que pongas subtítulos donde las frases queden a la mitad».
 * Tenía razón: un rótulo que acaba en «que» obliga a leer dos veces, y en un
 * vídeo de cincuenta segundos nadie lee dos veces.
 *
 * La segunda versión arregló los finales y dejó los principios. Salían
 * «DE CUMPLIR», «A AUMENTAR», «QUE INSTALAR»: la misma frase partida, sólo
 * que por el otro lado. Y salía «DIOS / Y ES QUE EL PADRE» — dos oraciones
 * distintas en un mismo rótulo, porque Whisper no había puesto el punto.
 *
 * ── Qué cambia en ésta ────────────────────────────────────────────────────
 *
 * 1. **El silencio cuenta como puntuación.** Whisper da el segundo exacto de
 *    cada palabra, así que el hueco entre una y la siguiente se mide. Donde
 *    hay respiración hay frontera, aunque falte el punto.
 * 2. **Se elige el reparto entero, no rótulo a rótulo.** Antes se decidía
 *    sobre la marcha y el primer corte condenaba a todos los siguientes.
 *    Ahora se puntúan todos los repartos posibles y se coge el mejor del
 *    conjunto: si empeorar un rótulo salva los tres que vienen detrás, se
 *    empeora.
 * 3. **Un rótulo tampoco puede empezar colgando**, salvo que venga después
 *    de una pausa o un punto — ahí sí, porque la frase empieza de verdad.
 * 4. **Tiene que dar tiempo a leerlo.** Menos de medio segundo, o más de
 *    veinticuatro caracteres por segundo, se penaliza.
 */

/**
 * Palabras que no pueden ni cerrar ni abrir un rótulo.
 *
 * Son las que no significan nada solas: artículos, preposiciones,
 * conjunciones y auxiliares. El ojo las lee y se queda esperando.
 */
const APOYO = new Set([
  "que", "de", "a", "el", "la", "los", "las", "en", "con", "y", "o", "se",
  "tu", "tus", "su", "sus", "mi", "mis", "por", "para", "un", "una", "unos",
  "unas", "del", "al", "lo", "le", "les", "es", "ha", "han", "he", "has",
  "te", "me", "nos", "no", "sin", "sobre", "como", "cuando", "donde", "si",
  "ni", "pero", "más", "cada", "muy", "ya", "también", "así", "desde", "hasta",
  "nuestro", "nuestra", "nuestros", "nuestras", "vuestro", "vuestra",
  "todo", "toda", "todos", "todas", "este", "esta", "estos", "estas",
  "ese", "esa", "esos", "esas", "otro", "otra", "otros", "otras",
]);

/** Lo que dura un silencio para que cuente como coma, y como punto. */
const PAUSA_CORTA = 0.16;
const PAUSA_LARGA = 0.34;

/**
 * Lo ancho que sale cada letra, medido de la fuente de verdad.
 *
 * Contar caracteres miente: «CONSTANTEMENTE A CUMPLIR» y «A NUESTRO PERFECTO
 * DIOS.» tienen los mismos 24 caracteres y uno ocupa cien píxeles más que el
 * otro. Con la tabla, el ancho calculado y el real se diferencian en 1 píxel.
 * La genera `scripts/video/anchos.mjs` y hay que rehacerla si cambia la fuente.
 */
import anchosSegoe from "./anchos.json" with { type: "json" };
import { readFileSync } from "node:fs";

let anchos = anchosSegoe;
let tamanoRotulo = 74;

/**
 * Cambiar la tabla de anchos cuando el proyecto usa otra fuente. La genera
 * `anchos.mjs <fuente.ttf>`; si no existe, se avisa y se mide con Segoe, que
 * es parecida en ancho a la mayoría de las sans y sirve para no salirse.
 */
export function usarAnchos(ruta, tamano) {
  try {
    anchos = JSON.parse(readFileSync(ruta, "utf8"));
  } catch {
    console.error(`No hay tabla de anchos en ${ruta}; se mide con Segoe UI Bold.`);
  }
  if (tamano) tamanoRotulo = tamano;
}

/** Ancho en píxeles de un texto al tamaño de rótulo que usa el montaje. */
export function ancho(texto, tamano = tamanoRotulo) {
  const k = tamano / anchos.tamano;
  let px = 0;
  for (const c of texto.toUpperCase()) px += anchos.anchos[c] ?? anchos.reserva;
  return px * k;
}

/**
 * Los topes duros, en píxeles del cuadro de 1080 de ancho.
 *
 * Con 60 píxeles de margen a cada lado quedan 960 útiles; 900 deja aire para
 * el borde negro y la sombra del rótulo.
 */
const MAX_LINEA = 900;
/** Hasta aquí se aguanta en una línea antes que partir mal. */
const LINEA_FORZADA = 940;
/** Dos líneas cómodas. Más que esto ya es un párrafo. */
// 1650 y no 1550: «CON TODA TU MENTE, TODO TU CORAZÓN,» mide unos 1600 px en
// dos líneas de 800, que caben de sobra; con 1550 el reparto no podía juntarlas.
const MAX_ANCHO = 1650;
const ANCHO_IDEAL = 760;
// Siete y no seis: «CON TODA TU MENTE, TODO TU CORAZÓN,» son siete palabras
// cortas que caben de sobra en dos líneas, y con seis el reparto tenía que
// soltar «CON TODA TU MENTE,» en un parpadeo de 0,39 s. El ancho en píxeles
// sigue mandando.
const MAX_PAL = 7;
// 2,3 dejaba fuera «ILIMITADO DEL ESPÍRITU SANTO.» (2,43 s) y el reparto
// soltaba un «SANTO.» de 0,39 s. Un rótulo de 2,6 s se lee sin problema.
const MAX_DUR = 2.6;

/**
 * Parejas que no se separan en dos rótulos. «AHÍ ESTÁ EL ESPÍRITU» /
 * «SANTO QUE SE MANIFESTARÁ» salía del reparto sin ninguna regla que lo
 * impidiera: un nombre propio de dos palabras es una sola palabra.
 */
const PAREJAS = [
  ["espíritu", "santo"], ["cristo", "jesús"], ["jesús", "cristo"],
  ["padre", "celestial"], ["señor", "jesús"], ["dios", "padre"],
];

const sinSignos = (p) => p.replace(/[.,;:!?…¿¡"'()«»]/g, "").toLowerCase();
const cierra = (p) => /[.,;:!?…]$/.test(p);
const esApoyo = (p) => APOYO.has(sinSignos(p));

/**
 * Parte un rótulo largo en dos líneas.
 *
 * Hace falta porque las dos reglas chocan: no cortar una frase por la mitad
 * obliga a arrastrar palabras, y arrastrar palabras produce líneas de treinta
 * caracteres que no se leen en un móvil. Con dos líneas se cumplen las dos.
 */
function partirEnDos(texto, maximo = MAX_LINEA) {
  if (ancho(texto) <= maximo) return [texto];
  const palabras = texto.split(" ");
  if (palabras.length < 2) return [texto];

  // El corte de línea sigue la misma regla que el corte de rótulo: la primera
  // línea no debe acabar en palabra de apoyo. Sin esto salían cosas como
  // «DIOS Y ES / QUE EL PADRE», que se lee peor que no partir.
  let mejor = 1;
  let peor = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const izquierda = palabras.slice(0, i).join(" ");
    const derecha = palabras.slice(i).join(" ");
    const ai = ancho(izquierda);
    const ad = ancho(derecha);
    let nota = Math.abs(ai - ad) / 20;
    if (esApoyo(palabras[i - 1])) nota += 100;
    // Una línea que se pasa del ancho tampoco vale de nada.
    // Pasarse del ancho no es «un poco peor»: el texto se sale del cuadro.
    // Con un castigo suave el reparto elegía una línea de 1006 px en un
    // cuadro de 960 porque quedaba más equilibrada. Aquí no hay equilibrio
    // que valga.
    if (ai > maximo) nota += (ai - maximo) * 3;
    if (ad > maximo) nota += (ad - maximo) * 3;
    if (nota < peor) {
      peor = nota;
      mejor = i;
    }
  }
  // Si el único sitio por donde partir deja la primera línea colgando —«A
  // NUESTRO / PERFECTO»— es mejor no partir: una línea algo larga se lee, una
  // línea que acaba en «nuestro» hace parar el ojo.
  if (peor >= 100 && ancho(texto) <= LINEA_FORZADA) return [texto];
  return [palabras.slice(0, mejor).join(" "), palabras.slice(mejor).join(" ")];
}

/**
 * @param {{t:number, fin:number, p:string}[]} palabras
 * @param {number} desfase segundos que se recortaron al principio del clip
 */
export function agrupar(palabras, desfase = 0) {
  const w = palabras.filter((x) => x.p.trim());
  const n = w.length;
  if (!n) return [];

  /** El silencio que hay justo antes de la palabra i. */
  const hueco = (i) => (i <= 0 || i >= n ? Infinity : w[i].t - w[i - 1].fin);

  /** ¿Empieza frase de verdad en la palabra i? Por punto o por respiración. */
  const frontera = (i) =>
    i <= 0 || i >= n || cierra(w[i - 1].p) || hueco(i) >= PAUSA_CORTA;

  /**
   * Lo mal que queda el rótulo que va de la palabra i a la j (j no entra).
   * Infinito = no cabe. Cuanto más bajo, mejor.
   */
  function nota(i, j) {
    const texto = w.slice(i, j).map((x) => x.p).join(" ");
    const px = ancho(texto);
    const pal = j - i;
    const dur = w[j - 1].fin - w[i].t;

    // Una palabra suelta siempre es posible: si no, una palabra larga o un
    // trozo sin huecos dejaría el reparto sin solución.
    if (pal > 1 && (px > MAX_ANCHO || pal > MAX_PAL || dur > MAX_DUR)) {
      return Infinity;
    }

    let c = Math.abs(px - ANCHO_IDEAL) / 20;

    // Las dos faltas graves: dejar la frase colgando por el final o por el
    // principio. El principio se perdona si ahí arrancaba una frase.
    if (esApoyo(w[j - 1].p)) c += 300;
    // Ni cortar entre las dos mitades de un nombre propio.
    if (j < n) {
      const a = sinSignos(w[j - 1].p), b = sinSignos(w[j].p);
      if (PAREJAS.some(([x, y]) => x === a && y === b)) c += 400;
    }
    if (esApoyo(w[i].p) && !frontera(i)) c += 90;

    // Y la tercera: tragarse una frontera. Un rótulo que lleva dentro un punto
    // o una respiración larga junta dos frases que no tienen nada que ver
    // — «DIOS / Y ES QUE EL PADRE» salía justo de aquí.
    for (let k = i + 1; k < j; k++) {
      if (cierra(w[k - 1].p)) {
        // Salvo que lo de antes de la coma dure un suspiro: «Con toda tu
        // mente, todo tu corazón,» — Whisper dio 0,3 s a «con toda tu mente»
        // y sola parpadeaba. Juntas se leen como lo que son: una lista.
        c += w[k - 1].fin - w[i].t < 0.55 ? 60 : 250;
      } else if (hueco(k) >= PAUSA_LARGA) c += 150;
    }

    // Y los dos premios: cortar donde el hablante ya cortó.
    if (cierra(w[j - 1].p)) c -= 35;
    const despues = hueco(j);
    if (despues >= PAUSA_LARGA) c -= 30;
    else if (despues >= PAUSA_CORTA) c -= 15;

    // Que dé tiempo a leerlo. Mil cien píxeles por segundo son unos veinte
    // caracteres: por encima de eso el rótulo se va antes de haberlo leído.
    // Y más caro aún si además es una sola palabra: un «SANTO.» de 0,39 s
    // suelto es un parpadeo, no un rótulo.
    // Y menos de medio segundo no se lee, tenga las palabras que tenga: el
    // castigo tiene que pesar más que el de juntar dos trozos por una coma,
    // si no el reparto prefiere un parpadeo «limpio» a un rótulo legible.
    if (dur < 0.5) c += pal === 1 ? 160 : 140;
    if (px / Math.max(dur, 0.01) > 1100) c += 40;
    // Un rótulo de una palabra corta parpadea y no dice nada.
    if (pal === 1 && px < 280 && !cierra(w[j - 1].p)) c += 50;

    // Y que quepa de verdad una vez partido: hay grupos que caben «en total»
    // y no hay forma de partirlos en dos líneas que entren en el cuadro.
    const prueba = partirEnDos(texto.toUpperCase());
    for (const linea of prueba) {
      if (ancho(linea) > MAX_LINEA) c += 200;
    }

    return c;
  }

  // El mejor reparto del texto entero, no del rótulo que toca. Se calcula de
  // atrás hacia delante: mejor[i] es lo que cuesta repartir desde la palabra i
  // hasta el final, ya contando todo lo que viene después.
  const mejor = new Array(n + 1).fill(Infinity);
  const corte = new Array(n + 1).fill(-1);
  mejor[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j <= Math.min(n, i + MAX_PAL); j++) {
      const c = nota(i, j);
      if (c === Infinity || mejor[j] === Infinity) continue;
      const total = c + mejor[j];
      if (total < mejor[i]) {
        mejor[i] = total;
        corte[i] = j;
      }
    }
  }

  const grupos = [];
  for (let i = 0; i < n; ) {
    const j = corte[i] > i ? corte[i] : i + 1;
    const texto = w.slice(i, j).map((x) => x.p).join(" ").toUpperCase();
    grupos.push({
      t: Math.max(0, w[i].t - desfase),
      fin: Math.max(0, w[j - 1].fin - desfase),
      texto,
      lineas: partirEnDos(texto),
    });
    i = j;
  }

  // Sin huecos y sin solapes: cada uno acaba donde empieza el siguiente.
  grupos.forEach((g, i) => {
    if (grupos[i + 1]) g.fin = grupos[i + 1].t - 0.01;
  });

  return grupos;
}
