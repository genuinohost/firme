/**
 * Las dos decisiones del portero, sin nada alrededor.
 *
 * Viven aquí y no en `index.js` por un motivo práctico: `index.js` llama a
 * `initializeApp()` al cargarse, así que importarlo desde una prueba exige
 * credenciales de administrador y un emulador levantado. Estas dos funciones no
 * necesitan nada, y son justo las que pueden estar mal.
 *
 *   npm run revisar
 */

/**
 * Un nombre de canal que Agora acepta.
 *
 * El juego de caracteres y el tope de 64 son los de Agora, no nuestros. Se
 * comprueba para que un canal inventado falle con un motivo legible en vez de
 * con un error del SDK dentro del móvil de alguien.
 */
export function nombreDeSalaValido(canal) {
  return /^[A-Za-z0-9!#$%&()+\-:;<=.>?@[\]^_{}|~,]{1,64}$/.test(canal);
}

/**
 * Si esta persona entra hablando o escuchando.
 *
 * Es **la** decisión de todo esto. De lo que devuelve depende el rol del token,
 * y Agora no le da el privilegio de publicar audio a un oyente: quien entra
 * escuchando no es que la app no le encienda el micrófono, es que no trae
 * permiso para encenderlo.
 *
 * - En una **llamada** de dos no hay nada que moderar: los dos hablan.
 * - En un **devocional** habla el anfitrión y quien él haya llamado.
 *
 * `palabra` sólo lo puede mover el anfitrión, y eso lo garantizan las reglas de
 * Firestore — hay una prueba con ese nombre en `scripts/revisar-reglas.mjs`.
 */
export function puedeHablar({ tipo, anfitrion, uid, palabra }) {
  if (tipo === "llamada") return true;
  if (anfitrion === uid) return true;
  return palabra === true;
}
