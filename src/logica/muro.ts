import { huboSesion, leerPerfil, nube, type Perfil } from "./nube";

/**
 * El muro: las notas que alguien decide hacer públicas.
 *
 * ── Esto cambia una decisión anterior, y conviene saberlo ─────────────────
 *
 * Hasta el 17 de septiembre de 2026 este proyecto tenía escrito, en tres
 * sitios y con todas las letras, que **el diario no subía nunca**. No era
 * una nota suelta: era una promesa puesta en la pantalla de la cuenta, en la
 * política de privacidad y en la cabecera de las reglas del servidor.
 *
 * Alex pidió lo contrario: «las notas en el diario y exámenes deben tener la
 * opción de pública o privada. Lo público lo puede ver todo el mundo, amigos
 * o no». Es su app y es una petición razonable —un testimonio escrito que
 * nadie lee no anima a nadie—, así que se hace. Pero se hace **cambiando la
 * promesa a la vista de todos**, no colándolo por detrás: quien instaló la
 * app con la promesa vieja tiene derecho a leer la nueva.
 *
 * ── La regla que sustituye a la anterior ──────────────────────────────────
 *
 * **Nada de lo que se escribe sale del teléfono salvo la nota concreta en la
 * que su dueño tocó «publicar».** Por defecto todo es privado, lo de antes
 * sigue privado, y despublicar borra el texto del servidor de verdad.
 *
 * ── Lo que no viaja, aunque la nota sea pública ───────────────────────────
 *
 * Sube el texto, el nombre y el nombre de usuario. **No sube de qué plan
 * viene ni cómo acabó aquel día.** Esa pareja de datos es la más delicada de
 * la app: decir «esto es del plan de los ojos» o «aquel día fallé» cuenta la
 * batalla de alguien aunque el texto que escribió no la cuente. Si quiere
 * decirlo, que lo escriba él.
 */

/** Una nota tal y como se ve en el muro. */
export type NotaPublica = {
  id: string;
  uid: string;
  /** Quién la escribió, copiado al publicar para no leer 50 perfiles. */
  nombre: string;
  usuario: string;
  texto: string;
  /** Cuándo se escribió, no cuándo se publicó. */
  momento: number;
};

/** El tope de una nota pública. Largo para un testimonio, corto para un libro. */
export const TOPE_TEXTO = 2000;

/**
 * Quién está dentro, sin obligar a cargar Firebase a quien no tiene cuenta.
 *
 * La sesión vive en la pantalla de la cuenta, y el diario está en otra rama
 * del árbol. Pasarla de padre a hijo por seis componentes para esto sería
 * atar media app a una casilla. Se pregunta aquí, y sólo cuando hace falta.
 *
 * `onAuthStateChanged` es lo único fiable: al abrir la app `currentUser` está
 * en `null` durante unas décimas mientras Firebase restaura la sesión del
 * disco. Preguntar sólo por `currentUser` haría que publicar fallara con un
 * «necesitas una cuenta» justo después de arrancar, que es el peor momento
 * para mentirle a alguien.
 */
async function quienSoy(): Promise<{ uid: string } | null> {
  if (!huboSesion()) return null;
  const { auth } = await nube();
  if (auth.currentUser) return { uid: auth.currentUser.uid };
  return new Promise((resolver) => {
    let listo = false;
    const dejar = auth.onAuthStateChanged((u) => {
      if (listo) return;
      listo = true;
      dejar();
      resolver(u ? { uid: u.uid } : null);
    });
  });
}

/** Si esta persona puede publicar ahora mismo. */
export async function puedePublicar(): Promise<boolean> {
  return (await quienSoy()) !== null;
}

/** Mi identificador, o null si no hay cuenta. Para saber qué notas son mías. */
export async function miUid(): Promise<string | null> {
  return (await quienSoy())?.uid ?? null;
}

/**
 * Publicar una nota.
 *
 * El identificador del documento es el mismo que el de la nota en el
 * teléfono. Así publicar dos veces no duplica nada, despublicar sabe qué
 * borrar, y editar una nota ya publicada actualiza la de arriba en vez de
 * dejar dos versiones dando vueltas.
 *
 * El nombre se copia **dentro** de la nota: el muro enseña cuarenta a la vez,
 * y leer cuarenta perfiles para poner cuarenta nombres sería una factura cada
 * vez que alguien abre la pantalla. El precio es una lectura del perfil propio
 * al publicar, que es el sitio correcto para pagarla.
 *
 * Sin perfil no se publica: una nota firmada por nadie no le sirve a nadie, y
 * el que la lee no tendría a quién ir a animar.
 */
export async function publicarNota(nota: {
  id: string;
  texto: string;
  momento: number;
}): Promise<void> {
  const yo = await quienSoy();
  if (!yo) throw new Error("sin-cuenta");
  const perfil = await leerPerfil(yo.uid);
  if (!perfil) throw new Error("sin-perfil");
  const { bd } = await nube();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(bd, "notas", nota.id), {
    uid: yo.uid,
    nombre: perfil.nombre.slice(0, 40),
    usuario: perfil.usuario.slice(0, 20),
    texto: nota.texto.trim().slice(0, TOPE_TEXTO),
    momento: nota.momento,
  });
}

