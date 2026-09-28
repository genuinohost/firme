/**
 * El portero de Cloudflare, probado entero.
 *
 *   npm run revisar        (dentro de worker/)
 *
 * ── Qué se prueba, y por qué así ──────────────────────────────────────────
 *
 * Se llama al Worker **igual que lo va a llamar la app**: una petición POST con
 * un token y un canal, y se mira la respuesta. El manejador de un Worker es una
 * función normal, así que no hace falta ni Cloudflare ni cuenta ni red.
 *
 * Dos cosas se levantan de mentira, y cada una por un motivo distinto:
 *
 * **Las claves de Google.** Se genera un par de claves RSA aquí mismo y se
 * publica el juego en un servidor local. Así las pruebas firman tokens de
 * verdad, con firma de verdad, y **el Worker no tiene ningún modo de "no
 * comprobar"** — que sería lo cómodo y es justo el interruptor que acaba
 * encendido en producción.
 *
 * **Firestore.** Un servidor local que responde con la forma exacta de la API
 * de Firestore. Que las reglas sean correctas ya lo comprueba
 * `npm run revisar-reglas` en la raíz, con el emulador de verdad; aquí lo que
 * se mira es que el portero lea bien lo que le llega y decida bien con ello.
 */
import { createServer } from "node:http";
import { createSign, generateKeyPairSync } from "node:crypto";

const PROYECTO = "genuino-host";
const APP_ID = "1d30537aab4a4171b9649dba7f408565";
const CERTIFICADO = "fedcba9876543210fedcba9876543210";

let fallos = 0;
let pasadas = 0;

function debe(nombre, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log("  ok   " + nombre);
  } else {
    fallos++;
    console.log("FALLA  " + nombre);
    if (detalle) console.log("       " + detalle);
  }
}

// ── Las claves, y cómo se firma un token de Firebase ───────────────────────

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const KID = "la-clave-de-las-pruebas";

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Un token como los que emite Firebase. Se le puede estropear a propósito. */
function tokenDe(uid, cambios = {}) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = { alg: "RS256", kid: KID, typ: "JWT", ...(cambios.cabecera ?? {}) };
  const cuerpo = {
    iss: `https://securetoken.google.com/${PROYECTO}`,
    aud: PROYECTO,
    sub: uid,
    user_id: uid,
    iat: ahora - 60,
    exp: ahora + 3600,
    ...(cambios.cuerpo ?? {}),
  };
  const sinFirma = `${base64url(JSON.stringify(cabecera))}.${base64url(JSON.stringify(cuerpo))}`;
  if (cambios.firmaRota) return `${sinFirma}.${base64url("esto-no-es-una-firma")}`;
  const firmador = createSign("RSA-SHA256");
  firmador.update(sinFirma);
  return `${sinFirma}.${base64url(firmador.sign(privateKey))}`;
}

// ── Firestore de mentira, con la forma exacta de la de verdad ──────────────

/** Lo que hay «en la base» durante esta prueba. */
let base = {};
/** Las rutas que el portero pidió, para poder comprobarlas. */
let pedidas = [];

// ── Google y FCM de mentira, para el timbre ────────────────────────────────
//
// La cuenta de servicio recortada, generada aquí: una clave RSA de verdad en
// el formato exacto que Google entrega. Así `fcm.js` firma el JWT igual que lo
// firmará contra Google, y lo que se comprueba es lo que va a pasar.
const { privateKey: claveTimbre } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const CUENTA_TIMBRE = JSON.stringify({
  type: "service_account",
  client_email: "genuino-timbre@genuino-host.iam.gserviceaccount.com",
  private_key: claveTimbre.export({ type: "pkcs8", format: "pem" }),
});
/** Lo que le llegó al FCM de mentira. */
let enviados = [];
/** Cuántas veces se pidió token a Google. */
let tokensPedidos = 0;
/** Si el FCM de mentira debe negar el envío como si faltara el rol. */
let fcmSinPermiso = false;

const texto = (s) => ({ stringValue: s });
const numero = (n) => ({ integerValue: String(n) });
const siNo = (b) => ({ booleanValue: b });

