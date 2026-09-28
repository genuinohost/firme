/**
 * Que el archivo de devocionales sacado del chat esté entero y bien partido.
 *
 *   node scripts/devocionales/revisar-archivo.mjs
 *
 * Lee `privado/devocionales/` (lo que deja extraer-chat.mjs) y mira, día a
 * día, lo que la app necesita para los turnos de lectura:
 *
 *   - que cada pasaje traiga sus versículos y en orden, sin huecos entre un
 *     trozo y el siguiente del mismo capítulo (un hueco es un trozo que nadie
 *     leería);
 *   - que ningún versículo se haya quedado pegado a la reflexión o la oración;
 *   - que estén la reflexión, las preguntas, la oración y el recordatorio.
 *
 * No toca nada: sólo dice qué días hay que mirar a mano.
 */
import { readdirSync, readFileSync } from "node:fs";

const DIR = "privado/devocionales";
const dias = readdirSync(DIR)
  .filter((f) => /^dia-\d{3}\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")))
  .sort((a, b) => a.dia - b.dia);

const avisos = [];
const aviso = (dia, que) => avisos.push({ dia, que });
let versiculosTotales = 0;

for (const d of dias) {
  const t = d.trozos;
  const pasajes = t.filter((x) => x.tipo === "pasaje");
  const puntos = t.filter((x) => x.tipo === "reflexion").length;
  const preguntas = t.filter((x) => x.tipo === "preguntas").length;
  const tiene = (tipo) => t.some((x) => x.tipo === tipo);

  if (d.dia > 4 && !pasajes.length) aviso(d.dia, "sin pasajes");
  if (puntos < 8 || puntos > 13) aviso(d.dia, `reflexión con ${puntos} puntos`);
  if (preguntas && preguntas !== 3) aviso(d.dia, `${preguntas} preguntas`);
  if (!tiene("oracion")) aviso(d.dia, "sin oración");
  if (!tiene("recordatorio")) aviso(d.dia, "sin recordatorio");
  if (!d.tema) aviso(d.dia, "sin tema");

  // Versículos en orden dentro de cada pasaje, y seguidos entre pasajes del
  // mismo capítulo.
  let previo = null; // { cap: "Isaías 13", hasta }
  for (const p of pasajes) {
    const m = /^(.*\s\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(p.ref);
    if (!m) {
      aviso(d.dia, `referencia rara: «${p.ref}»`);
      continue;
    }
    const [, cap, desde, hasta = desde] = m;
    const numeros = p.texto
      .split("\n")
      .map((l) => /^\s*(\d{1,3})\s+\S/.exec(l)?.[1])
      .filter(Boolean)
      .map(Number);
    versiculosTotales += numeros.length;
    if (!numeros.length) aviso(d.dia, `${p.ref} sin versículos`);
    else {
      if (numeros[0] !== Number(desde)) aviso(d.dia, `${p.ref} empieza en el ${numeros[0]}`);
      if (numeros.at(-1) !== Number(hasta)) aviso(d.dia, `${p.ref} acaba en el ${numeros.at(-1)}`);
      for (let i = 1; i < numeros.length; i++) {
        if (numeros[i] !== numeros[i - 1] + 1) {
          aviso(d.dia, `${p.ref} salta del ${numeros[i - 1]} al ${numeros[i]}`);
          break;
        }
      }
    }
    if (previo && previo.cap === cap && Number(desde) !== previo.hasta + 1) {
      aviso(d.dia, `hueco en ${cap}: del ${previo.hasta} al ${desde}`);
    }
    previo = { cap, hasta: Number(hasta) };
  }

  // Un versículo colado en la reflexión o la oración.
  for (const x of t.filter((x) => x.tipo !== "pasaje" && x.tipo !== "clave")) {
    const colados = x.texto.split("\n").filter((l) => /^\s*\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/.test(l) && !/^\s*\d{1,2}[.)]/.test(l));
    if (colados.length >= 2) aviso(d.dia, `${colados.length} líneas con pinta de versículo en «${x.ref}»`);
  }
}

console.log(`Días: ${dias.length} · versículos: ${versiculosTotales}`);
const porDia = new Map();
for (const a of avisos) porDia.set(a.dia, [...(porDia.get(a.dia) ?? []), a.que]);
console.log(`Días con algo que mirar: ${porDia.size}`);
for (const [dia, ques] of porDia) console.log(`  ${String(dia).padStart(3)}: ${ques.join(" · ")}`);
process.exit(0);
