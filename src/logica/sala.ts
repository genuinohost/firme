import { Capacitor, registerPlugin } from "@capacitor/core";
import { miUid } from "./muro";
import { nube } from "./nube";

/**
 * La sala de voz, desde el lado de la web.
 *
 * ── Qué pidió Alex ────────────────────────────────────────────────────────
 *
 * > «La app debe tener la capacidad de realizar una llamada grupal. Al menos 30
 * > personas o más unidas en una llamada para poder leer los devocionales y
 * > comentarlos.» (24-09-2026)
 *
 * El detalle de por qué Agora, por qué el SDK nativo y cuánto cuesta está en
 * `docs/investigacion/salas-de-voz.md`. Lo que hay que saber para leer este
 * archivo son tres cosas:
 *
 * 1. **Aquí no viaja audio.** La voz va por el servidor de Agora. Este archivo
 *    coordina: pide permiso, entra, y mantiene al día la lista de quién está.
 * 2. **Quién habla lo decide el token**, que firma una Cloud Function. Un oyente
 *    no es alguien a quien la app no le enciende el micrófono: es alguien cuyo
 *    permiso no incluye publicar voz. Por eso la moderación no se puede saltar
 *    desde un APK modificado.
 * 3. **La lista de quién está dentro sale de Firestore**, no de Agora. Ahí están
 *    los nombres y las fotos. De Agora sólo hace falta lo que Firestore no puede
 *    saber: quién está hablando ahora mismo.
 */

// --------------------------------------------------------------- el plugin

type QuienHabla = { yo: boolean; volumen: number; cuenta?: string };

