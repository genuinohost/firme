import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * El aviso de «se acabó el grupo» con el móvil bloqueado.
 *
 * En un grupo de 10 a 30 minutos lo normal es que la pantalla se apague sola
 * mientras se habla. La app no cambia de canal con el móvil bloqueado (Android
 * no deja arrancar el servicio de voz desde segundo plano), así que al acabar
 * el tiempo alguien tiene que avisar: una notificación con sonido y vibración,
 * que al tocarla abre la app, y la app vuelve sola a la sala principal.
 *
 * Se programa en Android al entrar en el grupo, para la hora de fin: así suena
 * aunque la app esté dormida. Si el anfitrión los reúne antes, se avisa en el
 * momento. Y se olvida al volver.
 */

const CANAL = "grupos-firme";
/** Fuera del rango de la rutina: `alarmasNativas.reprogramar` no lo toca. */
export const ID_AVISO_GRUPO = 997_001;

async function asegurarCanal(): Promise<void> {
  await LocalNotifications.createChannel({
    id: CANAL,
    name: "Subgrupos del devocional",
    description: "Cuando termina el tiempo de tu grupo",
    importance: 4,
    visibility: 1,
    vibration: true,
  });
}

/** A la hora de fin del grupo, un aviso para volver. */
export async function programarVueltaDelGrupo(hasta: number, grupo: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !hasta || hasta < Date.now() + 5_000) return;
  try {
    await asegurarCanal();
    await LocalNotifications.cancel({ notifications: [{ id: ID_AVISO_GRUPO }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_AVISO_GRUPO,
          channelId: CANAL,
          title: `Terminó el tiempo del ${grupo}`,
          body: "Toca para volver a la sala principal.",
          schedule: { at: new Date(hasta), allowWhileIdle: true },
          smallIcon: "ic_stat_firme",
          iconColor: "#c9a227",
        },
      ],
    });
  } catch {
    // Sin aviso, vuelve igual al mirar el móvil.
  }
}

/** Avisar ya: el anfitrión reunió a todos y este móvil está bloqueado. */
export async function avisarVueltaYa(texto: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await asegurarCanal();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_AVISO_GRUPO,
          channelId: CANAL,
          title: texto,
          body: "Toca para volver a la sala principal.",
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
          smallIcon: "ic_stat_firme",
          iconColor: "#c9a227",
        },
      ],
    });
  } catch {
    // Vuelve igual al mirar el móvil.
  }
}

/** Ya volvió (o se fue): el aviso sobra. */
export async function olvidarVueltaDelGrupo(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID_AVISO_GRUPO }] });
    await LocalNotifications.removeDeliveredNotifications({
      notifications: [{ id: ID_AVISO_GRUPO, title: "", body: "" }],
    });
  } catch {
    // Nada que olvidar.
  }
}
