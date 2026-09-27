import agoraToken from "agora-token";
import { nombreDeSalaValido, puedeHablar } from "../../functions/decidir.js";
import { llamarAlTema } from "./fcm.js";
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

/**
 * Servir el APK, porque desde Venezuela no se puede bajar de GitHub.
 *
 * ── El fallo, en vídeo ────────────────────────────────────────────────────
 *
 * El 27-09-2026 Alex grabó su móvil: la app decía «hay una versión nueva»,
 * tocaba «Descargar», se abría `github.com…` y **la página se quedaba en
 * negro**. Seis segundos de pantalla vacía. Por eso seguía en la 6.7 y por eso
 * ninguno de los arreglos de las alarmas le había llegado nunca.
 *
 * GitHub no sirve el archivo desde `github.com`: redirige a
 * `objects.githubusercontent.com`, otro dominio, y ése se cae desde allí.
 *
 * ── Por qué aquí y no en Firebase ─────────────────────────────────────────
 *
 * Se intentó servirlo desde el propio sitio y Firebase lo niega con todas las
 * letras: «Executable files are forbidden on the Spark billing plan». Y el plan
 * de pago es justo el que no se pudo activar.
 *
 * Así que lo trae este Worker. El móvil habla con un solo dominio —el mismo que
 * ya usa para entrar a las salas— y quien se pelea con GitHub es Cloudflare,
 * desde fuera. No se guarda nada: se pide y se reenvía tal cual.
 *
 * ── De dónde saca qué versión ─────────────────────────────────────────────
 *
 * De `version.json`, el mismo archivo que consultan los móviles. Así publicar
 * una versión nueva no obliga a tocar el Worker: se sube la release, se
 * despliega la web, y esto ya sirve la nueva.
 */
async function servirElApk(peticion, entorno) {
  let nombre;
  try {
    const r = await fetch(entorno.VERSION_URL, { cf: { cacheTtl: 60 } });
    nombre = (await r.json())?.nombre;
  } catch {
    nombre = null;
  }
  if (!nombre) {
    return new Response("No se pudo saber cuál es la última versión.", { status: 502 });
  }

  const archivo = `Genuino-${nombre}.apk`;
  const deGithub = `${entorno.RELEASES_URL}/${archivo}`;

  /*
    Se deja pasar el `Range`, y no es un adorno.

    Son sesenta megas por una conexión venezolana. Sin esto, una descarga que se
    corta al 80 % empieza de cero, y la siguiente también — que es exactamente
    la forma de no instalar nunca una actualización. Con esto, el navegador
    reanuda por donde iba.
  */
  const aGithub = new Headers();
  for (const cual of ["Range", "If-Range"]) {
    const v = peticion.headers.get(cual);
    if (v) aGithub.set(cual, v);
  }

  const apk = await fetch(deGithub, { headers: aGithub, redirect: "follow" });
  if (!apk.ok || !apk.body) {
    return new Response("No se pudo traer el paquete.", { status: 502 });
  }

  const cabeceras = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    // Sin esto, algunos navegadores lo abren en vez de guardarlo y se queda la
    // pantalla en negro — que es justo el síntoma del que veníamos.
    "Content-Disposition": `attachment; filename="${archivo}"`,
    // Y esto es lo que le dice al navegador que puede reanudar.
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  });
  for (const cual of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
    const v = apk.headers.get(cual);
    if (v) cabeceras.set(cual, v);
  }

  // Se reenvía el cuerpo tal cual, sin leerlo entero en memoria: son sesenta
  // megas y un Worker no tiene sitio para eso. Y se conserva el 206, que es lo
  // que distingue «aquí va el trozo que pediste» de «aquí va todo otra vez».
  return new Response(apk.body, { status: apk.status, headers: cabeceras });
}

/**
 * Hacer sonar los móviles de la comunidad: «te llaman al devocional».
 *
 * ── Quién puede ──────────────────────────────────────────────────────────
 *
 * Alex, el 27-09-2026: «VITAL que yo pueda hacer que le suene la llamada a los
 * que voluntariamente están dentro del grupo de voz […] cada vez que yo, y sólo
 * yo (o alguno de los otros administradores que yo señale), hagan la llamada».
 *
 * Los que pueden llamar son los que **moderan**: `moderadores/{uid}`, una
 * lista que no se puede escribir desde la app y se da de alta desde la
 * consola. Se comprueba leyendo ese documento **con el token de quien llama** —
 * las reglas dejan a cada uno leer sólo el suyo, que es justo lo que hace
 * falta aquí. Un desconocido que encuentre esta dirección se lleva un 403.
 *
 * Y sólo se puede llamar a una sala **abierta**: una llamada a una sala que no
 * existe deja a treinta personas entrando a la nada.
 *
 * ── Un mensaje, miles de móviles ─────────────────────────────────────────
 *
 * No se lee ninguna lista de tokens: cada móvil se apuntó él solo al tema
 * `devocional` al entrar a la comunidad, y aquí se manda un solo aviso al
 * tema. Ver `fcm.js`.
 */
