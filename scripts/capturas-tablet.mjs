/**
 * Las capturas de tablet que Play exige.
 *
 * ── Por qué hacen falta ───────────────────────────────────────────────────
 *
 * Google pide capturas para tablets de 7" y de 10" **como campos
 * obligatorios** en cuanto la app se distribuye a tablets, y con una
 * proporción distinta a las del teléfono: 16:9 o 9:16. Las nuestras son
 * 1220×2440, es decir 1:2, y por eso la ficha no dejaba guardar.
 *
 * ── Por qué se rellena con el fondo y no se estira ────────────────────────
 *
 * Estirar una captura de teléfono hasta que cuadre enseñaría una app
 * deformada que no existe. Recortarla se comería contenido.
 *
 * Lo que se hace es **añadir fondo a los lados**, y no es un truco: la app
 * tiene el contenido centrado con un ancho máximo, así que en una tablet se ve
 * exactamente así — la interfaz en el centro y el fondo a los lados. La
 * captura resultante es lo que de verdad ve alguien con una tablet.
 *
 *   node scripts/capturas-tablet.mjs
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// El mismo fondo de la app, para que el añadido no se note como un borde.
const FONDO = { r: 0x0b, g: 0x0d, b: 0x10, alpha: 1 };

const ORIGEN = "docs/tienda/capturas/listas";
const DESTINO = "docs/tienda/capturas/tablet";

/**
 * 9:16 **exacto**, y por eso las medidas van escritas y no calculadas.
 *
 * Calcular el ancho a partir del alto parecía más limpio y salía torcido: con
 * 2440 de alto, 2440×9/16 = 1372,5, y al redondear a 1373 la proporción queda
 * en 0,5627 en vez de 0,5625. Play compara eso y lo rechaza. Aquí el ancho es
 * múltiplo de 9 y el alto el múltiplo de 16 que le toca, así que no hay coma
 * que redondear.
 */
const MEDIDAS = [
  // El teléfono también, aunque parezca que no hace falta.
  //
  // Las capturas originales son 1220×2440, o sea **1:2**, y Play las mandaba a
  // «necesita recorte» en vez de aceptarlas: el hueco de teléfono pide 9:16
  // igual que los de tablet. Se veían bien en la biblioteca y no se podían
  // usar, que es la peor manera de fallar.
  { nombre: "tel", ancho: 1440, alto: 2560 },
  { nombre: "7", ancho: 1368, alto: 2432 },
  // La de 10" va más grande para que no se vea blanda en una pantalla que es
  // físicamente mayor.
  { nombre: "10", ancho: 1620, alto: 2880 },
];

if (!existsSync(ORIGEN)) {
  console.error("No están las capturas de teléfono en " + ORIGEN);
  process.exit(1);
}

mkdirSync(DESTINO, { recursive: true });

const archivos = readdirSync(ORIGEN).filter((a) => a.endsWith(".png")).sort();
console.log(`\n${archivos.length} capturas de teléfono → tablet\n`);

for (const { nombre, ancho, alto } of MEDIDAS) {
  console.log(`  tablet de ${nombre}" · ${ancho}×${alto}`);

  for (const archivo of archivos) {
    const salida = join(DESTINO, `${nombre}-${archivo}`);

    // `contain` hace las dos cosas de una vez: encaja la imagen dentro del
    // lienzo sin deformarla y rellena lo que sobra con el fondo.
    //
    // Antes esto iba a mano, encajando por el alto y añadiendo a los lados, y
    // **se rompía con la captura de la alarma**, que es apaisada: encajada por
    // el alto salía más ancha que el lienzo y no había nada que rellenar. Una
    // sola de las catorce estaba mal, y era justo la que más importa — la que
    // le demuestra al revisor que esto es un despertador.
    await sharp(join(ORIGEN, archivo))
      .resize(ancho, alto, { fit: "contain", background: FONDO })
      .png()
      .toFile(salida);

    const m = await sharp(salida).metadata();
    const proporcion = (m.width / m.height).toFixed(4);
    const bien = proporcion === (9 / 16).toFixed(4);
    console.log(`    ${bien ? "ok  " : "MAL "} ${salida}  ${m.width}×${m.height}`);
    if (!bien) process.exitCode = 1;
  }
}

console.log(`\nListas en ${DESTINO}\n`);
