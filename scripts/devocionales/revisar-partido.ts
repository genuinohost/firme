/**
 * Que el troceador siga partiendo el archivo del año exactamente igual.
 *
 *   npm run revisar-partido
 *
 * `partirDevocional` lo usan la app (al pegar un día) y el extractor del chat.
 * Cualquier arreglo para lo que se pega —asteriscos, emojis, bloques pegados
 * juntos— puede cambiar sin querer cómo se parte un día viejo, y entonces la
 * sala repartiría turnos distintos de los del archivo. Esto lo vigila: vuelve
 * a partir cada día guardado y lo compara con lo que se subió.
 *
 * El archivo vive en `privado/` (lleva la Biblia con derechos y no va al
 * repositorio). En un ordenador sin él, no comprueba nada y lo dice.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { partirDevocional } from "../../src/logica/partirDevocional";

const CARPETA = "privado/devocionales";
if (!existsSync(CARPETA)) {
  console.log("Sin el archivo de devocionales en este ordenador: nada que comparar.");
  process.exit(0);
}

let iguales = 0;
const distintos: string[] = [];
for (const f of readdirSync(CARPETA).filter((x) => /^dia-\d{3}\.json$/.test(x)).sort()) {
  const d = JSON.parse(readFileSync(join(CARPETA, f), "utf8"));
  const p = partirDevocional(d.devocional);
  const antes = JSON.stringify({ tema: d.tema, capitulos: d.capitulos, trozos: d.trozos });
  const ahora = JSON.stringify({ tema: p.tema, capitulos: p.capitulos, trozos: p.trozos });
  if (antes === ahora) iguales++;
  else distintos.push(`${f}: ${p.trozos.length} trozos ahora, ${d.trozos.length} en el archivo`);
}

for (const x of distintos.slice(0, 15)) console.log("FALLA ", x);
console.log(
  distintos.length
    ? `\n${distintos.length} días se parten distinto que en el archivo (${iguales} iguales).\n`
    : `\n${iguales} días se parten igual que en el archivo.\n`,
);
process.exit(distintos.length ? 1 : 0);
