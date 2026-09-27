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
import { prepararCredenciales } from "./credenciales.mjs";

const PROYECTO = "genuino-host";

/**
 * La web Y las reglas, siempre juntas.
 *
 * El 27-09-2026 la 6.12 salio con las salas de voz y las reglas de Firestore
 * que las permiten se quedaron sin desplegar: se cambiaron en dos commits, se
 * probaron en el emulador, y nadie corrio `desplegar-reglas`. Alex toco «Abrir»
 * y la app le dijo «mira tu conexion» con la conexion perfecta.
 *
 * Desplegar unas reglas que no cambiaron no hace nada, asi que ir siempre
 * juntas no cuesta. Lo que si cuesta es que dependan de la memoria de alguien.
 * Y antes de subirlas pasan por `revisar-reglas`: esta en `firebase.json` como
 * `predeploy`, y si una pregunta falla, no se despliega nada.
 */
const TARGET = "hosting:firme,firestore:rules";

prepararCredenciales();

const correr = (cmd, args) =>
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });

correr("npm", ["run", "build"]);
correr("npx", ["firebase", "deploy", "--only", TARGET, "--project", PROYECTO]);
