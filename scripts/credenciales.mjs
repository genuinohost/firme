/**
 * Que desplegar no vuelva a pedir que alguien inicie sesión.
 *
 * ── El problema, y por qué costó verlo ────────────────────────────────────
 *
 * Alex, el 16-09-2026: «¿cómo podemos hacer para que puedas iniciar sesión en
 * Firebase, o que quede siempre abierto? Es molestoso iniciar sesión a cada
 * rato». La respuesta fue una **cuenta de servicio**, cuya clave no caduca, en
 * `~/.firebase/genuino-despliegue.json`. Y funcionó… unas horas.
 *
 * El 18-09-2026 volvió a fallar con «Your credentials are no longer valid».
 * La causa no era la clave: la clave estaba bien y sigue estando bien. Era que
 * **el CLI de Firebase prefiere la sesión de usuario guardada antes que la
 * cuenta de servicio**, y la sesión guardada (`auto@genuinohost.com`) había
 * caducado. Con un usuario caducado delante, el CLI ni se molesta en mirar
 * `GOOGLE_APPLICATION_CREDENTIALS`: falla y manda a iniciar sesión.
 *
 * Lo desagradable del fallo es que la clave estaba puesta y el mensaje decía
 * que no había credenciales. Miraba al sitio equivocado.
 *
 * ── El arreglo ────────────────────────────────────────────────────────────
 *
 * En vez de cerrar la sesión de Alex —que es suya y puede querer usarla—, los
 * despliegues corren con **su propia carpeta de configuración**, vacía de
 * usuarios. Sin sesión guardada que estorbe, el CLI usa la cuenta de servicio,
 * que es lo que queríamos desde el principio.
 *
 * Si algún día no hay clave, no se toca nada: se deja el comportamiento de
 * siempre y que el CLI use la sesión de Alex, caducada o no.
 */
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const CLAVE = join(homedir(), ".firebase", "genuino-despliegue.json");

/**
 * Prepara el entorno para desplegar. Devuelve `true` si va con la cuenta de
 * servicio, `false` si toca depender de la sesión del CLI.
 */
export function prepararCredenciales() {
  // La clave puede venir ya puesta en el entorno del sistema —así la tiene
  // Alex— o estar en su sitio de siempre. Las dos valen.
  //
  // Ojo con el orden: la primera versión de esto salía aquí mismo cuando la
  // variable ya estaba puesta, **y entonces no aislaba nada**. Seguía fallando
  // exactamente igual, porque el problema nunca fue la clave: era la sesión
  // caducada que el CLI mira antes. Aislar es el arreglo, y tiene que pasar
  // siempre que haya clave, venga de donde venga.
  const clave = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? CLAVE;

  if (!existsSync(clave)) {
    console.log("⚠ No hay cuenta de servicio en " + clave);
    console.log("  Se intentará con la sesión del CLI, que caduca cada día.");
    return false;
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = clave;

  // La carpeta aparte: aquí no hay ninguna sesión guardada, así que el CLI no
  // tiene nada que preferir por delante de la clave.
  const aparte = join(tmpdir(), "genuino-firebase-conf");
  mkdirSync(aparte, { recursive: true });
  process.env.XDG_CONFIG_HOME = aparte;

  console.log("Credenciales: la cuenta de servicio (sin sesión de usuario de por medio).");
  return true;
}
