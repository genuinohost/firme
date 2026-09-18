/**
 * Leer los avisos de fallos que mandan los hermanos, con sus capturas.
 *
 * Nadie puede leerlos desde la app: las reglas sólo dejan escribir. Esto va con
 * la cuenta de servicio, que se las salta.
 *
 *   node scripts/fallos.mjs            los últimos 20, con su parte técnico
 *   node scripts/fallos.mjs 50         los últimos 50
 *   node scripts/fallos.mjs borrar <id>
 *
 * Las capturas se guardan en `docs/fallos/<id>-N.jpg` para poder mirarlas.
 */
import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAVE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  join(homedir(), ".firebase", "genuino-despliegue.json");

if (!existsSync(CLAVE)) {
  console.error("No hay cuenta de servicio en " + CLAVE);
  process.exit(1);
}

const cuenta = JSON.parse(readFileSync(CLAVE, "utf8"));
const P = cuenta.project_id;

const b64 = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function token() {
  const t = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const c = b64(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: t + 3600,
      iat: t,
    }),
  );
  const f = createSign("RSA-SHA256")
    .update(`${h}.${c}`)
    .sign(cuenta.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${h}.${c}.${f}`,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("token: " + JSON.stringify(d));
  return d.access_token;
}

const T = await token();
const DOCS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const api = async (ruta, opciones = {}) => {
  const r = await fetch(`${DOCS}/${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${T}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : {};
};

const [uno, dos] = process.argv.slice(2);

if (uno === "borrar") {
  if (!dos) {
    console.error("Falta el identificador del aviso.");
    process.exit(1);
  }
  // Las capturas primero: borrar el padre no se lleva la subcolección.
  const caps = await api(`fallos/${dos}/capturas`).catch(() => ({}));
  for (const c of caps.documents ?? []) {
    await api(`fallos/${dos}/capturas/${c.name.split("/").pop()}`, { method: "DELETE" });
  }
  await api(`fallos/${dos}`, { method: "DELETE" });
  console.log(`\nAviso ${dos} borrado, con sus capturas.\n`);
  process.exit(0);
}

const cuantos = Number(uno) || 20;
const d = await api("fallos");
const avisos = (d.documents ?? [])
  .map((f) => ({
    id: f.name.split("/").pop(),
    texto: f.fields?.texto?.stringValue ?? "",
    parte: f.fields?.parte?.stringValue ?? "",
    cuando: Number(f.fields?.cuando?.integerValue ?? f.fields?.cuando?.doubleValue ?? 0),
  }))
  .sort((a, b) => b.cuando - a.cuando)
  .slice(0, cuantos);

if (avisos.length === 0) {
  console.log("\nNo hay ningún aviso de fallo.\n");
  process.exit(0);
}

const CARPETA = "docs/fallos";
mkdirSync(CARPETA, { recursive: true });

console.log(`\n${avisos.length} aviso(s), del más nuevo al más viejo\n`);

for (const a of avisos) {
  console.log("═".repeat(72));
  console.log(`${new Date(a.cuando).toLocaleString("es")}   ·   id ${a.id}`);
  console.log("");
  console.log(a.texto);
  console.log("");
  console.log("── parte técnico ──");
  console.log(a.parte);

  const caps = await api(`fallos/${a.id}/capturas`).catch(() => ({}));
  let n = 0;
  for (const c of caps.documents ?? []) {
    const url = c.fields?.imagen?.stringValue ?? "";
    const coma = url.indexOf(",");
    if (coma < 0) continue;
    const ruta = join(CARPETA, `${a.id}-${n++}.jpg`);
    writeFileSync(ruta, Buffer.from(url.slice(coma + 1), "base64"));
    console.log(`captura → ${ruta}`);
  }
  console.log("");
}

console.log("Para borrar uno:  node scripts/fallos.mjs borrar <id>\n");
