/**
 * Qué alarmas le entregaría la app a Android, calculado con la copia en la nube
 * de una cuenta. Para diagnosticar «no suenan las alarmas» sin el móvil delante:
 * si aquí salen bien, el fallo está en el móvil (permisos, MIUI, batería); si
 * salen mal, en la app.
 *
 *   npx vite-node scripts/mirar-alarmas.ts <correo>
 *
 * Sólo LEE, con la cuenta de servicio. Imprime horas y nombres de bloques, nada más.
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { avisosPendientes } from "../src/logica/avisos";
import { datosIniciales } from "../src/datos/almacen";

const correo = process.argv[2];
if (!correo) {
  console.error("Uso: npx vite-node scripts/mirar-alarmas.ts <correo>");
  process.exit(1);
}
const cuenta = JSON.parse(readFileSync(join(homedir(), ".firebase", "genuino-despliegue.json"), "utf8"));
const b64 = (b: string | Buffer) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function token(alcance: string): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cue = b64(JSON.stringify({ iss: cuenta.client_email, scope: alcance, aud: "https://oauth2.googleapis.com/token", exp: ahora + 600, iat: ahora }));
  const firma = createSign("RSA-SHA256").update(`${cab}.${cue}`).sign(cuenta.private_key, "base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cab}.${cue}.${firma}` }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

function valor(v: Record<string, unknown>): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return campos(((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields) ?? {});
  if ("arrayValue" in v) return (((v.arrayValue as { values?: Record<string, unknown>[] }).values) ?? []).map(valor);
  return undefined;
}
function campos(f: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, valor(v)]));
}

// El uid de la cuenta, por su correo (Identity Toolkit, con la cuenta de servicio).
const tAuth = await token("https://www.googleapis.com/auth/identitytoolkit");
const busq = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${cuenta.project_id}/accounts:lookup`, {
  method: "POST",
  headers: { Authorization: `Bearer ${tAuth}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email: [correo] }),
});
const usuarios = ((await busq.json()) as { users?: { localId: string; lastLoginAt?: string; lastRefreshAt?: string }[] }).users ?? [];
if (!usuarios.length) {
  console.error("No hay cuenta con ese correo.");
  process.exit(1);
}
const uid = usuarios[0].localId;
console.log("cuenta encontrada; último acceso:", usuarios[0].lastRefreshAt ?? usuarios[0].lastLoginAt);

const tDb = await token("https://www.googleapis.com/auth/datastore");
const r = await fetch(
  `https://firestore.googleapis.com/v1/projects/${cuenta.project_id}/databases/(default)/documents/usuarios/${uid}/respaldo/rutina`,
  { headers: { Authorization: `Bearer ${tDb}` } },
);
if (!r.ok) {
  console.error("Sin copia en la nube:", r.status);
  process.exit(1);
}
const doc = (await r.json()) as { fields: Record<string, Record<string, unknown>>; updateTime: string };
const copia = campos(doc.fields) as Record<string, unknown>;
console.log("copia guardada:", doc.updateTime, "· versión de la app que la guardó:", copia.version ?? "?");
const datos = { ...datosIniciales(), ...(copia as object) } as ReturnType<typeof datosIniciales>;
console.log(`rutina: ${datos.rutina.length} bloques (${datos.rutina.filter((b) => b.activo).length} activos) · tareas: ${datos.tareas.length}`);
for (const b of datos.rutina) {
  console.log(`  ${b.activo ? "✓" : "✗"} ${b.hora} ${b.nombre}  días ${JSON.stringify(b.dias)}  timbre ${b.timbre}  aviso previo ${b.avisoPrevioMin ?? 0}`);
}
const avisos = avisosPendientes(datos, new Date(), 3);
console.log(`\nalarmas de los próximos 3 días que se entregarían a Android: ${avisos.length}`);
for (const a of avisos.slice(0, 40)) {
  console.log(`  ${a.cuando.toLocaleString("es-VE", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}  ${a.titulo}`);
}

console.log(`\ntareas (${datos.tareas.length}):`);
for (const t of [...datos.tareas].sort((a, b) => (a.fecha + (a.hora ?? "")).localeCompare(b.fecha + (b.hora ?? "")))) {
  console.log(`  ${t.fecha} ${t.hora ?? "sin hora"}  timbre ${t.timbre}  repite ${t.repiteHasta ?? "—"} ${t.diasSemana ? JSON.stringify(t.diasSemana) : ""}  «${t.nombre.slice(0, 30)}»`);
}
