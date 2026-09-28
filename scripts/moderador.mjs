/**
 * Dar o quitar permisos de moderador.
 *
 * ── Para qué ──────────────────────────────────────────────────────────────
 *
 * Desde la 6.3 la app enseña a unos usuarios lo que escriben otros (el muro y
 * las frases del perfil). **Google Play no deja publicar una app así si nadie
 * puede retirar lo que esté mal**, y además un muro cristiano abierto donde no
 * se pueda quitar nada es un sitio donde el primero que pase escribe lo que
 * quiera delante de gente que vino a buscar ánimo.
 *
 * Quien esté en la colección `moderadores` puede borrar cualquier nota o
 * cualquier frase. Lo comprueban las reglas del servidor, no la app: aunque
 * alguien se montara su propio cliente, sin estar ahí no borra nada ajeno.
 *
 *   node scripts/moderador.mjs poner correo@gmail.com
 *   node scripts/moderador.mjs quitar correo@gmail.com
 *   node scripts/moderador.mjs dueño  correo@gmail.com
 *   node scripts/moderador.mjs ver
 *
 * Desde el 28-09-2026 hay dos rangos: el **dueño** (uno, se pone aquí) nombra
 * y quita moderadores desde la app, en Juntos → «quién puede llamar». Un
 * moderador llama, abre salas y retira lo ajeno, pero no nombra a nadie.
 *
 * ── Por qué a pelo y sin librerías ────────────────────────────────────────
 *
 * Lo normal sería `firebase-admin`, pero pesa más que toda la app y esto se
 * usa tres veces en la vida del proyecto. Con la clave de servicio se firma un
 * JWT, se cambia por un token y se habla con las dos APIs de siempre. Son
 * cuarenta líneas y ninguna dependencia nueva.
 */
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAVE = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? join(homedir(), ".firebase", "genuino-despliegue.json");

if (!existsSync(CLAVE)) {
  console.error("No hay cuenta de servicio en " + CLAVE);
  process.exit(1);
}

// La clave no se imprime nunca, ni entera ni en trozos.
const cuenta = JSON.parse(readFileSync(CLAVE, "utf8"));
const PROYECTO = cuenta.project_id;

const base64url = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Un token de acceso, firmando un JWT con la clave de la cuenta de servicio. */
async function token() {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
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
  if (!d.access_token) throw new Error("No se pudo obtener el token: " + JSON.stringify(d));
  return d.access_token;
}

const api = async (url, opciones = {}) => {
  const r = await fetch(url, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      ...opciones.headers,
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : {};
};

/** El identificador de quien entró con ese correo, o null si no ha entrado nunca. */
async function uidDe(correo) {
  const d = await api(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/accounts:lookup`,
    { method: "POST", body: JSON.stringify({ email: [correo] }) },
  );
  return d.users?.[0]?.localId ?? null;
}

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

const [orden, correo] = process.argv.slice(2);

if (orden === "ver") {
  const d = await api(`${DOCS}/moderadores`);
  const filas = d.documents ?? [];
  if (filas.length === 0) {
    console.log("\nNo hay ningún moderador. Nadie puede retirar lo que escriba otro.\n");
  } else {
    console.log(`\n${filas.length} moderador(es):`);
    for (const f of filas) {
      const uid = f.name.split("/").pop();
      const c = f.fields ?? {};
      const quien = c.usuario?.stringValue
        ? `@${c.usuario.stringValue}`
        : (c.correo?.stringValue ?? "(sin correo apuntado)");
      const rango = c.dueno?.booleanValue ? "  ·  DUEÑO" : "";
      console.log(`  ${quien}  ·  ${uid}${rango}`);
    }
    console.log("");
  }
  process.exit(0);
}

if (!correo || !["poner", "quitar", "dueño", "dueno"].includes(orden)) {
  console.log("Uso:");
  console.log("  node scripts/moderador.mjs poner  correo@gmail.com");
  console.log("  node scripts/moderador.mjs quitar correo@gmail.com");
  console.log("  node scripts/moderador.mjs dueño  correo@gmail.com   (nombra y quita desde la app)");
  console.log("  node scripts/moderador.mjs ver");
  process.exit(1);
}

const uid = await uidDe(correo);
if (!uid) {
  console.error(`\n«${correo}» no tiene cuenta en la app todavía.`);
  console.error("Tiene que entrar una vez con Google desde Más → Mi cuenta, y repetir esto.\n");
  process.exit(1);
}

if (orden === "dueño" || orden === "dueno") {
  // Con `updateMask`: se añade el rango sin pisar lo que ya tenga el documento.
  // Sin la máscara, PATCH reemplaza el documento entero. Y `dueno` sin ñ,
  // porque las reglas de Firestore no admiten ñ en los nombres de campo.
  const mascara = ["dueno", "correo", "desde"].map((c) => `updateMask.fieldPaths=${c}`).join("&");
  await api(`${DOCS}/moderadores/${uid}?${mascara}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        dueno: { booleanValue: true },
        correo: { stringValue: correo },
        desde: { integerValue: String(Date.now()) },
      },
    }),
  });
  console.log(`\n${correo} es el dueño: nombra y quita moderadores desde la app (Juntos → quién puede llamar).`);
  console.log(`uid: ${uid}\n`);
} else if (orden === "poner") {
  await api(`${DOCS}/moderadores/${uid}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        correo: { stringValue: correo },
        desde: { integerValue: String(Date.now()) },
      },
    }),
  });
  console.log(`\n${correo} ya puede retirar notas y frases de cualquiera.`);
  console.log(`uid: ${uid}\n`);
} else {
  await api(`${DOCS}/moderadores/${uid}`, { method: "DELETE" });
  console.log(`\n${correo} ya no modera.\n`);
}
