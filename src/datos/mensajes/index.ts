import type { MensajeDiario } from "./tipos";
import { TANDA_1 } from "./tanda1";
import { TANDA_2 } from "./tanda2";

export type { MensajeDiario } from "./tipos";
export { componer } from "./tipos";

/**
 * El banco entero.
 *
 * Crece por tandas temáticas para que cada archivo siga siendo legible y para
 * poder revisar los versículos por bloques.
 */
export const MENSAJES: MensajeDiario[] = [...TANDA_1, ...TANDA_2];

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
