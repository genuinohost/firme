import agoraToken from "agora-token";
import { nombreDeSalaValido, puedeHablar } from "../../functions/decidir.js";
import { abrirVuelta, cerrarVuelta, enviarAviso, tokenDeAcceso } from "./fcm.js";
import { leerDocumento, listarDocumentos } from "./firestore.js";
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
 * 2. **Si hablas.** Se entra de oyente: el token del oyente no lleva el
 *    privilegio de publicar audio. Habla el anfitrión y quien él haya llamado.
 *    ⚠️ Agora sólo hace cumplir ese privilegio si el proyecto tiene activada
 *    la **autenticación de coanfitrión** (Co-host authentication); sin eso el
 *    papel del token es decorativo y manda el booleano `habla` que obedece la
 *    app. Ver docs/investigacion/salas-de-voz.md.
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
 * Cuánto puede vivir una sala aunque nadie la cierre.
 *
 * Un devocional dura una hora; cuatro es margen de sobra. Pasado esto el
 * portero deja de firmar tokens —y de renovarlos— aunque `abierta` siga en
 * true: si al anfitrión se le apagó el móvil con la sala abierta, una sala
 * olvidada no puede facturar días de Agora a quien la encuentre en «Juntos».
 */
const SALA_DURA_MS = 4 * 3600_000;
const sigueAbierta = (sala) =>
  sala.abierta === true && Date.now() - Number(sala.desde ?? 0) < SALA_DURA_MS;

/**
 * Cuánto dura el privilegio de HABLAR de quien no es el anfitrión.
 *
 * Entrar vale una hora; hablar, cinco minutos, y la app lo renueva cada dos
 * mientras tenga la palabra (tres minutos de margen para un fallo de red a
 * mitad de una lectura). Así, si el anfitrión se la quita y el aviso no llega
 * —o llega a un cliente que no obedece—, es Agora quien le cierra el
 * micrófono a los cinco minutos como mucho, no a la hora. (Sólo cuenta si el
 * proyecto de Agora tiene activada la autenticación de coanfitrión; ver
 * docs/investigacion/salas-de-voz.md.) El anfitrión queda fuera: es el único
 * que se juega perder la voz a mitad del devocional por un fallo de red.
 */
