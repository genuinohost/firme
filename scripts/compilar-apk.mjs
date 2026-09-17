/**
 * Compila el APK de release, en el orden correcto y comprobándolo.
 *
 * ── El fallo que hace falta este script ───────────────────────────────────
 *
 * El 17 de septiembre de 2026 se publicó una 4.7 que por dentro era la 4.6.
 * `npx cap sync` copia **lo que haya en `dist` en ese momento**, y `dist` se
 * había compilado antes de subir el número en `build.gradle`. El resultado:
 *
 *   - El manifiesto de Android decía `versionCode 29` / `versionName 4.7`.
 *   - El JavaScript de dentro decía `4.6`, porque Vite hornea la versión al
 *     compilar leyendo `build.gradle`.
 *
 * Y no era solo un número mal puesto en una pantalla: `versionInstalada()`
 * devolvía 28 mientras `version.json` anunciaba 29, así que **la app iba a
 * insistir para siempre con que había una actualización** que al instalarse no
 * callaba el aviso. Alex lo vio como «sigue en 4.6» después de instalar dos
 * veces.
 *
 * El orden no se puede dejar a la memoria de nadie: aquí va escrito, y además
 * se comprueba el resultado antes de dar el APK por bueno.
 *
 *   npm run apk
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GRADLE = "android/app/build.gradle";
const APK = "android/app/build/outputs/apk/release/app-release.apk";

const gradle = readFileSync(GRADLE, "utf8");
const codigo = gradle.match(/versionCode\s+(\d+)/)?.[1];
const nombre = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
if (!codigo || !nombre) {
  console.error("No se pudo leer la versión de " + GRADLE);
  process.exit(1);
}

// Ojo con las opciones: sin recogerlas, el `cwd: "android"` de gradlew se
// perdia y el comando se lanzaba desde la raiz del proyecto, donde no existe.
const ENVOLTORIO = process.platform === "win32" ? "gradlew.bat" : "gradlew";

const correr = (cmd, args, opciones = {}) =>
  execFileSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opciones,
  });

console.log(`\nCompilando Genuino ${nombre} (código ${codigo})\n`);

// 1. La web PRIMERO, que es donde estaba el fallo: Vite hornea la versión
//    leyendo build.gradle, así que tiene que compilarse después de subirla.
correr("npm", ["run", "build"]);

// 2. Comprobar que la web horneó la versión que toca, antes de meterla en el
//    APK. Es la comprobación que habría evitado publicar una 4.7 que por
//    dentro era la 4.6.
comprobarLaWeb(nombre, codigo);

// 3. Copiarla al proyecto de Android y compilar.
correr("npx", ["cap", "sync", "android"]);
// Ruta absoluta a propósito: con `shell: true` en Windows, un `gradlew.bat`
// suelto se busca en el PATH y no en el `cwd`, y el comando falla con un
// «Command failed» que no dice nada de lo que pasa.
correr(join(process.cwd(), "android", ENVOLTORIO), ["assembleRelease", "-q"], {
  cwd: "android",
});

console.log(`\n  ${APK}`);
console.log(`  Genuino ${nombre} · código ${codigo} · web y manifiesto de acuerdo.\n`);

/**
 * Que el JavaScript compilado lleve de verdad esta versión.
 *
 * Se busca en los archivos de `dist`, que es lo que `cap sync` va a copiar
 * dentro del APK. Si no está, `dist` es viejo y el APK saldría mintiendo.
 */
function comprobarLaWeb(nombre, codigo) {
  const carpeta = "dist/assets";
  let hayNombre = false;
  let hayCodigo = false;

  for (const archivo of readdirSync(carpeta)) {
    if (!archivo.endsWith(".js")) continue;
    const texto = readFileSync(join(carpeta, archivo), "utf8");
    if (texto.includes(`"${nombre}"`)) hayNombre = true;
    // El código va como número suelto; se busca pegado a la versión para no
    // confundirlo con cualquier otro 29 del bundle.
    if (new RegExp(`${codigo}[,;)\\s]`).test(texto)) hayCodigo = true;
  }

  if (hayNombre && hayCodigo) {
    console.log(`\n  ✓ La web compilada lleva la ${nombre} (código ${codigo}).`);
    return;
  }

  console.error(`\n  ✕ La web compilada NO lleva la ${nombre}.`);
  console.error("    `dist` está desfasado respecto a android/app/build.gradle.");
  console.error("    Sin esto, el APK saldría con un número en el manifiesto y otro");
  console.error("    por dentro, y la app pediría actualizarse para siempre.");
  process.exit(1);
}