async function llamar(peticion, entorno, origen) {
  let cuerpo;
  try {
    cuerpo = await peticion.json();
  } catch {
    return respuesta({ error: "cuerpo", porque: "No se entendió la petición." }, 400, origen);
  }
  const canal = String(cuerpo?.canal ?? "").trim();
  const token = String(cuerpo?.token ?? "");
  const nombre = String(cuerpo?.nombre ?? "Devocional").slice(0, 60);

  if (!nombreDeSalaValido(canal)) {
    return respuesta({ error: "nombre-invalido", porque: PORQUE["nombre-invalido"] }, 400, origen);
  }

  let uid;
  try {
    uid = await uidDelToken(token, { proyecto: entorno.PROYECTO, clavesUrl: entorno.CLAVES_URL });
  } catch (e) {
    console.log("token rechazado:", e?.message ?? e);
    return respuesta({ error: "sin-sesion", porque: PORQUE["sin-sesion"] }, 401, origen);
  }

  const base = entorno.FIRESTORE_URL;
  let modera, sala;
  try {
    [modera, sala] = await Promise.all([
      leerDocumento(base, `moderadores/${uid}`, token),
      leerDocumento(base, `salas/${canal}`, token),
    ]);
  } catch (e) {
    console.log("firestore:", e?.message ?? e);
    return respuesta(
      { error: "sin-conexion", porque: "No se pudo comprobar quién llama. Vuelve a probar." },
      502,
      origen,
    );
  }

  if (!modera) {
    return respuesta(
      { error: "no-puedes-llamar", porque: "Sólo quien lleva la comunidad puede llamar." },
      403,
      origen,
    );
  }
  if (!sala) {
    return respuesta({ error: "sala-no-existe", porque: PORQUE["sala-no-existe"] }, 404, origen);
  }
  if (sala.abierta !== true) {
    return respuesta({ error: "sala-cerrada", porque: PORQUE["sala-cerrada"] }, 409, origen);
  }

  try {
    await llamarAlTema({
      fcmUrl: entorno.FCM_URL,
      tokenUrl: entorno.FCM_TOKEN_URL,
      cuentaJson: entorno.FCM_CUENTA,
      tema: entorno.FCM_TEMA,
      datos: { tipo: "llamada", canal, nombre, quien: uid },
    });
  } catch (e) {
    const motivo = String(e?.message ?? e);
    console.log("fcm:", motivo);
    // Un 403 de Google no se arregla reintentando: es que la cuenta del timbre
    // no tiene el rol de enviar. Decir «vuelve a probar» ahi es mandar a alguien
    // a mirar donde no esta el fallo — la misma leccion que «mira tu conexion».
    const sinPermiso = /fcm-403|google-no-dio-token-40[13]/.test(motivo);
    return respuesta(
      sinPermiso
        ? {
            error: "servidor-sin-permiso",
            porque:
              "El servidor todavia no tiene permiso de Google para llamar. Es un ajuste de quien lleva la app, no tuyo.",
          }
        : { error: "no-se-pudo-llamar", porque: "No se pudo mandar la llamada. Vuelve a probar." },
      502,
      origen,
    );
  }

  return respuesta({ enviado: true, canal, tema: entorno.FCM_TEMA }, 200, origen);
}

export default {
  async fetch(peticion, entorno) {
    const origen = peticion.headers.get("Origin") ?? "";
    const ruta = new URL(peticion.url).pathname;

    // El paquete, antes que nada: es lo único que se pide con GET.
    if (ruta === "/apk") {
      if (peticion.method !== "GET" && peticion.method !== "HEAD") {
        return new Response("Sólo GET.", { status: 405 });
      }
      return servirElApk(peticion, entorno);
    }

    if (peticion.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cabecerasCors(origen) });
    }

    // Hacer sonar los móviles. Mismo portero, otra puerta.
    if (ruta === "/llamar") {
      if (peticion.method !== "POST") {
        return respuesta({ error: "metodo", porque: "Sólo POST." }, 405, origen);
      }
      return llamar(peticion, entorno, origen);
    }

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
      micLibre: sala.micLibre,
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
