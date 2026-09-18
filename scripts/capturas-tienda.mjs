/**
 * Prepara las capturas del móvil para Google Play.
 *
 * ── Por qué hace falta ────────────────────────────────────────────────────
 *
 * Play no acepta cualquier tamaño: **el lado largo no puede pasar del doble
 * del corto**. Las capturas del móvil de Alex salen a 1220 × 2712, que es
 * 1:2,22 — se rechazan tal cual, y eso se descubre subiéndolas, que es el peor
 * momento.
 *
 * El arreglo no es estirarlas ni ponerles bordes: es **quitar lo que sobra**.
 * Arriba, la barra de estado con su reloj, su batería, sus notificaciones de
 * WhatsApp y la píldora de que está proyectando pantalla. Abajo, los botones
 * de Android. Nada de eso es la app, nada de eso vende, y además distrae — y
 * al quitarlo la proporción cae sola dentro de lo permitido.
 *
 * Se recorta por proporción y no por píxeles fijos, para que siga valiendo si
 * algún día las capturas vienen de otro teléfono con otra resolución.
 *
 *   npm run capturas
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ENTRADA = "docs/tienda/capturas";
const SALIDA = "docs/tienda/capturas/listas";

/** Cuánto ocupa la barra de estado, en tanto por uno de la altura. */
const BARRA_ARRIBA = 0.048;
/** Y los botones de navegación de Android, abajo. */
const BARRA_ABAJO = 0.052;

/** Lo que exige Play: el lado largo, como mucho el doble del corto. */
const PROPORCION_MAXIMA = 2;
const MINIMO = 320;
const MAXIMO = 3840;

mkdirSync(SALIDA, { recursive: true });

const archivos = readdirSync(ENTRADA).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

if (archivos.length === 0) {
  console.error(`No hay capturas en ${ENTRADA}.`);
  process.exit(1);
}

console.log(`\nPreparando ${archivos.length} capturas para Play…\n`);

let problemas = 0;

for (const archivo of archivos) {
  const origen = join(ENTRADA, archivo);
  const imagen = sharp(origen);
  const { width, height } = await imagen.metadata();

  let arriba = Math.round(height * BARRA_ARRIBA);
  let abajo = Math.round(height * BARRA_ABAJO);
  let alto = height - arriba - abajo;

  // Si con eso todavía no cabe en la proporción, se recorta más por abajo:
  // lo de abajo es la barra de pestañas, que se repite en todas y se entiende
  // igual; lo de arriba es el titular de cada pantalla y ahí está lo que vende.
  const altoMaximo = Math.floor(width * PROPORCION_MAXIMA);
  if (alto > altoMaximo) {
    abajo += alto - altoMaximo;
    alto = altoMaximo;
  }

  const salida = join(SALIDA, archivo.replace(/\.jpe?g$/i, ".png"));

  await imagen
    .extract({ left: 0, top: arriba, width, height: alto })
    // 24 bits sin canal alfa, que es lo que pide Play.
    .flatten({ background: "#0b0d10" })
    .png({ compressionLevel: 9 })
    .toFile(salida);

  const proporcion = alto / width;
  const bien =
    proporcion <= PROPORCION_MAXIMA &&
    width >= MINIMO &&
    alto >= MINIMO &&
    width <= MAXIMO &&
    alto <= MAXIMO;

  if (!bien) problemas++;

  console.log(
    `  ${bien ? "✓" : "✕"} ${archivo.padEnd(30)} ${width}×${alto}  ` +
      `(1:${proporcion.toFixed(2)})  −${arriba} arriba, −${abajo} abajo`,
  );
}

console.log(`\n  ${SALIDA}`);
console.log(
  problemas === 0
    ? "  Todas dentro de lo que pide Play.\n"
    : `  ⚠ ${problemas} siguen fuera de medida.\n`,
);
process.exit(problemas === 0 ? 0 : 1);