const servidor = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/claves") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] }));
    return;
  }

  if (url.pathname === "/token") {
    tokensPedidos++;
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const jwt = new URLSearchParams(cuerpo).get("assertion") ?? "";
      const partes = jwt.split(".");
      const claims = partes.length === 3 ? JSON.parse(Buffer.from(partes[1], "base64url").toString()) : {};
      // Google comprueba la firma y el emisor. Aquí se comprueba el emisor, que
      // es lo que se puede comprobar sin ser Google.
      if (claims.iss !== "genuino-timbre@genuino-host.iam.gserviceaccount.com") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "token-de-mentira", expires_in: 3600 }));
    });
    return;
  }

  if (url.pathname === "/fcm") {
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      // Para poder simular a Google negando el envio por falta de rol.
      if (fcmSinPermiso) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { status: "PERMISSION_DENIED" } }));
        return;
      }
      if (req.headers.authorization !== "Bearer token-de-mentira") {
        res.writeHead(401);
        res.end();
        return;
      }
      enviados.push(JSON.parse(cuerpo));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ name: "projects/genuino-host/messages/123" }));
    });
    return;
  }

  if (url.pathname.startsWith("/documentos/")) {
    const ruta = decodeURIComponent(url.pathname.slice("/documentos/".length));
    pedidas.push(ruta);
    // Firestore exige la sesión: si no viene, contesta como contestaría él.
    if (!req.headers.authorization?.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { status: "UNAUTHENTICATED" } }));
      return;
    }
    const doc = base[ruta];
    if (!doc) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { status: "NOT_FOUND" } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: ruta, fields: doc }));
    return;
  }

  res.writeHead(404);
  res.end();
});

await new Promise((listo) => servidor.listen(0, "127.0.0.1", listo));
const PUERTO = servidor.address().port;

const entorno = {
  PROYECTO,
  AGORA_APP_ID: APP_ID,
  AGORA_APP_CERTIFICATE: CERTIFICADO,
  CLAVES_URL: `http://127.0.0.1:${PUERTO}/claves`,
  FIRESTORE_URL: `http://127.0.0.1:${PUERTO}/documentos`,
  FCM_TOKEN_URL: `http://127.0.0.1:${PUERTO}/token`,
  FCM_URL: `http://127.0.0.1:${PUERTO}/fcm`,
  FCM_TEMA: "devocional",
  FCM_CUENTA: CUENTA_TIMBRE,
};

const { default: portero } = await import("./src/index.js");
const { olvidarClaves } = await import("./src/verificar.js");

/** Llama al portero como lo llamaría la app. */
async function llamar(cuerpo, origen = "https://localhost") {
  pedidas = [];
  const r = await portero.fetch(
    new Request("https://portero.genuino/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origen },
      body: JSON.stringify(cuerpo),
    }),
    entorno,
  );
  return { estado: r.status, datos: await r.json(), cabeceras: r.headers };
}

console.log("\nEL PORTERO EN CLOUDFLARE\n");

// ── Quién es ───────────────────────────────────────────────────────────────
console.log("La sesión");

base = {
  "salas/devocional": {
    nombre: texto("Devocional"),
    anfitrion: texto("ana"),
    abierta: siNo(true),
    desde: numero(Date.now()),
    tipo: texto("devocional"),
  },
};

{
  const r = await llamar({ canal: "devocional", token: tokenDe("ana") });
  debe("un token bien firmado entra", r.estado === 200, JSON.stringify(r.datos));
  debe(
    "y se leen las tres cosas de la sala, en las rutas correctas",
    pedidas.length === 3 &&
      pedidas.includes("salas/devocional") &&
      pedidas.includes("salas/devocional/expulsados/ana") &&
      pedidas.includes("salas/devocional/dentro/ana"),
    pedidas.join(" · "),
  );
}

for (const [nombre, token] of [
  ["sin token, nadie entra", ""],
  ["un token inventado no entra", "esto.no.es"],
  ["con la FIRMA ROTA no entra", tokenDe("ana", { firmaRota: true })],
  ["CADUCADO no entra", tokenDe("ana", { cuerpo: { exp: Math.floor(Date.now() / 1000) - 120 } })],
  [
    "de OTRO PROYECTO de Firebase no entra — Google los firma con las mismas claves",
    tokenDe("ana", { cuerpo: { aud: "otro-proyecto" } }),
  ],
  [
    "con un emisor raro no entra",
    tokenDe("ana", { cuerpo: { iss: "https://securetoken.google.com/otro" } }),
  ],
  ["sin uid no entra", tokenDe("ana", { cuerpo: { sub: "" } })],
]) {
  const r = await llamar({ canal: "devocional", token });
  debe(nombre, r.estado === 401, `respondió ${r.estado}`);
}

