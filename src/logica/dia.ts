import type { Datos, Suceso } from "@/datos/tipos";

export const DIAS_CORTOS = ["D", "L", "M", "X", "J", "V", "S"];
export const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "AAAA-MM-DD" en hora local (no UTC: `toISOString` desplazaría el día). */
export function claveFecha(f: Date): string {
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

export function desdeClave(clave: string): Date {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function fechaLarga(f: Date): string {
  return `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

/** "HH:MM" → minutos desde medianoche. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function minutoActual(ahora = new Date()): number {
  return ahora.getHours() * 60 + ahora.getMinutes();
}

/**
 * La línea del día: bloques de la rutina que tocan hoy más las tareas de la
 * fecha, ordenados por hora. Las tareas sin hora van al final.
 */
export function sucesosDelDia(datos: Datos, fecha: string): Suceso[] {
  const diaSemana = desdeClave(fecha).getDay();

  const deRutina: Suceso[] = datos.rutina
    .filter((b) => b.activo && b.dias.includes(diaSemana))
    .map((b) => ({
      id: b.id,
      origen: "rutina" as const,
      nombre: b.nombre,
      minuto: aMinutos(b.hora),
      hora: b.hora,
      duracionMin: b.duracionMin,
      categoria: b.categoria,
      porque: b.porque,
      timbre: b.timbre,
      avisoPrevioMin: b.avisoPrevioMin,
      registro: datos.registros[`${fecha}|${b.id}`] ?? null,
    }));

  const deTareas: Suceso[] = datos.tareas
    .filter((t) => t.fecha === fecha)
    .map((t) => ({
      id: t.id,
      origen: "tarea" as const,
      nombre: t.nombre,
      minuto: t.hora ? aMinutos(t.hora) : null,
      hora: t.hora,
      duracionMin: t.duracionMin,
      categoria: t.categoria,
      porque: "",
      timbre: t.timbre,
      avisoPrevioMin: 0,
      registro: datos.registros[`${fecha}|${t.id}`] ?? null,
    }));

  return [...deRutina, ...deTareas].sort((a, b) => {
    if (a.minuto === null) return b.minuto === null ? 0 : 1;
    if (b.minuto === null) return -1;
    return a.minuto - b.minuto;
  });
}

export const MINUTOS_DEL_DIA = 1440;

/** ¿Este bloque se pasa de la medianoche? (dormir, un turno de noche…) */
export function cruzaMedianoche(minuto: number, duracionMin: number): boolean {
  return minuto + duracionMin > MINUTOS_DEL_DIA;
}

/**
 * El minuto en que se da por cerrado un suceso, **recortado a medianoche**.
 *
 * Un bloque de dormir de 22:00 a 06:00 pertenece al día en que empieza; si se
 * dejara su fin real (1800) nunca llegaría a «pasado» ni vencería, porque el
 * reloj del día no pasa de 1440. Se cierra a medianoche y el día siguiente
 * empieza limpio.
 */
export function finDe(suceso: Suceso): number {
  if (suceso.minuto === null) return MINUTOS_DEL_DIA;
  return Math.min(suceso.minuto + suceso.duracionMin, MINUTOS_DEL_DIA);
}

export type FaseSuceso = "pasado" | "ahora" | "proximo" | "futuro" | "sinHora";

/** En qué punto del día está cada suceso, para saber qué destacar. */
export function faseDe(
  suceso: Suceso,
  minutoAhora: number,
  esHoy: boolean,
): FaseSuceso {
  if (suceso.minuto === null) return "sinHora";
  if (!esHoy) return "futuro";
  const fin = finDe(suceso);
  if (minutoAhora >= suceso.minuto && minutoAhora < fin) return "ahora";
  if (minutoAhora >= fin) return "pasado";
  return "futuro";
}

/** El bloque que toca: el que está en curso o, si no hay, el siguiente. */
export function sucesoEnCurso(
  sucesos: Suceso[],
  minutoAhora: number,
): Suceso | null {
  const enCurso = sucesos.find(
    (s) => s.minuto !== null && minutoAhora >= s.minuto && minutoAhora < finDe(s),
  );
  if (enCurso) return enCurso;
  return sucesos.find((s) => s.minuto !== null && s.minuto > minutoAhora) ?? null;
}

/**
 * Un suceso está vencido cuando pasó su hora más la ventana de gracia y sigue
 * sin marcar. A partir de ahí ya no se puede marcar cumplido: cuenta como caída.
 */
export function estaVencido(
  suceso: Suceso,
  minutoAhora: number,
  graciaMin: number,
  esHoy: boolean,
): boolean {
  if (suceso.registro || suceso.minuto === null) return false;
  if (!esHoy) return false;
  return minutoAhora > finDe(suceso) + graciaMin;
}
