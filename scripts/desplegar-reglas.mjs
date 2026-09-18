/**
 * Publica `firestore.rules`, pero sólo si pasan las pruebas.
 *
 * Las reglas son lo único que separa el WhatsApp, el perfil y las notas de la
 * gente de cualquiera con una conexión. Desplegarlas es la operación más
 * peligrosa de este proyecto: un `allow read` de más no rompe nada, no da
 * error, no se ve en ninguna pantalla — simplemente deja la puerta abierta, y
 * nadie se entera hasta que alguien pasa por ella.
 *
 * Por eso no se despliegan a mano. Aquí se arranca el emulador, se hacen las
 * preguntas incómodas en nombre de un extraño, y **sólo si todas salen como
 * deben** se sube. Si una falla, esto se para y no se sube nada.
 *
 *   npm run desplegar-reglas
 *
 * Necesita Java, que ya hace falta para compilar el APK.
 */
import { execFileSync } from "node:child_process";
import { prepararCredenciales } from "./credenciales.mjs";

const PROYECTO = "genuino-host";

prepararCredenciales();

const correr = (cmd, args) =>
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });

console.log("\nComprobando las reglas antes de subirlas…\n");
try {
  correr("npm", ["run", "revisar-reglas"]);
} catch {
  console.error("");
  console.error("Las reglas NO pasan sus propias pruebas. No se sube nada.");
  console.error("Arregla firestore.rules y vuelve a intentarlo.");
  process.exit(1);
}

console.log("\nSubiendo las reglas…\n");
correr("npx", ["firebase", "deploy", "--only", "firestore:rules", "--project", PROYECTO]);
