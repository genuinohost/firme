/**
 * Prepara la publicación de una versión.
 *
 * Lee la versión de `build.gradle` —que es la única fuente de verdad— y con ella
 * escribe `.env.local`, para que la app sepa qué versión es, y `public/version.json`,
 * que es lo que consultan los móviles ya instalados.
 *
 * Así no hay dos números que se puedan desincronizar: se sube la versión en un
 * solo sitio y el resto se genera.
 *
 *   node scripts/publicar-version.mjs "Novedad una" "Novedad dos"
 */
import { readFileSync, writeFileSync } from "node:fs";

const GRADLE = "android/app/build.gradle";
const gradle = readFileSync(GRADLE, "utf8");

const codigo = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
const nombre = gradle.match(/versionName\s+"([^"]+)"/)?.[1];

if (!codigo || !nombre) {
  console.error("No se pudo leer la versión de " + GRADLE);
  process.exit(1);
}

const novedades = process.argv.slice(2);

// Lo que la app lleva dentro: sirve para compararse con lo publicado.
writeFileSync(
  ".env.local",
  `# Generado por scripts/publicar-version.mjs. No editar a mano.\n` +
    `VITE_VERSION_CODIGO=${codigo}\n` +
    `VITE_VERSION_NOMBRE=${nombre}\n`,
);

// Lo que consultan los móviles ya instalados.
const publicada = {
  _lee_esto:
    "Lo generan los scripts; no se edita a mano. Cuando la app esté en Google Play, " +
    "cambiar 'enlace' por la ficha de Play y las actualizaciones serán automáticas.",
  codigo,
  nombre,
  enlace: "https://genuino-pro.web.app/Firme.apk",
  novedades,
  importante: false,
};

writeFileSync("public/version.json", JSON.stringify(publicada, null, 2) + "\n");

console.log(`Versión ${nombre} (código ${codigo})`);
console.log(`  .env.local y public/version.json actualizados`);
if (novedades.length === 0) {
  console.log("  ⚠️  sin novedades: pásalas como argumentos para que se vean en el aviso");
} else {
  for (const n of novedades) console.log("  · " + n);
}
