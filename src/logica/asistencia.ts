import { miUid } from "./muro";
import { nube } from "./nube";

/**
 * La asistencia al devocional: quién vino, su racha y sus faltas.
 *
 * ── Lo que pidió Alex, el 28-09-2026 ──────────────────────────────────────
 *
 * > «Debo tener un control de asistencias e inasistencias. Debes establecer
 * > rachas por cada día que conecten, y una carita triste 😢 por cada día que
 * > sumen no conectando. Todo debe verse en el perfil de los que están
 * > conectados.»
 *
 * ── Cómo se cuenta ────────────────────────────────────────────────────────
 *
 * Venir es **entrar a la sala del devocional**. Al entrar, el propio móvil
 * apunta el día en `comunidad/voz/asistencia/{uid}` y calcula:
 *
 * - **racha** 🔥: días de reunión seguidos, contando hacia atrás desde hoy.
 * - **faltas** 😢: días de reunión sin venir en los últimos treinta, y sólo
 *   desde el primer día que vino — quien acaba de llegar no arranca con
 *   veintinueve faltas.
 *
 * Los días son los de cada móvil (hora local): el devocional de las 5 de
 * Caracas es el mismo día en Madrid a las 11. Si la reunión no es diaria, los
 * días que no toca ni suman ni restan (`diasReunion`, 0 = domingo; vacío =
 * todos).
 *
 * Cada uno escribe sólo lo suyo y lo garantizan las reglas; la lista entera
 * la ve quien modera, que es el control que pidió Alex. Los dos números
 * viajan además a la ficha de la sala (`dentro/{uid}`), que es donde los
 * ven los demás mientras están conectados.
 */

export type Asistencia = {
  uid: string;
  nombre: string;
  usuario: string;
  /** Los días que vino, «AAAA-MM-DD» en hora local; los últimos 120 como mucho. */
  dias: string[];
  racha: number;
  faltas: number;
  /** El último día que vino. */
  ultimo: string;
};

/** «AAAA-MM-DD» en hora local. */
export function claveDia(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function desdeClave(c: string): Date {
  const [a, m, d] = c.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function esDiaDeReunion(f: Date, dias: number[]): boolean {
  return dias.length === 0 || dias.includes(f.getDay());
}

/** Racha y faltas a partir de los días que vino. Pura, para poder probarla. */
export function calcularAsistencia(
  dias: string[],
  hoy: string,
  diasReunion: number[] = [],
): { racha: number; faltas: number } {
  const vino = new Set(dias);

  // La racha: días de reunión seguidos hacia atrás desde hoy. Hoy cuenta si
  // ya vino; si no, la racha es la que traía hasta ayer… que es cero, porque
  // esto se calcula al venir.
  let racha = 0;
  const f = desdeClave(hoy);
  for (let i = 0; i < 3660; i++) {
    if (esDiaDeReunion(f, diasReunion)) {
      if (!vino.has(claveDia(f))) break;
      racha++;
    }
    f.setDate(f.getDate() - 1);
  }

  // Las faltas: días de reunión sin venir en los últimos treinta, y sólo
  // desde el primer día que vino.
  const primero = dias.length > 0 ? dias.slice().sort()[0] : hoy;
  let faltas = 0;
  const g = desdeClave(hoy);
  for (let i = 0; i < 30; i++) {
    g.setDate(g.getDate() - 1);
    const c = claveDia(g);
    if (c < primero) break;
    if (esDiaDeReunion(g, diasReunion) && !vino.has(c)) faltas++;
  }

  return { racha, faltas };
}

async function refAsistencia(uid: string) {
  const { bd } = await nube();
  const { doc } = await import("firebase/firestore");
  return doc(bd, "comunidad", "voz", "asistencia", uid);
}

/**
 * Apuntar que hoy vine. Devuelve la racha y las faltas ya recalculadas, para
 * llevarlas a la ficha de la sala.
 */
export async function marcarAsistencia(
  quienSoy: { nombre: string; usuario: string },
  diasReunion: number[] = [],
  ahora = new Date(),
): Promise<{ racha: number; faltas: number }> {
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  const { getDoc, setDoc } = await import("firebase/firestore");
  const ref = await refAsistencia(uid);
  const previo = await getDoc(ref);
  const hoy = claveDia(ahora);
  const antes: string[] =
    previo.exists() && Array.isArray(previo.data().dias)
      ? (previo.data().dias as unknown[]).filter((d): d is string => typeof d === "string")
      : [];
  const dias = Array.from(new Set([...antes, hoy])).sort().slice(-120);
  const { racha, faltas } = calcularAsistencia(dias, hoy, diasReunion);
  await setDoc(ref, {
    nombre: quienSoy.nombre.slice(0, 40),
    usuario: quienSoy.usuario.slice(0, 20),
    dias,
    racha,
    faltas,
    ultimo: hoy,
  });
  return { racha, faltas };
}

/** La lista entera, para quien modera: el control de asistencias. */
export async function listarAsistencia(): Promise<Asistencia[]> {
  const { bd } = await nube();
  const { collection, getDocs } = await import("firebase/firestore");
  const r = await getDocs(collection(bd, "comunidad", "voz", "asistencia"));
  return r.docs
    .map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        nombre: typeof x.nombre === "string" ? x.nombre : "",
        usuario: typeof x.usuario === "string" ? x.usuario : "",
        dias: Array.isArray(x.dias) ? (x.dias as unknown[]).filter((v): v is string => typeof v === "string") : [],
        racha: typeof x.racha === "number" ? x.racha : 0,
        faltas: typeof x.faltas === "number" ? x.faltas : 0,
        ultimo: typeof x.ultimo === "string" ? x.ultimo : "",
      };
    })
    // Los de racha más larga arriba; a igual racha, por nombre.
    .sort((a, b) => b.racha - a.racha || a.nombre.localeCompare(b.nombre, "es"));
}
