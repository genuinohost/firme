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

/**
 * Un canal de Android **no se puede modificar una vez creado**: ni su sonido ni
 * su importancia. La única forma de corregirlo es publicar otro con id nuevo.
 *
 * El canal v1 se creó con `sound: ""`, que deja el canal mudo. Si algún día hay
 * que volver a tocar el sonido o la importancia, hay que subir este número.
 */
const CANAL = "alarmas-firme-v2";

export function esNativo(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Canal de importancia máxima: es lo que hace que el aviso suene y se asome en
 * pantalla en vez de caer callado en la bandeja.
 *
 * No se le pasa `sound`: sin ese campo Android usa el tono de notificación del
 * teléfono. Pasarle una cadena vacía es lo que lo dejaba mudo.
 */
async function asegurarCanal(): Promise<void> {
  try {
    await LocalNotifications.deleteChannel({ id: "alarmas-firme" });
  } catch {
    // El canal viejo puede no existir; da igual.
  }
  await LocalNotifications.createChannel({
    id: CANAL,
    name: "Alarmas de la rutina",
    description: "Los avisos de cada bloque del día",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  });
}

function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
}

export type EstadoNativo = {
  nativo: boolean;
  avisos: boolean;
  /** Android 12+ exige permiso aparte para alarmas al minuto exacto. */
  exactas: boolean;
  /** Cuántos avisos tiene el sistema en cola ahora mismo. */
  enCola: number;
  /** La hora del primer aviso en cola, según el propio sistema. */
  primero: Date | null;
  /** Qué salió mal, si algo salió mal. */
  error: string | null;
};

/**
 * Lo que Android dice de verdad sobre nuestras alarmas.
 *
 * Es el único diagnóstico que vale: si la cola está vacía, el fallo está en
 * programarlas; si está llena y aun así no suena, el fallo está en el móvil
 * silenciándolas.
 */
export async function estadoNativo(): Promise<EstadoNativo> {
  const vacio: EstadoNativo = {
    nativo: false,
    avisos: false,
    exactas: false,
    enCola: 0,
    primero: null,
    error: null,
  };
  if (!esNativo()) return vacio;

  try {
    const permiso = await LocalNotifications.checkPermissions();

    let exactas = true;
    try {
      exactas =
        (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
    } catch {
      // Android anterior al 12 no tiene ese ajuste: se dan por concedidas.
    }

    const pendientes = await LocalNotifications.getPending();
    const horas = pendientes.notifications
      .map((n) => (n.schedule?.at ? new Date(n.schedule.at).getTime() : 0))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    return {
      nativo: true,
      avisos: permiso.display === "granted",
      exactas,
      enCola: pendientes.notifications.length,
      primero: horas.length > 0 ? new Date(horas[0]) : null,
      error: null,
    };
  } catch (e) {
    return { ...vacio, nativo: true, error: mensajeDe(e) };
  }
}

export async function pedirPermisosNativos(): Promise<{ avisos: boolean; error: string | null }> {
  if (!esNativo()) return { avisos: false, error: null };
  try {
    let avisos = (await LocalNotifications.checkPermissions()).display === "granted";
    if (!avisos) {
      avisos = (await LocalNotifications.requestPermissions()).display === "granted";
    }
    await asegurarCanal();
    return { avisos, error: null };
  } catch (e) {
    return { avisos: false, error: mensajeDe(e) };
  }
}

/** Abre el ajuste del sistema donde se conceden las alarmas exactas. */
export async function abrirAjusteAlarmasExactas(): Promise<void> {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* no disponible en esta versión de Android */
  }
}

export type ResultadoProgramar = { programadas: number; error: string | null };

/**
 * Entrega a Android la lista completa de avisos.
 *
 * Se borra todo lo anterior y se vuelve a programar desde cero: es más simple
 * que llevar la cuenta de qué cambió, y barato porque solo pasa al abrir la app
 * o al tocar la rutina.
 */
export async function reprogramar(datos: Datos, ahora = new Date()): Promise<ResultadoProgramar> {
  if (!esNativo()) return { programadas: 0, error: null };

  try {
    await asegurarCanal();

    const pendientes = await LocalNotifications.getPending();
    if (pendientes.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pendientes.notifications });
    }

    const avisos = avisosPendientes(datos, ahora, DIAS_POR_DELANTE).slice(0, MAXIMO_AVISOS);
    if (avisos.length === 0) return { programadas: 0, error: null };

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

    return { programadas: avisos.length, error: null };
  } catch (e) {
    return { programadas: 0, error: mensajeDe(e) };
  }
}

/**
 * Programa un aviso de prueba por la misma vía que los de verdad.
 *
 * Es la única forma de comprobar la cadena entera —AlarmManager, canal, sonido,
 * pantalla apagada— sin esperar a que llegue una hora de la rutina.
 */
export async function probarAlarmaDelSistema(segundos = 60): Promise<ResultadoProgramar> {
  if (!esNativo()) {
    return { programadas: 0, error: "Esto solo funciona en la app de Android." };
  }
  try {
    await asegurarCanal();
    await LocalNotifications.schedule({
      notifications: [
        {
          // Un identificador alto y fijo, para no pisar los avisos de verdad.
          id: 999_000,
          channelId: CANAL,
          title: "Prueba del sistema",
          body: "Si oyes esto con la pantalla apagada, las alarmas funcionan.",
          schedule: { at: new Date(Date.now() + segundos * 1000), allowWhileIdle: true },
          smallIcon: "ic_stat_firme",
          iconColor: "#c9a227",
        },
      ],
    });
    return { programadas: 1, error: null };
  } catch (e) {
    return { programadas: 0, error: mensajeDe(e) };
  }
}
