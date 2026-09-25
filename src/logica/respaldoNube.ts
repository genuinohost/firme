import type { Datos } from "@/datos/tipos";
import { miUid } from "./muro";
import { nube } from "./nube";

/**
 * La copia de la rutina en la nube.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * Alex, el 24-09-2026: «los datos básicos deberían estar en una nube, porque
 * no todo el mundo va a estar pendiente de exportar una copia». Tiene razón, y
 * era un fallo de diseño: pedirle a alguien que exporte un respaldo «por si
 * acaso» es pedirle que piense en perder el móvil **antes** de perderlo. Nadie
 * lo hace. El primer hermano que cambie de teléfono perdía su rutina entera.
 *
 * ── Qué sube y qué NO ─────────────────────────────────────────────────────
 *
 * La regla, en una frase: **sube lo que te devuelve tu rutina y tu racha; no
 * sube nada de lo que escribiste ni de dónde caíste.**
 *
 * Sube:
 *   - los planes, la rutina, las tareas, los motivos y los ajustes;
 *   - los registros de cumplimiento **sin la excusa**, y los registros de plan
 *     **sin las caídas**: con eso vuelve la racha, que es lo que duele perder.
 *
 * No sube, y no va a subir:
 *   - **el diario** (`notas`). Está decidido desde la 6.3 y sigue igual: un
 *     diario que sube entero sube también la caída que alguien anotó a las
 *     tres de la mañana, y esa no la publicó nadie.
 *   - **`registros[].excusa`**, que es lo que la persona escribió cuando se
 *     saltó algo. Es una confesión, no un dato de configuración.
 *   - **`planesRegistros[].caidas`**, o sea en qué áreas falló.
 *
 * Los tres se quitan aquí, al construir la copia, y no en la pantalla ni en
 * las reglas: si un día alguien añade otra vía de subida, este filtro sigue
 * siendo el sitio donde se decide.
 *
 * ── Por qué restaurar no mezcla ───────────────────────────────────────────
 *
 * Bajar la copia **sustituye**, y sólo se ofrece cuando en el móvil no hay
 * rutina o cuando el dueño lo pide a mano. Mezclar dos estados que divergieron
 * —un bloque borrado aquí, otro añadido allá— es una fábrica de sorpresas, y
 * una sorpresa aquí significa una alarma que no suena.
 */

/** Lo que de verdad viaja. El diario no está, y no es un olvido. */
export type Basico = {
  version: number;
  planes: Datos["planes"];
  planesRegistros: Datos["planesRegistros"];
  rutina: Datos["rutina"];
  tareas: Datos["tareas"];
  registros: Datos["registros"];
  motivos: Datos["motivos"];
  ajustes: Datos["ajustes"];
  /** Cuándo se guardó, para poder decir «tu copia es del martes». */
  guardado: number;
};

/**
 * Quita del paquete todo lo que no tiene por qué salir del teléfono.
 *
 * Se exporta aparte para poder probarlo: es la función de la que depende una
 * promesa, y una promesa que no se puede comprobar no es una promesa.
 */
export function soloLoBasico(datos: Datos, ahora = Date.now()): Basico {
  const registros: Datos["registros"] = {};
  for (const [clave, r] of Object.entries(datos.registros ?? {})) {
    // La excusa se queda en el móvil. El estado y la hora vuelven, que es lo
    // que reconstruye la racha.
    registros[clave] = { estado: r.estado, momento: r.momento };
  }

  const planesRegistros: Datos["planesRegistros"] = {};
  for (const [clave, r] of Object.entries(datos.planesRegistros ?? {})) {
    const { caidas: _caidas, ...resto } = r;
    planesRegistros[clave] = resto;
  }

  return {
    version: datos.version,
    planes: datos.planes ?? [],
    planesRegistros,
    rutina: datos.rutina ?? [],
    tareas: datos.tareas ?? [],
    registros,
    motivos: datos.motivos ?? [],
    ajustes: datos.ajustes,
    guardado: ahora,
  };
}

/** Dónde vive la copia: un documento por persona, que sólo lee su dueño. */
async function documento(uid: string) {
  const { bd } = await nube();
  const { doc } = await import("firebase/firestore");
  return doc(bd, "usuarios", uid, "respaldo", "rutina");
}

/**
 * Guarda la copia. Silencioso a propósito: esto corre solo, y un error de red
 * no puede interrumpir a quien está usando la app.
 */
export async function subirRespaldo(uid: string, datos: Datos): Promise<boolean> {
  try {
    const { setDoc } = await import("firebase/firestore");
    await setDoc(await documento(uid), soloLoBasico(datos));
    return true;
  } catch {
    return false;
  }
}

