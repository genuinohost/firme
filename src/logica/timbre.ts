import { Capacitor, registerPlugin } from "@capacitor/core";
import { nombreInstalado } from "./actualizacion";
import { dondeEstaElPortero } from "./comunidad";
import type { Acuse, ResultadoLlamada } from "./llamada";
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
 *    de Firebase y, desde la 6.27, deja su token de avisos en su ficha de la
 *    comunidad (la ven él y quien modera). Salirse es darse de baja y borrar
 *    la ficha, y desde ese momento ese móvil no suena. Voluntario de verdad.
 * 2. **Llamar** lo hace el portero (`/llamar`): comprueba que quien llama
 *    modera y que la sala está abierta, y manda un aviso a cada móvil —y otro
 *    al tema, para las apps viejas—. Cada móvil que suena contesta «me sonó»
 *    y a quien llamó le llega quién (ver `llamada.ts`).
 * 3. **Sonar** lo hace el servicio nativo al recibir el aviso, con la misma
 *    maquinaria de las alarmas. La web sólo pregunta al abrirse si hay una
 *    llamada pendiente y enseña «Entrar» o «Ahora no».
 *
 * La lista de miembros vive en `comunidad/voz/miembros`: sirve para contar,
 * para que uno vea si está y, desde la 6.27, para llamar a cada aparato por su
 * token (`moviles`, uno por aparato). El tema se sigue mandando en cada
 * llamada, para lo que no tenga su entrada al día (las apps viejas).
 */

