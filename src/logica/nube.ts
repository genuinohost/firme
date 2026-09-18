import { Capacitor } from "@capacitor/core";

/**
 * La cuenta: entrar, el perfil y los amigos.
 *
 * ── Lo que sube y lo que no ───────────────────────────────────────────────
 *
 * Sube el **perfil** (nombre, foto, ciudad, país, versículo) y la **amistad**.
 * Y, desde la 6.3, **la nota suelta en la que alguien tocó «publicar»** — eso
 * vive en `muro.ts`, y allí está explicado por qué cambió.
 *
 * **El diario no se sincroniza, y eso sigue igual.** No hay copia «solo para
 * el dueño», ni «por si se pierde el móvil», ni cifrada. Un diario que sube
 * entero sube también la caída que alguien anotó a las tres de la mañana, y
 * esa no la publicó nadie. La tentación de sincronizarlo «para que no se
 * pierda» va a volver y va a sonar razonable: la respuesta es no.
 *
 * ── Por qué todo esto se carga en diferido ────────────────────────────────
 *
 * Firebase pesa más que media app. Cargarlo al arrancar le costaría un par de
 * segundos a cada usuario en cada apertura — incluidos los que nunca vayan a
 * crear una cuenta, que van a ser la mayoría, y muchos con una conexión mala en
 * un teléfono barato. Así que **no se carga hasta que hace falta**: la primera
 * vez que se entra en la pantalla de la cuenta, o al arrancar sólo si ya se
 * había entrado antes en este móvil.
 */

/**
 * Si las cuentas están abiertas al público.
 *
 * Abiertas el **17 de septiembre de 2026**, cuando Alex activó el acceso con
 * Google en la consola de Firebase y `google-services.json` vino ya con sus dos
 * clientes de OAuth.
 *
 * Estuvo en `false` desde que se escribió la pantalla hasta ese momento, y a
 * propósito: entrar no podía funcionar sin eso, y **una entrada de menú que
 * lleva a un callejón hace más daño que no tener la función** — quien la toca
 * concluye que la app está rota, y de ahí no se vuelve.
 *
 * Si algún día hay que cerrarlas —una fuga, un abuso—, esto vuelve a `false` y
 * la app sigue funcionando entera sin cuenta, como el primer día.
 */
export const CUENTAS_ABIERTAS = true;

const CONFIG = {
  apiKey: "AIzaSyBPt4IdZBkTCa8MarOdg6MopgDbFWO4l1M",
  authDomain: "genuino-host.firebaseapp.com",
  projectId: "genuino-host",
  storageBucket: "genuino-host.firebasestorage.app",
  messagingSenderId: "514594462820",
  appId: "1:514594462820:web:f2307f80472abc31ca5371",
};

/**
 * La marca de que en este móvil alguien entró alguna vez.
 *
 * Es lo que permite no cargar Firebase al arrancar sin dejar fuera a quien ya
 * tiene cuenta. No guarda nada de nadie: es un sí o un no.
 */
const HUBO_SESION = "firme.cuenta.hubo";

export function huboSesion(): boolean {
  try {
    return localStorage.getItem(HUBO_SESION) === "1";
  } catch {
    return false;
  }
}

function apuntarSesion(hay: boolean): void {
  try {
    if (hay) localStorage.setItem(HUBO_SESION, "1");
    else localStorage.removeItem(HUBO_SESION);
  } catch {
    /* modo privado */
  }
}

// ---------------------------------------------------------------- el arranque

type Piezas = {
  auth: import("firebase/auth").Auth;
  bd: import("firebase/firestore").Firestore;
};

let piezas: Promise<Piezas> | null = null;

/** Arranca Firebase una sola vez, y devuelve siempre lo mismo. */
export function nube(): Promise<Piezas> {
  if (piezas) return piezas;
  piezas = (async () => {
    const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = getApps()[0] ?? initializeApp(CONFIG);
    return { auth: getAuth(app), bd: getFirestore(app) };
  })();
  return piezas;
}

// ------------------------------------------------------------------- perfiles