const PALABRA_SEGUNDOS = 300;

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
  "no-es-tu-grupo": "Este grupo es de otros. El tuyo sale en la sala principal.",
  "grupo-terminado": "Este grupo ya terminó. Vuelve a la sala principal.",
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
  // De la release de ESA versión, no de «la última». Con `latest/download`,
  // entre publicar la release nueva y desplegar su version.json el portero
  // pedía Genuino-6.22.apk a la release 6.23, que no lo tiene: 502 a todos
  // los que iban a actualizar en ese rato (28-09-2026).
  const deGithub = `${entorno.RELEASES_URL}/v${nombre}/${archivo}`;

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

  // Siempre GET. Se probó a reenviar el HEAD como HEAD (28-09-2026) y GitHub
  // lo devuelve sin cuerpo desde su almacén firmado: el portero lo tomaba por
  // un fallo y contestaba 502 a quien sólo preguntaba el tamaño.
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
 * ── Móvil por móvil, y el tema detrás ────────────────────────────────────
 *
 * Se lee la lista de la comunidad **con el token de quien llama** (las reglas
 * sólo dejan listarla a quien modera, que es quien llama) y se manda un aviso
 * a cada móvil que dejó su token, menos al propio. Lo que conteste Google con
 * cada uno vuelve en `resultados`, con el nombre: así el botón puede decir
 * «a Pepa no le llegó» en vez de «Llamando a 2».
 *
 * Cada aparato de una persona tiene su propio aviso (la ficha guarda un token
 * por aparato, `moviles`): su móvil Y su tableta. El aviso al tema va DETRÁS,
 * y SIEMPRE, para lo que no tenga ficha al día (una app vieja, un móvil cuya
 * ficha no llegó a escribirse).
 *
 * Lo que cambia es su PRIORIDAD. Alta si hace falta de verdad: alguien con la
 * app vieja (sin token), pasado del tope, un suelto que falló, o la lista sin
 * leer. Si no, normal: los móviles que ya sonaron por su token lo reconocen
 * por `llamada` y no pintan nada, y Google rebaja la prioridad de las apps
 * cuyos avisos ALTOS no enseñan nada; los normales no cuentan. Un token muerto
 * (`no-registrado`, alguien que desinstaló) tampoco lo sube: el tema no le
 * sirve de nada a quien ya no tiene la app. Ver `fcm.js`.
 *
 * Tope de 40 avisos sueltos: el plan gratuito de Workers deja 50 peticiones
 * de salida por llamada, y unas pocas se van en comprobar quién llama. Los que
 * pasen del tope se quedan con el tema (y se dice).
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
  if (!sigueAbierta(sala)) {
    return respuesta({ error: "sala-cerrada", porque: PORQUE["sala-cerrada"] }, 409, origen);
  }

  // La lista de la comunidad, con sus tokens. Si no se puede leer (reglas
  // viejas, Firestore caído), se llama sólo al tema, como hasta la 6.26.
  let miembros = null;
  try {
    miembros = await listarDocumentos(base, "comunidad/voz/miembros", token);
  } catch (e) {
    console.log("miembros:", e?.message ?? e);
  }

  const llamada = idDeLlamada();
  const miToken = typeof cuerpo?.miToken === "string" && cuerpo.miToken.length <= 400 ? cuerpo.miToken : "";
  const alSonar = `${new URL(peticion.url).origin}/sono`;
  const comun = { tipo: "llamada", canal, nombre, quien: uid, llamada };
  const fcm = { fcmUrl: entorno.FCM_URL, tokenUrl: entorno.FCM_TOKEN_URL, cuentaJson: entorno.FCM_CUENTA };

  const otros = (miembros ?? []).filter((m) => m.id !== uid);
  // Cada aparato de cada uno: la ficha guarda un token por aparato (`moviles`,
  // desde la 6.27) y el último en `token`. Sin repetir, y nunca el móvil de
  // quien llama: si quedó en la ficha de otra cuenta (una de prueba, un móvil
  // prestado), le sonaba a él y el informe decía «le sonó» de la otra persona.
  const deOtro = (m) => tokensDe(m).filter((t) => t !== miToken);
  // Por rondas: primero el aparato principal de cada uno y después los demás,
  // para que el tope corte aparatos de sobra y no personas.
  const pares = [];
  for (let ronda = 0; ronda < 3; ronda++) {
    for (const m of otros) {
      const t = deOtro(m)[ronda];
      if (t) pares.push({ m, token: t });
    }
  }
  const aMano = pares.slice(0, MAX_AVISOS_SUELTOS);

  // Nadie más en la comunidad: no hay a quién llamar, y no es un fallo.
  if (miembros != null && otros.length === 0) {
    return respuesta({ enviado: true, canal, llamada, tema: null, vuelta: false, resultados: [] }, 200, origen);
  }

  let tema = null;
  let sueltos;
  try {
    // El token de acceso UNA vez, antes de repartir. Si cada aviso lo pidiera
    // por su cuenta, con la caché fría (la primera llamada del día) serían
    // treinta firmas RSA y treinta peticiones a Google: más de las 50
    // subpeticiones y de los 10 ms de CPU del plan gratuito, y a la mitad no
    // les llegaría. (Revisión de la 6.27.)
    await tokenDeAcceso(entorno.FCM_CUENTA, entorno.FCM_TOKEN_URL);
    sueltos = await Promise.all(
      aMano.map(async ({ m, token: destino }) => {
        const datos = { ...comun, para: m.id };
        // La vuelta sólo si hay con qué volver: sin el token de quien llama
        // (un fallo al pedirlo, o falta la clave) no hay a quién avisar.
        if (miToken && entorno.TIMBRE_CLAVE) {
          datos.vuelta = await cerrarVuelta(entorno.TIMBRE_CLAVE, {
            l: llamada,
            p: m.id,
            t: miToken,
            n: Date.now(),
            e: Date.now() + VUELTA_VALE_MS,
          });
          datos.sono = alSonar;
        }
        return enviarAviso({ ...fcm, destino: { token: destino }, datos });
      }),
    );
    const sinAparato = otros.some((m) => deOtro(m).length === 0);
    const temaHaceFalta =
      miembros == null ||
      sinAparato ||
      pares.length > aMano.length ||
      sueltos.some((r) => !r.ok && r.motivo !== "no-registrado");
    tema = await enviarAviso({
      ...fcm,
      destino: { topic: entorno.FCM_TEMA },
      datos: comun,
      // TEMA_SIEMPRE_ALTO: mientras haya aparatos con la 6.26 (sin su entrada
      // en la ficha), el tema es lo único que les llega y en normal llega
      // tarde. Se quita de wrangler.toml cuando todos tengan la 6.27.
      prioridad: temaHaceFalta || entorno.TEMA_SIEMPRE_ALTO === "1" ? "high" : "normal",
    });
  } catch (e) {
    // Sólo llega aquí si no hubo token de acceso de Google: no salió nada.
    const motivo = String(e?.message ?? e);
    tema = { ok: false, motivo: /google-no-dio-token-40[13]/.test(motivo) ? "sin-permiso" : "fallo", detalle: motivo };
    sueltos = aMano.map(() => tema);
  }

  const algunoSalio = !!tema?.ok || sueltos.some((r) => r.ok);
  if (!algunoSalio) {
    console.log("fcm:", [tema, ...sueltos].filter(Boolean).map((r) => r.detalle ?? r.motivo).join(" | ").slice(0, 500));
    // Un 403 de Google no se arregla reintentando: es que la cuenta del timbre
    // no tiene el rol de enviar. Decir «vuelve a probar» ahi es mandar a alguien
    // a mirar donde no esta el fallo — la misma leccion que «mira tu conexion».
    const sinPermiso = [tema, ...sueltos].some((r) => r?.motivo === "sin-permiso");
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

  // Por persona: le salió si salió a alguno de sus aparatos.
  const porUid = new Map();
  aMano.forEach(({ m }, i) => {
    const lista = porUid.get(m.id) ?? [];
    lista.push(sueltos[i]);
    porUid.set(m.id, lista);
  });
  // A quien sólo se llega por el tema (app vieja, o pasado el tope), si el
  // tema falló no le salió nada: se dice «fallo», no «le llega por el camino
  // de antes». (Revisión de la 6.27.)
  const porElTema = (estado) => (tema?.ok ? estado : "fallo");
  const resultados =
    miembros == null
      ? null
      : otros.map((m) => {
          const rs = porUid.get(m.id);
          // Si el tope le cortó algún aparato y los que salieron no llegaron,
          // le queda el tema: no se le dice «no-registrado» a quien sí le llegó.
          const cortado = rs && deOtro(m).length > rs.length;
          const estado = rs
            ? rs.some((r) => r.ok)
              ? "enviado"
              : cortado
                ? porElTema("solo-tema")
                : rs.every((r) => r.motivo === "no-registrado")
                  ? "no-registrado"
                  : "fallo"
            : deOtro(m).length > 0
              ? porElTema("solo-tema")
              : porElTema("sin-token");
          return { uid: m.id, nombre: String(m.nombre ?? "").slice(0, 40), estado };
        });

  return respuesta(
    {
      enviado: true,
      canal,
      llamada,
      // Si salió el aviso general (siempre se manda; ver arriba).
      tema: tema == null ? null : tema.ok,
      vuelta: !!(miToken && entorno.TIMBRE_CLAVE),
      resultados,
    },
    200,
    origen,
  );
}