type TimbreNativo = {
  unirse(): Promise<void>;
  salirse(): Promise<void>;
  /** El token de avisos de este móvil (6.27). */
  miToken(): Promise<{ token: string }>;
  /** Los «me sonó» que llegaron a este móvil, como texto JSON (6.27). */
  acuses(): Promise<{ lista: string }>;
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
  /** Cuando llega un «me sonó» con la app abierta (6.27). */
  addListener(evento: "acuse", cb: (d: { acuse: string }) => void): Promise<{ remove: () => Promise<void> }>;
  /** Google cambió el token de este móvil con la app abierta (6.27). */
  addListener(evento: "tokenNuevo", cb: () => void): Promise<{ remove: () => Promise<void> }>;
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

/**
 * Si esta persona está apuntada, distinguiendo «no» de «no se sabe» (sin red):
 * `null` en la duda. Sin esto, sin conexión la tarjeta del devocional invitaba
 * a «unirse» a quien ya estaba dentro. (Revisión de la 6.27.)
 */
export async function soyMiembroOnull(): Promise<boolean | null> {
  const uid = await miUid();
  if (!uid) return false;
  try {
    const { getDoc } = await import("firebase/firestore");
    return (await getDoc(await refMiembro(uid))).exists();
  } catch (e) {
    return String((e as { code?: string })?.code ?? "").includes("permission-denied") ? false : null;
  }
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

/** La llamada de prueba: no es una sala. La reconoce la app y no intenta entrar. */
export const CANAL_PRUEBA = "prueba-del-timbre";

/** El token de avisos de este móvil, o "" si no hay (web, Play Services, red). */
async function miTokenDeAvisos(): Promise<string> {
  if (!hayTimbre()) return "";
  try {
    const { token } = await nativo.miToken();
    return typeof token === "string" && token.length >= 20 && token.length <= 400 ? token : "";
  } catch {
    return "";
  }
}

/**
 * Un nombre para ESTE aparato, guardado en él. Sirve para que el móvil y la
 * tableta de una misma persona tengan cada uno su entrada en la ficha y les
 * suenen a los dos. Si se borran los datos sale otro, y la entrada vieja (con
 * su token muerto) se queda hasta que la desplacen dos aparatos más nuevos:
 * NO se borra sola. El portero llama primero al aparato principal de cada uno,
 * así que una entrada muerta no le quita el sitio a nadie.
 */
function idDeEsteAparato(): string {
  const CLAVE = "genuino.aparato";
  try {
    let id = localStorage.getItem(CLAVE);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(CLAVE, id);
    }
    return id;
  } catch {
    return "este";
  }
}

type Aparato = { token: string; en: number; version: string };

/**
 * Lo que va en la ficha para que el portero pueda llamar a este aparato: su
 * entrada en `moviles` (sin pisar la de los otros aparatos de la persona) y,
 * en `token`, el del último que se abrió (lo que leía el portero de antes).
 */
function datosDelMovil(
  token: string,
  moviles?: Record<string, Aparato> | null,
): { token: string; tokenEn: number; version: string; moviles: Record<string, Aparato> } {
  const ahora = Date.now();
  const version = String(nombreInstalado()).slice(0, 20);
  const id = idDeEsteAparato();
  const otros = Object.entries(moviles && typeof moviles === "object" ? moviles : {})
    // El mismo token con otro nombre es este aparato con los datos borrados.
    .filter(([k, v]) => k !== id && v && typeof v.token === "string" && v.token !== token)
    .sort((a, b) => Number(b[1].en ?? 0) - Number(a[1].en ?? 0))
    .slice(0, 2);
  return {
    token,
    tokenEn: ahora,
    version,
    moviles: Object.fromEntries([...otros, [id, { token, en: ahora, version }]]),
  };
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
  // Y el token, para que el portero llame a este móvil y sepa si le llegó.
  // Sin él se apunta igual: le sigue llegando por el tema.
  const token = await miTokenDeAvisos();
  const { setDoc } = await import("firebase/firestore");
  await setDoc(await refMiembro(uid), {
    nombre: quienSoy.nombre,
    usuario: quienSoy.usuario,
    desde: Date.now(),
    ...(token ? datosDelMovil(token) : {}),
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
  const uid = await miUid();
  if (!uid) return;
  try {
    const { getDoc, updateDoc } = await import("firebase/firestore");
    const ref = await refMiembro(uid);
    const ficha = await getDoc(ref);
    if (!ficha.exists()) {
      // Se salió desde otro aparato: éste también deja de sonar. Sólo con la
      // respuesta del servidor (una lectura sin red no puede dar de baja).
      if (!ficha.metadata.fromCache) await nativo.salirse().catch(() => {});
      return;
    }
    try {
      await nativo.unirse();
    } catch {
      // Sin avisos de Google no hay nada que hacer aquí; la tarjeta de la
      // comunidad ya explica ese fallo cuando la persona la abre.
    }
    // 6.27: y el token en la ficha, si falta o Google lo cambió (reinstalar,
    // borrar datos, o simplemente Google). También la versión, para que quien
    // llama sepa si alguien sigue con la app vieja.
    const token = await miTokenDeAvisos();
    const d = ficha.data();
    const moviles = (d.moviles ?? null) as Record<string, Aparato> | null;
    const mio = moviles?.[idDeEsteAparato()];
    if (token && (mio?.token !== token || mio?.version !== String(nombreInstalado()).slice(0, 20) || d.token !== token)) {
      await updateDoc(ref, datosDelMovil(token, moviles));
    }
  } catch {
    // Sin conexión: la próxima vez que se abra la app.
  }
}

/**
 * Mantener el token de la ficha al día mientras la app vive: cuando Google lo
 * cambia (aviso del servicio nativo) y, como mucho una vez por hora, al volver
 * a primer plano. Sin esto sólo se renovaba al arrancar en frío, y «que abra
 * Genuino» no lo arreglaba si la app seguía en memoria. (Revisión de la 6.27.)
 */
export function vigilarMiToken(): () => void {
  if (!hayTimbre()) return () => {};
  let ultima = Date.now();
  const escucha = nativo.addListener("tokenNuevo", () => {
    ultima = Date.now();
    void reapuntarmeSiEstoyDentro();
  });
  const alVolver = () => {
    if (document.visibilityState !== "visible" || Date.now() - ultima < 3_600_000) return;
    ultima = Date.now();
    void reapuntarmeSiEstoyDentro();
  };
  document.addEventListener("visibilitychange", alVolver);
  return () => {
    document.removeEventListener("visibilitychange", alVolver);
    void escucha.then((e) => e.remove()).catch(() => {});
  };
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

/** Quiénes están apuntados, con su nombre. Sólo lo puede sacar quien modera (reglas). */
export async function listarMiembros(): Promise<{ uid: string; nombre: string; usuario: string }[]> {
  const { bd } = await nube();
  const { collection, getDocs } = await import("firebase/firestore");
  const r = await getDocs(collection(bd, "comunidad", "voz", "miembros"));
  return r.docs
    .map((d) => ({ uid: d.id, nombre: String(d.data().nombre ?? ""), usuario: String(d.data().usuario ?? "") }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Quiénes están apuntados, en vivo y SÓLO con lo que confirma el servidor.
 *
 * Para la sala: si alguien se une con la sala abierta, entra en los turnos sin
 * que el anfitrión salga y vuelva. Una respuesta de la caché sin conexión se
 * ignora: vendría vacía y dejaría a todos «fuera de la comunidad».
 */
export function escucharMiembros(alCambiar: (uids: Set<string>) => void, alFallar: (e: unknown) => void): () => void {
  let fin: (() => void) | null = null;
  let vivo = true;
  void (async () => {
    try {
      const { bd } = await nube();
      const { collection, onSnapshot } = await import("firebase/firestore");
      if (!vivo) return;
      fin = onSnapshot(
        collection(bd, "comunidad", "voz", "miembros"),
        { includeMetadataChanges: true },
        (r) => {
          if (r.metadata.fromCache) return;
          alCambiar(new Set(r.docs.map((d) => d.id)));
        },
        alFallar,
      );
    } catch (e) {
      alFallar(e);
    }
  })();
  return () => {
    vivo = false;
    fin?.();
  };
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
export type LlamadaHecha = {
  enviado: true;
  /** Identifica esta llamada en los «me sonó». "" con un portero viejo. */
  llamada: string;
  /** Qué pasó con cada uno. `null` si el portero no pudo leer la lista. */
  resultados: ResultadoLlamada[] | null;
  /** Si se pidieron «me sonó». Falso si este móvil no dio su token o al servidor le falta la clave. */
  vuelta: boolean;
  /** Si salió el aviso general (tema). null si no había nadie más a quien llamar o el portero es viejo. */
  tema: boolean | null;
  /** Cuándo salió, con el reloj de este móvil. */
  en: number;
};

export async function llamarALaComunidad(
  canal: string,
  nombre: string,
): Promise<LlamadaHecha | { enviado: false; porque: string }> {
  const { auth } = await nube();
  const quien = auth.currentUser;
  if (!quien) return { enviado: false, porque: "Hace falta entrar con tu cuenta." };
  try {
    // Dentro del try: con la sesión caducada y sin red, getIdToken lanza, y
    // fuera de aquí el botón se quedaba en «Llamando…» para siempre.
    const token = await quien.getIdToken();
    // El token de avisos de ESTE móvil: es a donde vuelve el «me sonó».
    const miToken = await miTokenDeAvisos();
    const en = Date.now();
    const r = await fetch(`${dondeEstaElPortero()}/llamar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canal, nombre, token, ...(miToken ? { miToken } : {}) }),
    });
    if (r.ok) {
      const d = (await r.json().catch(() => ({}))) as {
        llamada?: unknown;
        resultados?: unknown;
        vuelta?: unknown;
        tema?: unknown;
      };
      const resultados = Array.isArray(d.resultados)
        ? d.resultados
            .filter((x): x is ResultadoLlamada => !!x && typeof x.uid === "string" && typeof x.estado === "string")
            .map((x) => ({ uid: x.uid, nombre: String(x.nombre ?? ""), estado: x.estado }))
        : null;
      return {
        enviado: true,
        llamada: typeof d.llamada === "string" ? d.llamada : "",
        resultados,
        vuelta: d.vuelta === true,
        tema: typeof d.tema === "boolean" ? d.tema : null,
        en,
      };
    }
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

function leerAcuse(crudo: unknown): Acuse | null {
  try {
    const a = (typeof crudo === "string" ? JSON.parse(crudo) : crudo) as Partial<Acuse> | null;
    if (!a || typeof a.llamada !== "string" || typeof a.para !== "string") return null;
    return {
      llamada: a.llamada,
      para: a.para,
      tarda: Number(a.tarda) || 0,
      estado: a.estado && typeof a.estado === "object" ? a.estado : {},
      en: Number(a.en) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Los «me sonó» de una llamada, según llegan. Los que llegaron con la app en
 * segundo plano se leen de lo que guardó el servicio nativo, al empezar y al
 * volver a primer plano; los que llegan con la app delante, al momento.
 * Devuelve cómo dejar de escuchar. Fuera de la app no hace nada.
 */
export function escucharAcuses(llamada: string, alLlegar: (a: Acuse) => void): () => void {
  if (!hayTimbre() || !llamada) return () => {};
  let vivo = true;
  const leerGuardados = async () => {
    try {
      const { lista } = await nativo.acuses();
      const todos = JSON.parse(lista) as unknown[];
      if (!vivo || !Array.isArray(todos)) return;
      for (const crudo of todos) {
        const a = leerAcuse(crudo);
        if (a && a.llamada === llamada) alLlegar(a);
      }
    } catch {
      // Nada guardado que leer.
    }
  };
  void leerGuardados();
  const escucha = nativo.addListener("acuse", (d) => {
    const a = leerAcuse(d.acuse);
    if (vivo && a && a.llamada === llamada) alLlegar(a);
  });
  const alVolver = () => {
    if (document.visibilityState === "visible") void leerGuardados();
  };
  document.addEventListener("visibilitychange", alVolver);
  return () => {
    vivo = false;
    document.removeEventListener("visibilitychange", alVolver);
    void escucha.then((e) => e.remove()).catch(() => {});
  };
}

/**
 * Probar el timbre: el portero hace sonar ESTE móvil dentro de unos segundos,
 * como una llamada de verdad. Antes se asegura de que la ficha tenga el token
 * de este móvil (si se apuntó con la app vieja, no lo tiene).
 */
export async function probarMiTimbre(): Promise<{ ok: true; segundos: number } | { ok: false; porque: string }> {
  if (!hayTimbre()) return { ok: false, porque: "La prueba es desde la app de Android: es el móvil el que suena." };
  const { auth } = await nube();
  const quien = auth.currentUser;
  if (!quien) return { ok: false, porque: "Hace falta entrar con tu cuenta." };
  await reapuntarmeSiEstoyDentro();
  try {
    const r = await fetch(`${dondeEstaElPortero()}/probar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: await quien.getIdToken() }),
    });
    const d = (await r.json().catch(() => ({}))) as { segundos?: number; porque?: string; error?: string };
    if (r.ok) return { ok: true, segundos: Number(d.segundos) || 0 };
    // Un portero sin /probar trata la petición como una entrada a sala y
    // contesta «Ese nombre de sala no es válido»: eso no es lo que pasa.
    if (d.error === "nombre-invalido") {
      return { ok: false, porque: "El servidor todavía no sabe hacer la prueba. Avisa a quien lleva la app." };
    }
    return { ok: false, porque: d.porque ?? "No se pudo pedir la prueba. Vuelve a probar." };
  } catch {
    return { ok: false, porque: "No se pudo pedir la prueba. Mira tu conexión." };
  }
}