export type Perfil = {
  uid: string;
  /** Cómo se llama, tal cual lo escribe. */
  nombre: string;
  /** El nombre de usuario, único y en minúsculas. Por él lo encuentran. */
  usuario: string;
  foto?: string;
  ciudad?: string;
  pais?: string;
  /** Un versículo de cabecera. Lo que uno lleva por delante. */
  versiculo?: string;
  cita?: string;
  /** Cuándo empezó. Milisegundos. */
  desde?: number;

  /**
   * Si deja que sus hermanos vean sus cifras.
   *
   * **La decisión es de cada uno, y por eso existe este campo.** Enseñar
   * rachas ajenas en una app de disciplina cristiana puede volverla un
   * escaparate — pero esconderlas siempre le quita a un hermano la forma más
   * sencilla de animar a otro. Que lo elija quien se juega la suya.
   *
   * Si falta, se entiende que sí: es lo que dijo Alex — «cada quien decide si
   * las oculta».
   */
  muestraRachas?: boolean;
  /** Días seguidos. Sólo está si la persona deja verlas. */
  racha?: number;
  /** Días desde que empezó a usar la app. */
  diasEnPie?: number;
  /** Bloques cumplidos en total. */
  cumplidos?: number;
};

/** Las cifras que se publican, y sólo si su dueño quiere. */
export type Cifras = { racha: number; diasEnPie: number; cumplidos: number };

export type Amigo = {
  uid: string;
  nombre: string;
  usuario: string;
  foto?: string;
  estado: "enviada" | "recibida" | "aceptada";
  cuando?: number;
};

export type Sesion = {
  uid: string;
  correo: string | null;
  nombre: string | null;
  foto: string | null;
};

function aSesion(u: import("firebase/auth").User): Sesion {
  return { uid: u.uid, correo: u.email, nombre: u.displayName, foto: u.photoURL };
}

/**
 * Avisa cada vez que se entra o se sale.
 *
 * Devuelve la función para dejar de escuchar. Si nadie había entrado nunca en
 * este móvil **no carga Firebase siquiera**: avisa que no hay sesión y se acaba.
 */
export async function vigilarSesion(
  alCambiar: (sesion: Sesion | null) => void,
): Promise<() => void> {
  if (!huboSesion()) {
    alCambiar(null);
    return () => {};
  }
  const { auth } = await nube();
  const { onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(auth, (u) => {
    apuntarSesion(u !== null);
    alCambiar(u ? aSesion(u) : null);
  });
}

/**
 * Entrar con Google.
 *
 * En el móvil lo hace el plugin nativo: abre el selector de cuentas de Android,
 * que es un toque y no pide contraseña. La ventana emergente de la web no
 * funciona dentro de un WebView — se abre y se queda en blanco— así que no
 * vale con un solo camino.
 */
export async function entrarConGoogle(): Promise<Sesion> {
  const { auth } = await nube();
  const { GoogleAuthProvider, signInWithCredential, signInWithPopup } = await import(
    "firebase/auth"
  );

  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    const r = await FirebaseAuthentication.signInWithGoogle();
    const idToken = r.credential?.idToken;
    if (!idToken) throw new Error("Google no devolvió la credencial.");
    const u = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    apuntarSesion(true);
    return aSesion(u.user);
  }

  const u = await signInWithPopup(auth, new GoogleAuthProvider());
  apuntarSesion(true);
  return aSesion(u.user);
}

export async function salir(): Promise<void> {
  const { auth } = await nube();
  const { signOut } = await import("firebase/auth");
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      await FirebaseAuthentication.signOut();
    } catch {
      // Si el lado nativo ya no tiene sesión, da igual: lo que manda es el de abajo.
    }
  }
  await signOut(auth);
  apuntarSesion(false);
}

// --------------------------------------------------------- leer y guardar perfil

export async function leerPerfil(uid: string): Promise<Perfil | null> {
  const { bd } = await nube();
  const { doc, getDoc } = await import("firebase/firestore");
  const d = await getDoc(doc(bd, "usuarios", uid));
  if (!d.exists()) return null;
  const x = d.data();
  return {
    uid,
    nombre: String(x.nombre ?? ""),
    usuario: String(x.usuario ?? ""),
    foto: x.foto ? String(x.foto) : undefined,
    ciudad: x.ciudad ? String(x.ciudad) : undefined,
    pais: x.pais ? String(x.pais) : undefined,
    versiculo: x.versiculo ? String(x.versiculo) : undefined,
    cita: x.cita ? String(x.cita) : undefined,
    desde: typeof x.desde === "number" ? x.desde : undefined,
    // Si no dice nada, se entiende que sí las enseña.
    muestraRachas: x.muestraRachas !== false,
    racha: typeof x.racha === "number" ? x.racha : undefined,
    diasEnPie: typeof x.diasEnPie === "number" ? x.diasEnPie : undefined,
    cumplidos: typeof x.cumplidos === "number" ? x.cumplidos : undefined,
  };
}

