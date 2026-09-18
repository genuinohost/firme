import { Capacitor } from "@capacitor/core";
import type { Datos } from "@/datos/tipos";
import { huboSesion, nube } from "./nube";
import { parteDelDespertador } from "./parte";

/**
 * Avisar de un fallo, con capturas.
 *
 * ── De dónde sale ─────────────────────────────────────────────────────────
 *
 * Alex: «los hermanos deberían tener un botón especial para escribir y mandar
 * capturas de los errores de la app».
 *
 * Lo pidió el mismo día que se descubrió que una hermana llevaba días
 * esperando por una solicitud que él nunca vio. Ese fallo existía, era grave, y
 * **llegó por WhatsApp y de rebote**. Todo lo que se ha arreglado en este
 * proyecto se ha arreglado porque alguien se molestó en contarlo; el camino
 * para contarlo no debería depender de tener el teléfono del dueño.
 *
 * ── Por qué NO hace falta cuenta para avisar ──────────────────────────────
 *
 * Esto se decidió a propósito y va contra la intuición: lo normal sería pedir
 * cuenta, para evitar basura. Pero **los dos peores fallos de este proyecto han
 * sido fallos de entrar**: el login que rebotaba y el registro que no
 * terminaba. Quien más necesita avisar es justo el que no puede entrar.
 *
 * Exigir cuenta para avisar de un fallo es dejar sin voz a quien sufre el fallo
 * más grave. El precio es que alguien podría llenar esto de ruido; se paga.
 *
 * ── Qué se manda, y qué no ────────────────────────────────────────────────
 *
 * El texto que escriba, las capturas que elija, y un parte técnico con la
 * versión, el teléfono y **cuántas** cosas tiene (planes, notas, tareas) — los
 * números, nunca el contenido. Ni una línea del diario sale de aquí.
 */

/** El tope de cada captura ya encogida, en caracteres del data URL. */
const TOPE_IMAGEN = 700_000;

/** Cuántas capturas se admiten. Tres cuentan un fallo; diez son un álbum. */
export const MAX_CAPTURAS = 3;

/**
 * El parte técnico que acompaña al aviso.
 *
 * Son **números y nombres de versión, nunca contenido**. Saber que alguien
 * tiene 3 planes y 40 notas ayuda a reproducir un fallo; saber qué dicen esas
 * notas no ayuda a nada y no es asunto nuestro.
 */
export async function parteTecnico(datos: Datos): Promise<string> {
  const lineas: string[] = [];
  lineas.push(`Genuino ${__VERSION_NOMBRE__} (código ${__VERSION_CODIGO__})`);
  lineas.push(`Plataforma: ${Capacitor.getPlatform()}`);
  lineas.push(`Navegador: ${navigator.userAgent}`);
  lineas.push(`Idioma: ${navigator.language}`);
  lineas.push(`Huso: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  lineas.push(`Cuenta en este móvil: ${huboSesion() ? "sí" : "no"}`);
  lineas.push(
    `Tiene: ${datos.planes?.length ?? 0} plan(es), ${datos.rutina?.length ?? 0} bloque(s), ` +
      `${datos.tareas?.length ?? 0} tarea(s), ${(datos.notas ?? []).length} nota(s)`,
  );

  // Si el despertador tiene algo que contar, va: la mitad de los fallos que se
  // reportan «a mano» acaban siendo de alarmas.
  try {
    const parte = await parteDelDespertador();
    if (parte) lineas.push("", "— parte del despertador —", parte.slice(0, 2500));
  } catch {
    /* si no se puede leer, el aviso vale igual */
  }

  return lineas.join("\n").slice(0, 4000);
}

/**
 * Encoge una imagen hasta que quepa.
 *
 * Una captura de un móvil moderno pesa varios megas y Firestore no admite un
 * documento de más de uno. Se reduce el lado largo y, si aún no cabe, se baja
 * la calidad por pasos. **Si al final no cupiera, se devuelve null** en vez de
 * mandar algo roto: un aviso sin captura sirve; una captura a medias, no.
 */
export function encoger(archivo: File): Promise<string | null> {
  return new Promise((resolver) => {
    const lector = new FileReader();
    lector.onerror = () => resolver(null);
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => resolver(null);
      img.onload = () => {
        const lado = Math.max(img.width, img.height);
        const escala = Math.min(1, 1100 / lado);
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const pincel = lienzo.getContext("2d");
        if (!pincel) return resolver(null);
        pincel.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        for (const calidad of [0.7, 0.55, 0.4, 0.3]) {
          const url = lienzo.toDataURL("image/jpeg", calidad);
          if (url.length <= TOPE_IMAGEN) return resolver(url);
        }
        resolver(null);
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}

/**
 * Manda el aviso.
 *
 * Las capturas van **una por documento**, en una subcolección. Meterlas en el
 * mismo documento que el texto tendría un final conocido: tres capturas
 * pasarían del megabyte que admite Firestore y el aviso entero se perdería —
 * con el texto dentro, que es lo que de verdad importa.
 *
 * Por eso el texto se guarda **primero y solo**. Si luego falla una captura, el
 * aviso ya está a salvo.
 */
export async function avisarDeUnFallo(
  texto: string,
  capturas: string[],
  datos: Datos,
): Promise<void> {
  const { bd } = await nube();
  const { addDoc, collection, doc, setDoc } = await import("firebase/firestore");

  const parte = await parteTecnico(datos);
  const aviso = await addDoc(collection(bd, "fallos"), {
    texto: texto.trim().slice(0, 2000),
    parte,
    cuando: Date.now(),
  });

  for (let i = 0; i < Math.min(capturas.length, MAX_CAPTURAS); i++) {
    await setDoc(doc(bd, "fallos", aviso.id, "capturas", String(i)), { imagen: capturas[i] });
  }
}
