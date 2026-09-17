/**
 * Publica una versión: sube el APK a GitHub Releases y avisa a los móviles.
 *
 * Firebase Hosting en su plan gratuito prohíbe los archivos ejecutables, así que
 * el APK vive en GitHub Releases —gratis, sin límite y sin caducidad— y en
 * Firebase queda solo `version.json`, que es lo que consultan los móviles ya
 * instalados para saber si hay algo nuevo.
 *
 *   node scripts/publicar-release.mjs "Novedad una" "Novedad dos"
 *
 * Antes hay que tener el APK de release compilado y `gh` con la sesión iniciada.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APK = "android/app/build/outputs/apk/release/app-release.apk";
const GRADLE = "android/app/build.gradle";
const GH = "C:\\Program Files\\GitHub CLI\\gh.exe";

function gh(...args) {
  return execFileSync(existsSync(GH) ? GH : "gh", args, { encoding: "utf8" }).trim();
}

if (!existsSync(APK)) {
  console.error("No hay APK compilado. Ejecuta antes:");
  console.error("  cd android && ./gradlew assembleRelease");
  process.exit(1);
}

const gradle = readFileSync(GRADLE, "utf8");
const codigo = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
const nombre = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const etiqueta = `v${nombre}`;
const novedades = process.argv.slice(2);

// El repositorio se saca de git, para no tenerlo escrito en dos sitios.
/**
 * Que la web compilada lleve la misma versión que el APK.
 *
 * El 17-09-2026 se publicó una 4.7 que por dentro era la 4.6: `cap sync` copia
 * lo que haya en `dist`, y `dist` se había compilado antes de subir el número.
 * El manifiesto decía 29 y el JavaScript 28, así que la app pedía actualizarse
 * **para siempre** y al instalar no se callaba.
 *
 * Esto se comprueba aquí y no solo al compilar, porque publicar es el último
 * punto donde el fallo todavía es barato: una vez subido, ya está en los
 * teléfonos.
 */
function laWebCuadra() {
  const carpeta = "dist/assets";
  if (!existsSync(carpeta)) return false;
  let bien = false;
  for (const archivo of readdirSync(carpeta)) {
    if (!archivo.endsWith(".js")) continue;
    if (readFileSync(join(carpeta, archivo), "utf8").includes(`"${nombre}"`)) bien = true;
  }
  return bien;
}

if (!laWebCuadra()) {
  console.error(`La web de ${"dist"} no lleva la versión ${nombre}.`);
  console.error("El APK saldría con un número en el manifiesto y otro por dentro,");
  console.error("y la app pediría actualizarse para siempre. Compila con:");
  console.error("  npm run apk");
  process.exit(1);
}

const remoto = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const repo = remoto.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, "");

console.log(`Publicando ${etiqueta} en ${repo}…`);

// Un nombre con la versión: así el que lo descarga sabe qué tiene.
const nombreArchivo = `Genuino-${nombre}.apk`;
// Con copyFileSync y no con `cp`: `cp` solo existe si esto se lanza desde
// Git Bash, y desde PowerShell el script se caia con un ENOENT confuso.
copyFileSync(APK, nombreArchivo);

const cuerpo =
  novedades.length > 0
    ? novedades.map((n) => `- ${n}`).join("\n")
    : "Mejoras y correcciones.";

try {
  gh(
    "release", "create", etiqueta,
    `${nombreArchivo}#Genuino ${nombre} para Android`,
    "--repo", repo,
    "--title", `Genuino ${nombre}`,
    "--notes", cuerpo,
  );
  console.log(`  Release ${etiqueta} creada.`);
} catch {
  // Si ya existía, se reemplaza el archivo en vez de fallar.
  gh("release", "upload", etiqueta, nombreArchivo, "--repo", repo, "--clobber");
  console.log(`  Release ${etiqueta} ya existía; archivo actualizado.`);
}

// El enlace estable a la última versión, que es al que apunta la app.
const enlace = `https://github.com/${repo}/releases/latest/download/${nombreArchivo}`;

writeFileSync(
  "public/version.json",
  JSON.stringify(
    {
      _lee_esto:
        "Lo genera scripts/publicar-release.mjs; no se edita a mano. Cuando la app esté " +
        "en Google Play, cambiar 'enlace' por la ficha de Play.",
      codigo,
      nombre,
      enlace,
      novedades,
      importante: false,
    },
    null,
    2,
  ) + "\n",
);

rmSync(nombreArchivo, { force: true });

console.log(`  version.json apunta a ${enlace}`);
console.log("");
console.log("Falta publicar la web para que los móviles se enteren:");
console.log("  npm run desplegar");
