import agoraToken from "agora-token";
import { nombreDeSalaValido, puedeHablar } from "../../functions/decidir.js";
import { leerDocumento } from "./firestore.js";
import { uidDelToken } from "./verificar.js";

const { RtcRole, RtcTokenBuilder } = agoraToken;

/**
 * El portero de las salas de voz, en Cloudflare.
 *
 * ── Por qué aquí y no en Firebase ─────────────────────────────────────────
 *
 * Estaba escrito como Cloud Function, que es donde va lo natural. Pero las Cloud
 * Functions exigen el plan Blaze, Blaze exige una tarjeta, y a Alex se la
 * rechazaron el 25-09-2026 con `OR_CCREU_01`: **Google Cloud no opera en
 * Venezuela**, y una tarjeta con dirección venezolana no pasa aunque se elija
 * otro país.
 *
 * No es un problema que se arregle intentándolo otra vez. Así que el portero
 * vive donde sí se puede: un Worker de Cloudflare, plan gratuito, **sin
 * tarjeta**.
 *
 * ── Qué decide, que es lo mismo de antes ──────────────────────────────────
 *
 * 1. **Si entras.** Hace falta cuenta, que la sala exista y esté abierta, y no
 *    estar expulsado.
 * 2. **Si hablas.** Se entra de oyente, y Agora no le da el privilegio de
 *    publicar audio a un oyente. Habla el anfitrión y quien él haya llamado.
 *
 * Y lo decide **el mismo código**: `puedeHablar` vive en `functions/decidir.js`
 * y lo usan los dos porteros. Si algún día vuelve el de Firebase, no habrá dos
 * versiones de la regla que sostiene un devocional de treinta.
 *
 * ── Lo que este Worker NO guarda ──────────────────────────────────────────
 *
 * Ninguna credencial de Google. Lee Firestore **con el token de la propia
 * persona** —ver `firestore.js`—, así que no puede ver nada que ella no viera.
 * El único secreto que hay aquí es el certificado de Agora, que sirve para
 * firmar y para nada más.
 */

/**
 * Cuánto vale un permiso de entrada.
 *
 * Una hora. El token lleva **dentro** si puedes hablar o sólo escuchar, así que
 * su duración es también el tiempo máximo que alguien conserva la palabra
 * después de que se le quite. El cliente pide otro en cuanto eso cambia; esto es
 * el techo para el caso raro de que ese aviso no llegue.
 */
const VALE_SEGUNDOS = 3600;

/**
 * Desde dónde se admiten llamadas.
 *
 * `https://localhost` es la app de Android: Capacitor sirve la web desde ahí
 * dentro del móvil. Los otros dos son la web. Cualquier otro origen se queda
 * fuera — no porque el token no valiera, sino para que esto no se convierta en
 * un firmador de tokens abierto a cualquier página de internet.
 */
const ORIGENES = [
  "https://localhost",
  "http://localhost",
  "https://genuino-pro.web.app",
  "https://genuino-host.web.app",
];

function cabecerasCors(origen) {
  const permitido = ORIGENES.includes(origen) ? origen : ORIGENES[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function respuesta(cuerpo, estado, origen) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json", ...cabecerasCors(origen) },
  });
}

/**
 * Los motivos, escritos para una persona.
 *
 * Van aquí y no en la app porque son los del portero: la app no tiene forma de
 * saber si una sala está cerrada o si a alguien lo sacaron.
 */
const PORQUE = {
  "sin-sesion": "Hace falta entrar con tu cuenta.",
  "sala-no-existe": "Esa sala no existe.",
  "sala-cerrada": "La sala está cerrada.",
  expulsado: "No puedes entrar en esta sala.",
  "nombre-invalido": "Ese nombre de sala no es válido.",
};

export default {
  async fetch(peticion, entorno) {
    const origen = peticion.headers.get("Origin") ?? "";

    if (peticion.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cabecerasCors(origen) });
    }
    if (peticion.method !== "POST") {
      return respuesta({ error: "metodo", porque: "Sólo POST." }, 405, origen);
    }

    let cuerpo;
    try {
      cuerpo = await peticion.json();
    } catch {
      return respuesta({ error: "cuerpo", porque: "No se entendió la petición." }, 400, origen);
    }

    const canal = String(cuerpo?.canal ?? "").trim();
    const token = String(cuerpo?.token ?? "");

    if (!nombreDeSalaValido(canal)) {
      return respuesta(
        { error: "nombre-invalido", porque: PORQUE["nombre-invalido"] },
        400,
        origen,
      );
    }

    // ── Quién es ──────────────────────────────────────────────────────────
    let uid;
    try {
      uid = await uidDelToken(token, {
        proyecto: entorno.PROYECTO,
        clavesUrl: entorno.CLAVES_URL,
      });
    } catch (e) {
      // Se registra el motivo exacto y se devuelve uno solo: a quien llama no se
      // le cuenta si el token caducó, si era de otro proyecto o si la firma
      // estaba mal. Eso sólo ayuda a quien está probando a colarse.
      console.log("token rechazado:", e?.message ?? e);
      return respuesta({ error: "sin-sesion", porque: PORQUE["sin-sesion"] }, 401, origen);
    }

    // ── Si entra ──────────────────────────────────────────────────────────
    const base = entorno.FIRESTORE_URL;
    let sala, expulsado, dentro;
    try {
      // Las tres a la vez: es una puerta, y una puerta lenta es una puerta que
      // se rodea.
      [sala, expulsado, dentro] = await Promise.all([
        leerDocumento(base, `salas/${canal}`, token),
        leerDocumento(base, `salas/${canal}/expulsados/${uid}`, token),
        leerDocumento(base, `salas/${canal}/dentro/${uid}`, token),
      ]);
    } catch (e) {
      console.log("firestore:", e?.message ?? e);
      return respuesta(
        { error: "sin-conexion", porque: "No se pudo comprobar la sala. Vuelve a probar." },
        502,
        origen,
      );
    }

    if (!sala) {
      return respuesta({ error: "sala-no-existe", porque: PORQUE["sala-no-existe"] }, 404, origen);
    }
    if (sala.abierta !== true) {
      return respuesta({ error: "sala-cerrada", porque: PORQUE["sala-cerrada"] }, 409, origen);
    }
    if (expulsado) {
      // Se dice sin rodeos y sin sermón. Quien está fuera merece saberlo.
      return respuesta({ error: "expulsado", porque: PORQUE.expulsado }, 403, origen);
    }

    // ── Si habla ──────────────────────────────────────────────────────────
    const esAnfitrion = sala.anfitrion === uid;
    const habla = puedeHablar({
      tipo: sala.tipo,
      anfitrion: sala.anfitrion,
      uid,
      palabra: dentro?.palabra,
    });

    // Con la cuenta en texto, no con un número: el uid de Firebase es una cadena
    // y convertirlo a un entero de 32 bits significa inventarse un hash y
    // aceptar colisiones.
    const permiso = RtcTokenBuilder.buildTokenWithUserAccount(
      entorno.AGORA_APP_ID,
      entorno.AGORA_APP_CERTIFICATE,
      canal,
      uid,
      habla ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      VALE_SEGUNDOS,
      VALE_SEGUNDOS,
    );

    return respuesta(
      {
        appId: entorno.AGORA_APP_ID,
        canal,
        cuenta: uid,
        token: permiso,
        habla,
        esAnfitrion,
        caduca: Math.floor(Date.now() / 1000) + VALE_SEGUNDOS,
      },
      200,
      origen,
    );
  },
};
