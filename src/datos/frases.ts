import type { Categoria } from "./tipos";

/**
 * Banco de frases. Tres momentos: cuando empieza el bloque (`empuje`),
 * cuando lo cumple (`victoria`) y cuando lo salta (`caida`).
 *
 * Las frases con `fuente` son citas; el resto son de la casa.
 * Los versículos van en Reina-Valera 1909, que es de dominio público.
 */
export type Frase = {
  texto: string;
  fuente?: string;
  /** Si lleva categoría, se prefiere para bloques de esa área. */
  categoria?: Categoria;
  banco: "casa" | "estoicos" | "versiculos";
};

export const EMPUJE: Frase[] = [
  // — de la casa —
  { texto: "No tienes que tener ganas. Solo tienes que empezar.", banco: "casa" },
  { texto: "Dentro de una hora esto ya estará hecho. Decide ahora quién lo hizo.", banco: "casa" },
  { texto: "El hombre que querías ser está al otro lado de los próximos diez minutos.", banco: "casa" },
  { texto: "Nadie te está mirando. Por eso cuenta doble.", banco: "casa" },
  { texto: "La disciplina es acordarte de lo que quieres de verdad.", banco: "casa" },
  { texto: "Hazlo cansado. Hazlo con sueño. Hazlo sin ánimo. Pero hazlo.", banco: "casa" },
  { texto: "Cada vez que cumples, le estás enseñando a tu cabeza que tu palabra vale.", banco: "casa" },
  { texto: "No negocies con la cama. No negocies con el reloj. Ya lo decidiste ayer.", banco: "casa" },
  { texto: "Lo difícil no es el bloque. Es el minuto antes del bloque. Ya estás en él.", banco: "casa" },
  { texto: "Levántate. Nada cambia mientras sigas sentado.", banco: "casa" },
  { texto: "Hoy no se gana entero. Se gana este bloque.", banco: "casa" },
  { texto: "La excusa que estás pensando ya la usaste antes. No funcionó.", banco: "casa" },

  { texto: "Mueve el cuerpo aunque la cabeza proteste. La cabeza va detrás.", categoria: "cuerpo", banco: "casa" },
  { texto: "El cuerpo que descuidas hoy es el que te frena dentro de diez años.", categoria: "cuerpo", banco: "casa" },
  { texto: "Concentración es decirle que no a cien cosas buenas.", categoria: "mente", banco: "casa" },
  { texto: "Una hora entera, sin móvil. Eso es todo lo que se te pide.", categoria: "trabajo", banco: "casa" },
  { texto: "El trabajo hecho a medias vuelve. El hecho bien, se va y no molesta.", categoria: "trabajo", banco: "casa" },
  { texto: "Están aquí ahora. No van a estar siempre. Deja el teléfono.", categoria: "familia", banco: "casa" },
  { texto: "Descansar también es obedecer. Mañana hace falta un hombre entero.", categoria: "descanso", banco: "casa" },
  { texto: "Este rato a solas es el que sostiene todo lo demás.", categoria: "fe", banco: "casa" },

  // — estoicos y máximas —
  { texto: "Empieza de una vez: atreverse a ser sabio ya es la mitad del camino.", fuente: "Horacio", banco: "estoicos" },
  { texto: "No es que tengamos poco tiempo, es que perdemos mucho.", fuente: "Séneca", banco: "estoicos" },
  { texto: "Deja de discutir de una vez qué debe ser un hombre bueno. Sélo.", fuente: "Marco Aurelio", banco: "estoicos" },
  { texto: "Al amanecer, cuando te cueste levantarte, piensa: despierto para hacer el trabajo de un hombre.", fuente: "Marco Aurelio", banco: "estoicos" },
  { texto: "Ninguna cosa grande se hace de repente.", fuente: "Epicteto", banco: "estoicos" },
  { texto: "Si quieres algo bueno, tómalo de ti mismo.", fuente: "Epicteto", banco: "estoicos" },
  { texto: "La suerte es lo que pasa cuando la preparación se encuentra con la ocasión.", fuente: "Séneca", banco: "estoicos" },
  { texto: "Pospón las cosas y la vida se te pasará de largo.", fuente: "Séneca", banco: "estoicos" },
  { texto: "Grano a grano se llena el granero.", fuente: "Refrán", banco: "estoicos" },
  { texto: "A quien madruga, Dios le ayuda.", fuente: "Refrán", banco: "estoicos" },

  // — versículos —
  { texto: "Esfuérzate y sé valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo dondequiera que vayas.", fuente: "Josué 1:9", banco: "versiculos" },
  { texto: "Todo lo que te viniere a la mano para hacer, hazlo según tus fuerzas.", fuente: "Eclesiastés 9:10", banco: "versiculos" },
  { texto: "Todo lo puedo en Cristo que me fortalece.", fuente: "Filipenses 4:13", banco: "versiculos" },
  { texto: "Y todo lo que hagáis, hacedlo de corazón, como para el Señor, y no para los hombres.", fuente: "Colosenses 3:23", banco: "versiculos" },
  { texto: "El alma del perezoso desea, y nada alcanza; mas el alma de los diligentes será engordada.", fuente: "Proverbios 13:4", banco: "versiculos" },
  { texto: "Los pensamientos del diligente ciertamente van a abundancia; mas todo presuroso, indefectiblemente a pobreza.", fuente: "Proverbios 21:5", banco: "versiculos" },
  { texto: "Enséñanos de tal modo a contar nuestros días, que traigamos al corazón sabiduría.", fuente: "Salmos 90:12", banco: "versiculos" },
  { texto: "Porque no nos ha dado Dios espíritu de temor, sino de fortaleza, y de amor, y de templanza.", fuente: "2 Timoteo 1:7", banco: "versiculos" },
  { texto: "Los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.", fuente: "Isaías 40:31", banco: "versiculos" },
  { texto: "Antes hiero mi cuerpo, y lo pongo en servidumbre.", fuente: "1 Corintios 9:27", banco: "versiculos" },
];