/**
 * Publica las cifras del teléfono, o las retira.
 *
 * **Las cifras salen del teléfono y sólo suben si la persona lo permite.** Si
 * lo apaga, no basta con dejar de enviarlas: hay que **borrar las que ya
 * estaban**, o se quedarían ahí para siempre las del día que lo apagó. Apagar
 * algo tiene que apagarlo de verdad.
 */
export async function publicarCifras(
  uid: string,
  cifras: Cifras,
  mostrar: boolean,
): Promise<void> {
  const { bd } = await nube();
  const { doc, updateDoc, deleteField } = await import("firebase/firestore");
  await updateDoc(
    doc(bd, "usuarios", uid),
    mostrar
      ? { muestraRachas: true, ...cifras }
      : {
          muestraRachas: false,
          racha: deleteField(),
          diasEnPie: deleteField(),
          cumplidos: deleteField(),
        },
  );
}

/** Minúsculas y sin tildes: así «José» encuentra a «jose» y al revés. */
export function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Un nombre de usuario legal: minúsculas, números, punto y guion bajo. */
export function limpiarUsuario(bruto: string): string {
  return bruto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20);
}

export function usuarioValido(u: string): boolean {
  return /^[a-z0-9._]{3,20}$/.test(u);
}

export async function usuarioLibre(usuario: string, uidPropio?: string): Promise<boolean> {
  const { bd } = await nube();
  const { doc, getDoc } = await import("firebase/firestore");
  const d = await getDoc(doc(bd, "handles", usuario));
  if (!d.exists()) return true;
  return uidPropio !== undefined && d.data().uid === uidPropio;
}

/**
 * Guarda el perfil, y con él su nombre de usuario.
 *
 * El nombre de usuario vive además como **clave de un documento aparte**,
 * porque Firestore no tiene índices únicos: la única forma de garantizar que no
 * se repita es hacer que sea la clave y prohibir sobrescribir. Y todo va en una
 * transacción: si el nombre se lo llevó otro entre que se comprobó y se guardó,
 * no queda un perfil con un nombre que ya no es suyo.
 */
export async function guardarPerfil(perfil: Perfil, usuarioAnterior?: string): Promise<void> {
  const { bd } = await nube();
  const { doc, runTransaction } = await import("firebase/firestore");

  await runTransaction(bd, async (t) => {
    const clave = doc(bd, "handles", perfil.usuario);

    if (perfil.usuario !== usuarioAnterior) {
      const ya = await t.get(clave);
      if (ya.exists() && ya.data().uid !== perfil.uid) {
        throw new Error("nombre-ocupado");
      }
      t.set(clave, { uid: perfil.uid });
      if (usuarioAnterior) t.delete(doc(bd, "handles", usuarioAnterior));
    }

    const datos: Record<string, unknown> = {
      nombre: perfil.nombre.trim(),
      usuario: perfil.usuario,
      // Una copia del nombre en minúsculas y sin tildes, sólo para buscar.
      // Firestore no sabe buscar sin distinguir mayúsculas, así que la forma
      // de hacerlo es guardar ya normalizado lo que se va a comparar.
      busca: sinTildes(perfil.nombre),
      desde: perfil.desde ?? Date.now(),
    };
    // Los campos vacíos no se guardan: un perfil lleno de cadenas vacías es
    // ruido que luego hay que estar comprobando en todas partes.
    if (perfil.foto) datos.foto = perfil.foto;
    if (perfil.ciudad?.trim()) datos.ciudad = perfil.ciudad.trim();
    if (perfil.pais?.trim()) datos.pais = perfil.pais.trim();
    if (perfil.versiculo?.trim()) datos.versiculo = perfil.versiculo.trim();
    if (perfil.cita?.trim()) datos.cita = perfil.cita.trim();
    datos.muestraRachas = perfil.muestraRachas !== false;

    t.set(doc(bd, "usuarios", perfil.uid), datos);
  });
}

// --------------------------------------------------------------------- amigos

/**
 * Buscar a un hermano.
 *
 * **Antes sólo encontraba por el nombre de usuario exacto**, y eso es un muro:
 * nadie se sabe de memoria el usuario de otro. Alex intentó agregar a José, no
 * le salió nadie, y dio por hecho que la función estaba rota — cuando lo que
 * pasaba es que había buscado «José» y su usuario era `jagpromax`.
 *
 * Ahora se prueba en tres pasos, del más exacto al más amplio, y se devuelve
 * una lista: quien busca «jose» puede encontrar a varios, y eso está bien.
 */
