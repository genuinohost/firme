/**
 * Hacer sonar los móviles: mandar un aviso por Firebase Cloud Messaging.
 *
 * ── La llave, y por qué es la única de Google que hay aquí ────────────────
 *
 * Google exige que quien manda avisos se identifique con una cuenta de
 * servicio. Es la única credencial de Google que vive en este Worker, y está
 * **recortada** a propósito: `genuino-timbre@…` sólo puede enviar avisos.
 * No lee Firestore, no ve perfiles, no toca nada. Alex lo decidió así el
 * 27-09-2026, con el riesgo delante: lo peor que puede pasar si se filtra es
 * que alguien mande avisos falsos, y se revoca en un minuto.
 *
 * La clave entró por tubería directa a `wrangler secret put`: no se escribió
 * en disco ni se imprimió en ningún sitio.
 *
 * ── Cómo se usa ───────────────────────────────────────────────────────────
 *
 * Con la clave se firma un JWT (RS256, WebCrypto), se cambia por un token de
 * acceso en el endpoint de Google, y con ése se llama a FCM. El token vale una
 * hora y se guarda en memoria mientras el Worker viva.
 *
 * ── Por qué ahora a cada móvil, y no sólo al tema ─────────────────────────
 *
 * Hasta la 6.26 se llamaba con **un solo mensaje** al tema `devocional`, al
 * que cada móvil se apunta solo. Funcionaba a ciegas: Google acepta el aviso
 * aunque no le llegue a nadie, y «Llamando a 2» contaba la lista de Firestore,
 * no los móviles que sonaron. El 28-09-2026 Alex probó con dos amigos —«no
 * suena la llamada a mis amigos»— y no había forma de saber a cuál no llegó
 * ni por qué. Y Google lo dice claro: los temas están hechos para repartir a
 * muchos, no para llegar rápido; para pocos móviles y deprisa, token a token.
 *
 * Desde la 6.27 cada móvil guarda su token en su ficha de la comunidad (la
 * ven sólo él y quien modera) y el portero, leyendo con el token del que llama,
 * manda un aviso a cada uno y sabe qué contestó Google con cada uno. El tema
 * se sigue mandando, para los móviles con la app vieja; los nuevos reconocen
 * la misma llamada (`llamada`) y no suenan dos veces.
 */