/** Un token de FCM con buena pinta (los de verdad rondan los 160 caracteres). */
const tokenValido = (t) => typeof t === "string" && t.length > 20 && t.length <= 400;

/**
 * Los tokens de los aparatos de un miembro, sin repetir: los de `moviles` (uno
 * por aparato, desde la 6.27) y el de `token` (el del último que se abrió).
 * Con un solo token por ficha, el segundo aparato de alguien (su tableta) sólo
 * sonaba por el tema; y el tema, si no hacía falta para nadie más, salía en
 * prioridad normal, que con la tableta en reposo llega tarde. (Tercera
 * revisión de la 6.27.)
 */
function tokensDe(m) {
  const lista = [];
  if (m?.moviles && typeof m.moviles === "object") {
    for (const v of Object.values(m.moviles)) if (tokenValido(v?.token)) lista.push(v.token);
  }
  if (tokenValido(m?.token)) lista.push(m.token);
  return [...new Set(lista)].slice(0, 3);
}

/** Cuántos avisos sueltos como mucho por llamada (ver `llamar`). */
const MAX_AVISOS_SUELTOS = 40;

/** Cuánto vale una vuelta: lo mismo que el aviso en Google, y un poco más. */
const VUELTA_VALE_MS = 15 * 60_000;

/** Un identificador corto para reconocer la misma llamada por dos caminos. */
function idDeLlamada() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => (x % 36).toString(36)).join("");
}

/**
 * Lo que un móvil dice de sí mismo al sonar. Sólo lo que sirve para saber por
 * qué no se vio o no se oyó, recortado: el portero no reenvía lo que no espera.
 */
