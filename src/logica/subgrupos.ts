/**
 * Subgrupos del devocional: partir a los que están en la sala en grupos
 * pequeños para una actividad puntual, cada grupo en su propio canal de voz.
 *
 * Alex, 28-09-2026: «quiero que la comunidad de devocionales se pueda dividir
 * en subgrupos pequeños para actividades puntuales. Yo elijo los miembros del
 * subgrupo, pero también debo tener la opción de que el sistema los coloque al
 * azar. Serán grupos de 2 a 5, según la cantidad de conectados. Siempre debemos
 * procurar que sean desde 2 a 5 subgrupos. Ejemplo: Grupo A, 5 participantes;
 * B, 5, y así».
 *
 * Así que dos límites a la vez: **de 2 a 5 grupos**, y **de 2 a 5 personas por
 * grupo**. Caben de 4 a 25 personas. Con menos de 4 no se puede partir; con más
 * de 25, cinco grupos no bastan para que ninguno pase de 5, y se avisa (manda
 * el número de grupos, que es lo que él dijo «siempre»).
 *
 * El reparto es parejo: los grupos se diferencian como mucho en una persona.
 * 11 personas son 4 + 4 + 3, no 5 + 5 + 1.
 */

export const GRUPOS_MIN = 2;
export const GRUPOS_MAX = 5;
export const POR_GRUPO_MIN = 2;
export const POR_GRUPO_MAX = 5;
export const LETRAS = ["A", "B", "C", "D", "E"] as const;
export type Letra = (typeof LETRAS)[number];

/** Cuántos grupos tocan para `n` personas, o `null` si no se puede partir (menos de 4). */
export function gruposSugeridos(n: number): number | null {
  if (n < GRUPOS_MIN * POR_GRUPO_MIN) return null;
  return Math.min(GRUPOS_MAX, Math.max(GRUPOS_MIN, Math.ceil(n / POR_GRUPO_MAX)));
}

/** Los números de grupos entre los que puede elegir, con `n` personas: que ninguno quede de 1. */
export function gruposPosibles(n: number): number[] {
  const r: number[] = [];
  for (let k = GRUPOS_MIN; k <= GRUPOS_MAX; k++) if (k * POR_GRUPO_MIN <= n) r.push(k);
  return r;
}

/**
 * Repartir al azar en `k` grupos parejos: se barajan (Fisher-Yates) y se dan
 * como cartas, uno a cada grupo por turno.
 *
 * `azar` se puede cambiar para las pruebas; en la app es `Math.random`.
 */
export function repartir<T>(personas: T[], k: number, azar: () => number = Math.random): T[][] {
  const grupos: T[][] = Array.from({ length: Math.max(1, k) }, () => []);
  const baraja = [...personas];
  for (let i = baraja.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [baraja[i], baraja[j]] = [baraja[j], baraja[i]];
  }
  baraja.forEach((p, i) => grupos[i % grupos.length].push(p));
  return grupos;
}

/**
 * Lo que no cumple un reparto, en palabras, para enseñárselo al anfitrión
 * antes de enviar a nadie. Vacío si está bien.
 *
 * No impide enviar: si él decide un grupo de 6 para una actividad, es suya.
 */
export function avisosDelReparto(tamaños: number[]): string[] {
  const avisos: string[] = [];
  const conGente = tamaños.filter((t) => t > 0);
  if (conGente.length < GRUPOS_MIN) avisos.push("Hace falta gente en al menos 2 grupos.");
  tamaños.forEach((t, i) => {
    const g = `El grupo ${LETRAS[i] ?? i + 1}`;
    if (t === 1) avisos.push(`${g} tiene una sola persona.`);
    if (t > POR_GRUPO_MAX) avisos.push(`${g} tiene ${t}: pasa de ${POR_GRUPO_MAX}.`);
  });
  return avisos;
}
