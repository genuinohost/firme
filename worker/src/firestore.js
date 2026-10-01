/**
 * Leer documentos de Firestore por su API de red.
 *
 * ── La decisión que ahorra un secreto entero ──────────────────────────────
 *
 * Lo normal sería que el portero leyera con una **cuenta de servicio**: una
 * credencial de administrador que lo ve todo. Eso obliga a guardar esa clave en
 * Cloudflare, a renovar un token de Google en cada arranque, y a que un fallo
 * aquí exponga la base entera.
 *
 * No hace falta. Firestore acepta el **propio token de la persona** y aplica
 * `firestore.rules` como si leyera ella. Y nuestras reglas ya dejan que quien ha
 * entrado lea la sala, su ficha y la lista de expulsados — que es exactamente lo
 * que el portero necesita mirar.
 *
 * Así que aquí no hay ninguna credencial nuestra. **El portero no puede leer
 * nada que la persona no pudiera leer por su cuenta**, y eso no le quita fuerza:
 * lo que decide no es qué ve, sino qué firma.
 */

/** De la forma que usa Firestore a un objeto normal. */
function valor(v) {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("mapValue" in v) return campos(v.mapValue.fields ?? {});
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(valor);
  // Un tipo que no esperábamos. Se devuelve tal cual antes que inventarse algo.
  return v;
}

function campos(f) {
  const o = {};
  for (const [k, v] of Object.entries(f)) o[k] = valor(v);
  return o;
}

/**
 * Lee un documento. Devuelve sus campos, o `null` si no existe.
 *
 * Un 403 **no se confunde con un 404**: que las reglas nieguen la lectura es un
 * problema distinto de que el documento no esté, y mezclarlos haría que un fallo
 * de permisos se leyera como «esa sala no existe» — que es justo el mensaje que
 * nos tuvo media hora perdidos con el emulador de funciones.
 */
export async function leerDocumento(base, ruta, token) {
  const r = await fetch(`${base}/${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return null;
  if (r.status === 403 || r.status === 401) throw new Error("firestore-nos-niega");
  if (!r.ok) throw new Error(`firestore-${r.status}`);
  const j = await r.json();
  return campos(j.fields ?? {});
}

/**
 * Lista los documentos de una colección: `[{ id, ...campos }]`.
 *
 * Con el token de quien pide, como `leerDocumento`: si las reglas no le dejan
 * listar, lanza, y quien llama decide qué hacer sin esa lista. Pide de 300 en
 * 300 hasta `max`, para no quedarse corto ni pedir sin fin.
 */
export async function listarDocumentos(base, ruta, token, max = 900) {
  const docs = [];
  let pagina = "";
  do {
    const url = `${base}/${ruta}?pageSize=300${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ""}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 403 || r.status === 401) throw new Error("firestore-nos-niega");
    if (!r.ok) throw new Error(`firestore-${r.status}`);
    const j = await r.json();
    for (const d of j.documents ?? []) {
      docs.push({ id: String(d.name ?? "").split("/").pop(), ...campos(d.fields ?? {}) });
    }
    pagina = j.nextPageToken ?? "";
  } while (pagina && docs.length < max);
  return docs;
}
