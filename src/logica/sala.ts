import { Capacitor, registerPlugin } from "@capacitor/core";
import { dondeEstaElPortero } from "./comunidad";
import { miUid } from "./muro";
import { marcarAsistencia } from "./asistencia";
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
  }): Promise<{ habla: boolean; microfono?: boolean }>;
  salir(): Promise<void>;
  micro(o: { abierto: boolean }): Promise<void>;
  /** Sin token sólo se puede BAJAR a oyente; para hablar hace falta el token nuevo. */
  rol(o: { token?: string; habla: boolean }): Promise<void>;
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
  /**
   * Micrófonos libres: todos pueden abrir el suyo sin pedir la palabra.
   *
   * Lo enciende y lo apaga el anfitrión. Alex, el 27-09-2026: «cuando viene la
   * lectura en los devocionales, todos deben tener la posibilidad de abrir y
   * cerrar el micrófono sin mi permiso porque sería muy tedioso». Cuando está
   * apagado, se vuelve a levantar la mano.
   *
   * Vive en la sala y no en cada ficha porque es una decisión sobre todos, y
   * la sala sólo la escribe él. El portero lo lee al firmar el token.
   */
  micLibre?: boolean;
  /**
   * La campana: a ese instante suena suave en el móvil de todos los que están
   * dentro, para avisar de que el tiempo se acabó y hay que cerrar el
   * comentario. Alex, el 28-09-2026: el devocional es de 5 a 6, los comentarios
   * de 5:40 a 6:00, y «a las 6 debe sonar a todos una campanita suave». La
   * enciende y la apaga él. `cuando` es un instante absoluto, para que suene a
   * la vez en Caracas y en Madrid; cada móvil la hace sonar por su cuenta.
   */
  campana?: { cuando: number; activa: boolean };
  /**
   * La lectura por turnos del devocional: qué día, qué trozo va, en qué puesto
   * de la lista y quién lo lee. Alex, 28-09-2026: «el sistema debe
   * identificar, según la lista de participantes y si está o no conectado, a
   * quién le toca leer, y debe salir un letrero sutil arriba para que la
   * persona sepa que le toca; también quién es el próximo».
   */
  lectura?: Lectura;
};

export type Lectura = {
  plan: string;
  dia: number;
  /** El índice del trozo que se está leyendo; igual al total, se acabó. */
  trozo: number;
  /**
   * Cuántos trozos tiene la lectura, fijado al empezarla. Con él, todos saben
   * a la vez cuándo se acaba aunque el texto no les haya cargado o tengan una
   * copia distinta del día.
   */
  total: number;
  /** El puesto en la lista de quien lee (−1 si nadie). */
  puesto: number;
  /** El id de la entrada de la lista, y su cuenta. */
  lector: string;
  lectorUid: string;
  desde: number;
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
  /** Días seguidos viniendo al devocional (🔥) y faltas del último mes (😢). */
  racha?: number;
  faltas?: number;
  /**
   * El anfitrión le cerró el micrófono. Sólo él lo pone y lo quita; al que
   * lo lleva, su app le cierra el micro y no le deja abrirlo. Alex,
   * 28-09-2026: «debo tener la opción de mutear micrófonos encima de los
   * participantes», sobre todo al acabar, cuando alguien olvida colgar.
   */
  silenciado?: boolean;
  /** «Hoy sólo escucho» 👂: la lectura por turnos se lo salta. */
  escucha?: boolean;
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
  const { auth } = await nube();
  const quien = auth.currentUser;
  if (!quien) throw new Error("sin-cuenta");

  // El token de la sesión, que es lo único que el portero necesita para saber
  // quién llama. Firebase lo renueva solo cuando toca.
  const token = await quien.getIdToken();

  const r = await fetch(dondeEstaElPortero(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canal, token }),
  });

  if (!r.ok) {
    // El portero manda el motivo ya escrito para una persona — «la sala está
    // cerrada», «no puedes entrar en esta sala»—, porque él es el único que lo
    // sabe. Si no vino ninguno, es que falló la red y no el permiso.
    let porque = "No se pudo entrar en la sala.";
    try {
      const e = (await r.json()) as { porque?: string };
      if (e?.porque) porque = e.porque;
    } catch {
      // Una respuesta que no es JSON significa que no llegamos al portero.
    }
    throw new Error(porque);
  }

  return (await r.json()) as Permiso;
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
  campana?: Sala["campana"],
): Promise<void> {
  // Desde donde no se puede entrar no se abre: si no, desde el navegador
  // quedaba una sala «sonando ahora» para los treinta y nadie dentro.
  if (!hayVoz()) throw new Error("solo-en-la-app");
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  const { setDoc } = await import("firebase/firestore");
  await setDoc(await refSala(canal), {
    nombre,
    anfitrion: uid,
    abierta: true,
    desde: Date.now(),
    tipo,
    // Se nace con permiso. Que sea el anfitrión quien decida soltar los
    // micrófonos, y no que se encuentre treinta abiertos sin haberlo pedido.
    micLibre: false,
    ...(campana ? { campana } : {}),
  });
}

