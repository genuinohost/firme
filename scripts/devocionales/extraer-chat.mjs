/**
 * Saca del chat de WhatsApp exportado el archivo de devocionales del año.
 *
 *   npx vite-node scripts/devocionales/extraer-chat.mjs "<carpeta o .txt del chat>"
 *
 * ── Qué hace ──────────────────────────────────────────────────────────────
 *
 * Alex, 28-09-2026: «ya exporté todo lo que es este grupo… quiero que tengas
 * un archivo porque eso se usará cada año con muchos grupos de devocionales».
 *
 * Lee el .txt de la exportación, lo parte en mensajes y se queda **sólo con
 * los de Alex** que son parte del devocional:
 *
 *   - el devocional del día («CAMINEMOS CON LA PALABRA: DÍA N DE 365» hasta el
 *     21 de enero, «LEYENDO TODA LA BIBLIA EN UN AÑO: DÍA N DE 365» después),
 *   - «lo que aprendí hoy» (bloque 3),
 *   - la «ALERTA DÍA N» de la víspera (bloque 4),
 *
 * y, del grupo, el ORDEN DE LECTURA y a quién le tocó el comentario cada día
 * (los manda Alex o una auxiliar), que es la dinámica que la app tiene que
 * repetir.
 *
 * Si un día se mandó dos veces (una corrección), vale el ÚLTIMO.
 *
 * ── Adónde va, y por qué NO al repositorio ─────────────────────────────────
 *
 * A `privado/devocionales/`, que Git ignora. El repositorio es público y esto
 * lleva el texto bíblico completo de cada día (RVR1960, que tiene derechos) y
 * los nombres de los hermanos. Nada de los mensajes de los demás miembros sale
 * de aquí salvo sus nombres en la lista de lectura, que es lo que la app
 * necesita para los turnos.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// El troceador es el mismo que usa la app al pegar un devocional: si partieran
// distinto, el mismo día se leería de dos maneras.
import { RE_ALERTA, RE_DIA, partirDevocional } from "../../src/logica/partirDevocional.ts";

const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: npx vite-node scripts/devocionales/extraer-chat.mjs "<carpeta o .txt del chat>"');
  process.exit(1);
}
const archivo = statSync(entrada).isDirectory()
  ? join(entrada, readdirSync(entrada).find((f) => f.endsWith(".txt")))
  : entrada;

const SALIDA = "privado/devocionales";
const AUTOR = "Alex";

// ── 1. El chat, en mensajes ────────────────────────────────────────────────
//
// «28/9/2026, 4:53 a. m. - Alex: texto». Las líneas que no empiezan así son
// continuación del mensaje anterior. WhatsApp mete a veces un carácter
// invisible (U+200E) delante; se quita.
const CABECERA = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})\s*([ap])\.\s*m\.\s*-\s*(.*)$/;

const lineas = readFileSync(archivo, "utf8").split(/\r?\n/);
const mensajes = [];
for (const crudo of lineas) {
  const linea = crudo.replace(/‎/g, "");
  const m = CABECERA.exec(linea);
  if (m) {
    const [, d, mes, a, h, min, ap, resto] = m;
    let hora = Number(h) % 12;
    if (ap === "p") hora += 12;
    const dosPuntos = resto.indexOf(": ");
    const autor = dosPuntos > 0 ? resto.slice(0, dosPuntos) : null;
    const texto = dosPuntos > 0 ? resto.slice(dosPuntos + 2) : resto;
    mensajes.push({
      fecha: `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      hora: `${String(hora).padStart(2, "0")}:${min}`,
      autor,
      lineas: [texto],
    });
  } else if (mensajes.length) {
    mensajes[mensajes.length - 1].lineas.push(linea);
  }
}
for (const m of mensajes) {
  m.texto = m.lineas.join("\n").replace(/<Se editó este mensaje\.>/g, "").trim();
  delete m.lineas;
}

// ── 2. Lo que es devocional ────────────────────────────────────────────────

/** Quita los asteriscos del formato de WhatsApp y los espacios de más. */
const limpio = (t) => t.replace(/\*/g, "").replace(/[ \t]+\n/g, "\n").trim();

