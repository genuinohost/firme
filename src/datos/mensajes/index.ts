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
export type { MensajeDiario } from "./tipos";
export { componer } from "./tipos";
export { AREAS, areaDe, type AreaDelBanco } from "./areas";

/**
 * El banco entero.
 *
 * Crece por tandas temáticas para que cada archivo siga siendo legible y para
 * poder revisar los versículos por bloques.
 */
export const MENSAJES: MensajeDiario[] = [
  ...TANDA_1,
  ...TANDA_2,
  ...TANDA_3,
  ...TANDA_4,
  ...TANDA_5,
  ...TANDA_6,
  ...TANDA_7,
  ...TANDA_8,
  ...TANDA_9,
  ...TANDA_10,
  ...TANDA_11,
  ...TANDA_12,
  ...TANDA_13,
  ...TANDA_14,
  ...TANDA_15,
];

/** Quita tildes y mayúsculas: así «oración» encuentra «ORACION». */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Busca por tema. Devuelve lo que mejor encaje, de más a menos: primero lo que
 * coincide con el tema, luego con el título, y por último con el cuerpo.
 */
export function buscarMensajes(consulta: string): MensajeDiario[] {
  const q = normalizar(consulta);
  if (!q) return [];

  const palabras = q.split(/\s+/).filter((p) => p.length > 2);
  const puntuar = (m: MensajeDiario): number => {
    const tema = normalizar(m.tema);
    const titulo = normalizar(m.titulo);
    const cuerpo = normalizar(m.cuerpo + " " + m.versiculo + " " + m.cita);

    if (tema === q) return 100;
    let puntos = 0;
    if (tema.includes(q)) puntos += 50;
    if (titulo.includes(q)) puntos += 30;
    for (const p of palabras) {
      if (tema.includes(p)) puntos += 10;
      if (titulo.includes(p)) puntos += 6;
      if (cuerpo.includes(p)) puntos += 2;
    }
    return puntos;
  };

  return MENSAJES.map((m) => ({ m, puntos: puntuar(m) }))
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .map((x) => x.m);
}

/**
 * El mensaje que toca hoy.
 *
 * Va rotando por el banco según el día del año, así que no se repite hasta
 * agotarlo y sale el mismo aunque se abra la app varias veces.
 */
export function mensajeDelDia(fecha = new Date()): MensajeDiario | null {
  if (MENSAJES.length === 0) return null;
  const inicio = new Date(fecha.getFullYear(), 0, 0);
  const dia = Math.floor((fecha.getTime() - inicio.getTime()) / 86_400_000);
  return MENSAJES[dia % MENSAJES.length];
}

/** Todos los temas del banco, sin repetir y en orden. */
export function temasDisponibles(): string[] {
  return [...new Set(MENSAJES.map((m) => m.tema))].sort((a, b) => a.localeCompare(b, "es"));
}
