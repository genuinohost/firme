import { miUid } from "./muro";
import { leerPerfil, nube, usuarioValido } from "./nube";

/**
 * Quién puede llamar: los moderadores, y el dueño que los nombra.
 *
 * ── Lo que pidió Alex, el 27-09-2026 ──────────────────────────────────────
 *
 * > «…te suena cada vez que yo, y sólo yo (o alguno de los otros
 * > administradores que yo señale), hagan la llamada.»
 *
 * Hasta la 6.18 la lista sólo se tocaba con `scripts/moderador.mjs` desde
 * este PC: para señalar a alguien, Alex tenía que pedirlo. Ahora la señala
 * él desde el móvil.
 *
 * ── Dos rangos, una lista ─────────────────────────────────────────────────
 *
 * Todo vive en `moderadores/{uid}`, la misma lista que ya decide quién retira
 * notas ajenas, quién abre salas y quién hace sonar los móviles. El **dueño**
 * lleva `dueno: true` (uno solo, y sólo lo pone la cuenta de servicio); los
 * demás son moderadores que él nombró. **Sólo el dueño nombra y quita**, y a
 * él no lo quita nadie. Lo hacen cumplir las reglas del servidor, no esta
 * pantalla: la app sólo enseña botones a quien las reglas dejarían pasar.
 *
 * ¿Por qué no dejar que cualquier moderador nombre a otros? Porque entonces
 * «los que yo señale» pasa a ser «los que señale cualquiera que yo señalé», y
 * a las tres de la mañana suenan treinta móviles por decisión de alguien a
 * quien Alex no conoce.
 */

export type Moderador = {
  uid: string;
  nombre?: string;
  usuario?: string;
  /** Lo apunta el script; los nombrados desde la app llevan nombre y usuario. */
  correo?: string;
  dueno: boolean;
  desde?: number;
};

/** Si quien está dentro es el dueño. Falla en silencio a `false`, que es el lado seguro. */
export async function soyDueno(): Promise<boolean> {
  const yo = await miUid();
  if (!yo) return false;
  try {
    const { bd } = await nube();
    const { doc, getDoc } = await import("firebase/firestore");
    const d = await getDoc(doc(bd, "moderadores", yo));
    return d.exists() && d.data().dueno === true;
  } catch {
    return false;
  }
}

/** La lista entera. Sólo el dueño puede pedirla; a los demás las reglas les dicen que no. */
export async function listarModeradores(): Promise<Moderador[]> {
  const { bd } = await nube();
  const { collection, getDocs } = await import("firebase/firestore");
  const r = await getDocs(collection(bd, "moderadores"));
  return r.docs
    .map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        nombre: typeof x.nombre === "string" ? x.nombre : undefined,
        usuario: typeof x.usuario === "string" ? x.usuario : undefined,
        correo: typeof x.correo === "string" ? x.correo : undefined,
        dueno: x.dueno === true,
        desde: typeof x.desde === "number" ? x.desde : undefined,
      };
    })
    // El dueño primero; después, por orden de nombramiento.
    .sort((a, b) => Number(b.dueno) - Number(a.dueno) || (a.desde ?? 0) - (b.desde ?? 0));
}

/**
 * Nombrar a alguien por su @usuario.
 *
 * Se busca en `handles/{usuario}`, que cualquiera con cuenta puede leer, y se
 * guarda con su nombre para que la lista se lea sin más consultas. Los
 * errores llevan una clave corta; la pantalla los traduce.
 */
export async function nombrarModerador(usuarioCrudo: string): Promise<Moderador> {
  const yo = await miUid();
  if (!yo) throw new Error("sin-cuenta");
  const usuario = usuarioCrudo.trim().replace(/^@/, "").toLowerCase();
  if (!usuarioValido(usuario)) throw new Error("usuario-invalido");

  const { bd } = await nube();
  const { doc, getDoc, setDoc } = await import("firebase/firestore");
  const clave = await getDoc(doc(bd, "handles", usuario));
  if (!clave.exists()) throw new Error("no-existe");
  const uid = String(clave.data().uid ?? "");
  if (!uid) throw new Error("no-existe");
  if (uid === yo) throw new Error("eres-tu");
  if ((await getDoc(doc(bd, "moderadores", uid))).exists()) throw new Error("ya-modera");

  const perfil = await leerPerfil(uid).catch(() => null);
  const datos = {
    nombre: (perfil?.nombre || usuario).slice(0, 60),
    usuario,
    puestoPor: yo,
    desde: Date.now(),
  };
  await setDoc(doc(bd, "moderadores", uid), datos);
  return { uid, ...datos, dueno: false };
}

/** Quitarle el permiso. Al dueño no se le puede quitar; las reglas lo impiden. */
export async function quitarModerador(uid: string): Promise<void> {
  const { bd } = await nube();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(bd, "moderadores", uid));
}
