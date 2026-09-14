import { idNuevo } from "@/datos/almacen";
import type { Plan, PlantillaPlan, RegistroPlan, EstadoDia } from "@/datos/planes/tipos";
import type { Datos, Suceso } from "@/datos/tipos";
import { claveFecha, desdeClave } from "./dia";

/**
 * La vida de un plan: crearlo, saber si se cumplió hoy y llevarle la racha.
 *
 * Cada plan tiene su propia cuenta. Alguien puede llevar cuarenta días
 * madrugando y haber fallado ayer en santidad, y la app tiene que poder decirle
 * las dos cosas por separado — que es justo lo que hace útil mirarlas.
 */

export function crearDesdePlantilla(
  plantilla: PlantillaPlan,
  ajustes: { hora?: string; hoy?: Date } = {},
): Plan {
  const hoy = ajustes.hoy ?? new Date();
  return {
    id: idNuevo(),
    plantilla: plantilla.plantilla,
    nombre: plantilla.nombre,
    proposito: plantilla.proposito,
    versiculo: plantilla.versiculo,
    cita: plantilla.cita,
    emoji: plantilla.emoji,
    categoria: plantilla.categoria,
    compromisos: plantilla.compromisos.map((c) => ({
      ...c,
      id: idNuevo(),
      // La hora elegida al crear el plan manda sobre la de la plantilla.
      hora: ajustes.hora ?? c.hora,
    })),
    puntos: plantilla.puntos.map((p) => ({ ...p, id: idNuevo() })),
    horaExamen: plantilla.horaExamen ?? "21:30",
    timbreExamen: plantilla.timbreExamen ?? "campana",
    activo: true,
    desde: claveFecha(hoy),
  };
}

export function claveRegistro(fecha: string, idPlan: string): string {
  return `${fecha}|plan|${idPlan}`;
}

export function registroDe(datos: Datos, fecha: string, idPlan: string): RegistroPlan | null {
  return datos.planesRegistros?.[claveRegistro(fecha, idPlan)] ?? null;
}

/** Los bloques de un plan que tocan en una fecha, ya resueltos como sucesos. */
export function sucesosDelPlan(plan: Plan, fecha: string, datos: Datos): Suceso[] {
  const diaSemana = desdeClave(fecha).getDay();
  return plan.compromisos
    .filter((c) => c.dias.includes(diaSemana))
    .map((c) => ({
      id: c.id,
      origen: "rutina" as const,
      nombre: c.nombre,
      minuto: Number(c.hora.slice(0, 2)) * 60 + Number(c.hora.slice(3, 5)),
      hora: c.hora,
      duracionMin: c.duracionMin,
      categoria: plan.categoria,
      porque: c.porque,
      timbre: c.timbre,
      avisoPrevioMin: c.avisoPrevioMin,
      registro: datos.registros[`${fecha}|${c.id}`] ?? null,
    }));
}

/**
 * Cómo va un plan en un día.
 *
 * Se gana cumpliendo **todos** sus bloques y **todos** sus puntos. En santidad
 * no hay aprobado por los pelos: o se guardó el día, o no se guardó.
 */
export function estadoDelDia(
  plan: Plan,
  fecha: string,
  datos: Datos,
  esHoy: boolean,
): EstadoDia {
  const sucesos = sucesosDelPlan(plan, fecha, datos);
  const registro = registroDe(datos, fecha, plan.id);
  const hayPuntos = plan.puntos.length > 0;

  if (sucesos.length === 0 && !hayPuntos) return "sinNada";
  // Antes de estrenar el plan no se le puede reprochar nada.
  if (fecha < plan.desde) return "sinNada";

  const bloquesFallados = sucesos.some((s) => s.registro?.estado === "saltado");
  const bloquesSinMarcar = sucesos.some((s) => !s.registro);
  const puntosFallados = hayPuntos && registro
    ? plan.puntos.some((p) => registro.puntos[p.id] === false)
    : false;
  const sinRepasar = hayPuntos && (!registro || registro.repasado === 0);

  if (bloquesFallados || puntosFallados) return "fallado";
  if (bloquesSinMarcar || sinRepasar) return esHoy ? "pendiente" : "fallado";
  return "ganado";
}

function restarDias(f: Date, n: number): Date {
  const r = new Date(f);
  r.setDate(r.getDate() - n);
  return r;
}

/**
 * Días seguidos ganados en este plan.
 *
 * El de hoy solo suma si ya está ganado: mientras está pendiente no cuenta ni
 * rompe, para no castigar a media tarde por algo que aún puede cumplirse.
 */
export function rachaDelPlan(plan: Plan, datos: Datos, hoy = new Date()): number {
  let racha = 0;
  if (estadoDelDia(plan, claveFecha(hoy), datos, true) === "ganado") racha = 1;

  for (let i = 1; i < 400; i++) {
    const fecha = claveFecha(restarDias(hoy, i));
    if (fecha < plan.desde) break;
    const estado = estadoDelDia(plan, fecha, datos, false);
    if (estado === "sinNada") continue;
    if (estado !== "ganado") break;
    racha++;
  }
  return racha;
}

export function rachaMaximaDelPlan(plan: Plan, datos: Datos, hoy = new Date()): number {
  let mejor = 0;
  let corriente = 0;
  for (let i = 400; i >= 0; i--) {
    const fecha = claveFecha(restarDias(hoy, i));
    if (fecha < plan.desde) continue;
    const estado = estadoDelDia(plan, fecha, datos, i === 0);
    if (estado === "sinNada" || estado === "pendiente") continue;
    if (estado === "ganado") {
      corriente++;
      if (corriente > mejor) mejor = corriente;
    } else {
      corriente = 0;
    }
  }
  return mejor;
}

/** Cuántos días lleva en pie el plan, se hayan ganado o no. */
export function diasDesdeElComienzo(plan: Plan, hoy = new Date()): number {
  const inicio = desdeClave(plan.desde);
  return Math.max(1, Math.round((hoy.getTime() - inicio.getTime()) / 86_400_000) + 1);
}

/** El punto de examen que más se está fallando, para poder señalarlo. */
export function puntoMasFlojo(
  plan: Plan,
  datos: Datos,
  dias = 30,
  hoy = new Date(),
): { texto: string; fallos: number } | null {
  const cuenta = new Map<string, number>();
  for (let i = 0; i < dias; i++) {
    const registro = registroDe(datos, claveFecha(restarDias(hoy, i)), plan.id);
    if (!registro) continue;
    for (const punto of plan.puntos) {
      if (registro.puntos[punto.id] === false) {
        cuenta.set(punto.id, (cuenta.get(punto.id) ?? 0) + 1);
      }
    }
  }
  let peor: { texto: string; fallos: number } | null = null;
  for (const [id, fallos] of cuenta) {
    const punto = plan.puntos.find((p) => p.id === id);
    if (punto && (!peor || fallos > peor.fallos)) peor = { texto: punto.texto, fallos };
  }
  return peor;
}

/** ¿Toca ya el repaso de la noche? */
export function tocaRepaso(plan: Plan, minutoAhora: number): boolean {
  if (plan.puntos.length === 0) return false;
  const minuto = Number(plan.horaExamen.slice(0, 2)) * 60 + Number(plan.horaExamen.slice(3, 5));
  return minutoAhora >= minuto;
}
