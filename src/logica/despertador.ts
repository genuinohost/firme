import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Datos } from "@/datos/tipos";
import { avisosPendientes } from "./avisos";

/**
 * El despertador de verdad.
 *
 * Las notificaciones corrientes las silencia el modo No molestar, y eso dejaba
 * mudas las alarmas de madrugada. Este módulo habla con el plugin propio
 * (`AlarmaExacta.java`), que programa con `setAlarmClock` y hace sonar el tono
 * por el canal de audio de alarma, que No molestar no silencia.
 */

type AlarmaParaAndroid = {
  /** Marca de tiempo en milisegundos. */
  cuando: number;
  titulo: string;
  cuerpo: string;
  idSuceso: string;
};

export type EstadoDespertador = {
  enCola: number;
  /** Marca de tiempo de la próxima, o 0 si no hay ninguna. */
  proxima: number;
  puedeExactas: boolean;
  volumenAlarma: number;
  volumenAlarmaMaximo: number;
};

type PluginAlarmaExacta = {
  programar(opciones: { alarmas: AlarmaParaAndroid[] }): Promise<{ programadas: number }>;
  estado(): Promise<EstadoDespertador>;
  probar(opciones: { segundos: number }): Promise<{ cuando: number }>;
  pedirPermisoExactas(): Promise<void>;
  abrirAjustesDeLaApp(): Promise<void>;
};

const AlarmaExacta = registerPlugin<PluginAlarmaExacta>("AlarmaExacta");

/** Cuántos días por delante se dejan programados. */
const DIAS_POR_DELANTE = 14;

/**
 * Tope de alarmas en cola.
 *
 * `setAlarmClock` es cara para el sistema, así que se deja un número holgado
 * pero no desmedido. Con una rutina de diez bloques, esto cubre tres semanas.
 */
const MAXIMO = 200;

export function hayDespertador(): boolean {
  return Capacitor.isNativePlatform();
}

/** Entrega a Android la lista completa, borrando lo que hubiera antes. */
export async function programarDespertador(
  datos: Datos,
  ahora = new Date(),
): Promise<{ programadas: number; error: string | null }> {
  if (!hayDespertador()) return { programadas: 0, error: null };

  const alarmas: AlarmaParaAndroid[] = avisosPendientes(datos, ahora, DIAS_POR_DELANTE)
    .slice(0, MAXIMO)
    .map((aviso) => ({
      cuando: aviso.cuando.getTime(),
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      idSuceso: aviso.idSuceso,
    }));

  try {
    const r = await AlarmaExacta.programar({ alarmas });
    return { programadas: r.programadas, error: null };
  } catch (e) {
    return { programadas: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function estadoDespertador(): Promise<EstadoDespertador | null> {
  if (!hayDespertador()) return null;
  try {
    return await AlarmaExacta.estado();
  } catch {
    return null;
  }
}

export async function probarDespertador(segundos = 60): Promise<Date | null> {
  if (!hayDespertador()) return null;
  try {
    const r = await AlarmaExacta.probar({ segundos });
    return new Date(r.cuando);
  } catch {
    return null;
  }
}

export async function pedirPermisoExactas(): Promise<void> {
  if (!hayDespertador()) return;
  try {
    await AlarmaExacta.pedirPermisoExactas();
  } catch {
    /* en Android anterior al 12 no hace falta */
  }
}

export async function abrirAjustesDeLaApp(): Promise<void> {
  if (!hayDespertador()) return;
  try {
    await AlarmaExacta.abrirAjustesDeLaApp();
  } catch {
    /* nada que hacer si el sistema lo rechaza */
  }
}
