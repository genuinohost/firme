/**
 * Revisa el banco de mensajes.
 *
 * Va a crecer hasta los 365, escritos a mano y en tandas, así que conviene tener
 * una red que avise de lo que se escapa al ojo: temas repetidos, versículos
 * usados dos veces, cuerpos demasiado largos o reglas de formato incumplidas.
 *
 *   node scripts/revisar-banco.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CARPETA = "src/datos/mensajes";

/** Saca los objetos del fuente sin compilar TypeScript: basta con leer campos. */
function leerTanda(ruta) {
  const texto = readFileSync(ruta, "utf8");
  const mensajes = [];
  // Cada mensaje empieza en "tema:" y acaba en "cita:".
  const bloques = texto.split(/\n\s*\{\s*\n/).slice(1);
  for (const bloque of bloques) {
    const campo = (nombre) => {
      const m = bloque.match(new RegExp(`${nombre}:\\s*\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      return m ? m[1] : null;
    };
    const tema = campo("tema");
    if (!tema) continue;
    mensajes.push({
      archivo: ruta.split(/[\\/]/).pop(),
      tema,
      titulo: campo("titulo"),
      emoji: campo("emoji"),
      cuerpo: campo("cuerpo"),
      versiculo: campo("versiculo"),
      cita: campo("cita"),
    });
  }
  return mensajes;
}

const archivos = readdirSync(CARPETA)
  .filter((f) => /^tanda\d+\.ts$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

const todos = archivos.flatMap((f) => leerTanda(join(CARPETA, f)));
const avisos = [];

const vistos = new Map();
for (const m of todos) {
  for (const [clave, valor] of [
    ["tema", m.tema],
    ["título", m.titulo],
    ["versículo", m.versiculo],
  ]) {
    if (!valor) continue;
    const id = `${clave}|${valor.toLowerCase()}`;
    if (vistos.has(id)) {
      avisos.push(`repetido (${clave}): «${valor}» en ${vistos.get(id)} y ${m.archivo}`);
    } else {
      vistos.set(id, m.archivo);
    }
  }

  const faltan = ["titulo", "emoji", "cuerpo", "versiculo", "cita"].filter((c) => !m[c]);
  if (faltan.length) avisos.push(`«${m.tema}»: le falta ${faltan.join(", ")}`);

  if (m.titulo && m.titulo !== m.titulo.toUpperCase()) {
    avisos.push(`«${m.tema}»: el título no está en mayúsculas`);
  }
  const palabras = m.cuerpo ? m.cuerpo.split(/\s+/).length : 0;
  if (palabras > 70) avisos.push(`«${m.tema}»: el cuerpo tiene ${palabras} palabras (más de 70)`);
  if (palabras > 0 && palabras < 25) {
    avisos.push(`«${m.tema}»: el cuerpo tiene solo ${palabras} palabras`);
  }
  if (m.cita && /RV|1960|1909|reina/i.test(m.cita)) {
    avisos.push(`«${m.tema}»: la cita lleva la versión, y no debe («${m.cita}»)`);
  }
  if (m.cuerpo && /\b\d{1,2}\s*(am|a\.\s*m\.|pm|p\.\s*m\.)/i.test(m.cuerpo)) {
    avisos.push(`«${m.tema}»: el cuerpo menciona una hora`);
  }
}

const meta = 365;
console.log(`Mensajes en el banco: ${todos.length} de ${meta}`);
console.log(`Tandas: ${archivos.length} (${archivos.join(", ")})`);
console.log(`Faltan: ${Math.max(0, meta - todos.length)}`);
console.log("");

if (avisos.length === 0) {
  console.log("Sin problemas.");
} else {
  console.log(`${avisos.length} aviso(s):`);
  for (const a of avisos) console.log(" - " + a);
  process.exitCode = 1;
}