/**
 * Despublicar: que deje de estar.
 *
 * Borra el documento, no lo marca como oculto. La diferencia importa: «lo
 * escondo pero lo guardo» es exactamente lo que la gente teme cuando le dices
 * que puede retirar algo.
 */
export async function despublicarNota(id: string): Promise<void> {
  const { bd } = await nube();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(bd, "notas", id));
}

function aNota(id: string, d: Record<string, unknown>): NotaPublica {
  return {
    id,
    uid: String(d.uid ?? ""),
    nombre: String(d.nombre ?? ""),
    usuario: String(d.usuario ?? ""),
    texto: String(d.texto ?? ""),
    momento: Number(d.momento ?? 0),
  };
}

/** Las últimas notas de todo el mundo, de la más nueva a la más vieja. */
export async function leerMuro(cuantas = 40): Promise<NotaPublica[]> {
  const { bd } = await nube();
  const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
  const r = await getDocs(
    query(collection(bd, "notas"), orderBy("momento", "desc"), limit(cuantas)),
  );
  return r.docs.map((d) => aNota(d.id, d.data()));
}

/**
 * Las notas públicas de una persona.
 *
 * Se piden por `uid` a secas y se ordenan aquí. Pedirlas ordenadas al
 * servidor obligaría a crear un índice compuesto en Firestore, y un índice
 * que falta no da error al compilar: da una pantalla vacía el día que alguien
 * la abre. Con treinta notas ordenar en el teléfono no cuesta nada.
 */
export async function leerMuroDe(uid: string, cuantas = 30): Promise<NotaPublica[]> {
  const { bd } = await nube();
  const { collection, getDocs, limit, query, where } = await import("firebase/firestore");
  const r = await getDocs(query(collection(bd, "notas"), where("uid", "==", uid), limit(cuantas)));
  return r.docs.map((d) => aNota(d.id, d.data())).sort((a, b) => b.momento - a.momento);
}

// ------------------------------------------------- denunciar, bloquear, esconder
//
// Esto no es celo de más: **Google Play lo exige**. En cuanto una app enseña
// texto escrito por unos usuarios a otros, su política de contenido generado
// pide tres cosas para dejarla en la tienda — poder denunciar lo que está
// mal, poder bloquear a quien lo escribe, y que alguien pueda retirarlo.
//
// Y sin ella, un muro cristiano abierto es un sitio donde el primero que pase
// puede escribir cualquier cosa delante de gente que vino a buscar ánimo.

/** Dejar constancia de una nota que no debería estar. Sólo escribe. */
export async function denunciarNota(id: string, motivo: string): Promise<void> {
  const yo = await quienSoy();
  if (!yo) throw new Error("sin-cuenta");
  const { bd } = await nube();
  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
  await addDoc(collection(bd, "denuncias"), {
    nota: id,
    de: yo.uid,
    motivo: motivo.slice(0, 200),
    cuando: serverTimestamp(),
  });
}

/**
 * Bloquear a alguien: no volver a ver nada suyo.
 *
 * La lista es de quien bloquea y sólo él la lee. El filtro se hace en el
 * teléfono y no en el servidor, porque un muro público se lee de una vez y no
 * hay forma de decirle a Firestore «todo menos estos». Con una lista de
 * bloqueados de tamaño humano, filtrar aquí es instantáneo.
 */
export async function bloquear(otro: string): Promise<void> {
  const yo = await quienSoy();
  if (!yo) throw new Error("sin-cuenta");
  const { bd } = await nube();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(bd, "usuarios", yo.uid, "bloqueados", otro), { cuando: Date.now() });
}

/**
 * Los bloqueados, con su nombre y no sólo su identificador.
 *
 * Cuesta una lectura por persona, y se paga sin discutir: una lista de
 * `kJ3x…` no le dice a nadie a quién está dejando de leer, y entonces
 * desbloquear es un salto al vacío. Quien bloqueó a dos personas lee dos
 * perfiles una vez, al abrir una pantalla que casi nadie abre.
 *
 * Si un perfil ya no existe —esa persona borró su cuenta— se devuelve igual,
 * con el identificador por nombre, para que el bloqueo se pueda quitar. Una
 * fila que no se puede quitar es basura permanente.
 */
export async function listarBloqueados(): Promise<Perfil[]> {
  const uids = [...(await leerBloqueados())];
  const perfiles = await Promise.all(
    uids.map(async (uid) => {
      const p = await leerPerfil(uid).catch(() => null);
      return p ?? { uid, nombre: "Alguien que ya no tiene perfil", usuario: "" };
    }),
  );
  return perfiles;
}

export async function desbloquear(otro: string): Promise<void> {
  const yo = await quienSoy();
  if (!yo) return;
  const { bd } = await nube();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(bd, "usuarios", yo.uid, "bloqueados", otro));
}

/** A quién tengo bloqueado. Lista vacía si no hay cuenta. */
export async function leerBloqueados(): Promise<Set<string>> {
  const yo = await quienSoy();
  if (!yo) return new Set();
  try {
    const { bd } = await nube();
    const { collection, getDocs } = await import("firebase/firestore");
    const r = await getDocs(collection(bd, "usuarios", yo.uid, "bloqueados"));
    return new Set(r.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
}