function estadoLimpio(e) {
  const o = {};
  if (!e || typeof e !== "object") return o;
  for (const k of ["sono", "repetida", "avisos", "canal", "pantalla", "bateria", "ahorro"]) {
    if (typeof e[k] === "boolean") o[k] = e[k];
  }
  for (const [k, max] of [
    ["cajon", 24],
    ["noMolestar", 24],
    ["fabricante", 30],
    ["modelo", 40],
    ["android", 10],
    ["version", 20],
  ]) {
    if (typeof e[k] === "string") o[k] = e[k].slice(0, max);
  }
  if (Number.isFinite(e.volumen)) o.volumen = Math.max(-1, Math.min(100, Math.round(e.volumen)));
  return o;
}

/**
 * «Me sonó»: lo manda el servicio nativo de un móvil al que se llamó, con la
 * vuelta que venía en el aviso. El portero la abre y le reenvía a quien llamó
 * quién era y cómo estaba su móvil. No lleva sesión de Firebase —lo manda el
 * móvil con la app cerrada, que no la tiene—: lo que lo protege es la vuelta,
 * que sólo este Worker sabe cerrar y que caduca a los quince minutos.
 */
async function sono(peticion, entorno, origen) {
  if (!entorno.TIMBRE_CLAVE) return respuesta({ error: "sin-vuelta" }, 503, origen);
  let cuerpo;
  try {
    cuerpo = await peticion.json();
  } catch {
    return respuesta({ error: "cuerpo" }, 400, origen);
  }
  const vuelta = String(cuerpo?.vuelta ?? "");
  if (!vuelta || vuelta.length > 2048) return respuesta({ error: "vuelta" }, 400, origen);
  let v;
  try {
    v = await abrirVuelta(entorno.TIMBRE_CLAVE, vuelta);
  } catch {
    return respuesta({ error: "vuelta" }, 400, origen);
  }
  if (!v || typeof v.t !== "string" || typeof v.l !== "string" || !(Date.now() < Number(v.e))) {
    return respuesta({ error: "caducada" }, 410, origen);
  }
  const r = await enviarAviso({
    fcmUrl: entorno.FCM_URL,
    tokenUrl: entorno.FCM_TOKEN_URL,
    cuentaJson: entorno.FCM_CUENTA,
    destino: { token: v.t },
    datos: {
      tipo: "sono",
      llamada: v.l,
      para: String(v.p ?? ""),
      tarda: String(Math.max(0, Date.now() - Number(v.n ?? Date.now()))),
      estado: JSON.stringify(estadoLimpio(cuerpo?.estado)),
    },
    // Normal y no alta: no pinta nada en pantalla, y Google rebaja la
    // prioridad de quien manda avisos «altos» que no enseñan nada — no se va
    // a gastar ese crédito en esto, que hace falta para las llamadas.
    prioridad: "normal",
  }).catch((e) => ({ ok: false, motivo: "fallo", detalle: String(e?.message ?? e) }));
  if (!r.ok) console.log("sono:", r.detalle ?? r.motivo);
  return respuesta({ ok: r.ok }, 200, origen);
}

/** Cuánto espera la prueba del timbre antes de sonar. */
const ESPERA_PRUEBA_MS = 15_000;

/** El canal de la prueba: no es una sala; la app lo reconoce y no intenta entrar. */
const CANAL_PRUEBA = "prueba-del-timbre";

/**
 * Probar el timbre: que le suene a quien lo pide, a su propio móvil, dentro de
 * quince segundos — el tiempo de cerrar la app y apagar la pantalla, que es
 * cuando de verdad se juega (un Xiaomi que no deja despertar a la app suena
 * con ella abierta y no con ella cerrada).
 *
 * Se manda al token que está en SU ficha de la comunidad, leída con SU sesión.
 * Los tokens de los demás sólo los ve quien modera, que ya puede llamar a todos.
 *
 * Antes de decir «te sonará en 15 segundos», se le pregunta a Google si
 * aceptaría el aviso (`validate_only`): si la cuenta del timbre perdió el rol
 * o el token caducó, se dice eso, en vez de dejar a la persona tocando la
 * batería de su Xiaomi por un fallo que no es suyo. (Revisión de la 6.27.)
 */
