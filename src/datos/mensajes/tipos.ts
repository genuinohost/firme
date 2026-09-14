/**
 * Los mensajes que Alex comparte cada madrugada en sus grupos de WhatsApp.
 *
 * Las reglas de forma están en `docs/mensajes-whatsapp.md` y vienen dictadas por
 * él: título en mayúsculas entre emojis, cuerpo en segunda persona, y un
 * versículo al final cuya referencia va **sin** la versión.
 *
 * ⚠️ Los versículos del banco van en **Reina-Valera 1909**, que es de dominio
 * público. La 1960 tiene derechos de Sociedades Bíblicas Unidas y no puede
 * empaquetarse por cientos dentro de una app que se distribuye.
 */
export type MensajeDiario = {
  /** Palabra o expresión del tema, para poder buscarlo. */
  tema: string;
  /** Va en mayúsculas, sin los emojis. */
  titulo: string;
  /** Un emoji, o dos, que flanquean el título. */
  emoji: string;
  /** El cuerpo, en segunda persona. Sin nombres y sin mencionar la hora. */
  cuerpo: string;
  /** El texto del versículo, sin comillas: se ponen al componer. */
  versiculo: string;
  /** «Josué 1:9». Nunca lleva la versión. */
  cita: string;
};

/** Deja el mensaje tal como se pega en WhatsApp. */
export function componer(m: MensajeDiario): string {
  return `${m.emoji} ${m.titulo} ${m.emoji}\n\n${m.cuerpo}\n\n📖 "${m.versiculo}" ${m.cita}`;
}
