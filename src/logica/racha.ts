import type { Categoria, Datos } from "@/datos/tipos";
import { claveFecha, sucesosDelDia } from "./dia";

/** Un día se gana cumpliendo al menos este porcentaje de sus bloques. */
export const UMBRAL_DIA = 0.8;

export type ResumenDia = {
  fecha: string;
  total: number;
  cumplidos: number;
  saltados: number;
  /** 0 a 1. Si el día no tenía bloques, es 1. */
  ratio: number;
  ganado: boolean;
  /** ¿Se tocó algo ese día? Un día anterior a la instalación no es un fallo. */
  registrado: boolean;
};

export function resumenDe(datos: Datos, fecha: string): ResumenDia {
  const sucesos = sucesosDelDia(datos, fecha);
  const total = sucesos.length;
  const cumplidos = sucesos.filter((s) => s.registro?.estado === "cumplido").length;
  const saltados = sucesos.filter((s) => s.registro?.estado === "saltado").length;
  const ratio = total === 0 ? 1 : cumplidos / total;
  return {
    fecha,
    total,
    cumplidos,
    saltados,
    ratio,
    ganado: total > 0 && ratio >= UMBRAL_DIA,
    registrado: cumplidos + saltados > 0,
  };
}

function restarDias(f: Date, n: number): Date {
  const r = new Date(f);
  r.setDate(r.getDate() - n);
  return r;
}

/**
 * El primer día del que hay algo anotado. Antes de esa fecha la app no se
 * usaba, así que no cuenta como días fallados.
 */
export function primerDiaRegistrado(datos: Datos): string | null {
  let minimo: string | null = null;
  for (const clave of Object.keys(datos.registros)) {
    const fecha = clave.split("|")[0];
    if (minimo === null || fecha < minimo) minimo = fecha;
  }
  return minimo;
}

/**
 * Días seguidos ganados. El día de hoy solo suma si ya está ganado; mientras
 * está en curso no cuenta ni rompe, para no castigar por ir a media mañana.
 */
export function rachaActual(datos: Datos, hoy = new Date()): number {
  const desde = primerDiaRegistrado(datos);
  if (desde === null) return 0;
  let racha = 0;
  if (resumenDe(datos, claveFecha(hoy)).ganado) racha = 1;
  for (let i = 1; i < 400; i++) {
    const fecha = claveFecha(restarDias(hoy, i));
    if (fecha < desde) break; // antes de empezar a usar la app no se falló nada
    const r = resumenDe(datos, fecha);
    if (r.total === 0) continue; // un día sin nada programado no rompe la cadena
    if (!r.ganado) break;
    racha++;
  }
  return racha;
}

export function rachaMaxima(datos: Datos, hoy = new Date()): number {
  const desde = primerDiaRegistrado(datos);
  if (desde === null) return 0;
  let mejor = 0;
  let corriente = 0;
  for (let i = 365; i >= 0; i--) {
    const fecha = claveFecha(restarDias(hoy, i));
    if (fecha < desde) continue;
    const r = resumenDe(datos, fecha);
    if (r.total === 0) continue;
    if (r.ganado) {
      corriente++;
      if (corriente > mejor) mejor = corriente;
    } else {
      corriente = 0;
    }
  }
  return mejor;
}

export function ultimosDias(datos: Datos, n: number, hoy = new Date()): ResumenDia[] {
  const salida: ResumenDia[] = [];
  for (let i = n - 1; i >= 0; i--) {
    salida.push(resumenDe(datos, claveFecha(restarDias(hoy, i))));
  }
  return salida;
}

/** Cumplimiento por área en los últimos `n` días: dónde se está fallando. */
export function porCategoria(
  datos: Datos,
  n: number,
  hoy = new Date(),
): Record<Categoria, { total: number; cumplidos: number }> {
  const acumulado = {} as Record<Categoria, { total: number; cumplidos: number }>;
  for (let i = 0; i < n; i++) {
    const fecha = claveFecha(restarDias(hoy, i));
    for (const s of sucesosDelDia(datos, fecha)) {
      if (!s.registro) continue;
      const c = (acumulado[s.categoria] ??= { total: 0, cumplidos: 0 });
      c.total++;
      if (s.registro.estado === "cumplido") c.cumplidos++;
    }
  }
  return acumulado;
}

/** Total histórico de bloques cumplidos. El contador que solo sube. */
export function totalCumplidos(datos: Datos): number {
  return Object.values(datos.registros).filter((r) => r.estado === "cumplido").length;
}