async function probar(peticion, entorno, origen, ctx) {
  let cuerpo;
  try {
    cuerpo = await peticion.json();
  } catch {
    return respuesta({ error: "cuerpo", porque: "No se entendió la petición." }, 400, origen);
  }
  const token = String(cuerpo?.token ?? "");
  let uid;
  try {
    uid = await uidDelToken(token, { proyecto: entorno.PROYECTO, clavesUrl: entorno.CLAVES_URL });
  } catch {
    return respuesta({ error: "sin-sesion", porque: PORQUE["sin-sesion"] }, 401, origen);
  }
  let ficha;
  try {
    ficha = await leerDocumento(entorno.FIRESTORE_URL, `comunidad/voz/miembros/${uid}`, token);
  } catch {
    return respuesta({ error: "sin-conexion", porque: "No se pudo comprobar. Vuelve a probar." }, 502, origen);
  }
  if (!ficha) {
    return respuesta({ error: "no-eres-miembro", porque: "Primero únete a la comunidad de voz." }, 404, origen);
  }
  if (typeof ficha.token !== "string" || ficha.token.length < 20) {
    return respuesta(
      {
        error: "sin-token",
        porque: "Tu móvil todavía no está registrado. Cierra la app del todo, ábrela y vuelve a probar.",
      },
      409,
      origen,
    );
  }
  const fcmPrueba = { fcmUrl: entorno.FCM_URL, tokenUrl: entorno.FCM_TOKEN_URL, cuentaJson: entorno.FCM_CUENTA };
  const datosPrueba = { tipo: "llamada", canal: CANAL_PRUEBA, nombre: "Prueba del timbre", prueba: "1" };
  const valida = await enviarAviso({
    ...fcmPrueba,
    destino: { token: ficha.token },
    datos: { ...datosPrueba, llamada: "validar" },
    soloValidar: true,
  }).catch((e) => ({
    ok: false,
    motivo: /google-no-dio-token-40[13]/.test(String(e?.message)) ? "sin-permiso" : "fallo",
  }));
  if (!valida.ok) {
    const porque =
      valida.motivo === "no-registrado"
        ? "Google no reconoce tu móvil. Cierra la app del todo, ábrela y vuelve a probar."
        : valida.motivo === "sin-permiso"
          ? "El servidor todavía no tiene permiso de Google para llamar. Es un ajuste de quien lleva la app, no tuyo."
          : "Google no aceptó la prueba ahora mismo. Vuelve a probar en un momento.";
    return respuesta({ error: valida.motivo, porque }, valida.motivo === "no-registrado" ? 409 : 502, origen);
  }
  const espera = Number(entorno.ESPERA_PRUEBA_MS ?? ESPERA_PRUEBA_MS);
  const mandar = async () => {
    if (espera > 0) await new Promise((listo) => setTimeout(listo, espera));
    const r = await enviarAviso({
      ...fcmPrueba,
      destino: { token: ficha.token },
      datos: { ...datosPrueba, llamada: idDeLlamada() },
    });
    if (!r.ok) console.log("prueba:", r.detalle ?? r.motivo);
    return r;
  };
  // Se contesta ya y se manda después: el Worker puede seguir hasta 30 s tras
  // responder si se le pide con waitUntil. Sin ctx (las pruebas), en el acto.
  if (ctx?.waitUntil) {
    ctx.waitUntil(mandar().catch((e) => console.log("prueba:", e?.message ?? e)));
    return respuesta({ ok: true, segundos: Math.round(espera / 1000) }, 200, origen);
  }
  const r = await mandar().catch((e) => ({ ok: false, motivo: String(e?.message ?? e) }));
  return respuesta({ ok: r.ok, segundos: 0, motivo: r.ok ? undefined : r.motivo }, r.ok ? 200 : 502, origen);
}