/** Trae la copia, o null si no hay ninguna. */
export async function bajarRespaldo(uid: string): Promise<Basico | null> {
  try {
    const { getDoc } = await import("firebase/firestore");
    const d = await getDoc(await documento(uid));
    if (!d.exists()) return null;
    return d.data() as Basico;
  } catch {
    return null;
  }
}

/**
 * Mete la copia en los datos del móvil.
 *
 * El diario y las excusas que ya hubiera aquí **se conservan**: la copia no los
 * trae, así que tampoco puede borrarlos. Quien restaura en un móvil nuevo
 * tendrá el diario vacío, que es lo que dijimos que pasaría.
 */
export function aplicarRespaldo(datos: Datos, copia: Basico): Datos {
  return {
    ...datos,
    version: copia.version ?? datos.version,
    planes: copia.planes ?? [],
    planesRegistros: copia.planesRegistros ?? {},
    rutina: copia.rutina ?? [],
    tareas: copia.tareas ?? [],
    registros: copia.registros ?? {},
    motivos: copia.motivos ?? [],
    ajustes: copia.ajustes ?? datos.ajustes,
    notas: datos.notas,
  };
}

// ---------------------------------------------------------------- lo automático

/**
 * La huella de lo que viaja, sin la hora.
 *
 * Sirve para no subir lo mismo dos veces. Importa más de lo que parece: el
 * diario cambia con cada letra que alguien escribe por la noche, y el diario
 * **no va** en la copia. Sin esta comparación, escribir tres párrafos mandaría
 * treinta copias idénticas al servidor.
 */
function huella(datos: Datos): string {
  const { guardado: _guardado, ...resto } = soloLoBasico(datos, 0);
  return JSON.stringify(resto);
}

/** Lo último que se subió desde esta sesión. Así no se repite. */
let ultimaHuella: string | null = null;

/**
 * Si ya se comprobó, en esta ejecución, que subir no destruye nada.
 *
 * Una vez basta: después de la primera subida buena, lo que hay arriba lo puso
 * este teléfono.
 */
let comprobado = false;

/** Cuántos días distintos hay registrados. Las claves son `AAAA-MM-DD|id`. */
export function diasRegistrados(registros: Datos["registros"] | undefined): number {
  return new Set(Object.keys(registros ?? {}).map((c) => c.slice(0, 10))).size;
}

/**
 * Sube la copia si hay cuenta, si cambió algo, y **si subirla no borra nada**.
 *
 * ── El fallo que esto evita, que casi se publica ───────────────────────────
 *
 * La primera versión de esto subía cada veinte segundos sin mirar qué había
 * arriba. Léase la secuencia entera: alguien reinstala la app, le queda la
 * rutina de ejemplo y cero historial, entra con su cuenta para recuperar lo
 * suyo… y veinte segundos después **la copia automática sustituye sus 43 días
 * por el teléfono vacío**, antes de que llegue a tocar el botón de traerla.
 *
 * El respaldo que se escribió para que nadie pierda su racha habría sido el que
 * la borra, y sin un solo mensaje de error.
 *
 * Así que la subida automática se niega a pisar una copia que tiene más
 * historial que este teléfono. Se comprueba **una vez por ejecución**: cuesta
 * una lectura al abrir la app y compra que el caso del móvil nuevo sea
 * imposible, no improbable.
 *
 * `forzar` es el botón de «Guardar ahora»: si alguien decide a mano que lo de
 * este teléfono manda, manda. Pero lo decide él, mirándolo.
 */
export async function respaldarSiToca(
  datos: Datos,
  opciones: { forzar?: boolean } = {},
): Promise<"subido" | "igual" | "sin-cuenta" | "la-nube-trae-más" | "falló"> {
  const uid = await miUid();
  if (!uid) return "sin-cuenta";

  const h = huella(datos);
  if (h === ultimaHuella && !opciones.forzar) return "igual";

  if (!comprobado && !opciones.forzar) {
    const arriba = await bajarRespaldo(uid);
    if (
      arriba &&
      diasRegistrados(arriba.registros) > diasRegistrados(datos.registros)
    ) {
      return "la-nube-trae-más";
    }
  }

  const bien = await subirRespaldo(uid, datos);
  if (!bien) return "falló";
  ultimaHuella = h;
  comprobado = true;
  return "subido";
}

/** Trae la copia de quien esté dentro, o null. */
export async function miRespaldo(): Promise<Basico | null> {
  const uid = await miUid();
  if (!uid) return null;
  return bajarRespaldo(uid);
}

/** Cuántos bloques cumplidos guarda la copia. Para poder decir qué se recupera. */
export function cuantoTrae(copia: Basico): { dias: number; bloques: number } {
  const claves = Object.keys(copia.registros ?? {});
  const dias = new Set(claves.map((c) => c.slice(0, 10))).size;
  const bloques = claves.filter((c) => copia.registros[c]?.estado === "cumplido").length;
  return { dias, bloques };
}
