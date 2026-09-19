/**
 * Rehace la tabla de anchos de letra que usan los rótulos.
 *
 * Sólo hay que ejecutarlo si cambia la fuente o el tamaño base. Necesita
 * Python con Pillow, que es lo único por aquí que sabe leer un .ttf.
 *
 *     node scripts/video/anchos.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FUENTE = "C:/Windows/Fonts/segoeuib.ttf";
const TAMANO = 100;
const LETRAS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ0123456789 .,;:!?¡¿…'\"()-–—«»/%&+";

const guion = `
import json, sys
from PIL import ImageFont
f = ImageFont.truetype(${JSON.stringify(FUENTE)}, ${TAMANO})
letras = json.loads(sys.argv[1])
print(json.dumps({
  "tamano": ${TAMANO},
  "reserva": round(f.getlength("M"), 2),
  "anchos": {c: round(f.getlength(c), 2) for c in letras},
}, ensure_ascii=False, indent=1))
`;

const salida = execFileSync("python", ["-c", guion, JSON.stringify(LETRAS)], {
  encoding: "utf8",
});

const aqui = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(aqui, "anchos.json"), salida, "utf8");
console.log(`tabla rehecha · ${LETRAS.length} letras`);
