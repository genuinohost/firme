import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";
import type { Frase } from "@/datos/frases";

/**
 * Compartir y copiar frases.
 *
 * Las frases son lo que más engancha de la app, así que tienen que poder salir
 * de ella. En el móvil se abre el menú de compartir de Android —WhatsApp, notas,
 * lo que sea—; en el navegador se copia al portapapeles.
 */

/** El texto tal como se comparte: la frase entrecomillada y su autor debajo. */
export function textoDe(frase: Pick<Frase, "texto" | "fuente">): string {
  return frase.fuente ? `«${frase.texto}»\n— ${frase.fuente}` : `«${frase.texto}»`;
}

const FIRMA_ACTIVA = "firme.firma";

/**
 * La firma que se añade a lo que se comparte.
 *
 * El enlace no está escrito aquí: viene de `comunidad.json`, que se publica en
 * internet. Cuando la app esté en Google Play se cambia allí y a todos les
 * cambia, sin tener que actualizar nada.
 */
export type Firma = {
  usuario: string;
  enlaceApp: string;
};

const FIRMA_POR_DEFECTO: Firma = {
  usuario: "@GenuinoLove",
  enlaceApp: "https://genuino-pro.web.app",
};

export function firmaActiva(): boolean {
  try {
    return localStorage.getItem(FIRMA_ACTIVA) !== "no";
  } catch {
    return true;
  }
}

export function activarFirma(activa: boolean): void {
  try {
    localStorage.setItem(FIRMA_ACTIVA, activa ? "si" : "no");
  } catch {
    /* sin almacenamiento */
  }
}

/** Lo que se publica en comunidad.json manda; si no hay nada, el valor de casa. */
export function leerFirma(): Firma {
  try {
    const crudo = localStorage.getItem("firme.comunidad");
    if (crudo) {
      const c = JSON.parse(crudo) as { firma?: Partial<Firma> };
      if (c.firma) return { ...FIRMA_POR_DEFECTO, ...c.firma };
    }
  } catch {
    /* se usa el valor de casa */
  }
  return FIRMA_POR_DEFECTO;
}

/**
 * Añade la firma al pie de lo que se comparte.
 *
 * Va separada por una línea en blanco para que en WhatsApp se lea como una
 * posdata y no como parte de la frase.
 */
export function conFirma(texto: string): string {
  if (!firmaActiva()) return texto;
  const { usuario, enlaceApp } = leerFirma();
  return `${texto}\n\n${usuario}\n📲 ${enlaceApp}`;
}

export type ResultadoCompartir = "compartido" | "copiado" | "fallo";

export async function compartirFrase(
  frase: Pick<Frase, "texto" | "fuente">,
): Promise<ResultadoCompartir> {
  const texto = conFirma(textoDe(frase));

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ text: texto, dialogTitle: "Compartir la frase" });
      return "compartido";
    } catch {
      // Cancelar el menú de compartir también llega aquí: se cae a copiar.
      return copiar(texto);
    }
  }

  // En el navegador, compartir solo existe en móvil y exige un gesto reciente.
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texto });
      return "compartido";
    } catch {
      return copiar(texto);
    }
  }

  return copiar(texto);
}

/** Copia el texto tal cual, sin tocarlo. Para cuando ya lleva firma. */
export async function copiar(texto: string): Promise<ResultadoCompartir> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Clipboard.write({ string: texto });
      return "copiado";
    } catch {
      return "fallo";
    }
  }

  try {
    await navigator.clipboard.writeText(texto);
    return "copiado";
  } catch {
    // El portapapeles moderno exige permiso y contexto seguro, y hay
    // navegadores que lo niegan. El método viejo sigue funcionando ahí.
    return copiarALaAntigua(texto);
  }
}

function copiarALaAntigua(texto: string): ResultadoCompartir {
  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    // Fuera de la vista, pero dentro del documento: si no, no se puede seleccionar.
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.top = "-1000px";
    document.body.appendChild(campo);
    campo.select();
    const salioBien = document.execCommand("copy");
    document.body.removeChild(campo);
    return salioBien ? "copiado" : "fallo";
  } catch {
    return "fallo";
  }
}