export async function buscarHermanos(consulta: string): Promise<Perfil[]> {
  const texto = sinTildes(consulta).replace(/^@/, "");
  if (texto.length < 3) return [];

  const { bd } = await nube();
  const { doc, getDoc, collection, query, where, orderBy, limit, getDocs } = await import(
    "firebase/firestore"
  );

  const encontrados = new Map<string, Perfil>();

  const anotar = (uid: string, x: Record<string, unknown>) => {
    if (encontrados.has(uid)) return;
    encontrados.set(uid, {
      uid,
      nombre: String(x.nombre ?? ""),
      usuario: String(x.usuario ?? ""),
      foto: x.foto ? String(x.foto) : undefined,
      ciudad: x.ciudad ? String(x.ciudad) : undefined,
      pais: x.pais ? String(x.pais) : undefined,
      versiculo: x.versiculo ? String(x.versiculo) : undefined,
      cita: x.cita ? String(x.cita) : undefined,
      desde: typeof x.desde === "number" ? x.desde : undefined,
    });
  };

  // 1. El nombre de usuario exacto. Es lo más barato y lo más probable cuando
  //    alguien le ha pasado su usuario a otro.
  const limpio = limpiarUsuario(texto);
  if (usuarioValido(limpio)) {
    try {
      const clave = await getDoc(doc(bd, "handles", limpio));
      if (clave.exists()) {
        const perfil = await leerPerfil(String(clave.data().uid));
        if (perfil) encontrados.set(perfil.uid, perfil);
      }
    } catch {
      // Si esto falla, todavía quedan los otros dos caminos.
    }
  }

  // 2. Por el principio del nombre de usuario.
  const porPrefijo = async (campo: string) => {
    try {
      const r = await getDocs(
        query(
          collection(bd, "usuarios"),
          where(campo, ">=", texto),
          where(campo, "<=", texto + ""),
          orderBy(campo),
          limit(8),
        ),
      );
      for (const d of r.docs) anotar(d.id, d.data());
    } catch {
      // Una consulta sin índice no debe tumbar la búsqueda entera.
    }
  };

  if (usuarioValido(limpio)) await porPrefijo("usuario");
  // 3. Y por el principio del nombre, que es como busca la gente de verdad.
  await porPrefijo("busca");

  return [...encontrados.values()].slice(0, 8);
}

/** Por el nombre de usuario exacto. Se mantiene para lo que ya lo usaba. */
export async function buscarPorUsuario(usuario: string): Promise<Perfil | null> {
  return (await buscarHermanos(usuario))[0] ?? null;
}

export async function listarAmigos(uid: string): Promise<Amigo[]> {
  const { bd } = await nube();
  const { collection, getDocs } = await import("firebase/firestore");
  const lista = await getDocs(collection(bd, "usuarios", uid, "amigos"));
  return lista.docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      nombre: String(x.nombre ?? ""),
      usuario: String(x.usuario ?? ""),
      foto: x.foto ? String(x.foto) : undefined,
      estado: (x.estado ?? "enviada") as Amigo["estado"],
      cuando: typeof x.cuando === "number" ? x.cuando : undefined,
    };
  });
}

/**
 * Pedir amistad.
 *
 * Se escriben las dos caras a la vez: «enviada» en la lista de uno y
 * «recibida» en la del otro. Cada lado guarda su propia copia — parece
 * redundante y es justo lo que permite que las reglas sean simples y que nadie
 * pueda tocar la lista de otro salvo para dejar ahí una solicitud suya.
 */
export async function pedirAmistad(yo: Perfil, otro: Perfil): Promise<void> {
  if (yo.uid === otro.uid) throw new Error("uno-mismo");
  if (!yo.uid || !yo.usuario) throw new Error("paso:mi-perfil-incompleto");
  if (!otro.uid || !otro.usuario) throw new Error("paso:su-perfil-incompleto");
  const { bd } = await nube();
  const { doc, writeBatch } = await import("firebase/firestore");
  const lote = writeBatch(bd);
  const cuando = Date.now();

  lote.set(doc(bd, "usuarios", yo.uid, "amigos", otro.uid), {
    estado: "enviada",
    cuando,
    nombre: otro.nombre,
    usuario: otro.usuario,
    ...(otro.foto ? { foto: otro.foto } : {}),
  });
  lote.set(doc(bd, "usuarios", otro.uid, "amigos", yo.uid), {
    estado: "recibida",
    cuando,
    nombre: yo.nombre,
    usuario: yo.usuario,
    ...(yo.foto ? { foto: yo.foto } : {}),
  });
  await lote.commit();
}