/** Poner, mover o apagar la campana. Sólo el anfitrión, y lo garantizan las reglas. */
export async function ponerCampana(
  canal: string,
  campana: NonNullable<Sala["campana"]>,
): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(await refSala(canal), { campana });
}

/**
 * Soltar o recoger los micrófonos. Sólo el anfitrión, y lo garantizan las
 * reglas.
 *
 * A los demás les llega por el oyente de la sala y su app pide un token nuevo:
 * el permiso de hablar viaja firmado, así que sin token nuevo no cambia nada.
 */
export async function ponerMicLibre(canal: string, libre: boolean): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(await refSala(canal), { micLibre: libre });
}

/**
 * Avisa de cualquier cambio en la sala: se cerró, se soltaron los micrófonos.
 *
 * Devuelve la función para dejar de escuchar. Hay que llamarla al salir.
 */
export async function verSala(
  canal: string,
  alCambiar: (sala: Sala | null) => void,
): Promise<() => void> {
  const { onSnapshot } = await import("firebase/firestore");
  return onSnapshot(await refSala(canal), (d) => {
    alCambiar(d.exists() ? { canal, ...(d.data() as Omit<Sala, "canal">) } : null);
  });
}

/**
 * Cerrarla: no entra nadie más ni se renueva ningún token, y a los de dentro
 * les llega que se cerró y su app sale sola. Puede el anfitrión, y cualquier
 * moderador si el anfitrión la dejó abierta (se le apagó el móvil).
 */
export async function cerrarSala(canal: string): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  // Sólo `abierta`: en un update las reglas ven el documento fusionado, y la
  // regla del moderador exige que no cambie nada más.
  await updateDoc(await refSala(canal), { abierta: false });
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
          ...(typeof x.racha === "number" ? { racha: x.racha } : {}),
          ...(typeof x.faltas === "number" ? { faltas: x.faltas } : {}),
          ...(x.silenciado === true ? { silenciado: true } : {}),
          ...(x.escucha === true ? { escucha: true } : {}),
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

/** «Hoy sólo escucho» 👂, o volver a leer. Es de cada uno. */
export async function soloEscucho(canal: string, si: boolean): Promise<void> {
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(await refDentro(canal, uid), { escucha: si });
  apuntarEscucha(si);
}

// «Hoy sólo escucho» se recuerda en el móvil el día entero. Al volver a entrar
// —se cayó la red, MIUI cerró la app— la ficha se borra y se crea de nuevo, y
// sin esto la persona volvía a la lista de turnos sin haberlo pedido.
const CLAVE_ESCUCHA = "genuino.sala.escucha";

function hoyLocal(): string {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

function apuntarEscucha(si: boolean): void {
  try {
    if (si) localStorage.setItem(CLAVE_ESCUCHA, hoyLocal());
    else localStorage.removeItem(CLAVE_ESCUCHA);
  } catch {
    // Sin almacenamiento, se pierde al volver a entrar; no es grave.
  }
}

function escuchaHoy(): boolean {
  try {
    return localStorage.getItem(CLAVE_ESCUCHA) === hoyLocal();
  } catch {
    return false;
  }
}

/**
 * Empezar la lectura. Sólo el anfitrión (lo garantizan las reglas).
 */
export async function ponerLectura(canal: string, lectura: Lectura): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(await refSala(canal), { lectura });
}

/**
 * Mover la lectura —pasar el turno, volver atrás, que lea otro— SÓLO si sigue
 * donde quien toca el botón la vio. Devuelve `false` si ya se había movido.
 *
 * El lector dice «Terminé» y, en el mismo segundo, el anfitrión toca
 * «Siguiente» con la pantalla todavía sin actualizar: sin esta comprobación,
 * la lectura saltaba dos trozos y uno se quedaba sin leer. Y un doble toque en
 * «Terminé» ya no da un error falso: el segundo ve que ya avanzó y no hace nada.
 */