export const VICTORIA: Frase[] = [
  { texto: "Hecho. Eso ya no te lo quita nadie.", banco: "casa" },
  { texto: "Una piedra más en el muro.", banco: "casa" },
  { texto: "Cumpliste sin ganas. Eso es exactamente la disciplina.", banco: "casa" },
  { texto: "Así se construye un hombre: un bloque cerrado a la vez.", banco: "casa" },
  { texto: "Tu palabra vale. Acabas de demostrarlo otra vez.", banco: "casa" },
  { texto: "Nadie aplaudió. Da igual. Tú lo sabes.", banco: "casa" },
  { texto: "El de ayer no lo habría hecho. El de hoy sí.", banco: "casa" },
  { texto: "Bien. Ahora el siguiente.", banco: "casa" },
  { texto: "Ganaste el bloque. Suma.", banco: "casa" },
  { texto: "No busques la recompensa. Ya la tienes: eres el que lo hizo.", fuente: "Marco Aurelio", banco: "estoicos" },
  { texto: "Bienaventurado el varón que soporta la tentación; porque cuando fuere probado, recibirá la corona de vida.", fuente: "Santiago 1:12", banco: "versiculos" },
  { texto: "Estad firmes y constantes, creciendo en la obra del Señor siempre.", fuente: "1 Corintios 15:58", banco: "versiculos" },
  { texto: "Bien, buen siervo y fiel; sobre poco has sido fiel, sobre mucho te pondré.", fuente: "Mateo 25:21", banco: "versiculos" },
];

export const CAIDA: Frase[] = [
  { texto: "Se cayó uno. No se cayó el día. Vuelve al siguiente.", banco: "casa" },
  { texto: "Un fallo es un fallo. Dos seguidos es una costumbre nueva. Que no haya segundo.", banco: "casa" },
  { texto: "No te castigues. Levántate. Es más útil.", banco: "casa" },
  { texto: "Lo que hagas en los próximos diez minutos importa más que lo que acabas de dejar.", banco: "casa" },
  { texto: "Apunta la excusa. Léela mañana. Verás lo pequeña que era.", banco: "casa" },
  { texto: "Siete veces cae el justo, y vuelve a levantarse.", fuente: "Proverbios 24:16", banco: "versiculos" },
  { texto: "No nos cansemos, pues, de hacer bien; porque a su tiempo segaremos, si no hubiéremos desmayado.", fuente: "Gálatas 6:9", banco: "versiculos" },
  { texto: "Nuevas son cada mañana; grande es tu fidelidad.", fuente: "Lamentaciones 3:23", banco: "versiculos" },
  { texto: "Caer no es fracasar. Quedarse en el suelo, sí.", fuente: "Refrán", banco: "estoicos" },
];

export const REPASO: Frase[] = [
  { texto: "Cuenta el día. Lo que no se mide, se olvida.", banco: "casa" },
  { texto: "Al cerrar el día, pregúntate: ¿qué mal corregí, qué vicio resistí, en qué soy mejor?", fuente: "Séneca", banco: "estoicos" },
  { texto: "Mañana no empieza mañana. Empieza esta noche, cuando decides a qué hora te levantas.", banco: "casa" },
];
