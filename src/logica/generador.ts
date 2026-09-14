import type { MensajeDiario } from "@/datos/mensajes";

/**
 * Generación de mensajes por internet, cuando el banco no tiene el tema.
 *
 * Va contra OpenRouter con la clave que Alex guarde en Ajustes. El banco sigue
 * siendo lo predeterminado: esto es para cuando quiere un tema concreto que no
 * está escrito.
 *
 * ⚠️ La clave se guarda **solo en el móvil**, igual que el resto de los datos.
 */

const CLAVE_GUARDADA = "firme.openrouter";
const MODELO_GUARDADO = "firme.openrouter.modelo";

/**
 * El más barato que escribe bien en español: unos nueve céntimos por cada mil
 * mensajes. Se puede cambiar desde Ajustes.
 */
export const MODELO_POR_DEFECTO = "google/gemini-2.5-flash-lite";

export function leerClave(): string {
  try {
    return localStorage.getItem(CLAVE_GUARDADA) ?? "";
  } catch {
    return "";
  }
}

export function guardarClave(clave: string): void {
  try {
    if (clave.trim()) localStorage.setItem(CLAVE_GUARDADA, clave.trim());
    else localStorage.removeItem(CLAVE_GUARDADA);
  } catch {
    /* sin almacenamiento no se puede guardar */
  }
}

export function leerModelo(): string {
  try {
    return localStorage.getItem(MODELO_GUARDADO) || MODELO_POR_DEFECTO;
  } catch {
    return MODELO_POR_DEFECTO;
  }
}

export function guardarModelo(modelo: string): void {
  try {
    localStorage.setItem(MODELO_GUARDADO, modelo.trim() || MODELO_POR_DEFECTO);
  } catch {
    /* sin almacenamiento no se puede guardar */
  }
}

export function hayClave(): boolean {
  return leerClave().length > 0;
}

/**
 * Las instrucciones de estilo, tal como las dictó Alex.
 *
 * Están en `docs/mensajes-whatsapp.md`; si cambian ahí, cambian aquí.
 */
const INSTRUCCIONES = `Eres quien redacta el mensaje que un hermano comparte cada madrugada en grupos de WhatsApp para animar a otros a mantenerse fieles a Dios.

Escribe UN mensaje sobre el tema que te den, listo para copiar y pegar en WhatsApp.

Reglas, sin excepción:
- Título en MAYÚSCULAS, con un emoji antes y el mismo emoji después.
- Cuerpo en segunda persona del singular, hablándole directamente al que lee ("Levántate", "Busca", "No dejes de..."). Nunca en primera persona del plural.
- Entre 35 y 60 palabras en el cuerpo. Tono de aliento, jamás de reproche ni de culpa.
- No menciones nombres propios de personas.
- No menciones horas ni madrugadas concretas ("a las 3am" y parecidos están prohibidos).
- Termina con un versículo de la Biblia Reina-Valera 1960 que trate de verdad el tema, precedido de 📖 y entre comillas dobles.
- La referencia va inmediatamente después de las comillas, SIN indicar la versión. Escribe "Josué 1:9", nunca "Josué 1:9 (RVR1960)".
- Cita el versículo con exactitud. Si no recuerdas el texto exacto, elige otro versículo que sí sepas literal.

Responde solo con el mensaje. Nada de explicaciones, ni saludos, ni comillas alrededor del conjunto.

Ejemplo exacto del formato:

🦁 ESFUERZO Y VALENTÍA 🦁

No dejes de ORAR. Es en la madrugada en oración donde Dios fortalece tu corazón, disipa todo temor y te otorga el valor y la firmeza necesarios para conquistar cada desafío del día.

📖 "Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas." Josué 1:9`;

export type ResultadoGenerar =
  | { ok: true; texto: string; coste: number | null }
  | { ok: false; error: string };

/**
 * Pide un mensaje sobre `tema`. Devuelve el texto ya compuesto, listo para
 * copiar, y lo que costó la llamada si OpenRouter lo informa.
 */
export async function generarMensaje(tema: string): Promise<ResultadoGenerar> {
  const clave = leerClave();
  if (!clave) {
    return { ok: false, error: "Falta la clave de OpenRouter. Ponla en Ajustes." };
  }
  if (!tema.trim()) {
    return { ok: false, error: "Escribe primero el tema." };
  }

  try {
    const respuesta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        // OpenRouter usa esto para las estadísticas de la cuenta.
        "X-Title": "Firme",
      },
      body: JSON.stringify({
        model: leerModelo(),
        messages: [
          { role: "system", content: INSTRUCCIONES },
          { role: "user", content: `Tema: ${tema.trim()}` },
        ],
        // Un mensaje son unas sesenta palabras; con esto sobra.
        max_tokens: 400,
        temperature: 0.9,
        usage: { include: true },
      }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      return { ok: false, error: explicar(respuesta.status, cuerpo) };
    }

    const datos = await respuesta.json();
    const texto: string = datos?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) return { ok: false, error: "El modelo no devolvió nada. Prueba otra vez." };

    const coste = typeof datos?.usage?.cost === "number" ? datos.usage.cost : null;
    return { ok: true, texto: limpiar(texto), coste };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Sin conexión o fallo de red: ${mensaje}` };
  }
}

/** Traduce los errores de OpenRouter a algo que se entienda. */
function explicar(estado: number, cuerpo: string): string {
  if (estado === 401) return "La clave no es válida. Revísala en Ajustes.";
  if (estado === 402) return "La cuenta de OpenRouter se quedó sin saldo.";
  if (estado === 429) return "Demasiadas peticiones seguidas. Espera un momento.";
  if (estado === 404) return "Ese modelo no existe o no está disponible.";
  try {
    const j = JSON.parse(cuerpo);
    const detalle = j?.error?.message;
    if (detalle) return `${estado}: ${detalle}`;
  } catch {
    /* el cuerpo no era JSON */
  }
  return `Error ${estado} de OpenRouter.`;
}

/**
 * A veces el modelo envuelve el mensaje en comillas o en un bloque de código,
 * por mucho que se le diga que no. Se le quitan.
 */
function limpiar(texto: string): string {
  let t = texto.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  if (t.startsWith('"') && t.endsWith('"') && !t.slice(1, -1).includes('"')) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** El mensaje del banco, ya compuesto, para poder tratarlo igual que el generado. */
export function textoDelBanco(m: MensajeDiario): string {
  return `${m.emoji} ${m.titulo} ${m.emoji}\n\n${m.cuerpo}\n\n📖 "${m.versiculo}" ${m.cita}`;
}
