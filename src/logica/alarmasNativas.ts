import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Datos } from "@/datos/tipos";
import { avisosPendientes } from "./avisos";

/**
 * Alarmas del sistema operativo.
 *
 * En la versión web, el aviso lo dispara un temporizador de JavaScript, y
 * Android congela ese JavaScript en cuanto se apaga la pantalla: por eso la
 * PWA no despertaba a nadie.
 *
 * Aquí se le entregan las horas a Android y es él quien despierta, con su
 * `AlarmManager`. Funciona con la app cerrada, sin conexión y sin servidor.
 */

/** Cuántos días por delante se programan. Se rehace cada vez que se abre la app. */
const DIAS_POR_DELANTE = 14;

/** Tope de avisos en cola. Android empieza a descartar por encima de unos 500. */
const MAXIMO_AVISOS = 400;

const CANAL = "alarmas-firme";

export function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Un canal de importancia máxima: es lo que hace que el aviso suene y se
 * asome en pantalla en vez de caer callado en la bandeja.
 */
async function asegurarCanal(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: CANAL,
      name: "Alarmas de la rutina",
      description: "Los avisos de cada bloque del día",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "",
    });
  } catch {
    // Los canales solo existen en Android 8+; en versiones viejas no hace falta.
  }
}

export type EstadoPermisos = {
  avisos: boolean;
  /** Android 12+ exige permiso aparte para alarmas al minuto exacto. */
  exactas: boolean;
};

export async function pedirPermisosNativos(): Promise<EstadoPermisos> {
  if (!esNativo()) return { avisos: false, exactas: false };

  let avisos = (await LocalNotifications.checkPermissions()).display === "granted";
  if (!avisos) {
    avisos = (await LocalNotifications.requestPermissions()).display === "granted";
  }

  let exactas = true;
  try {
    const estado = await LocalNotifications.checkExactNotificationSetting();
    exactas = estado.exact_alarm === "granted";
  } catch {
    // En Android anterior al 12 no existe el ajuste: se dan por concedidas.
  }

  await asegurarCanal();
  return { avisos, exactas };
}

/** Abre el ajuste del sistema donde se conceden las alarmas exactas. */
export async function abrirAjusteAlarmasExactas(): Promise<void> {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* no disponible en esta versión de Android */
  }
}

/**
 * Entrega a Android la lista completa de avisos.
 *
 * Se borra todo lo anterior y se vuelve a programar desde cero: es más simple
 * que llevar la cuenta de qué cambió, y barato porque solo pasa al abrir la app
 * o al tocar la rutina.
 */
export async function reprogramar(datos: Datos, ahora = new Date()): Promise<number> {
  if (!esNativo()) return 0;

  try {
    const pendientes = await LocalNotifications.getPending();
    if (pendientes.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pendientes.notifications });
    }

    const avisos = avisosPendientes(datos, ahora, DIAS_POR_DELANTE).slice(0, MAXIMO_AVISOS);
    if (avisos.length === 0) return 0;

    await LocalNotifications.schedule({
      notifications: avisos.map((aviso, indice) => ({
        // Los identificadores se reparten al vuelo porque acabamos de vaciar
        // la cola: así no hay que inventar un hash que podría chocar.
        id: indice + 1,
        channelId: CANAL,
        title: aviso.titulo,
        body: aviso.cuerpo,
        schedule: {
          at: aviso.cuando,
          // Sin esto, Android retrasa el aviso hasta que el móvil despierte
          // por su cuenta, que es justo lo que rompía las alarmas.
          allowWhileIdle: true,
        },
        smallIcon: "ic_stat_firme",
        iconColor: "#c9a227",
        extra: { idSuceso: aviso.idSuceso },
      })),
    });

    return avisos.length;
  } catch {
    return 0;
  }
}

/** Cuántos avisos hay en la cola del sistema ahora mismo. */
export async function avisosEnCola(): Promise<number> {
  if (!esNativo()) return 0;
  try {
    return (await LocalNotifications.getPending()).notifications.length;
  } catch {
    return 0;
  }
}
