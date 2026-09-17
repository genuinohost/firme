/**
 * Publica la web en Firebase Hosting.
 *
 * Existe en vez de una línea suelta en `package.json` por dos motivos, y los
 * dos costaron una tarde:
 *
 * 1. **El target.** El proyecto de Firebase es `genuino-host`, el mismo de
 *    genuinohost.com, y su site por defecto es el de la web pública. Un
 *    `firebase deploy --only hosting` sin target **sustituiría la web de la
 *    empresa por esta app**. Aquí va escrito y no se puede olvidar.
 *
 * 2. **Las credenciales.** La sesión de usuario caducaba cada día: el CLI
 *    estaba a nombre de una cuenta de Google Workspace, y la política de
 *    «duración de sesión de Google Cloud» del dominio la expira a las 16 horas.
 *    Ahora despliega una cuenta de servicio, que está exenta. La variable
 *    `GOOGLE_APPLICATION_CREDENTIALS` se puso a nivel de usuario, pero **los
 *    procesos que ya estaban abiertos no la ven** —heredan el entorno de su
 *    padre, no el registro—, así que aquí se rellena sola si falta.
 *
 *   npm run desplegar
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROYECTO = "genuino-host";
const TARGET = "hosting:firme";
const CLAVE = join(homedir(), ".firebase", "genuino-despliegue.json");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  if (existsSync(CLAVE)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = CLAVE;
    console.log("Credenciales: la cuenta de servicio.");
  } else {
    console.log("⚠ No hay cuenta de servicio en " + CLAVE);
    console.log("  Se intentará con la sesión del CLI, que caduca cada día.");
  }
}

const correr = (cmd, args) =>
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });

correr("npm", ["run", "build"]);
correr("npx", ["firebase", "deploy", "--only", TARGET, "--project", PROYECTO]);
