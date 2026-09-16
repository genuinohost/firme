import type { MensajeDiario } from "./tipos";
import { TANDA_1 } from "./tanda1";
import { TANDA_2 } from "./tanda2";
import { TANDA_3 } from "./tanda3";
import { TANDA_4 } from "./tanda4";
import { TANDA_5 } from "./tanda5";
import { TANDA_6 } from "./tanda6";
import { TANDA_7 } from "./tanda7";
import { TANDA_8 } from "./tanda8";
import { TANDA_9 } from "./tanda9";
import { TANDA_10 } from "./tanda10";
import { TANDA_11 } from "./tanda11";
import { TANDA_12 } from "./tanda12";
import { TANDA_13 } from "./tanda13";
import { TANDA_14 } from "./tanda14";
import { TANDA_15 } from "./tanda15";

/**
 * El banco, ordenado por áreas.
 *
 * Hasta la 4.3 la pantalla del mensaje enseñaba **los 365 temas de golpe**, uno
 * por mensaje, como un muro de etiquetas diminutas al final de la pantalla.
 * Alex: «está bien que se vea, pero no debe verse como un error». Tenía razón:
 * no era una lista, era un vertido — nadie encuentra nada en 365 fragmentos en
 * minúscula, y lo que se lee de un vistazo es que algo se rompió.
 *
 * Las áreas **no están inventadas ni adivinadas por palabras sueltas**: cada
 * tanda del banco se escribió alrededor de un asunto, y eso ya estaba dicho en
 * la cabecera de su archivo. Aquí sólo se recoge y se agrupa lo que se
 * emparenta, que es la diferencia entre ordenar y etiquetar por encima.
 */
export type AreaDelBanco = {
  id: string;
  nombre: string;
  emoji: string;
  /** Para qué día sirve esta área. Una línea, en su idioma. */
  descripcion: string;
  mensajes: MensajeDiario[];
};

export const AREAS: AreaDelBanco[] = [
  {
    id: "madrugada",
    nombre: "La madrugada",
    emoji: "🌅",
    descripcion: "Levantarse, esforzarse y sostenerlo día tras día",
    mensajes: TANDA_1,
  },
  {
    id: "dentro",
    nombre: "La batalla de dentro",
    emoji: "🛡️",
    descripcion: "El carácter y lo que nadie ve pero a todos derriba",
    mensajes: [...TANDA_2, ...TANDA_10],
  },
  {
    id: "oracion",
    nombre: "Oración y fe",
    emoji: "🙏",
    descripcion: "Cómo orar, y qué hacer cuando no llega respuesta",
    mensajes: [...TANDA_3, ...TANDA_11],
  },
  {
    id: "trabajo",
    nombre: "Trabajo y propósito",
    emoji: "🛠️",
    descripcion: "Lo que se hace con las manos, y responder de lo tuyo",
    mensajes: [...TANDA_4, ...TANDA_8],
  },
  {
    id: "hermanos",
    nombre: "Los hermanos",
    emoji: "🤝",
    descripcion: "El testimonio, la vida compartida y el trato de cada día",
    mensajes: [...TANDA_5, ...TANDA_12],
  },
  {
    id: "dolor",
    nombre: "El dolor y el consuelo",
    emoji: "🕯️",
    descripcion: "Para el que está lejos, enfermo o empezando de cero",
    mensajes: [...TANDA_6, ...TANDA_15],
  },
  {
    id: "casa",
    nombre: "La casa",
    emoji: "🏡",
    descripcion: "El matrimonio, los hijos y el dinero",
    mensajes: TANDA_7,
  },
  {
    id: "quien-es",
    nombre: "Quién es Él",
    emoji: "✝️",
    descripcion: "Cuando el ánimo no viene de uno, viene de acordarse de Él",
    mensajes: [...TANDA_9, ...TANDA_14],
  },
  {
    id: "cada-dia",
    nombre: "La vida de cada día",
    emoji: "⏳",
    descripcion: "El cuerpo, el tiempo y las decisiones pequeñas",
    mensajes: TANDA_13,
  },
];

/** El área a la que pertenece un mensaje, si se sabe. */
export function areaDe(mensaje: MensajeDiario): AreaDelBanco | null {
  return AREAS.find((a) => a.mensajes.includes(mensaje)) ?? null;
}