export default {
  async fetch(peticion, entorno, ctx) {
    // En Workers el reloj se congela hasta la primera E/S: esto es la hora
    // exacta de llegada (para que el móvil mida su desfase como NTP).
    const llegada = Date.now();
    const origen = peticion.headers.get("Origin") ?? "";
    const ruta = new URL(peticion.url).pathname;

    // La hora, para que cada móvil corrija su reloj como NTP y «ver juntos»
    // vaya a la par. GET y sin cabeceras propias: el navegador no manda el
    // preflight, y la medida no lleva dentro el viaje de más que sí lleva la
    // primera petición (DNS, TLS, preflight), que va sólo a la ida.
    if (ruta === "/hora") {
      if (peticion.method !== "GET") return new Response("Sólo GET.", { status: 405 });
      return new Response(JSON.stringify({ llegada, ahora: Date.now() }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cabecerasCors(origen) },
      });
    }

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
    if (ruta === "/sono" || ruta === "/probar") {
      if (peticion.method !== "POST") {
        return respuesta({ error: "metodo", porque: "Sólo POST." }, 405, origen);
      }
      return ruta === "/sono" ? sono(peticion, entorno, origen) : probar(peticion, entorno, origen, ctx);
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
    if (!sigueAbierta(sala)) {
      // Un grupo cerrado no es el devocional cerrado: se dice distinto, y la
      // app devuelve a la sala principal en vez de dar la reunión por terminada.
      const cual = sala.tipo === "subgrupo" ? "grupo-terminado" : "sala-cerrada";
      return respuesta({ error: cual, porque: PORQUE[cual] }, 409, origen);
    }
    if (expulsado) {
      // Se dice sin rodeos y sin sermón. Quien está fuera merece saberlo.
      return respuesta({ error: "expulsado", porque: PORQUE.expulsado }, 403, origen);
    }

    // Un subgrupo es de sus miembros (y del anfitrión, que entra a escuchar).
    // Las reglas ya no dejan apuntarse en su lista a nadie más; esto cierra
    // además el canal de voz, que es lo que de verdad se oye.
    if (sala.tipo === "subgrupo") {
      if (sala.anfitrion !== uid && !(Array.isArray(sala.miembros) && sala.miembros.includes(uid))) {
        return respuesta({ error: "no-es-tu-grupo", porque: PORQUE["no-es-tu-grupo"] }, 403, origen);
      }
      // Pasada su hora (con dos minutos de margen), el grupo ya no renueva la
      // voz: quien se quedó con la pantalla apagada no factura cuatro horas.
      if (typeof sala.hasta === "number" && sala.hasta > 0 && Date.now() > sala.hasta + 120_000) {
        return respuesta({ error: "grupo-terminado", porque: PORQUE["grupo-terminado"] }, 409, origen);
      }
      // Y quien fue expulsado del devocional tampoco entra en sus grupos.
      if (typeof sala.padre === "string" && sala.padre) {
        let fuera = null;
        try {
          fuera = await leerDocumento(base, `salas/${sala.padre}/expulsados/${uid}`, token);
        } catch (e) {
          // Como las otras lecturas: sin poder comprobarlo, no se firma.
          console.log("firestore:", e?.message ?? e);
          return respuesta(
            { error: "sin-conexion", porque: "No se pudo comprobar la sala. Vuelve a probar." },
            502,
            origen,
          );
        }
        if (fuera) return respuesta({ error: "expulsado", porque: PORQUE.expulsado }, 403, origen);
      }
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
    //
    // Tres casos. El oyente: sólo entrar. El anfitrión: entrar y hablar una
    // hora. Quien habla sin ser el anfitrión (con la palabra, con los
    // micrófonos libres, en una llamada de dos): entrar una hora y hablar
    // PALABRA_SEGUNDOS, con privilegios separados — un solo plazo corto para
    // todo echaría del canal a quien no renovara a tiempo.
    const hablaPoco = habla && !esAnfitrion;
    const permiso = hablaPoco
      ? RtcTokenBuilder.BuildTokenWithUserAccountAndPrivilege(
          entorno.AGORA_APP_ID,
          entorno.AGORA_APP_CERTIFICATE,
          canal,
          uid,
          VALE_SEGUNDOS,
          VALE_SEGUNDOS,
          PALABRA_SEGUNDOS,
          PALABRA_SEGUNDOS,
          PALABRA_SEGUNDOS,
        )
      : RtcTokenBuilder.buildTokenWithUserAccount(
          entorno.AGORA_APP_ID,
          entorno.AGORA_APP_CERTIFICATE,
          canal,
          uid,
          habla ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
          VALE_SEGUNDOS,
          VALE_SEGUNDOS,
        );

    const ahora = Math.floor(Date.now() / 1000);
    return respuesta(
      {
        appId: entorno.AGORA_APP_ID,
        canal,
        cuenta: uid,
        token: permiso,
        habla,
        esAnfitrion,
        caduca: ahora + VALE_SEGUNDOS,
        // La hora de aquí, en milisegundos: con ella cada móvil corrige su
        // reloj para ver un video a la par que los demás («ver juntos»).
        ahora: Date.now(),
        llegada,
        // Cuándo deja de valer la palabra, para que la app sepa renovarla.
        ...(hablaPoco ? { caducaPalabra: ahora + PALABRA_SEGUNDOS } : {}),
      },
      200,
      origen,
    );
  },
};
