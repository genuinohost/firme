import { nube } from "./nube";

/**
 * «Caminemos con la Palabra»: el devocional de cada día, leído en comunidad.
 *
 * ── La dinámica, tal como la contó Alex (video del 28-09-2026) ────────────
 *
 * > «Los devocionales salen de uno de los planes de YouVersion que se llama
 * > Caminemos con la Palabra: 365 días para leer toda la Biblia. El 1 de enero
 * > comenzamos con Génesis 1… A las 4:50 se manda el buenos días. Después la
 * > lista y a quién le toca el comentario: eso se va moviendo por esta misma
 * > lista, todo es continuo. Hoy le tocó a una hermana, mañana le toca al
 * > hermano que sigue. Entre 4:50 y 4:59 envío la lectura. Cada quien lee un
 * > párrafo: uno lee Gálatas 6:6-10, después viene otro con 6:11-15… otro
 * > lee el punto 1 de la reflexión, el siguiente el punto 2… Se lee de 5 a
 * > 5:35. Yo doy un breve comentario y le doy el paso a la persona que hace el
 * > comentario, desde las 5:40 hasta las 6.»
 *
 * Así que aquí hay tres cosas:
 *
 * 1. **El archivo**: cada día, ya partido en los trozos que se leen por turnos
 *    (`devocionales/caminemos-2026/dias/{N}`, sólo para la comunidad: lleva el
 *    texto bíblico completo, que tiene derechos, igual que el grupo).
 * 2. **El orden de lectura**: la lista, y el ancla del comentario — qué puesto
 *    comentó qué día; desde ahí avanza uno por día y da la vuelta.
 * 3. **El turno**: quién lee el trozo que va, saltándose a quien no está en la
 *    sala o hoy sólo escucha (el 👂 del grupo).
 */

export const PLAN = "caminemos-2026";
export const NOMBRE_PLAN = "Caminemos con la Palabra";
export const DIAS_DEL_PLAN = 365;

export type Trozo = {
  tipo: "pasaje" | "reflexion" | "preguntas" | "oracion" | "recordatorio" | "comparte" | "clave";
  /** «Isaías 13:1-5», «Reflexión · 3», «Oración del día». */
  ref: string;
  texto: string;
};

export type Devocional = {
  dia: number;
  fecha: string;
  tema: string;
  /** «Isaías 13», «Gálatas 6»: los capítulos de la lectura, en orden. */
  capitulos: string[];
  trozos: Trozo[];
  /** «Lo que aprendí hoy», si Alex lo mandó ese día. */
  aprendi?: string;
  /** Cuándo se subió esta versión del día (ms). Para saber si la del móvil es vieja. */
  subido?: number;
};

// ------------------------------------------------------------- los días

/** El día del plan para una fecha: el 1 de enero es el 1. En bisiesto, el 29 de febrero comparte con el 28. */
export function diaDelPlan(fecha = new Date()): number {
  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const hoy = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  let n = Math.round((hoy.getTime() - inicio.getTime()) / 86_400_000) + 1;
  const bisiesto = new Date(fecha.getFullYear(), 1, 29).getMonth() === 1;
  if (bisiesto && n >= 60) n -= 1;
  return Math.min(DIAS_DEL_PLAN, Math.max(1, n));
}

/**
 * La fecha de un día del plan, en el año dado: la inversa de `diaDelPlan`.
 * En bisiesto el 29 de febrero comparte día con el 28, así que del día 60 en
 * adelante hay que saltarse uno (el 60 es el 1 de marzo, el 365 el 31 de diciembre).
 */
