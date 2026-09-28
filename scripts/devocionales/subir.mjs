/**
 * Sube el archivo de devocionales a Firestore, sólo para la comunidad.
 *
 *   node scripts/devocionales/subir.mjs            (todo lo de privado/devocionales)
 *   node scripts/devocionales/subir.mjs 272 273    (sólo esos días)
 *   node scripts/devocionales/subir.mjs --orden    (además, el orden de lectura)
 *
 * Lee lo que dejó `extraer-chat.mjs` y lo escribe en
 * `devocionales/caminemos-2026/dias/{N}`, que según las reglas sólo leen los
 * miembros de la comunidad y quien modera. Va con la cuenta de servicio, como
 * `moderador.mjs`: desde la app nadie puede escribir ahí.
 *
 * Con `--orden` siembra además `comunidad/voz/lectura/orden` con la última
 * lista del grupo (el «ORDEN DE LECTURA BÍBLICA DE HOY») y el ancla del
 * comentario: quién comentó el último día apuntado. Sin cuentas de la app:
 * esas las vincula quien modera desde la app, una a una. Si ya había un orden,
 * NO se pisa salvo con `--orden --pisar`.
 */
import { createSign } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PLAN = "caminemos-2026";
const DIR = "privado/devocionales";
const CLAVE = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? join(homedir(), ".firebase", "genuino-despliegue.json");

if (!existsSync(CLAVE)) {
  console.error("No hay cuenta de servicio en " + CLAVE);
  process.exit(1);
}
if (!existsSync(DIR)) {
  console.error(`No está ${DIR}. Antes: node scripts/devocionales/extraer-chat.mjs "<chat>"`);
  process.exit(1);
}

// La clave no se imprime nunca, ni entera ni en trozos.
const cuenta = JSON.parse(readFileSync(CLAVE, "utf8"));
const PROYECTO = cuenta.project_id;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

const base64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let guardado = null;
async function token() {
  if (guardado && guardado.hasta > Date.now()) return guardado.token;
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      exp: ahora + 3600,
      iat: ahora,
    }),
  );
  const firma = createSign("RSA-SHA256")
    .update(`${cabecera}.${cuerpo}`)
    .sign(cuenta.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecera}.${cuerpo}.${firma}`,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("No se pudo obtener el token de Google.");
  guardado = { token: d.access_token, hasta: Date.now() + 50 * 60_000 };
  return guardado.token;
}

/** Un valor de JavaScript en el formato de la API REST de Firestore. */
function valor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: campos(v) } };
}
function campos(o) {
  const f = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = valor(v);
  return f;
}

async function escribir(ruta, datos) {
  const r = await fetch(`${DOCS}/${ruta}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: campos(datos) }),
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function existe(ruta) {
  const r = await fetch(`${DOCS}/${ruta}`, { headers: { Authorization: `Bearer ${await token()}` } });
  return r.ok;
}

// ── Los días ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const soloDias = args.filter((a) => /^\d+$/.test(a)).map(Number);
const archivos = readdirSync(DIR)
  .filter((f) => /^dia-\d{3}\.json$/.test(f))
  .filter((f) => !soloDias.length || soloDias.includes(Number(f.slice(4, 7))));

let hechos = 0;
const cola = [...archivos];
async function trabajador() {
  while (cola.length) {
    const f = cola.shift();
    const d = JSON.parse(readFileSync(join(DIR, f), "utf8"));
    await escribir(`devocionales/${PLAN}/dias/${d.dia}`, {
      dia: d.dia,
      fecha: d.fecha ?? "",
      tema: d.tema ?? "",
      capitulos: d.capitulos ?? [],
      trozos: d.trozos.map((t) => ({ tipo: t.tipo, ref: t.ref, texto: t.texto })),
      aprendi: d.aprendi ?? "",
      alerta: d.alerta ?? "",
      subido: Date.now(),
    });
    hechos++;
    if (hechos % 25 === 0) console.log(`  ${hechos}/${archivos.length}`);
  }
}
await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
console.log(`Días subidos: ${hechos} a devocionales/${PLAN}/dias/`);

// ── El orden de lectura ────────────────────────────────────────────────────
if (args.includes("--orden")) {
  const ruta = "comunidad/voz/lectura/orden";
  if ((await existe(ruta)) && !args.includes("--pisar")) {
    console.log("El orden de lectura ya existe: no se pisa (usa --pisar si de verdad quieres).");
  } else {
    const { ordenes, comentarios } = JSON.parse(readFileSync(join(DIR, "orden-de-lectura.json"), "utf8"));
    const ultima = ordenes.at(-1);
    const lista = ultima.lista.map((e, i) => ({ id: `e${i + 1}`, nombre: e.nombre }));
    const hoy = comentarios.filter((c) => c.cuando === "hoy").at(-1);
    const puesto = lista.findIndex((e) => e.nombre === hoy?.nombre);
    if (puesto < 0) throw new Error(`No encuentro a «${hoy?.nombre}» en la lista para anclar el comentario.`);
    await escribir(ruta, { lista, ancla: { fecha: hoy.fecha, puesto }, actualizado: Date.now() });
    console.log(`Orden de lectura: ${lista.length} personas; el ${hoy.fecha} comentó ${hoy.nombre} (puesto ${puesto + 1}).`);
  }
}
