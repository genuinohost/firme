/**
 * Deja el APK junto a la web, para que los móviles ya instalados puedan
 * descargarlo desde el aviso de versión nueva.
 *
 * Si no hay APK compilado no falla: puede que solo se esté publicando la web.
 */
import { copyFileSync, existsSync, statSync } from "node:fs";

const ORIGEN = "android/app/build/outputs/apk/release/app-release.apk";
const DESTINO = "dist/Firme.apk";

if (!existsSync(ORIGEN)) {
  console.log("Sin APK compilado; se publica solo la web.");
  process.exit(0);
}

copyFileSync(ORIGEN, DESTINO);
const mb = (statSync(DESTINO).size / 1024 / 1024).toFixed(1);
console.log(`APK copiado a ${DESTINO} (${mb} MB)`);
