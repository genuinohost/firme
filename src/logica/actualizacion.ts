import { Capacitor, CapacitorHttp } from "@capacitor/core";

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

/**
 * Cada cuánto se pregunta sola.
 *
 * Mientras la app se instala a mano y se publica varias veces al día, doce horas
 * eran demasiadas: se actualizaba por la mañana y no volvía a enterarse de nada
 * hasta la noche. Para no depender de esto hay además un botón en Ajustes que
 * pregunta al momento.
 */
const HORAS_ENTRE_CONSULTAS = 4;

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
 * Se lee de `android/app/build.gradle` al compilar (ver `vite.config.ts`), que
 * es el mismo sitio del que la saca Android. Antes vivía a mano en `.env.local`
 * y se quedó congelada en la 2.5 mientras la app iba por la 3.4: el aviso
 * enseñaba un número falso. Un número que hay que acordarse de actualizar acaba
 * desfasado siempre.
 */
export function versionInstalada(): number {
  return __VERSION_CODIGO__;
}

export function nombreInstalado(): string {
  return __VERSION_NOMBRE__;
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
/**
 * Pedir un JSON sin que CORS lo impida.
 *
 * **Esto costó dos días.** Dentro de la app la web se sirve desde
 * `https://localhost`, así que pedir `genuino-pro.web.app/version.json` es una
 * petición entre orígenes distintos. Firebase Hosting no manda
 * `Access-Control-Allow-Origin`, así que el navegador la bloqueaba, `fetch`
 * lanzaba, y el `catch` de arriba concluía «no hay nada nuevo».
 *
 * **El aviso de versión nueva no salió nunca**, y nadie podía saberlo: no había
 * error en ninguna parte, solo un silencio que parecía «estás al día».
 *
 * La cabecera ya está puesta en el servidor, pero eso no basta: depender de una
 * cabecera que cualquiera puede quitar sin darse cuenta es dejar la puerta
 * abierta al mismo fallo. `CapacitorHttp` hace la petición **desde el lado
 * nativo**, donde CORS no existe — y así funciona aunque el servidor cambie.
 */
async function pedirJson<T>(url: string): Promise<T | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await CapacitorHttp.get({
        url,
        headers: { "Cache-Control": "no-cache" },
        // Sin esto, una respuesta lenta deja la promesa colgada para siempre.
        readTimeout: 15_000,
        connectTimeout: 15_000,
      });
      if (r.status < 200 || r.status >= 300) return null;
      return (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as T;
    } catch {
      return null;
    }
  }
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function hayVersionNueva(forzar = false): Promise<VersionPublicada | null> {
  // En el navegador no tiene sentido: ahí siempre se sirve lo último.
  if (!Capacitor.isNativePlatform()) return null;
  if (!forzar && !tocaConsultar()) return null;

  try {
    const datos = await pedirJson<VersionPublicada>(URL_VERSION);
    if (!datos) return null;

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
