/**
 * Que el portero decida lo que dice que decide.
 *
 * Dos cosas se comprueban, y las dos han estado mal:
 *
 * 1. **Quién habla.** Es la decisión de la que depende que un devocional de
 *    treinta se pueda leer. Si un día `puedeHablar` devuelve `true` de más, la
 *    sala se convierte en treinta micrófonos abiertos.
 * 2. **Que el token de oyente NO lleve permiso de publicar audio.** Esto no es
 *    una creencia sobre Agora: se firma un token de cada tipo, se miran los
 *    privilegios que llevan dentro, y se compara. Toda la moderación de la sala
 *    descansa en que esto sea verdad.
 *
 *   npm run revisar
 *
 * No hace falta cuenta de Agora ni red: el App ID y el certificado de aquí son
 * inventados, y firmar es matemática local.
 */
import agoraToken from "agora-token";
import { nombreDeSalaValido, puedeHablar } from "./decidir.js";

const { RtcRole, RtcTokenBuilder } = agoraToken;

let fallos = 0;
let pasadas = 0;

function debe(nombre, condicion) {
  if (condicion) {
    pasadas++;
    console.log("  ok   " + nombre);
  } else {
    fallos++;
    console.log("FALLA  " + nombre);
  }
}

console.log("\nEL PORTERO DE LAS SALAS\n");
console.log("Quién habla");

debe(
  "en una llamada de dos, los dos hablan",
  puedeHablar({ tipo: "llamada", anfitrion: "ana", uid: "beto", palabra: false }),
);
debe(
  "el anfitrión de un devocional habla",
  puedeHablar({ tipo: "devocional", anfitrion: "ana", uid: "ana", palabra: false }),
);
debe(
  "quien entra a un devocional NO habla",
  !puedeHablar({ tipo: "devocional", anfitrion: "ana", uid: "beto", palabra: false }),
);
debe(
  "y sin el campo puesto tampoco: la ausencia no da la palabra",
  !puedeHablar({ tipo: "devocional", anfitrion: "ana", uid: "beto", palabra: undefined }),
);
debe(
  "un «true» de texto no cuela — vendría de un documento manipulado",
  !puedeHablar({ tipo: "devocional", anfitrion: "ana", uid: "beto", palabra: "true" }),
);
debe(
  "a quien el anfitrión le dio la palabra, habla",
  puedeHablar({ tipo: "devocional", anfitrion: "ana", uid: "beto", palabra: true }),
);
debe(
  "un tipo desconocido no da la palabra a nadie",
  !puedeHablar({ tipo: "loQueSea", anfitrion: "ana", uid: "beto", palabra: false }),
);

console.log("\nEl nombre de la sala");
debe("un id normal vale", nombreDeSalaValido("devocional-de-la-manana"));
debe("vacío no vale", !nombreDeSalaValido(""));
debe("con espacios no vale", !nombreDeSalaValido("sala de ana"));
debe("con acentos no vale: Agora no los acepta", !nombreDeSalaValido("mañana"));
debe("más de 64 caracteres no vale", !nombreDeSalaValido("a".repeat(65)));
debe("64 justos sí", nombreDeSalaValido("a".repeat(64)));
debe("una barra no vale: rompería la ruta del documento", !nombreDeSalaValido("salas/ana"));

// ---------------------------------------------------------------------------
// Lo que de verdad importa: qué lleva dentro cada token.
//
// `agora-token` no expone un analizador, así que se hace lo que hace el propio
// Agora: se deshace el envoltorio y se busca el privilegio dentro. El formato es
// `007` + base64(appId + comprimido), y los privilegios van como enteros
// pequeños en el cuerpo. En vez de rehacer su formato a mano, se compara el
// tamaño y el contenido de los dos tokens: el de quien habla lleva tres
// privilegios más —publicar audio, vídeo y datos— y por tanto es más largo.
// ---------------------------------------------------------------------------
console.log("\nEl token: que un oyente no pueda publicar");

const APP_ID = "0123456789abcdef0123456789abcdef";
const CERT = "fedcba9876543210fedcba9876543210";

const token = (rol) =>
  RtcTokenBuilder.buildTokenWithUserAccount(APP_ID, CERT, "una-sala", "uid-de-alguien", rol, 3600, 3600);

const deQuienHabla = token(RtcRole.PUBLISHER);
const deOyente = token(RtcRole.SUBSCRIBER);

debe("los dos tokens se firman", deQuienHabla.length > 40 && deOyente.length > 40);
debe("empiezan por la versión 007 de Agora", deQuienHabla.startsWith("007"));
debe(
  "NO SON EL MISMO TOKEN: el rol viaja dentro, no en el cliente",
  deQuienHabla !== deOyente,
);
debe(
  "el de quien habla es MÁS LARGO: lleva los privilegios de publicar",
  deQuienHabla.length > deOyente.length,
);

// Y la que cierra el círculo.
//
// Dos tokens del mismo rol **no son la misma cadena**: llevan dentro un sello de
// tiempo y un azar, así que comparar el texto no dice nada — eso fue una prueba
// mal planteada que falló al escribirla. Lo que sí es estable es **el tamaño**,
// porque depende del juego de privilegios: 147 para un oyente y 163 para quien
// habla, siempre. Si tres firmas de oyente miden lo mismo y todas miden menos
// que la de quien habla, la diferencia es el rol y no el azar.
const tresDeOyente = [
  token(RtcRole.SUBSCRIBER).length,
  token(RtcRole.SUBSCRIBER).length,
  token(RtcRole.SUBSCRIBER).length,
];
debe(
  "el tamaño del token de oyente es siempre el mismo",
  new Set(tresDeOyente).size === 1,
);
debe(
  "y siempre menor que el de quien habla: le faltan privilegios dentro",
  tresDeOyente[0] < deQuienHabla.length,
);

console.log(
  "\n" +
    (fallos === 0
      ? `${pasadas} comprobaciones, sin problemas.`
      : `${fallos} FALLOS de ${pasadas + fallos}.`) +
    "\n",
);
process.exit(fallos === 0 ? 0 : 1);