export async function moverLectura(
  canal: string,
  vista: Pick<Lectura, "trozo" | "lectorUid" | "desde">,
  nueva: Lectura,
): Promise<boolean> {
  const { runTransaction } = await import("firebase/firestore");
  const { bd } = await nube();
  const ref = await refSala(canal);
  return runTransaction(bd, async (t) => {
    const d = await t.get(ref);
    const ahora = d.data()?.lectura as Lectura | undefined;
    if (!ahora || ahora.trozo !== vista.trozo || (ahora.lectorUid ?? "") !== vista.lectorUid || ahora.desde !== vista.desde) {
      return false;
    }
    t.update(ref, { lectura: nueva });
    return true;
  });
}

/** Terminar la lectura por turnos: se quita de la sala. Sólo el anfitrión. */
export async function quitarLectura(canal: string): Promise<void> {
  const { updateDoc, deleteField } = await import("firebase/firestore");
  await updateDoc(await refSala(canal), { lectura: deleteField() });
}

/** Quitar a alguien de la lista SIN vetarlo: para limpiar a quien se cayó. Sólo el anfitrión. */
export async function sacarDeLaLista(canal: string, aQuien: string): Promise<void> {
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(await refDentro(canal, aQuien));
}

/**
 * Volver a oyente YA, sin esperar al portero.
 *
 * Callarse no necesita token: el token sólo hace falta para hablar. Si se
 * esperara al portero y la red fallara, la persona seguiría publicando hasta
 * que caducara el token con la pantalla diciéndole que tiene la palabra.
 */
export async function callarme(): Promise<void> {
  await nativa.micro({ abierto: false });
  await nativa.rol({ habla: false });
}

/** Cerrarle o abrirle el micrófono a alguien. Sólo el anfitrión; lo garantizan las reglas. */
export async function silenciar(canal: string, aQuien: string, si: boolean): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(await refDentro(canal, aQuien), { silenciado: si });
}

/**
 * Terminar para todos: cerrar la sala y vaciar la lista.
 *
 * Alex, 28-09-2026: «cuando finaliza el devocional hay hermanos que olvidan
 * cerrar la llamada. Debí tener la opción de poder finalizar la llamada para
 * todos». A cada uno le llega que la sala se cerró y que ya no está en la
 * lista, y su app suelta el audio y sale sola.
 */