export async function aceptarAmistad(yo: string, otro: string): Promise<void> {
  const { bd } = await nube();
  const { doc, writeBatch } = await import("firebase/firestore");
  const lote = writeBatch(bd);
  lote.update(doc(bd, "usuarios", yo, "amigos", otro), { estado: "aceptada" });
  lote.update(doc(bd, "usuarios", otro, "amigos", yo), { estado: "aceptada" });
  await lote.commit();
}

export async function quitarAmistad(yo: string, otro: string): Promise<void> {
  const { bd } = await nube();
  const { doc, writeBatch } = await import("firebase/firestore");
  const lote = writeBatch(bd);
  lote.delete(doc(bd, "usuarios", yo, "amigos", otro));
  lote.delete(doc(bd, "usuarios", otro, "amigos", yo));
  await lote.commit();
}

// ------------------------------------------------------------ borrar la cuenta

/**
 * Borrar la cuenta entera. Sin peros y sin esconderlo.
 *
 * Google Play lo **exige** para cualquier app que permita crear una cuenta, y
 * además es lo decente: quien se va tiene derecho a irse del todo. Se quita al
 * usuario de la lista de sus amigos, su nombre de usuario vuelve a estar libre,
 * su perfil desaparece, y por último se borra la cuenta.
 *
 * Firebase exige haber entrado hace poco para borrar. Si protesta por eso, se
 * vuelve a entrar y se repite: es lo que evita que alguien con el móvil ajeno
 * en la mano borre la cuenta de otro.
 */
export async function borrarCuenta(uid: string, usuario: string): Promise<void> {
  const { auth, bd } = await nube();
  const { doc, writeBatch, collection, getDocs } = await import("firebase/firestore");
  const { deleteUser } = await import("firebase/auth");

  // Borrar el documento del perfil **no borra sus subcolecciones**: Firestore
  // no tiene carpetas, y `usuarios/{uid}` y `usuarios/{uid}/privado/contacto`
  // son dos documentos sin más parentesco que el nombre. Un borrado que deja
  // atrás el WhatsApp de alguien no es un borrado, por mucho que la pantalla
  // diga «se va de verdad». Así que aquí se nombra una por una todo lo que
  // cuelga de una cuenta, y cada colección nueva tiene que pasar por aquí.
  const { query, where } = await import("firebase/firestore");
  const [amigos, privado, bloqueados, mias] = await Promise.all([
    getDocs(collection(bd, "usuarios", uid, "amigos")),
    getDocs(collection(bd, "usuarios", uid, "privado")),
    getDocs(collection(bd, "usuarios", uid, "bloqueados")),
    getDocs(query(collection(bd, "notas"), where("uid", "==", uid))),
  ]);

  const lote = writeBatch(bd);
  for (const a of amigos.docs) {
    lote.delete(doc(bd, "usuarios", uid, "amigos", a.id));
    lote.delete(doc(bd, "usuarios", a.id, "amigos", uid));
  }
  for (const d of privado.docs) lote.delete(doc(bd, "usuarios", uid, "privado", d.id));
  for (const d of bloqueados.docs) lote.delete(doc(bd, "usuarios", uid, "bloqueados", d.id));
  // Y lo que publicó en el muro: irse es irse.
  for (const d of mias.docs) lote.delete(doc(bd, "notas", d.id));
  if (usuario) lote.delete(doc(bd, "handles", usuario));
  lote.delete(doc(bd, "usuarios", uid));
  await lote.commit();

  const u = auth.currentUser;
  if (!u) throw new Error("sin-sesion");
  try {
    await deleteUser(u);
  } catch (e) {
    const codigo = (e as { code?: string }).code ?? "";
    if (codigo === "auth/requires-recent-login") {
      await entrarConGoogle();
      const otra = auth.currentUser;
      if (otra) await deleteUser(otra);
    } else {
      throw e;
    }
  }
  apuntarSesion(false);
}

