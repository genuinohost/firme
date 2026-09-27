import { Capacitor, registerPlugin } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { dondeEstaElPortero } from "./comunidad";
import { copiar } from "./compartir";

/**
 * Pasarle la app a alguien mientras no está en Google Play.
 *
 * Alex, el 27-09-2026: «quiero instalar la APK en el cel de mi mamá pero no veo
 * la opción de compartir la aplicación desde la app».
 *
 * Dos formas, y el orden importa:
 *
 * 1. **El archivo mismo**, por WhatsApp, Bluetooth o Compartir cercano. La otra
 *    persona no descarga nada: le llega el APK y lo toca. Con la conexión que
 *    hay por aquí, eso es la diferencia entre instalar y no instalar — ese
 *    mismo día una descarga de treinta megas se había quedado en negro.
 * 2. **El enlace**, como red: si se está en la web, donde no hay archivo que
 *    mandar, o si compartir el archivo falla.
 *
 * El día que la app esté en Play, esto se cambia por el enlace de la ficha.
 */

type PasarAppNativo = {
  compartirApk(): Promise<{ version: string; bytes: number }>;
};

const nativo = registerPlugin<PasarAppNativo>("PasarApp");

/** De dónde se baja la app. Es el mismo Worker que sirve las salas. */
export function enlaceDeDescarga(): string {
  return `${dondeEstaElPortero()}/apk`;
}

export type ResultadoPasar = "archivo" | "enlace" | "copiado" | "fallo";

/**
 * Comparte la app: el archivo si se puede, el enlace si no.
 *
 * Devuelve qué fue lo que salió, para que la pantalla pueda decirlo: «te la
 * pasé como archivo» no es lo mismo que «te pasé un enlace», y quien la recibe
 * tiene que hacer cosas distintas con cada una.
 */
export async function pasarLaApp(): Promise<ResultadoPasar> {
  if (Capacitor.isNativePlatform()) {
    try {
      await nativo.compartirApk();
      return "archivo";
    } catch {
      // Sin archivo, queda el enlace. Se sigue abajo.
    }
  }

  const enlace = enlaceDeDescarga();
  const texto =
    "Te paso Genuino, la app de disciplina cristiana. Bájala aquí y tócala para " +
    `instalarla: ${enlace}`;
  try {
    await Share.share({ title: "Genuino", text: texto, url: enlace });
    return "enlace";
  } catch {
    return (await copiar(texto)) === "copiado" ? "copiado" : "fallo";
  }
}
