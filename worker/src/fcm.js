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
 * ── Por qué a un tema y no a cada móvil ───────────────────────────────────
 *
 * Cada móvil que entra a la comunidad se apunta él mismo al tema `devocional`
 * (lo hace el propio teléfono, sin servidor). Llamar es **un solo mensaje** al
 * tema; Google lo reparte a miles. Aquí no se guarda ningún token de nadie, y
 * no hace falta leer nada para saber a quién mandar.
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
 * Manda el aviso de «te llaman al devocional» a todos los del tema.
 *
 * Es un mensaje **de datos, sin parte visible**: lo recibe el servicio nativo
 * de la app aunque esté cerrada y es él quien hace sonar y enseña la pantalla
 * de llamada. Si fuera una notificación normal, Android la pintaría él solo
 * como un avisito silencioso, que es justo lo que no se quiere a las tres de
 * la mañana. Prioridad alta y sin caducidad larga: una llamada de hace veinte
 * minutos ya no es una llamada.
 */
export async function llamarAlTema({ fcmUrl, tokenUrl, cuentaJson, tema, datos }) {
  const token = await tokenDeAcceso(cuentaJson, tokenUrl);
  const r = await fetch(fcmUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        topic: tema,
        data: datos,
        android: { priority: "high", ttl: "600s" },
      },
    }),
  });
  if (!r.ok) {
    const texto = await r.text().catch(() => "");
    throw new Error(`fcm-${r.status}: ${texto.slice(0, 200)}`);
  }
  return (await r.json())?.name ?? "";
}