const RE_APRENDI = /lo que aprend[ií] hoy/i;
const RE_ORDEN = /ORDEN DE LECTURA/i;
const RE_COMENTARIO = /(hoy|mañana)\s+contin[uú]a[n]?\s+(?:el|los)\s+comentarios?\s+de\s*:?/i;
/** Los números de la lista vienen en emojis: 1️⃣1️⃣ es el once. */
const CIFRAS = { "0️⃣": 0, "1️⃣": 1, "2️⃣": 2, "3️⃣": 3, "4️⃣": 4, "5️⃣": 5, "6️⃣": 6, "7️⃣": 7, "8️⃣": 8, "9️⃣": 9 };

const dias = new Map(); // número → { devocional, aprendi, alerta, fecha }
const ordenes = []; // { fecha, lista: [{ n, nombre, estado }] }
const comentarios = []; // { fecha, cuando: "hoy"|"mañana", nombre }

for (const m of mensajes) {
  const cabeza = m.texto.slice(0, 400);

  // El orden de lectura y el comentario lo manda Alex o una auxiliar.
  if (RE_ORDEN.test(m.texto)) {
    const lista = leerLista(m.texto.slice(m.texto.search(RE_ORDEN)));
    if (lista.length >= 3) ordenes.push({ fecha: m.fecha, lista });
  }
  const c = RE_COMENTARIO.exec(m.texto);
  if (c) {
    // «🍥 *hoy continúa el comentario de:*\n1️⃣ Nombre»: lo que queda en la
    // línea del encabezado es el asterisco de cierre; el nombre va debajo.
    const tras = m.texto
      .slice(c.index + c[0].length)
      .split("\n")
      .map((l) => quitarNumero(l).replace(/[*_~]/g, "").trim())
      .find((l) => /\p{L}/u.test(l));
    if (tras) comentarios.push({ fecha: m.fecha, cuando: c[1].toLowerCase(), nombre: tras });
  }

  const d = RE_DIA.exec(cabeza);
  if (d && cabeza.search(RE_DIA) < 120) {
    const n = Number(d[1]);
    // De Alex, el último que mandó ese día (las correcciones van después).
    // De otro sólo si Alex no lo mandó y es el devocional entero: el 29 de
    // mayo lo mandó otra hermana; y varias copian el encabezado para su
    // propia reflexión, que no es el devocional.
    if (m.autor !== AUTOR && !(versiculos(m.texto) >= 10 && !dias.get(n)?.deAlex)) continue;
    const dia = dias.get(n) ?? { dia: n };
    dia.fecha = m.fecha;
    dia.enviado = `${m.fecha} ${m.hora}`;
    dia.devocional = limpio(m.texto);
    dia.deAlex = m.autor === AUTOR;
    dias.set(n, dia);
    continue;
  }

  if (m.autor !== AUTOR) continue;

  const a = RE_ALERTA.exec(cabeza);
  if (a) {
    const n = Number(a[1]);
    const dia = dias.get(n) ?? { dia: n };
    const texto = limpio(m.texto.slice(m.texto.search(/🔥|ALERTA/)));
    // El 12-09-2026 el devocional entero salió con el encabezado de la
    // alerta. Si una «alerta» trae los pasajes, es el devocional del día.
    if (versiculos(m.texto) >= 10 && !dia.devocional) {
      dia.fecha = m.fecha;
      dia.enviado = `${m.fecha} ${m.hora}`;
      dia.devocional = texto;
      dia.deAlex = true;
    } else {
      dia.alerta = texto;
    }
    dias.set(n, dia);
    continue;
  }
  if (RE_APRENDI.test(cabeza)) {
    // «Lo que aprendí hoy» no lleva número: es del devocional de ese día.
    const n = ultimoDiaDe(m.fecha);
    if (n != null) {
      const dia = dias.get(n);
      dia.aprendi = limpio(m.texto.slice(m.texto.search(RE_APRENDI)));
    }
  }
}

/** Cuántas líneas parecen versículos («12 Y dijo…»). */
function versiculos(texto) {
  return texto.split("\n").filter((l) => /^\s*\d{1,3}\s+\S/.test(l)).length;
}

function ultimoDiaDe(fecha) {
  let mejor = null;
  for (const [n, d] of dias) if (d.fecha === fecha && (mejor == null || n > mejor)) mejor = n;
  return mejor;
}

