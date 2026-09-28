import { Capacitor, registerPlugin } from "@capacitor/core";
import { dondeEstaElPortero } from "./comunidad";
import { miUid } from "./muro";
import { nube } from "./nube";

/**
 * El timbre: la comunidad de voz y la llamada que hace sonar los móviles.
 *
 * ── Lo que pidió Alex, el 27-09-2026 ──────────────────────────────────────
 *
 * > «VITAL que yo pueda hacer que le suene la llamada a los que voluntariamente
 * > están dentro del grupo de voz. Eso debe ser una comunidad donde entras
 * > voluntariamente, y al ser parte, te suena cada vez que yo, y sólo yo (o
 * > alguno de los otros administradores que yo señale), hagan la llamada.»
 *
 * Tres piezas, y cada una en su sitio:
 *
 * 1. **Apuntarse** es cosa del propio móvil: se suscribe al tema `devocional`
 *    de Firebase. No hay lista de tokens en ningún servidor. Salirse es darse
 *    de baja, y desde ese momento ese móvil no suena. Voluntario de verdad.
 * 2. **Llamar** lo hace el portero (`/llamar`): comprueba que quien llama
 *    modera y que la sala está abierta, y manda **un** aviso al tema.
 * 3. **Sonar** lo hace el servicio nativo al recibir el aviso, con la misma
 *    maquinaria de las alarmas. La web sólo pregunta al abrirse si hay una
 *    llamada pendiente y enseña «Entrar» o «Ahora no».
 *
 * La lista de miembros que se ve en la app vive en `comunidad/miembros`, y es
 * un espejo de quién se apuntó: sirve para contar y para que uno vea si está.
 * Lo que decide si te suena es el tema, no ese documento.
 */