export function fechaDelDia(n: number, año = new Date().getFullYear()): Date {
  const bisiesto = new Date(año, 1, 29).getMonth() === 1;
  return new Date(año, 0, n + (bisiesto && n >= 60 ? 1 : 0));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
/** «sept 29», como en la tira de días de YouVersion. */
export function fechaCorta(n: number): string {
  const f = fechaDelDia(n);
  return `${MESES[f.getMonth()]} ${f.getDate()}`;
}

// ------------------------------------------------------------- el archivo

/** Lleva el plan: el día 272 de otro plan es otro texto. */
const claveCache = (n: number) => `genuino.devocional.${PLAN}.${n}`;
/**
 * Pasado este tiempo, se vuelve a preguntar si hay una versión más nueva:
 * un día se puede corregir y volver a subir, y los móviles que ya lo habían
 * abierto se quedarían con el viejo para siempre.
 */
const CACHE_VALE_MS = 12 * 3600_000;

type EnCache = { dev: Devocional; guardado: number };

function deCache(n: number): EnCache | null {
  try {
    const x = localStorage.getItem(claveCache(n));
    return x ? (JSON.parse(x) as EnCache) : null;
  } catch {
    return null;
  }
}

/**
 * Cuántos días se guardan en el móvil: los de alrededor de hoy y los últimos
 * abiertos. Cada día pesa unos 20 KB y el almacenamiento es el MISMO donde la
 * app guarda las tareas y las rachas: sin tope, pasear por la tira acababa
 * llenándolo y lo que se rompía era lo de la persona, no esto.
 */
const DIAS_EN_EL_MOVIL = 8;

function aCache(dev: Devocional): void {
  const valor = JSON.stringify({ dev, guardado: Date.now() } satisfies EnCache);
  try {
    localStorage.setItem(claveCache(dev.dia), valor);
  } catch {
    // Lleno: se hace sitio con lo nuestro y se prueba una vez más.
    podarCache(dev.dia, 0);
    try {
      localStorage.setItem(claveCache(dev.dia), valor);
    } catch {
      return;
    }
  }
  podarCache(dev.dia, DIAS_EN_EL_MOVIL);
}

/** Quitar días guardados: se quedan hoy ±2, el recién guardado y los `quedan` más recientes. */
function podarCache(recien: number, quedan: number): void {
  try {
    const hoy = diaDelPlan();
    const nuestras: { clave: string; dia: number; guardado: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (!clave) continue;
      // Las de antes de llevar el plan en la clave («genuino.devocional.271»), fuera.
      if (/^genuino\.devocional\.\d+$/.test(clave)) {
        nuestras.push({ clave, dia: -1, guardado: 0 });
        continue;
      }
      const m = clave.startsWith(`genuino.devocional.${PLAN}.`) ? /\.(\d+)$/.exec(clave) : null;
      if (!m) continue;
      let guardado = 0;
      try {
        guardado = (JSON.parse(localStorage.getItem(clave) ?? "{}") as EnCache).guardado ?? 0;
      } catch {
        // Ilegible: fuera también.
      }
      nuestras.push({ clave, dia: Number(m[1]), guardado });
    }
    const fijos = (d: number) => d === recien || Math.abs(d - hoy) <= 2;
    const sobran = nuestras
      .filter((x) => !fijos(x.dia))
      .sort((a, b) => b.guardado - a.guardado)
      .slice(quedan);
    for (const x of sobran) localStorage.removeItem(x.clave);
  } catch {
    // Sin almacenamiento no hay nada que podar.
  }
}

/**
 * Un día del archivo. Se guarda en el móvil al leerlo: a las 4:55 de la
 * mañana no puede depender de la red. `null` si ese día no está (todavía no
 * se subió, o no se mandó).
 *
 * `fresco`: preguntar siempre al servidor (y quedarse con la copia sólo si no
 * hay red). Lo usa la sala: el anfitrión y los lectores tienen que estar
 * leyendo la MISMA versión del día, o cada uno contaría trozos distintos.
 */
export async function leerDia(n: number, { fresco = false }: { fresco?: boolean } = {}): Promise<Devocional | null> {
  const guardado = deCache(n);
  if (guardado && !fresco && Date.now() - guardado.guardado < CACHE_VALE_MS) return guardado.dev;
  try {
    const { bd } = await nube();
    const { doc, getDoc } = await import("firebase/firestore");
    const d = await getDoc(doc(bd, "devocionales", PLAN, "dias", String(n)));
    if (!d.exists()) return null;
    const dev = devocionalDe(n, d.data());
    aCache(dev);
    return dev;
  } catch (e) {
    // Sin red, la copia vieja es mejor que nada. Sin permiso, no: quien salió
    // de la comunidad deja de tenerlo.
    const codigo = String((e as { code?: string })?.code ?? "");
    if (guardado && !codigo.includes("permission-denied")) return guardado.dev;
    throw e;
  }
}

/**
 * El día, en vivo: para la sala. Avisa en cuanto aparece —Alex lo pega a las
 * 4:55 con la sala ya abierta— y si lo corrigen; y Firestore se reconecta solo
 * cuando vuelve la red. `null` mientras no exista.
 *
 * Devuelve la función para dejar de escuchar.
 */
export function escucharDia(
  n: number,
  /** `provisional`: viene de una copia sin confirmar con el servidor. */
  alCambiar: (dev: Devocional | null, provisional?: boolean) => void,
  alFallar: (e: unknown) => void,
): () => void {
  let fin: (() => void) | null = null;
  let vivo = true;
  void (async () => {
    try {
      const { bd } = await nube();
      const { doc, onSnapshot } = await import("firebase/firestore");
      if (!vivo) return;
      fin = onSnapshot(
        doc(bd, "devocionales", PLAN, "dias", String(n)),
        // Con los cambios de metadatos: si el primer aviso llega sin conexión
        // («no está», de la caché), el servidor confirma después el «no existe
        // de verdad» sólo como un cambio de metadatos. Sin esto, la sala se
        // quedaba en «Cargando…» y el anfitrión sin el botón de pegar.
        { includeMetadataChanges: true },
        (d) => {
          if (!d.exists()) {
            // Sin conexión con el servidor, Firestore dice «no está» sólo
            // porque no lo tiene en memoria. Eso no es «el día no existe»: se
            // usa la copia del móvil si la hay, y si no, se espera al servidor.
            if (d.metadata.fromCache) {
              const copia = deCache(n);
              if (copia) alCambiar(copia.dev, true);
              return;
            }
            return alCambiar(null);
          }
          const dev = devocionalDe(n, d.data());
          aCache(dev);
          alCambiar(dev, d.metadata.fromCache);
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

function devocionalDe(n: number, x: Record<string, unknown>): Devocional {
  return {
    dia: Number(x.dia ?? n),
    fecha: String(x.fecha ?? ""),
    tema: String(x.tema ?? ""),
    capitulos: Array.isArray(x.capitulos) ? x.capitulos.map(String) : [],
    trozos: Array.isArray(x.trozos)
      ? x.trozos
          // Un elemento que no es un trozo (un null guardado a mano) no puede
          // tumbar la pantalla de todos: se salta.
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map((t: Record<string, unknown>) => ({
          tipo: String(t.tipo) as Trozo["tipo"],
          ref: String(t.ref ?? ""),
          texto: String(t.texto ?? ""),
        }))
      : [],
    ...(x.aprendi ? { aprendi: String(x.aprendi) } : {}),
    ...(typeof x.subido === "number" ? { subido: x.subido } : {}),
  };
}

/**
 * Subir (o corregir) un día pegando el devocional. Sólo quien modera; lo
 * garantizan las reglas.
 *
 * Es lo que hace que la app no dependa de nadie más que de quien lleva el
 * grupo: Alex genera el devocional cada día (el Bloque 1 del prompt), lo manda
 * al grupo a las 4:50 y lo pega aquí. Desde ese momento la sala lo reparte.
 */
export async function guardarDia(dev: Devocional): Promise<void> {
  const { bd } = await nube();
  const { doc, setDoc } = await import("firebase/firestore");
  const subido = Date.now();
  await setDoc(doc(bd, "devocionales", PLAN, "dias", String(dev.dia)), {
    dia: dev.dia,
    fecha: dev.fecha,
    tema: dev.tema,
    capitulos: dev.capitulos,
    trozos: dev.trozos.map((t) => ({ tipo: t.tipo, ref: t.ref, texto: t.texto })),
    ...(dev.aprendi ? { aprendi: dev.aprendi } : {}),
    subido,
  });
  aCache({ ...dev, subido });
}

// ------------------------------------------------- las secciones de un día
//
// Como en YouVersion: primero «Devocional» y después cada capítulo de la
// lectura, cada uno con su círculo. «Iniciar lectura» los recorre en orden.

export type Seccion = {
  id: string;
  titulo: string;
  trozos: Trozo[];
};

export function seccionesDe(dev: Devocional): Seccion[] {
  const propias = dev.trozos.filter((t) => t.tipo !== "pasaje");
  const porCapitulo = new Map<string, Trozo[]>();
  for (const t of dev.trozos.filter((t) => t.tipo === "pasaje")) {
    const cap = t.ref.replace(/:\d.*$/, "");
    porCapitulo.set(cap, [...(porCapitulo.get(cap) ?? []), t]);
  }
  const secciones: Seccion[] = [{ id: "devocional", titulo: "Devocional", trozos: propias }];
  for (const [cap, trozos] of porCapitulo) secciones.push({ id: cap, titulo: cap, trozos });
  if (dev.aprendi) {
    secciones.push({
      id: "aprendi",
      titulo: "Lo que aprendí hoy",
      trozos: [{ tipo: "recordatorio", ref: "Lo que aprendí hoy", texto: sinTitulo(dev.aprendi) }],
    });
  }
  return secciones;
}

/** El mensaje del grupo empieza por «lo que aprendí hoy:», que ya es el título. */
function sinTitulo(texto: string): string {
  return texto.replace(/^\s*[*_]*lo que aprend[ií] hoy\s*:?\s*[*_]*\s*/i, "").trim();
}

// ------------------------------------------------------ lo leído, por día

const CLAVE_LEIDO = "genuino.devocional.leido";

type Leido = Record<string, string[]>;

function leerLeido(): Leido {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LEIDO) ?? "{}") as Leido;
  } catch {
    return {};
  }
}

export function leidasDe(dia: number): Set<string> {
  return new Set(leerLeido()[String(dia)] ?? []);
}

export function marcarLeida(dia: number, seccion: string): void {
  const todo = leerLeido();
  const ya = new Set(todo[String(dia)] ?? []);
  ya.add(seccion);
  todo[String(dia)] = [...ya];
  try {
    localStorage.setItem(CLAVE_LEIDO, JSON.stringify(todo));
  } catch {
    // Sin sitio no se recuerda; la lectura sigue.
  }
}

/** Si un día quedó leído entero (para el ✓ de la tira). */
export function diaCompleto(dia: number, secciones: number | null): boolean {
  const n = leidasDe(dia).size;
  return secciones != null ? n >= secciones && n > 0 : (leerLeido()[String(dia)]?.includes("*") ?? false);
}

/** Los días leídos enteros, de una vez: la tira pinta 365 y no puede leer el almacenamiento 365 veces. */
export function diasCompletos(): Set<number> {
  const todo = leerLeido();
  return new Set(
    Object.entries(todo)
      .filter(([, secciones]) => secciones.includes("*"))
      .map(([dia]) => Number(dia)),
  );
}

/** Apuntar que el día entero se leyó, para la tira aunque no se tenga el archivo a mano. */
export function marcarDiaCompleto(dia: number): void {
  marcarLeida(dia, "*");
}

// ---------------------------------------------------- el orden de lectura

export type Lector = {
  /** Estable dentro de la lista: «e1», «e2»… */
  id: string;
  nombre: string;
  /** Su cuenta en la app, si ya la vinculó quien modera. */
  uid?: string;
};

export type Orden = {
  lista: Lector[];
  /** Qué puesto (0 = el primero) comentó qué día. Desde ahí, uno por día. */
  ancla: { fecha: string; puesto: number };
};

export async function leerOrden(): Promise<Orden | null> {
  const { bd } = await nube();
  const { doc, getDoc } = await import("firebase/firestore");
  const d = await getDoc(doc(bd, "comunidad", "voz", "lectura", "orden"));
  return d.exists() ? ordenDe(d.data()) : null;
}

/**
 * El orden, en vivo: para la sala. Si quien modera vincula una cuenta con la
 * sala abierta, entra en los turnos sin que nadie tenga que salir y volver; y
 * un fallo de red al entrar se arregla solo al volver la red.
 */
export function escucharOrden(alCambiar: (o: Orden | null) => void, alFallar: (e: unknown) => void): () => void {
  let fin: (() => void) | null = null;
  let vivo = true;
  void (async () => {
    try {
      const { bd } = await nube();
      const { doc, onSnapshot } = await import("firebase/firestore");
      if (!vivo) return;
      fin = onSnapshot(
        doc(bd, "comunidad", "voz", "lectura", "orden"),
        (d) => alCambiar(d.exists() ? ordenDe(d.data()) : null),
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

function ordenDe(x: Record<string, unknown>): Orden {
  const ancla = (x.ancla ?? {}) as { fecha?: unknown; puesto?: unknown };
  return {
    lista: Array.isArray(x.lista)
      ? // Una entrada mala (un null guardado a mano) se deja como HUECO, no se
        // quita: los puestos tienen que coincidir con la lista guardada, que es
        // la que miran las reglas. Un hueco no tiene cuenta y nadie lo elige.
        x.lista.map((e: unknown) =>
          e && typeof e === "object" && (e as { id?: unknown }).id
            ? {
                id: String((e as Record<string, unknown>).id),
                nombre: String((e as Record<string, unknown>).nombre ?? ""),
                ...((e as Record<string, unknown>).uid ? { uid: String((e as Record<string, unknown>).uid) } : {}),
              }
            : { id: "", nombre: "" },
        )
      : [],
    ancla: { fecha: String(ancla.fecha ?? ""), puesto: Number(ancla.puesto ?? 0) },
  };
}

/** Guardar el orden. Sólo quien modera; lo garantizan las reglas. */
export async function guardarOrden(orden: Orden): Promise<void> {
  const { bd } = await nube();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(bd, "comunidad", "voz", "lectura", "orden"), {
    // Los huecos (entradas malas que se leyeron así) no se vuelven a guardar.
    lista: orden.lista.filter((e) => e.id).map((e) => ({ id: e.id, nombre: e.nombre, ...(e.uid ? { uid: e.uid } : {}) })),
    ancla: orden.ancla,
    actualizado: Date.now(),
  });
}

/** Días enteros de una fecha «AAAA-MM-DD» a otra. */
function diasEntre(de: string, a: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = a.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
}

/**
 * A quién le toca el comentario un día. Uno por día desde el ancla, dando la
 * vuelta a la lista: «hoy le tocó a una hermana, mañana al hermano que sigue».
 */
export function comentaristaDe(orden: Orden, fecha: string): Lector | null {
  const n = orden.lista.length;
  if (!n || !orden.ancla.fecha) return null;
  const puesto = (((orden.ancla.puesto + diasEntre(orden.ancla.fecha, fecha)) % n) + n) % n;
  // Un hueco (entrada mala del orden guardado) no comenta: el siguiente de verdad.
  for (let k = 0; k < n; k++) {
    const e = orden.lista[(puesto + k) % n];
    if (e?.id) return e;
  }
  return null;
}

/**
 * El ancla que hay que guardar tras editar la lista, para que el comentario de
 * HOY siga siendo de quien era.
 *
 * El ancla es un puesto: si se añade, se quita o se mueve a alguien, el mismo
 * número apunta a otra persona y el turno salta en silencio —comentaría otra
 * vez quien comentó ayer, o alguien se quedaría sin el suyo—. Así que se mira
 * quién comentaba hoy con la lista vieja y se ancla hoy en su puesto nuevo. Si
 * lo quitaron, comenta el siguiente de la lista vieja que sigue estando.
 */
export function reanclar(viejo: Orden, lista: Lector[], hoy: string): Orden["ancla"] {
  const antes = comentaristaDe(viejo, hoy);
  if (!antes || !lista.length) return { fecha: hoy, puesto: 0 };
  const n = viejo.lista.length;
  const desde = viejo.lista.findIndex((e) => e.id === antes.id);
  for (let k = 0; k < n; k++) {
    const candidato = viejo.lista[(desde + k) % n];
    const puesto = lista.findIndex((e) => e.id === candidato.id);
    if (puesto >= 0) return { fecha: hoy, puesto };
  }
  return { fecha: hoy, puesto: 0 };
}

// ------------------------------------------------------------- el turno

/**
 * El siguiente que lee, desde el puesto `despuesDe` (−1 para empezar por el
 * primero), dando la vuelta a la lista y saltándose a quien no puede leer
 * ahora: no está en la sala, no tiene cuenta vinculada, o hoy sólo escucha.
 * `null` si no hay nadie que pueda.
 */
export function siguienteLector(
  lista: Lector[],
  despuesDe: number,
  puedeLeer: (l: Lector) => boolean,
): { puesto: number; lector: Lector } | null {
  const n = lista.length;
  for (let k = 1; k <= n; k++) {
    const puesto = (((despuesDe + k) % n) + n) % n;
    const lector = lista[puesto];
    if (lector && puedeLeer(lector)) return { puesto, lector };
  }
  return null;
}

/**
 * Dónde está en la lista quien lee ahora, buscándolo por su id.
 *
 * `lectura.puesto` es un número: si quien modera edita el orden con la sala en
 * marcha, ese número apunta a otra persona y el turno se saltaba o repetía a
 * alguien. Si ya no está en la lista, vale el puesto guardado.
 */
export function puestoVivo(lista: Lector[], l: { lector: string; puesto: number }): number {
  const i = l.lector ? lista.findIndex((e) => e.id === l.lector) : -1;
  return i >= 0 ? i : l.puesto;
}

/**
 * El que lee al volver atrás: el primero que puede, contando hacia atrás desde
 * el puesto `antesDe` (sin incluirlo). Es quien leyó el trozo anterior, si
 * sigue en la sala; si no, el anterior a él que esté.
 */
export function anteriorLector(
  lista: Lector[],
  antesDe: number,
  puedeLeer: (l: Lector) => boolean,
): { puesto: number; lector: Lector } | null {
  const n = lista.length;
  for (let k = 1; k <= n; k++) {
    const puesto = (((antesDe - k) % n) + n) % n;
    const lector = lista[puesto];
    if (lector && puedeLeer(lector)) return { puesto, lector };
  }
  return null;
}
