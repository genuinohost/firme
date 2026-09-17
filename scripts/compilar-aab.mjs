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
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

correr("npm", ["run", "build"]);
correr("npx", ["cap", "sync", "android"]);
// Ruta absoluta: con `shell: true` en Windows, un `gradlew.bat` suelto se busca
// en el PATH y no en el `cwd`.
correr(join(process.cwd(), "android", ENVOLTORIO), ["bundleRelease", "--no-daemon"], {
  cwd: "android",
});

const origen = "android/app/build/outputs/bundle/release/app-release.aab";
mkdirSync("docs/tienda", { recursive: true });
const destino = `docs/tienda/Genuino-${nombre}.aab`;
copyFileSync(origen, destino);

console.log(`\n  ${destino}  ·  version ${nombre} (codigo ${codigo})`);
console.log("  Subelo en Play Console → Pruebas → Prueba interna → Crear version.\n");