type TimbreNativo = {
  unirse(): Promise<void>;
  salirse(): Promise<void>;
  llamadaPendiente(): Promise<{
    hay: boolean;
    canal?: string;
    nombre?: string;
    quien?: string;
    cuando?: number;
    sono?: boolean;
  }>;
  atendida(): Promise<void>;
  /** Cuando llega una llamada con la app ya abierta: lo nativo suena y avisa aquí. */
  addListener(
    evento: "llamada",
    cb: (d: { canal: string; nombre: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const nativo = registerPlugin<TimbreNativo>("Timbre");

/** Si este aparato puede sonar. Sólo la app de Android. */
export function hayTimbre(): boolean {
  return Capacitor.isNativePlatform();
}

export type LlamadaPendiente = {
  canal: string;
  nombre: string;
  quien: string;
  cuando: number;
  /** Si llegó a sonar, o llegó tarde y sólo quedó apuntada. */
  sono: boolean;
};

async function refMiembro(uid: string) {
  const { bd } = await nube();
  const { doc } = await import("firebase/firestore");
  return doc(bd, "comunidad", "voz", "miembros", uid);
}

/** Si esta persona está apuntada, según el espejo de Firestore. */
export async function soyMiembro(): Promise<boolean> {
  const uid = await miUid();
  if (!uid) return false;
  try {
    const { getDoc } = await import("firebase/firestore");
    return (await getDoc(await refMiembro(uid))).exists();
  } catch {
    return false;
  }
}

/**
 * Apuntarse. Primero el tema —que es lo que hace sonar— y después el espejo.
 *
 * En ese orden a propósito: si el espejo se escribiera primero y el tema
 * fallara, la app diría «estás dentro» y el móvil no sonaría nunca. Que la
 * lista diga que estás significa que suenas.
 */
export async function unirmeALaComunidad(quienSoy: { nombre: string; usuario: string }): Promise<void> {
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  if (hayTimbre()) {
    try {
      await nativo.unirse();
    } catch (e) {
      // Se distingue del fallo de red porque se arregla en otro sitio: el
      // 27-09-2026 Nazdrely no pudo apuntarse con cuenta, perfil y la 6.15, y
      // «mira tu conexión» la habría mandado a mirar donde no estaba el fallo.
      throw new Error("sin-avisos-de-google:" + String((e as { message?: string })?.message ?? e));
    }
  }
  const { setDoc } = await import("firebase/firestore");
  await setDoc(await refMiembro(uid), {
    nombre: quienSoy.nombre,
    usuario: quienSoy.usuario,
    desde: Date.now(),
  });
}

/**
 * Volver a apuntar este móvil al tema, si la persona está dentro.
 *
 * El tema vive en la instalación de Firebase, no en la cuenta: desinstalar,
 * borrar datos o estrenar móvil lo pierde, pero el espejo de Firestore sigue
 * diciendo «dentro» y «Llamando a N» lo contaba como un móvil que suena. Se
 * llama al arrancar la app; suscribirse otra vez a lo mismo es gratis y no
 * hace nada si ya estaba. (Revisión del timbre, 28-09-2026.)
 */
export async function reapuntarmeSiEstoyDentro(): Promise<void> {
  if (!hayTimbre()) return;
  if (!(await soyMiembro())) return;
  try {
    await nativo.unirse();
  } catch {
    // Sin avisos de Google no hay nada que hacer aquí; la tarjeta de la
    // comunidad ya explica ese fallo cuando la persona la abre.
  }
}

/** Cuando llega una llamada con la app abierta. `null` fuera de la app. */
export function alLlamar(hacer: () => void): Promise<{ remove: () => Promise<void> }> | null {
  if (!hayTimbre()) return null;
  return nativo.addListener("llamada", () => hacer());
}

/** Salirse. El orden contrario: se borra de la lista y se deja de sonar. */
export async function salirmeDeLaComunidad(): Promise<void> {
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(await refMiembro(uid));
  } finally {
    // Aunque el borrado falle por red, el móvil deja de sonar: es lo que la
    // persona pidió, y lo otro se arregla la próxima vez.
    if (hayTimbre()) await nativo.salirse();
  }
}

/** Cuántos están apuntados. Sólo lo puede contar quien modera. */
export async function cuantosMiembros(): Promise<number | null> {
  try {
    const { bd } = await nube();
    const { collection, getCountFromServer } = await import("firebase/firestore");
    const r = await getCountFromServer(collection(bd, "comunidad", "voz", "miembros"));
    return r.data().count;
  } catch {
    return null;
  }
}

/** La llamada que dejó el servicio nativo, si hay. */
export async function llamadaPendiente(): Promise<LlamadaPendiente | null> {
  if (!hayTimbre()) return null;
  try {
    const r = await nativo.llamadaPendiente();
    if (!r.hay || !r.canal) return null;
    return {
      canal: r.canal,
      nombre: r.nombre ?? "Devocional",
      quien: r.quien ?? "",
      cuando: r.cuando ?? 0,
      sono: r.sono === true,
    };
  } catch {
    return null;
  }
}

/** Callar el timbre y olvidar la llamada, se entre o no. */
export async function atenderLlamada(): Promise<void> {
  if (!hayTimbre()) return;
  try {
    await nativo.atendida();
  } catch {
    // Nada que callar.
  }
}

/**
 * Llamar a la comunidad: que suenen los móviles de los apuntados.
 *
 * Lo decide el portero, no esta función: aquí sólo se manda la sesión y la
 * sala. Si quien llama no modera, vuelve un 403 con su motivo escrito.
 */
export async function llamarALaComunidad(
  canal: string,
  nombre: string,
): Promise<{ enviado: true } | { enviado: false; porque: string }> {
  const { auth } = await nube();
  const quien = auth.currentUser;
  if (!quien) return { enviado: false, porque: "Hace falta entrar con tu cuenta." };
  const token = await quien.getIdToken();
  try {
    const r = await fetch(`${dondeEstaElPortero()}/llamar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canal, nombre, token }),
    });
    if (r.ok) return { enviado: true };
    let porque = "No se pudo llamar.";
    try {
      const e = (await r.json()) as { porque?: string };
      if (e?.porque) porque = e.porque;
    } catch {
      // Sin JSON no llegamos al portero.
    }
    return { enviado: false, porque };
  } catch {
    return { enviado: false, porque: "No se pudo llamar. Mira tu conexión." };
  }
}
