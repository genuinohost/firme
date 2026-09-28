/**
 * Que la lista del grupo no se cuele en el repositorio, que es público.
 *
 *   npm run revisar-nombres     (antes de cada commit que toque devocionales)
 *
 * La revisión de la 6.24 encontró los 26 nombres del grupo, varios con
 * apellido, en unas pruebas a punto de subirse a github.com/genuinohost/firme.
 * Esto lo busca en lo que se va a subir —las líneas nuevas respecto a HEAD y
 * los archivos que Git aún no conoce—, con los nombres de la lista que sólo
 * existe en este ordenador (`privado/devocionales/orden-de-lectura.json`).
 *
 * Falla si aparece un nombre con apellido, o tres nombres distintos de la lista
 * en el mismo archivo: eso ya es la lista. Un nombre suelto sólo se avisa: en
 * la bitácora se nombra a veces a quien probó algo, y eso ya estaba publicado.
 *
 * Sin la lista (otro ordenador) no comprueba nada y lo dice.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const LISTA = "privado/devocionales/orden-de-lectura.json";
if (!existsSync(LISTA)) {
  console.log("Sin la lista del grupo en este ordenador: no hay nada con qué comparar.");
  process.exit(0);
}

const limpio = (w) => w.normalize("NFC").replace(/[^\p{L}]/gu, "");
const datos = JSON.parse(readFileSync(LISTA, "utf8"));
const completos = new Set();
const sueltos = new Set();
// Palabras de la lista que también son palabras corrientes o del libro.
const CORRIENTES = new Set(["alex", "señor", "dios", "jesús", "hermano", "hermana", "hoy", "coral", "pedro", "juan", "pablo"]);
for (const o of datos.ordenes ?? []) {
  for (const p of o.lista ?? []) {
    const nombre = String(p.nombre ?? p)
      .split(/\s+/)
      .map(limpio)
      .filter((w) => w.length >= 3);
    if (nombre.length >= 2) completos.add(nombre.join(" "));
    for (const w of nombre) if (w.length >= 4 && !CORRIENTES.has(w.toLowerCase())) sueltos.add(w);
  }
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// Lo que se va a subir: líneas añadidas respecto a HEAD, por archivo…
const nuevo = new Map();
let archivo = "";
for (const l of git("diff", "HEAD", "--unified=0", "--no-color").split("\n")) {
  if (l.startsWith("+++ ")) archivo = l.slice(6);
  else if (l.startsWith("+") && archivo) nuevo.set(archivo, (nuevo.get(archivo) ?? "") + l.slice(1) + "\n");
}
// …y los archivos que Git todavía no conoce, enteros.
for (const f of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) {
  if (/\.(png|jpe?g|webp|mp4|mp3|apk|aab|jks|zip)$/i.test(f)) continue;
  try {
    nuevo.set(f, readFileSync(f, "utf8"));
  } catch {
    // Un archivo que no se deja leer no puede llevar la lista.
  }
}

let fallos = 0;
let avisos = 0;
for (const [f, texto] of nuevo) {
  if (f.startsWith("privado/")) continue;
  const palabras = texto.split(/\s+/).map(limpio).filter(Boolean);
  const unido = ` ${palabras.join(" ")} `;
  const conApellido = [...completos].filter((n) => unido.includes(` ${n} `));
  const encontrados = [...new Set(palabras.filter((w) => sueltos.has(w)))];
  if (conApellido.length || encontrados.length >= 3) {
    fallos++;
    console.log(`FALLA  ${f}: ${[...conApellido, ...encontrados].slice(0, 8).join(", ")}${encontrados.length > 8 ? "…" : ""}`);
  } else if (encontrados.length) {
    avisos++;
    console.log(`aviso  ${f}: ${encontrados.join(", ")} (un nombre suelto; mira si hace falta)`);
  }
}

console.log(
  fallos
    ? `\n${fallos} archivo(s) llevan nombres del grupo. El repositorio es público: quítalos antes del commit.\n`
    : `\nNingún nombre del grupo en lo que se va a subir${avisos ? ` (${avisos} aviso)` : ""}.\n`,
);
process.exit(fallos ? 1 : 0);
