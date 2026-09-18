/**
 * Compila el paquete para Google Play.
 *
 * Play no acepta APK: hay que subir un **AAB**, del que Google saca un APK a
 * medida de cada teléfono. La firma es la misma que la del APK, asi que este
 * almacén pasa a ser la «clave de subida» de Play App Signing — y perderlo
 * sigue siendo el peor accidente posible del proyecto.
 *
 *   npm run aab
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { revisarAntesDePublicar } from "./guardian.mjs";

const gradle = readFileSync("android/app/build.gradle", "utf8");
const nombre = gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? "sin-version";
const codigo = gradle.match(/versionCode\s+(\d+)/)?.[1] ?? "0";

// Ojo con las opciones: sin recogerlas, el `cwd: "android"` de gradlew se
// perdia y el comando se lanzaba desde la raiz del proyecto, donde no existe.
const ENVOLTORIO = process.platform === "win32" ? "gradlew.bat" : "gradlew";

const correr = (cmd, args, opciones = {}) =>
  execFileSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opciones,
  });

// Las comprobaciones primero. A Play se sube una sola vez: un `versionCode`
// publicado **no se puede reemplazar nunca**, y un nombre real colado dentro lo
// leen todos los que instalen desde la tienda. Aquí es donde más barato sale
// enterarse.
correr("npm", ["run", "revisar"]);

correr("npm", ["run", "build"]);

// Que la web horneó la versión que toca, ANTES de meterla en el paquete. Es la
// comprobación que le faltaba a este script y sí tenía el del APK.
revisarAntesDePublicar(nombre);

correr("npx", ["cap", "sync", "android"]);
// Ruta absoluta: con `shell: true` en Windows, un `gradlew.bat` suelto se busca
// en el PATH y no en el `cwd`.
correr(join(process.cwd(), "android", ENVOLTORIO), ["bundleRelease", "--no-daemon"], {
  cwd: "android",
});

const origen = "android/app/build/outputs/bundle/release/app-release.aab";
if (!existsSync(origen)) {
  console.error("Gradle dijo que sí, pero el .aab no está en " + origen);
  process.exit(1);
}
mkdirSync("docs/tienda", { recursive: true });
const destino = `docs/tienda/Genuino-${nombre}.aab`;
copyFileSync(origen, destino);

// Que el paquete esté firmado. Un .aab sin firma lo rechaza Play al subirlo,
// y el mensaje de Play no dice qué falta: dice «no se pudo procesar».
const ALMACEN = "android/firma.properties";
if (!existsSync(ALMACEN)) {
  console.error("");
  console.error("⚠ No hay " + ALMACEN + ", así que el paquete va SIN FIRMAR.");
  console.error("  Play lo rechazará. Sin ese archivo, Gradle compila igual y");
  console.error("  no avisa: por eso se avisa aquí.");
  process.exit(1);
}

console.log(`\n  ${destino}  ·  version ${nombre} (codigo ${codigo})`);
console.log("  Subelo en Play Console → Pruebas → Prueba interna → Crear version.\n");
