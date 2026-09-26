/**
 * Comprobar que quien llama es quien dice ser.
 *
 * ── Por qué está escrito a mano ───────────────────────────────────────────
 *
 * En una Cloud Function de Firebase esto no existe: la plataforma comprueba la
 * sesión y te da el `uid` hecho. Fuera de Firebase hay que hacerlo, y **es la
 * pieza que sostiene todo lo demás**: si esto acepta un token falso, cualquiera
 * entra en cualquier devocional a nombre de cualquiera.
 *
 * Un token de Firebase es un JWT firmado por Google con RS256. Comprobarlo es:
 *
 *   1. leer el `kid` de la cabecera,
 *   2. buscar esa clave pública en el juego de claves que Google publica,
 *   3. comprobar la firma sobre `cabecera.cuerpo`,
 *   4. y comprobar el contenido: quién lo emitió, para quién, y que no caducó.
 *
 * Los cuatro pasos hacen falta. **Comprobar la firma y no el contenido no vale
 * de nada**: Google firma los tokens de todos sus proyectos con las mismas
 * claves, así que un token legítimo de un proyecto ajeno pasaría la firma. Por
 * eso `iss` y `aud` se comparan contra el proyecto, y no es una formalidad.
 *
 * ── Y por qué no hay un modo «no comprobar» ───────────────────────────────
 *
 * Sería lo cómodo para las pruebas, y es justo la clase de interruptor que
 * acaba encendido en producción. En vez de eso, **de dónde salen las claves es
 * configurable**: las pruebas levantan su propio juego de claves y firman sus
 * propios tokens. El código que corre en las pruebas es el mismo que corre de
 * verdad, sin ramas.
 */

/**
 * Las claves de Google, guardadas un rato.
 *
 * Google las rota más o menos a diario y el juego trae varias a la vez para que
 * la rotación no corte a nadie. Pedirlas en cada llamada sería una petición de
 * red por cada persona que entra a un devocional; guardarlas para siempre sería
 * quedarse fuera el día que roten.
 */
let guardadas = null;
let guardadasHasta = 0;

/** Cuánto se fía uno de las claves guardadas. Una hora. */
const DURAN_MS = 3600_000;

async function clavesDe(url, ahora) {
  if (guardadas && ahora < guardadasHasta) return guardadas;
  const r = await fetch(url);
  if (!r.ok) throw new Error("no se pudieron leer las claves de Google");
  const j = await r.json();
  // El formato de Google es `{ keys: [...] }` (JWK). Se indexa por `kid`.
  const porKid = {};
  for (const k of j.keys ?? []) if (k.kid) porKid[k.kid] = k;
  guardadas = porKid;
  guardadasHasta = ahora + DURAN_MS;
  return porKid;
}

/** Sólo para las pruebas: olvidar lo guardado entre una y otra. */
export function olvidarClaves() {
  guardadas = null;
  guardadasHasta = 0;
}

function deBase64Url(texto) {
  const normal = texto.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  const binario = atob(relleno);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function json(bytes) {
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Devuelve el `uid` de quien manda el token, o lanza con un motivo.
 *
 * Los motivos son cortos y en clave —`caducado`, `otro-proyecto`— porque van al
 * registro, no a una persona. Quien los traduce es la app.
 */
export async function uidDelToken(token, { proyecto, clavesUrl, ahora = Date.now() }) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new Error("token-mal-formado");
  }
  const [cab64, cuerpo64, firma64] = token.split(".");

  const cabecera = json(deBase64Url(cab64));
  if (cabecera.alg !== "RS256") throw new Error("algoritmo-no-admitido");
  if (!cabecera.kid) throw new Error("token-sin-kid");

  const claves = await clavesDe(clavesUrl, ahora);
  const jwk = claves[cabecera.kid];
  // Que falte la clave suele significar que rotaron y lo guardado está viejo.
  // Se pide otra vez antes de rendirse.
  let clave = jwk;
  if (!clave) {
    olvidarClaves();
    clave = (await clavesDe(clavesUrl, ahora))[cabecera.kid];
  }
  if (!clave) throw new Error("clave-desconocida");

  const publica = await crypto.subtle.importKey(
    "jwk",
    { kty: clave.kty, n: clave.n, e: clave.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const vale = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publica,
    deBase64Url(firma64),
    new TextEncoder().encode(`${cab64}.${cuerpo64}`),
  );
  if (!vale) throw new Error("firma-invalida");

  const cuerpo = json(deBase64Url(cuerpo64));
  const segundos = Math.floor(ahora / 1000);

  // Treinta segundos de margen por si los relojes no coinciden. Sin esto, un
  // móvil con la hora ligeramente adelantada se queda fuera de su devocional.
  const MARGEN = 30;
  if (typeof cuerpo.exp !== "number" || cuerpo.exp + MARGEN < segundos) {
    throw new Error("caducado");
  }
  if (typeof cuerpo.iat !== "number" || cuerpo.iat - MARGEN > segundos) {
    throw new Error("del-futuro");
  }
  // Lo que impide que valga un token legítimo de OTRO proyecto de Firebase.
  if (cuerpo.aud !== proyecto) throw new Error("otro-proyecto");
  if (cuerpo.iss !== `https://securetoken.google.com/${proyecto}`) {
    throw new Error("emisor-raro");
  }
  if (typeof cuerpo.sub !== "string" || cuerpo.sub.length === 0) {
    throw new Error("sin-uid");
  }

  return cuerpo.sub;
}