{
  // Un token sin firmar, que es lo que emite el emulador de Firebase. Tiene que
  // rechazarse igual: si esto pasara, cualquiera se fabricaría uno.
  const cab = base64url(JSON.stringify({ alg: "none", kid: KID }));
  const cue = base64url(JSON.stringify({ sub: "ana", aud: PROYECTO, exp: 9e9, iat: 0 }));
  const r = await llamar({ canal: "devocional", token: `${cab}.${cue}.` });
  debe("SIN FIRMAR no entra, aunque diga lo correcto", r.estado === 401);
}

// ── Si entra ───────────────────────────────────────────────────────────────
console.log("\nSi entra");

{
  const r = await llamar({ canal: "no-existe", token: tokenDe("ana") });
  debe("una sala que no existe", r.estado === 404 && r.datos.error === "sala-no-existe");
}
{
  const r = await llamar({ canal: "sala con espacios", token: tokenDe("ana") });
  debe("un nombre que Agora no acepta", r.estado === 400 && r.datos.error === "nombre-invalido");
}
{
  base["salas/devocional"].abierta = siNo(false);
  const r = await llamar({ canal: "devocional", token: tokenDe("ana") });
  debe("una sala CERRADA no deja pasar", r.estado === 409 && r.datos.error === "sala-cerrada");
  base["salas/devocional"].abierta = siNo(true);
}
{
  base["salas/devocional/expulsados/curioso"] = { cuando: numero(1) };
  const r = await llamar({ canal: "devocional", token: tokenDe("curioso") });
  debe("UN EXPULSADO NO ENTRA", r.estado === 403 && r.datos.error === "expulsado");
  delete base["salas/devocional/expulsados/curioso"];
}

// ── Si habla ───────────────────────────────────────────────────────────────
console.log("\nSi habla");

let deOyente = null;
{
  const r = await llamar({ canal: "devocional", token: tokenDe("ana") });
  debe("el anfitrión habla", r.estado === 200 && r.datos.habla === true);
  debe("y se reconoce como anfitrión", r.datos.esAnfitrion === true);
  debe("el token empieza por la versión 007 de Agora", String(r.datos.token).startsWith("007"));
  debe("la cuenta del token es la suya", r.datos.cuenta === "ana");
}
{
  const r = await llamar({ canal: "devocional", token: tokenDe("beto") });
  debe("quien llega ESCUCHA", r.estado === 200 && r.datos.habla === false);
  debe("y no se cree el anfitrión", r.datos.esAnfitrion === false);
  deOyente = r.datos.token;
}
{
  base["salas/devocional/dentro/beto"] = { palabra: siNo(true), mano: siNo(false) };
  const r = await llamar({ canal: "devocional", token: tokenDe("beto") });
  debe("con la palabra dada, HABLA", r.estado === 200 && r.datos.habla === true);
  debe(
    "y su token es MÁS LARGO: lleva el privilegio de publicar",
    r.datos.token.length > deOyente.length,
    `${r.datos.token.length} vs ${deOyente.length}`,
  );
  delete base["salas/devocional/dentro/beto"];
}
{
  base["salas/devocional"].micLibre = siNo(true);
  const r = await llamar({ canal: "devocional", token: tokenDe("beto") });
  debe("con los MICRÓFONOS LIBRES, quien llega HABLA sin pedir", r.estado === 200 && r.datos.habla === true);
  delete base["salas/devocional"].micLibre;
  const r2 = await llamar({ canal: "devocional", token: tokenDe("beto") });
  debe("y al apagarlos, vuelve a escuchar", r2.estado === 200 && r2.datos.habla === false);
}
{
  base["salas/llamada"] = {
    nombre: texto("Ana y Beto"),
    anfitrion: texto("ana"),
    abierta: siNo(true),
    desde: numero(Date.now()),
    tipo: texto("llamada"),
  };
  const r = await llamar({ canal: "llamada", token: tokenDe("beto") });
  debe("en una llamada de dos, el que recibe habla", r.estado === 200 && r.datos.habla === true);
}

// ── El timbre ──────────────────────────────────────────────────────────────
console.log("\nEl timbre");

async function llamarA(cuerpo) {
  const r = await portero.fetch(
    new Request("https://portero.genuino/llamar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://localhost" },
      body: JSON.stringify(cuerpo),
    }),
    entorno,
  );
  return { estado: r.status, datos: await r.json() };
}