type SalaNativa = {
  disponible(): Promise<{ hay: boolean; microfono: boolean }>;
  entrar(o: {
    appId: string;
    canal: string;
    token: string;
    cuenta: string;
    habla: boolean;
    nombre: string;
  }): Promise<{ habla: boolean }>;
  salir(): Promise<void>;
  micro(o: { abierto: boolean }): Promise<void>;
  rol(o: { token: string; habla: boolean }): Promise<void>;
  renovar(o: { token: string }): Promise<void>;
  altavoz(o: { puesto: boolean }): Promise<void>;
  addListener(
    evento: "hablando",
    cb: (d: { quienes: QuienHabla[]; total: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    evento: "entrado" | "alguienEntro" | "alguienSalio" | "seSupoQuienEs" | "tokenPorCaducar",
    cb: (d: Record<string, unknown>) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    evento: "problema" | "estadoDeRed",
    cb: (d: { codigo?: number; estado?: number; motivo?: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const nativa = registerPlugin<SalaNativa>("Sala");

/**
 * Si este aparato puede entrar en una sala.
 *
 * Hoy sólo la app de Android. En el navegador haría falta el SDK de JavaScript
 * de Agora, y su propia documentación dice que dentro de un WebView el audio
 * «depende del dispositivo» — así que ahí no se promete lo que no se puede
 * cumplir. Se dice, y se manda a la app.
 */
export function hayVoz(): boolean {
  return Capacitor.isNativePlatform();
}

// ------------------------------------------------------------------ la sala

export type Sala = {
  canal: string;
  nombre: string;
  anfitrion: string;
  abierta: boolean;
  desde: number;
  tipo: "devocional" | "llamada";
};

/** Uno de los que están dentro. Sale de Firestore, con su nombre y su foto. */
export type Dentro = {
  uid: string;
  nombre: string;
  usuario: string;
  foto?: string;
  entro: number;
  /** Pidió comentar. */
  mano: boolean;
  /** El anfitrión le dio la palabra. Sólo él puede moverlo. */
  palabra: boolean;
};

/** Lo que devuelve el portero. */
export type Permiso = {
  appId: string;
  canal: string;
  cuenta: string;
  token: string;
  habla: boolean;
  esAnfitrion: boolean;
  caduca: number;
};

/**
 * Pide permiso de entrada.
 *
 * Es una Cloud Function y no una lectura de Firestore porque firma un token con
 * el certificado de Agora, que no puede estar en la app. Si falla, el motivo que
 * llega ya viene escrito para una persona: «la sala está cerrada», «no puedes
 * entrar en esta sala».
 */
export async function pedirPermiso(canal: string): Promise<Permiso> {
  const { app } = await nube();
  const { connectFunctionsEmulator, getFunctions, httpsCallable } = await import(
    "firebase/functions"
  );
  const funciones = getFunctions(app, "us-central1");
  // El mismo interruptor que en `nube.ts`: en lo que se publica es la constante
  // `false` y esto no entra en el paquete.
  if (import.meta.env.VITE_EMULADORES === "1") {
    connectFunctionsEmulator(funciones, "127.0.0.1", 5011);
  }
  const llamar = httpsCallable<{ canal: string }, Permiso>(funciones, "permisoDeSala");
  return (await llamar({ canal })).data;
}

async function refSala(canal: string) {
  const { bd } = await nube();
  const { doc } = await import("firebase/firestore");
  return doc(bd, "salas", canal);
}

/** Leer una sala. null si no existe. */
export async function leerSala(canal: string): Promise<Sala | null> {
  const { getDoc } = await import("firebase/firestore");
  const d = await getDoc(await refSala(canal));
  if (!d.exists()) return null;
  return { canal, ...(d.data() as Omit<Sala, "canal">) };
}

/**
 * Abrir una sala. La abre quien la modera.
 *
 * El canal es el identificador y **no se puede cambiar**: es lo que Agora usa
 * para juntar a la gente, así que renombrar la sala cambia el nombre que se lee,
 * no el sitio donde están.
 */
export async function abrirSala(
  canal: string,
  nombre: string,
  tipo: Sala["tipo"] = "devocional",
): Promise<void> {
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  const { setDoc } = await import("firebase/firestore");
  await setDoc(await refSala(canal), {
    nombre,
    anfitrion: uid,
    abierta: true,
    desde: Date.now(),
    tipo,
  });
}

/** Cerrarla. Los que estén dentro se quedan hasta que salgan; no entra nadie más. */
export async function cerrarSala(canal: string, nombre: string, tipo: Sala["tipo"]): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  // Se mandan los cinco campos porque las reglas validan el documento entero.
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  await updateDoc(await refSala(canal), { nombre, anfitrion: uid, abierta: false, tipo });
}

// --------------------------------------------------- quién está dentro

async function refDentro(canal: string, uid: string) {
  const { bd } = await nube();
  const { doc } = await import("firebase/firestore");
  return doc(bd, "salas", canal, "dentro", uid);
}

/**
 * Avisa de quién está dentro, y de los cambios.
 *
 * Devuelve la función para dejar de escuchar. **Hay que llamarla al salir de la
 * pantalla**: un oyente de Firestore que se queda vivo sigue gastando datos de
 * alguien que ya no está mirando.
 */
export async function verQuienEsta(
  canal: string,
  alCambiar: (gente: Dentro[]) => void,
): Promise<() => void> {
  const { bd } = await nube();
  const { collection, onSnapshot } = await import("firebase/firestore");
  return onSnapshot(collection(bd, "salas", canal, "dentro"), (lista) => {
    alCambiar(
      lista.docs.map((d) => {
        const x = d.data();
        return {
          uid: d.id,
          nombre: String(x.nombre ?? ""),
          usuario: String(x.usuario ?? ""),
          foto: x.foto ? String(x.foto) : undefined,
          entro: typeof x.entro === "number" ? x.entro : 0,
          mano: x.mano === true,
          palabra: x.palabra === true,
        };
      }),
    );
  });
}

/** Levantar o bajar la mano. Es lo único de su ficha que cada uno puede tocar. */
export async function mano(canal: string, levantada: boolean): Promise<void> {
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(await refDentro(canal, uid), { mano: levantada });
}

/**
 * Dar o quitar la palabra. **Sólo el anfitrión**, y lo garantizan las reglas.
 *
 * Al cambiar, al otro le llega por el oyente de Firestore y su app pide un token
 * nuevo: el papel viaja firmado, así que sin token nuevo no cambia nada.
 */
export async function darLaPalabra(
  canal: string,
  aQuien: string,
  se: boolean,
): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  // Al dar la palabra se le baja la mano: ya se le atendió.
  await updateDoc(await refDentro(canal, aQuien), { palabra: se, mano: false });
}

/** Sacar a alguien, y que no pueda volver. */
export async function expulsar(canal: string, aQuien: string): Promise<void> {
  const { bd } = await nube();
  const { deleteDoc, doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(bd, "salas", canal, "expulsados", aQuien), { cuando: Date.now() });
  await deleteDoc(await refDentro(canal, aQuien));
}

// ------------------------------------------------------------- entrar y salir

/** El canal en el que estamos. Sirve para no entrar dos veces y para salir bien. */
let dentroDe: string | null = null;

export function enQueSalaEstoy(): string | null {
  return dentroDe;
}

/**
 * Entrar en una sala.
 *
 * El orden importa y no es el intuitivo: **primero el permiso de Agora, después
 * apuntarse en la lista.** Si se apuntara antes, un fallo al entrar dejaría a
 * alguien en la lista de presentes sin estar, y los demás lo verían ahí sin
 * oírle nunca. Aparecer en la lista significa estar.
 */
export async function entrarEnSala(
  canal: string,
  quienSoy: { nombre: string; usuario: string; foto?: string },
): Promise<{ habla: boolean; esAnfitrion: boolean }> {
  if (!hayVoz()) throw new Error("solo-en-la-app");
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");

  const permiso = await pedirPermiso(canal);
  const sala = await leerSala(canal);

  await nativa.entrar({
    appId: permiso.appId,
    canal: permiso.canal,
    token: permiso.token,
    cuenta: permiso.cuenta,
    habla: permiso.habla,
    nombre: sala?.nombre ?? "Una sala",
  });
  dentroDe = canal;

  const { setDoc } = await import("firebase/firestore");
  await setDoc(await refDentro(canal, uid), {
    nombre: quienSoy.nombre,
    usuario: quienSoy.usuario,
    ...(quienSoy.foto ? { foto: quienSoy.foto } : {}),
    entro: Date.now(),
    mano: false,
    // Se entra en silencio siempre. Las reglas no admitirían otra cosa.
    palabra: false,
  });

  // En un devocional el altavoz; en una llamada de dos, el auricular.
  await nativa.altavoz({ puesto: sala?.tipo !== "llamada" });

  return { habla: permiso.habla, esAnfitrion: permiso.esAnfitrion };
}

/**
 * Salir.
 *
 * Se suelta el audio **antes** de borrarse de la lista, por lo contrario de
 * antes: si se borrara primero y el audio fallara al soltarse, los demás verían
 * a alguien fuera de la lista y seguirían oyéndole. Desaparecer de la lista
 * significa haber dejado de hablar.
 */
export async function salirDeSala(): Promise<void> {
  const canal = dentroDe;
  dentroDe = null;
  try {
    await nativa.salir();
  } catch {
    // Salir de donde no estás no es un error.
  }
  if (!canal) return;
  const uid = await miUid();
  if (!uid) return;
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(await refDentro(canal, uid));
  } catch {
    // Si la red se cayó, queda un fantasma en la lista. Lo limpia el anfitrión,
    // y es mejor eso que dejar el micrófono abierto por no poder escribir.
  }
}

/** Abrir o cerrar el propio micrófono, sin salirse. */
export async function miMicro(abierto: boolean): Promise<void> {
  await nativa.micro({ abierto });
}

/** Altavoz o auricular. */
export async function porElAltavoz(puesto: boolean): Promise<void> {
  await nativa.altavoz({ puesto });
}

/**
 * Cambiar de oyente a quien habla cuando el anfitrión lo decide.
 *
 * Pide un token nuevo: el papel va firmado dentro, así que no hay forma de
 * ascenderse a uno mismo por este camino.
 */
export async function cambiarDePapel(canal: string): Promise<boolean> {
  const permiso = await pedirPermiso(canal);
  await nativa.rol({ token: permiso.token, habla: permiso.habla });
  return permiso.habla;
}

/** Renovar el token antes de que caduque, sin cambiar de papel. */
export async function renovarToken(canal: string): Promise<void> {
  const permiso = await pedirPermiso(canal);
  await nativa.renovar({ token: permiso.token });
}

// --------------------------------------------------------------- los avisos

/** Quién está hablando ahora mismo. Es lo único que Firestore no puede saber. */
export function verQuienHabla(
  alCambiar: (quienes: QuienHabla[]) => void,
): Promise<{ remove: () => Promise<void> }> {
  return nativa.addListener("hablando", (d) => alCambiar(d.quienes ?? []));
}

/** Cuando el token está por caducar. Hay que renovar o se corta la voz. */
export function alCaducarElToken(
  hacer: () => void,
): Promise<{ remove: () => Promise<void> }> {
  return nativa.addListener("tokenPorCaducar", () => hacer());
}

/**
 * Las salas abiertas ahora mismo.
 *
 * Se consulta sólo por `abierta` y se ordena aquí, en el móvil. Con `orderBy`
 * en la consulta haría falta un índice compuesto en Firestore, y un índice que
 * falta no da un error claro: da una consulta que falla con un enlace para
 * crearlo, en el móvil de alguien, a la hora del devocional. Son veinte salas
 * como mucho: ordenarlas aquí no cuesta nada.
 */
export async function salasAbiertas(): Promise<Sala[]> {
  const { bd } = await nube();
  const { collection, getDocs, limit, query, where } = await import("firebase/firestore");
  const r = await getDocs(
    query(collection(bd, "salas"), where("abierta", "==", true), limit(20)),
  );
  return r.docs
    .map((d) => ({ canal: d.id, ...(d.data() as Omit<Sala, "canal">) }))
    .sort((a, b) => b.desde - a.desde);
}

/**
 * Un identificador de canal a partir del nombre que escribió una persona.
 *
 * Agora no admite acentos ni espacios, así que «Devocional de la mañana» no
 * puede ser el canal. Se le añade la fecha porque **el canal es el sitio**: dos
 * devocionales con el mismo nombre en semanas distintas tienen que ser dos
 * salas, o quien entre tarde a uno se meterá en la grabación mental del otro.
 */
export function canalDesdeNombre(nombre: string, cuando = new Date()): string {
  const limpio = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const dia = cuando.toISOString().slice(0, 10);
  return `${limpio || "sala"}-${dia}`;
}
