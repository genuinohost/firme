import { Capacitor } from "@capacitor/core";

/**
 * Avisar de que hay una versión nueva.
 *
 * Mientras la app se instala a mano, esto le ahorra a cada uno estar pidiendo el
 * archivo. Cuando esté en Google Play, `enlace` pasará a apuntar a la ficha de
 * Play y las actualizaciones serán automáticas: no habrá que tocar el código.
 *
 * **A propósito no se descarga ni se instala sola.** Hacerlo exigiría el permiso
 * `REQUEST_INSTALL_PACKAGES`, y Google Play rechaza las apps que lo llevan si no
 * son gestores de archivos o navegadores. Se avisa y se abre el enlace, que no
 * viola ninguna política y no habrá que deshacer luego.
 */

const URL_VERSION = "https://genuino-pro.web.app/version.json";
const ULTIMA_CONSULTA = "firme.version.consulta";
const DESCARTADA = "firme.version.descartada";

/** Cada cuánto se pregunta. Más a menudo no aporta nada. */
const HORAS_ENTRE_CONSULTAS = 12;

export type VersionPublicada = {
  /** El `versionCode` de Android: un número que solo sube. */
  codigo: number;
  /** Lo que ve el usuario: "2.3". */
  nombre: string;
  /** A dónde se le manda: el APK ahora, la ficha de Play después. */
  enlace: string;
  /** Qué trae de nuevo, en unas líneas. */
  novedades: string[];
  /** Si es true, se insiste aunque la haya descartado. Para arreglos graves. */
  importante?: boolean;
};

/**
 * La versión instalada.
 *
 * Se inyecta al compilar desde `build.gradle`, para que no haya dos números que
 * se puedan desincronizar.
 */
export function versionInstalada(): number {
  return Number(import.meta.env.VITE_VERSION_CODIGO ?? 0);
}

export function nombreInstalado(): string {
  return String(import.meta.env.VITE_VERSION_NOMBRE ?? "—");
}

function tocaConsultar(): boolean {
  try {
    const ultima = Number(localStorage.getItem(ULTIMA_CONSULTA) ?? 0);
    return Date.now() - ultima > HORAS_ENTRE_CONSULTAS * 3600_000;
  } catch {
    return true;
  }
}

/** «No me lo recuerdes más» para esta versión concreta. */
export function descartar(codigo: number): void {
  try {
    localStorage.setItem(DESCARTADA, String(codigo));
  } catch {
    /* sin almacenamiento */
  }
}

function estaDescartada(codigo: number): boolean {
  try {
    return Number(localStorage.getItem(DESCARTADA) ?? 0) >= codigo;
  } catch {
    return false;
  }
}

/**
 * Devuelve la versión publicada si es más nueva que la instalada y el usuario no
 * la ha descartado. En cualquier otro caso, null.
 */
export async function hayVersionNueva(forzar = false): Promise<VersionPublicada | null> {
  // En el navegador no tiene sentido: ahí siempre se sirve lo último.
  if (!Capacitor.isNativePlatform()) return null;
  if (!forzar && !tocaConsultar()) return null;

  try {
    const respuesta = await fetch(URL_VERSION, { cache: "no-cache" });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as VersionPublicada;

    try {
      localStorage.setItem(ULTIMA_CONSULTA, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }

    if (typeof datos.codigo !== "number") return null;
    if (datos.codigo <= versionInstalada()) return null;
    if (!datos.importante && estaDescartada(datos.codigo)) return null;
    return datos;
  } catch {
    // Sin conexión no pasa nada: se preguntará la próxima vez.
    return null;
  }
}