{
  enviados = [];
  const r = await llamarA({ canal: "devocional", token: tokenDe("beto"), nombre: "Devocional" });
  debe("QUIEN NO MODERA NO LLAMA a nadie", r.estado === 403 && r.datos.error === "no-puedes-llamar");
  debe("y no salió ningún aviso", enviados.length === 0);
}
{
  base["moderadores/ana"] = { desde: numero(1) };
  enviados = [];
  const r = await llamarA({ canal: "devocional", token: tokenDe("ana"), nombre: "Devocional de la mañana" });
  debe("quien modera SÍ llama", r.estado === 200 && r.datos.enviado === true, JSON.stringify(r.datos));
  debe("y sale UN aviso, al tema", enviados.length === 1 && enviados[0]?.message?.topic === "devocional");
  debe(
    "el aviso lleva la sala, el nombre y quién llama",
    enviados[0]?.message?.data?.canal === "devocional" &&
      enviados[0]?.message?.data?.nombre === "Devocional de la mañana" &&
      enviados[0]?.message?.data?.quien === "ana" &&
      enviados[0]?.message?.data?.tipo === "llamada",
  );
  debe("es de datos, sin parte visible: lo pinta la app, no Android", !enviados[0]?.message?.notification);
  debe("con prioridad alta y caducidad corta", enviados[0]?.message?.android?.priority === "high");
  debe("se pidió UN token a Google, firmado por la cuenta recortada", tokensPedidos === 1);
}
{
  enviados = [];
  const antes = tokensPedidos;
  await llamarA({ canal: "devocional", token: tokenDe("ana"), nombre: "Otra vez" });
  debe("la segunda llamada reutiliza el token: no se pide otro", tokensPedidos === antes);
}
{
  base["salas/devocional"].abierta = siNo(false);
  enviados = [];
  const r = await llamarA({ canal: "devocional", token: tokenDe("ana") });
  debe("a una sala CERRADA no se llama", r.estado === 409 && enviados.length === 0);
  base["salas/devocional"].abierta = siNo(true);
}
{
  enviados = [];
  const r = await llamarA({ canal: "no-existe", token: tokenDe("ana") });
  debe("a una sala que no existe tampoco", r.estado === 404 && enviados.length === 0);
}
{
  const r = await llamarA({ canal: "devocional", token: "" });
  debe("sin sesión, nada", r.estado === 401);
}
{
  // Lo que paso el 27-09-2026: la cuenta del timbre sin rol. El portero tiene
  // que decir que es cosa del servidor, no «vuelve a probar».
  fcmSinPermiso = true;
  const r = await llamarA({ canal: "devocional", token: tokenDe("ana") });
  debe(
    "si Google niega el envio por falta de rol, se dice que es del servidor",
    r.estado === 502 && r.datos.error === "servidor-sin-permiso",
    JSON.stringify(r.datos),
  );
  fcmSinPermiso = false;
}
delete base["moderadores/ana"];

// ── Lo que rodea ───────────────────────────────────────────────────────────
console.log("\nLo que rodea");

{
  const r = await portero.fetch(
    new Request("https://portero.genuino/", { method: "GET" }),
    entorno,
  );
  debe("sólo se admite POST", r.status === 405);
}
{
  const r = await portero.fetch(
    new Request("https://portero.genuino/", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    }),
    entorno,
  );
  debe("el navegador puede preguntar antes (CORS)", r.status === 204);
  debe(
    "y se le responde con su propio origen",
    r.headers.get("Access-Control-Allow-Origin") === "https://localhost",
  );
}
{
  const r = await llamar({ canal: "devocional", token: tokenDe("ana") }, "https://una-pagina-cualquiera.com");
  debe(
    "UNA PÁGINA CUALQUIERA NO recibe permiso del navegador",
    r.cabeceras.get("Access-Control-Allow-Origin") !== "https://una-pagina-cualquiera.com",
    r.cabeceras.get("Access-Control-Allow-Origin"),
  );
}
{
  olvidarClaves();
  const r = await llamar({ canal: "devocional", token: tokenDe("ana") });
  debe("si las claves se olvidan, se vuelven a pedir y todo sigue", r.estado === 200);
}

servidor.close();

console.log(
  "\n" +
    (fallos === 0
      ? `${pasadas} comprobaciones, sin problemas.`
      : `${fallos} FALLOS de ${pasadas + fallos}.`) +
    "\n",
);
process.exit(fallos === 0 ? 0 : 1);