export async function terminarParaTodos(canal: string): Promise<void> {
  await cerrarSala(canal);
  const { bd } = await nube();
  const { collection, getDocs, writeBatch } = await import("firebase/firestore");
  const dentro = await getDocs(collection(bd, "salas", canal, "dentro"));
  if (dentro.empty) return;
  const lote = writeBatch(bd);
  dentro.docs.forEach((d) => lote.delete(d.ref));
  await lote.commit();
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
): Promise<{ habla: boolean; esAnfitrion: boolean; micLibre: boolean; microfono: boolean }> {
  if (!hayVoz()) throw new Error("solo-en-la-app");
  const uid = await miUid();
  if (!uid) throw new Error("sin-cuenta");

  // Si quedó una ficha de otra vez (se cayó la red, MIUI mató la app), se
  // borra antes de pedir permiso: así el portero no la lee —con la palabra
  // de ayer puesta— y se entra en silencio, como siempre; y apuntarse es
  // crear, no sobrescribir, que las reglas no dejarían.
  const { deleteDoc, setDoc } = await import("firebase/firestore");
  await deleteDoc(await refDentro(canal, uid)).catch(() => {});

  const permiso = await pedirPermiso(canal);
  const sala = await leerSala(canal);

  // Venir a un devocional es asistir: se apunta el día, sube la racha (o
  // arranca) y los dos números van a la ficha, donde los ven los demás. Si
  // falla, se entra igual: la asistencia no puede dejar a nadie fuera.
  const asistencia =
    sala?.tipo === "devocional" ? await marcarAsistencia(quienSoy).catch(() => null) : null;

  const entrada = await nativa.entrar({
    appId: permiso.appId,
    canal: permiso.canal,
    token: permiso.token,
    cuenta: permiso.cuenta,
    habla: permiso.habla,
    nombre: sala?.nombre ?? "Una sala",
  });
  dentroDe = canal;

  try {
    await setDoc(await refDentro(canal, uid), {
      nombre: quienSoy.nombre,
      usuario: quienSoy.usuario,
      ...(quienSoy.foto ? { foto: quienSoy.foto } : {}),
      entro: Date.now(),
      mano: false,
      // Se entra en silencio siempre. Las reglas no admitirían otra cosa.
      palabra: false,
      ...(asistencia ? { racha: asistencia.racha, faltas: asistencia.faltas } : {}),
      ...(escuchaHoy() ? { escucha: true } : {}),
    });
  } catch (e) {
    // Aparecer en la lista significa estar. Si no se pudo, no se está: se
    // suelta el audio antes de decirlo, o quedaría un micrófono en una sala
    // en la que nadie te ve.
    await nativa.salir().catch(() => {});
    dentroDe = null;
    throw e;
  }

  // En un devocional el altavoz; en una llamada de dos, el auricular.
  await nativa.altavoz({ puesto: sala?.tipo !== "llamada" });

  return {
    // Lo que dice el nativo, no el portero: sin permiso de micrófono se entra
    // igual, pero a escuchar.
    habla: entrada.habla,
    esAnfitrion: permiso.esAnfitrion,
    micLibre: sala?.micLibre === true,
    microfono: entrada.microfono !== false,
  };
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
 * Quién llega y quién se va del canal de voz, por su cuenta.
 *
 * Firestore no se entera de que alguien se cayó: su ficha sigue en la lista
 * hasta que su móvil la borra, y si MIUI le cerró la app no la borra nunca.
 * Agora sí: avisa unos segundos después. Lo usa el anfitrión para no darle el
 * turno de lectura a un fantasma.
 *
 * Sólo avisa de quien publica voz (en directo, los oyentes no cuentan), y el
 * «pasó a oyente» (motivo 2) no es irse: sigue dentro.
 */
export function verLlegadasYSalidas(avisos: {
  alEntrar: (cuenta: string) => void;
  alSalir: (cuenta: string) => void;
}): () => void {
  const cuentas = new Map<number, string>();
  const apuntar = (d: Record<string, unknown>) => {
    if (typeof d.cuenta === "string" && d.cuenta) cuentas.set(Number(d.uid), d.cuenta);
  };
  const escuchas = [
    nativa.addListener("alguienEntro", (d) => {
      apuntar(d);
      const c = cuentas.get(Number(d.uid));
      if (c) avisos.alEntrar(c);
    }),
    nativa.addListener("seSupoQuienEs", (d) => {
      apuntar(d);
      const c = cuentas.get(Number(d.uid));
      if (c) avisos.alEntrar(c);
    }),
    nativa.addListener("alguienSalio", (d) => {
      if (Number(d.motivo ?? 0) === 2) return;
      const c = typeof d.cuenta === "string" && d.cuenta ? d.cuenta : cuentas.get(Number(d.uid));
      if (c) avisos.alSalir(c);
    }),
  ];
  return () => escuchas.forEach((e) => void e.then((x) => x.remove()).catch(() => {}));
}

/**
 * Cuando cambia la conexión con Agora. 4 es «reconectando»; 5, que se rindió
 * (veinte minutos sin red, o el token caducó sin renovarse). Sin oír esto la
 * pantalla decía «dentro» de una sala en la que ya no se estaba.
 */
export function alCambiarLaRed(
  hacer: (estado: number, motivo: number) => void,
): Promise<{ remove: () => Promise<void> }> {
  return nativa.addListener("estadoDeRed", (d) => hacer(d.estado ?? 0, d.motivo ?? 0));
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
  // Por tiempo y no por `abierta`: el portero deja de firmar tokens a las
  // cuatro horas (SALA_DURA_MS, el mismo techo que en el Worker), así que una
  // sala más vieja está cerrada aunque nadie la cerrara — y sin esto las
  // salas olvidadas de cada día se comían los veinte huecos de la lista y la
  // de hoy podía no salir. Un rango sobre un solo campo no pide índice.
  const r = await getDocs(
    query(collection(bd, "salas"), where("desde", ">", Date.now() - SALA_DURA_MS), limit(20)),
  );
  return r.docs
    .map((d) => ({ canal: d.id, ...(d.data() as Omit<Sala, "canal">) }))
    .filter((s) => s.abierta === true)
    .sort((a, b) => b.desde - a.desde);
}

/** Cuánto vive una sala aunque nadie la cierre. El mismo número que en el portero. */
export const SALA_DURA_MS = 4 * 3600_000;

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