/** El motivo, en palabras que se puedan enseñar. */
export function comoFallo(e: unknown): string {
  const mensaje = e instanceof Error ? e.message : String(e);
  const codigo = (e as { code?: string })?.code ?? "";

  if (mensaje.includes("paso:mi-perfil-incompleto")) {
    return "Tu perfil está a medias. Guárdalo antes de agregar a nadie.";
  }
  if (mensaje.includes("paso:su-perfil-incompleto")) {
    return "Esa persona todavía no ha terminado su perfil. Que lo guarde y vuelve a probar.";
  }
  if (mensaje.includes("nombre-ocupado")) return "Ese nombre de usuario ya lo tiene alguien.";
  if (mensaje.includes("uno-mismo")) return "Ese eres tú.";
  if (codigo === "auth/network-request-failed" || mensaje.includes("network")) {
    return "Sin conexión. La cuenta necesita internet; el resto de la app no.";
  }
  if (codigo === "auth/popup-closed-by-user" || mensaje.includes("canceled")) {
    return "";
  }
  if (codigo === "permission-denied") {
    // Este mensaje **tiene que decir algo que se pueda usar**. «No tienes
    // permiso» describe el síntoma y esconde la causa, y con eso no se arregla
    // nada: lo que hace falta saber es en qué operación se cayó.
    return (
      "El servidor rechazó la operación (permission-denied). " +
      (mensaje ? "Detalle: " + mensaje.slice(0, 90) : "")
    ).trim();
  }
  // Los dos fallos de «esto no esta encendido en la consola». Se distinguen
  // del resto a proposito: no son culpa de quien lo usa ni se arreglan
  // reintentando, y confundirlos con un fallo de red manda a todo el mundo a
  // mirar su conexion.
  if (codigo === "auth/operation-not-allowed") {
    return "Falta activar el acceso con Google en Firebase.";
  }
  if (
    codigo === "auth/configuration-not-found" ||
    mensaje.includes("CONFIGURATION_NOT_FOUND")
  ) {
    return "Las cuentas todavía no están activadas. Vuelve a probar en un rato.";
  }
  /*
    Lo que no se reconoce **se enseña tal cual**.

    Aquí ponía «Algo salió mal. Inténtalo otra vez.» y eso es exactamente el
    pecado que llevamos todo el día persiguiendo: un fallo convertido en una
    frase de aspecto normal que no permite depurar nada. Alex vio ese mensaje
    ante un `NoClassDefFoundError` —faltaba media librería dentro del APK— y
    daba a entender que bastaba con volver a intentarlo, cuando no iba a
    funcionar nunca.

    Un código feo en pantalla es incómodo. Un mensaje bonito que oculta la causa
    cuesta horas. Se elige lo incómodo.
  */
  const pista = (codigo || mensaje || "").toString().slice(0, 120);
  return pista
    ? `No se pudo entrar. Enséñale esto a quien lleve la app: ${pista}`
    : "No se pudo entrar, y no se pudo averiguar por qué.";
}

// ------------------------------------------------- lo que sólo ven los suyos

/**
 * El WhatsApp, que **no va en el perfil**.
 *
 * El perfil lo puede leer cualquiera que haya entrado —hace falta para poder
 * buscar a un hermano por su nombre—, y un número de teléfono ahí lo recoge
 * cualquiera con una cuenta y un rato libre. Así que vive aparte, y las reglas
 * comprueban que quien lo pide sea un hermano **ya aceptado**.
 */
export async function guardarWhatsapp(uid: string, whatsapp: string): Promise<void> {
  const { bd } = await nube();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(bd, "usuarios", uid, "privado", "contacto"), {
    whatsapp: whatsapp.trim().slice(0, 40),
  });
}

/** Devuelve el WhatsApp si somos hermanos suyos; si no, las reglas lo niegan. */
export async function leerWhatsapp(uid: string): Promise<string | null> {
  const { bd } = await nube();
  const { doc, getDoc } = await import("firebase/firestore");
  try {
    const d = await getDoc(doc(bd, "usuarios", uid, "privado", "contacto"));
    const w = d.exists() ? String(d.data().whatsapp ?? "") : "";
    return w || null;
  } catch {
    // Que lo niegue no es un fallo: es la regla haciendo su trabajo.
    return null;
  }
}

/**
 * El enlace para escribirle, a partir de lo que haya puesto.
 *
 * Se acepta tanto un número como un enlace pegado entero, porque la gente pega
 * lo que tiene a mano y no hay por qué hacerle aprender un formato. De un
 * número se quita todo lo que no sea cifra: los espacios, los guiones y los
 * paréntesis que trae cualquier número copiado de la agenda.
 */
export function enlaceWhatsapp(bruto: string): string | null {
  const t = bruto.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const cifras = t.replace(/\D/g, "");
  if (cifras.length < 8) return null;
  return `https://wa.me/${cifras}`;
}