function base64url(bytes) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemABytes(pem) {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let tokenGuardado = null;
let tokenHasta = 0;

/**
 * Un token de acceso de Google para la cuenta recortada.
 *
 * `cuentaJson` es el contenido del secreto `FCM_CUENTA`. `tokenUrl` se puede
 * cambiar para las pruebas, que levantan su propio endpoint de mentira: así el
 * código que corre en las pruebas es el mismo que corre de verdad.
 */
export async function tokenDeAcceso(cuentaJson, tokenUrl, ahora = Date.now()) {
  if (tokenGuardado && ahora < tokenHasta) return tokenGuardado;

  const cuenta = JSON.parse(cuentaJson);
  const segundos = Math.floor(ahora / 1000);

  const cabecera = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const cuerpo = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: cuenta.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: tokenUrl,
        iat: segundos,
        exp: segundos + 3600,
      }),
    ),
  );

  const clave = await crypto.subtle.importKey(
    "pkcs8",
    pemABytes(cuenta.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    clave,
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`;

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`google-no-dio-token-${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("google-dio-token-vacio");

  tokenGuardado = j.access_token;
  // Cinco minutos antes de que caduque, para no usar uno a punto de morir.
  tokenHasta = ahora + (Number(j.expires_in ?? 3600) - 300) * 1000;
  return tokenGuardado;
}

/** Sólo para las pruebas: olvidar el token entre una y otra. */
export function olvidarToken() {
  tokenGuardado = null;
  tokenHasta = 0;
}

/**
 * Manda un aviso de datos a un tema o a UN móvil, y dice qué contestó Google.
 *
 * Es un mensaje **de datos, sin parte visible**: lo recibe el servicio nativo
 * de la app aunque esté cerrada y es él quien hace sonar y enseña la pantalla
 * de llamada. Si fuera una notificación normal, Android la pintaría él solo
 * como un avisito silencioso, que es justo lo que no se quiere a las tres de
 * la mañana. Caducidad corta: una llamada de hace veinte minutos ya no es una
 * llamada.
 *
 * No lanza por lo que conteste Google: devuelve `{ ok, motivo }`, porque con
 * treinta móviles uno caducado no puede tumbar la llamada de los otros
 * veintinueve. Sí lanza si no hay token de acceso (eso tumba todos por igual).
 *
 * - `no-registrado`: ese móvil ya no existe para Google (desinstaló, borró
 *   datos o estrenó teléfono). No se arregla reintentando: abriendo la app.
 * - `sin-permiso`: a la cuenta del timbre le falta el rol de enviar.
 * - `fallo`: cualquier otra cosa (cuota, Google caído).
 */
export async function enviarAviso({ fcmUrl, tokenUrl, cuentaJson, destino, datos, prioridad = "high", soloValidar = false }) {
  const token = await tokenDeAcceso(cuentaJson, tokenUrl);
  let r;
  try {
    r = await fetch(fcmUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // `validate_only`: Google comprueba todo (permiso, token) sin mandar nada.
        ...(soloValidar ? { validate_only: true } : {}),
        message: {
          ...destino,
          data: datos,
          android: { priority: prioridad, ttl: "600s" },
        },
      }),
    });
  } catch (e) {
    return { ok: false, motivo: "fallo", detalle: String(e?.message ?? e).slice(0, 200) };
  }
  if (r.ok) return { ok: true, id: (await r.json().catch(() => ({})))?.name ?? "" };
  const texto = await r.text().catch(() => "");
  // UNREGISTERED llega como 404; un token mal formado o de otra instalación,
  // como 400 INVALID_ARGUMENT o 403 SENDER_ID_MISMATCH. Para quien llama es
  // lo mismo: ese móvil no está.
  const noEsta =
    r.status === 404 ||
    /UNREGISTERED|SENDER_ID_MISMATCH/.test(texto) ||
    (r.status === 400 && "token" in destino && /registration token/i.test(texto));
  const motivo = noEsta ? "no-registrado" : r.status === 403 ? "sin-permiso" : "fallo";
  return { ok: false, motivo, estado: r.status, detalle: `fcm-${r.status}: ${texto.slice(0, 200)}` };
}

/**
 * Manda el aviso de «te llaman al devocional» a todos los del tema. Lanza si
 * Google no lo acepta (así lo espera quien lo usa).
 */
export async function llamarAlTema({ fcmUrl, tokenUrl, cuentaJson, tema, datos }) {
  const r = await enviarAviso({ fcmUrl, tokenUrl, cuentaJson, destino: { topic: tema }, datos });
  if (!r.ok) throw new Error(r.detalle ?? r.motivo);
  return r.id;
}

// ── La vuelta: «a Pepa le sonó» ───────────────────────────────────────────
//
// Cada móvil al que se llama recibe, dentro del aviso, una «vuelta» cifrada:
// quién llama (su token de FCM), a quién se llamó y hasta cuándo vale. Cuando
// el móvil suena, la devuelve al portero y el portero avisa al que llamó.
//
// Así el portero no guarda nada —no hay base de datos en el Worker— y nadie
// puede inventarse un «me sonó» de otro: la vuelta va cifrada y autenticada
// (AES-GCM) con TIMBRE_CLAVE, que sólo tiene el Worker. Y el token del que
// llama no queda a la vista de los que reciben la llamada.

async function claveDeVuelta(secreto) {
  const bruto = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vuelta:${secreto}`));
  return crypto.subtle.importKey("raw", bruto, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function deBase64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Cierra la vuelta: un texto opaco para meter en el aviso. */
export async function cerrarVuelta(secreto, contenido) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await claveDeVuelta(secreto),
    new TextEncoder().encode(JSON.stringify(contenido)),
  );
  const junto = new Uint8Array(12 + cifrado.byteLength);
  junto.set(iv, 0);
  junto.set(new Uint8Array(cifrado), 12);
  return base64url(junto);
}

/** Abre una vuelta. Lanza si no la cerró este Worker o si la tocaron. */
export async function abrirVuelta(secreto, vuelta) {
  const junto = deBase64url(vuelta);
  if (junto.length < 13) throw new Error("vuelta-corta");
  const claro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: junto.slice(0, 12) },
    await claveDeVuelta(secreto),
    junto.slice(12),
  );
  return JSON.parse(new TextDecoder().decode(claro));
}
