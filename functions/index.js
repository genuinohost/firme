import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
// `agora-token` es CommonJS y **no tiene exports nombrados de ESM**: un
// `import { RtcRole } from "agora-token"` falla al cargar el modulo con
// «Named export 'RtcRole' not found», y falla al desplegar, no al escribirlo.
import agoraToken from "agora-token";

import { nombreDeSalaValido, puedeHablar } from "./decidir.js";

const { RtcRole, RtcTokenBuilder } = agoraToken;

/**
 * El portero de las salas de voz.
 *
 * ── Por qué esto tiene que existir en un servidor ──────────────────────────
 *
 * Agora no deja entrar a un canal sin un token firmado con el certificado del
 * proyecto. Ese certificado **no puede viajar en la app**: cualquiera que
 * descomprima el APK lo tendría, y con él podría abrir canales a nuestro nombre
 * y gastar nuestros minutos.
 *
 * Y de paso resuelve el control de acceso, que si no no tendría dónde vivir:
 * las reglas de Firestore no saben nada de Agora, y una puerta puesta en el
 * cliente no es una puerta. **Esta función es la puerta.**
 *
 * ── Las dos cosas que decide ───────────────────────────────────────────────
 *
 * 1. **Si entras.** Hace falta cuenta, que la sala exista y esté abierta, y no
 *    estar expulsado.
 * 2. **Si hablas.** Y esto es lo que hace que un devocional de treinta se pueda
 *    leer: se entra de **oyente**, y Agora no deja publicar voz a un oyente. No
 *    es que la app se porte bien y no encienda el micrófono — es que el permiso
 *    no lo trae.
 *
 * Quien habla es el anfitrión, o alguien a quien el anfitrión le dio la palabra
 * (`dentro/{uid}.palabra`). Ese campo sólo lo puede mover el anfitrión, y eso lo
 * garantizan las reglas de Firestore — hay una prueba con ese nombre en
 * `scripts/revisar-reglas.mjs`. Si esa regla cediera, cedería esto.
 *
 * En una llamada de dos no hay nada que moderar: los dos hablan.
 *
 * ── Los secretos ──────────────────────────────────────────────────────────
 *
 * Se ponen una vez y no viven en el repositorio:
 *
 *   npx firebase functions:secrets:set AGORA_APP_CERTIFICATE
 *   npx firebase functions:config  # el App ID va como parámetro, no es secreto
 */

initializeApp();

/** El App ID no es secreto: va en la app de todas formas. */
const APP_ID = defineString("AGORA_APP_ID");

/** El certificado sí. Con él se firma, y con él se podría suplantar. */
const CERTIFICADO = defineSecret("AGORA_APP_CERTIFICATE");

/**
 * Cuánto vale un permiso de entrada.
 *
 * Una hora, no un día. El token lleva **dentro** si puedes hablar o sólo
 * escuchar, así que su duración es también el tiempo máximo que alguien
 * conserva la palabra después de que se le quite. Una hora es razonable porque
 * el cliente pide otro en cuanto cambia `palabra` — esto es el techo para el
 * caso raro de que ese aviso no llegue.
 */
const VALE_SEGUNDOS = 3600;

/**
 * Da permiso de entrada a una sala.
 *
 * Devuelve el token, el App ID y si entras hablando o escuchando. El cliente lo
 * vuelve a pedir cuando el anfitrión le da o le quita la palabra.
 */
export const permisoDeSala = onCall(
  { secrets: [CERTIFICADO], region: "us-central1" },
  async (peticion) => {
    const uid = peticion.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Hace falta haber entrado con tu cuenta.");
    }

    const canal = String(peticion.data?.canal ?? "").trim();
    if (!nombreDeSalaValido(canal)) {
      throw new HttpsError("invalid-argument", "Ese nombre de sala no es válido.");
    }

    const bd = getFirestore();
    const refSala = bd.doc(`salas/${canal}`);

    // Las tres lecturas a la vez: la sala, si está expulsado, y si tiene la
    // palabra. Es una puerta, y una puerta lenta es una puerta que se rodea.
    const [sala, expulsado, dentro] = await Promise.all([
      refSala.get(),
      bd.doc(`salas/${canal}/expulsados/${uid}`).get(),
      bd.doc(`salas/${canal}/dentro/${uid}`).get(),
    ]);

    if (!sala.exists) {
      throw new HttpsError("not-found", "Esa sala no existe.");
    }
    if (sala.get("abierta") !== true) {
      throw new HttpsError("failed-precondition", "La sala está cerrada.");
    }
    if (expulsado.exists) {
      // Se dice sin rodeos y sin sermón. Quien está fuera merece saberlo.
      throw new HttpsError("permission-denied", "No puedes entrar en esta sala.");
    }

    const esAnfitrion = sala.get("anfitrion") === uid;
    const habla = puedeHablar({
      tipo: sala.get("tipo"),
      anfitrion: sala.get("anfitrion"),
      uid,
      palabra: dentro.get("palabra"),
    });

    const ahora = Math.floor(Date.now() / 1000);
    const caduca = ahora + VALE_SEGUNDOS;

    // Con la cuenta de usuario en texto, no con un número: el uid de Firebase
    // es una cadena y convertirlo a un entero de 32 bits significa inventarse
    // un hash y aceptar colisiones. Agora admite cuentas en texto y el SDK de
    // Android entra con `joinChannelWithUserAccount`.
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      APP_ID.value(),
      CERTIFICADO.value(),
      canal,
      uid,
      habla ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      VALE_SEGUNDOS,
      VALE_SEGUNDOS,
    );

    return {
      appId: APP_ID.value(),
      canal,
      cuenta: uid,
      token,
      habla,
      esAnfitrion,
      caduca,
    };
  },
);