/** «1️⃣1️⃣ Nombre Apellido 🟢» → { n: 11, nombre, estado }. */
function leerLista(texto) {
  const lista = [];
  for (const linea of texto.split("\n").slice(1)) {
    const numero = numeroDe(linea);
    if (numero == null) continue;
    const resto = quitarNumero(linea);
    if (!resto) continue;
    const estado = /👂/.test(resto) ? "escucha" : /🟢/.test(resto) ? "lee" : /🔴|⚪|❌/.test(resto) ? "no" : "lee";
    const nombre = resto.replace(/[🟢👂🏻🏼🏽🏾🏿🔴⚪❌]/gu, "").trim();
    if (nombre) lista.push({ n: numero, nombre, estado });
  }
  return lista;
}

function numeroDe(linea) {
  const l = linea.trim();
  if (l.startsWith("🔟")) return 10;
  let s = "";
  let resto = l;
  for (;;) {
    const k = Object.keys(CIFRAS).find((c) => resto.startsWith(c));
    if (!k) break;
    s += CIFRAS[k];
    resto = resto.slice(k.length);
  }
  if (s) return Number(s);
  const m = /^(\d{1,2})[).\-\s]/.exec(l);
  return m ? Number(m[1]) : null;
}
function quitarNumero(linea) {
  let l = linea.trim();
  if (l.startsWith("🔟")) return l.slice(2).trim();
  for (;;) {
    const k = Object.keys(CIFRAS).find((c) => l.startsWith(c));
    if (!k) break;
    l = l.slice(k.length);
  }
  return l.replace(/^\d{1,2}[).\-]\s*/, "").trim();
}

// ── 3. Cada devocional, en partes que se leen por turnos ───────────────────
//
// «Cada quien va a leer un párrafo… uno lee Gálatas 6:6-10, después viene
// otro y lee Gálatas 6:11-15… otro lee el punto número 1 de la reflexión».
// Así que el devocional se guarda ya partido en esos trozos, en orden.

// ── 4. Escribir ────────────────────────────────────────────────────────────

mkdirSync(SALIDA, { recursive: true });
const ordenados = [...dias.values()].filter((d) => d.devocional).sort((a, b) => a.dia - b.dia);
const indice = [];
let sinPasajes = 0;
let sinReflexion = 0;
for (const d of ordenados) {
  const { tema, capitulos, trozos } = partirDevocional(d.devocional);
  const pasajes = trozos.filter((t) => t.tipo === "pasaje").length;
  const puntos = trozos.filter((t) => t.tipo === "reflexion").length;
  if (!pasajes) sinPasajes++;
  if (!puntos) sinReflexion++;
  const salida = { ...d, tema, capitulos, trozos };
  writeFileSync(join(SALIDA, `dia-${String(d.dia).padStart(3, "0")}.json`), JSON.stringify(salida, null, 1));
  indice.push({ dia: d.dia, fecha: d.fecha, tema, capitulos, pasajes, puntos, trozos: trozos.length, aprendi: !!d.aprendi, alerta: !!d.alerta });
}
writeFileSync(join(SALIDA, "indice.json"), JSON.stringify(indice, null, 1));
writeFileSync(join(SALIDA, "orden-de-lectura.json"), JSON.stringify({ ordenes, comentarios }, null, 1));

// ── 5. El parte, para ver de un vistazo si salió bien ──────────────────────
const numeros = ordenados.map((d) => d.dia);
const faltan = [];
for (let n = 1; n <= Math.max(...numeros); n++) if (!numeros.includes(n)) faltan.push(n);
console.log(`Mensajes leídos: ${mensajes.length}`);
console.log(`Devocionales: ${ordenados.length} (del día ${numeros[0]} al ${numeros.at(-1)})`);
console.log(`Faltan: ${faltan.length ? faltan.join(", ") : "ninguno"}`);
console.log(`Con «lo que aprendí hoy»: ${ordenados.filter((d) => d.aprendi).length}`);
console.log(`Con alerta: ${ordenados.filter((d) => d.alerta).length}`);
console.log(`Sin pasajes partidos: ${sinPasajes} · sin reflexión partida: ${sinReflexion}`);
console.log(`Órdenes de lectura: ${ordenes.length} · comentarios apuntados: ${comentarios.length}`);
console.log(`Escrito en ${SALIDA}/ (ignorado por Git)`);
