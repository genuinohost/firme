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
  /** Cuántas creemos nosotros que quedan por sonar. */
  enCola: number;
  /**
   * Cuántas tiene **el sistema** de verdad.
   *
   * Es la cifra que vale. Hasta la 3.3 el diagnóstico leía nuestras propias
   * notas y salía verde aunque Android las hubiera tirado todas.
   */
  confirmadas: number;
  /** Marca de tiempo de la próxima, o 0 si no hay ninguna. */
  proxima: number;
  /** La siguiente alarma que tiene el sistema, sea de la app que sea. */
  proximaDelSistema: number;
  puedeExactas: boolean;
  volumenAlarma: number;
  volumenAlarmaMaximo: number;
  /** Fuera del ahorro de batería: lo que más alarmas mata si falta. */
  exentaDeBateria: boolean;
  /** Sin esto, «saltar No molestar» del canal de respaldo no hace nada. */
  accesoNoMolestar: boolean;
  avisosActivos: boolean;
  canalActivo: boolean;
  sonandoAhora: boolean;
  /** Lo último que impidió que sonara, si algo lo impidió. */
  ultimoFallo: string;
  /** Apuntes de los disparos reales, en JSON. */
  diario: string;
  /** La lista completa de alarmas guardada en disco, en JSON. */
  cola: string;
  fabricante: string;
  modelo: string;
  android: string;
  sdk: number;
  /** Cajón de reposo del sistema. «RESTRINGIDA» es la mala. */
  cajon: string;
  /** «Restringir actividad en segundo plano»: mata alarmas y nadie lo mira. */
  restringidaEnSegundoPlano: boolean;
  /**
   * El ahorro de energía del sistema.
   *
   * El modo **ultra** de algunos fabricantes cierra las apps de terceros y les
   * retira las alarmas. No hay forma de evitarlo desde dentro: está hecho para
   * eso. Sólo se puede avisar.
   */
  ahorroDeEnergia: boolean;
  /**
   * Cómo está puesto No molestar.
   *
   * En **silencio total** Android calla también el flujo de alarma, y entonces
   * no hay app capaz de sonar. Es la única causa de silencio sin arreglo desde
   * dentro: lo mínimo es saber nombrarla.
   */
  filtroNoMolestar: string;
};

type PluginAlarmaExacta = {
  programar(opciones: {
    alarmas: AlarmaParaAndroid[];
  }): Promise<{ programadas: number; confirmadas: number }>;
  estado(): Promise<EstadoDespertador>;
  probar(opciones: { segundos: number }): Promise<{ cuando: number }>;
  sonarYa(): Promise<void>;
  parar(): Promise<void>;
  revisarPerdidas(): Promise<{ perdidas: string }>;
  pedirPermisoExactas(): Promise<void>;
  pedirExencionBateria(): Promise<void>;
  pedirAccesoNoMolestar(): Promise<void>;
  abrirInicioAutomatico(): Promise<{ abierta: boolean; donde?: string }>;
  hayInicioAutomatico(): Promise<{ hay: boolean; fabricante: string }>;
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
    // Si el sistema aceptó menos de las que le dimos, eso es un fallo que hay
    // que decir, no una cifra que maquillar.
    if (r.confirmadas < r.programadas) {
      return {
        programadas: r.confirmadas,
        error: `Android solo guardó ${r.confirmadas} de ${r.programadas} alarmas.`,
      };
    }
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

export type AlarmaPerdida = { cuando: Date; titulo: string };

/**
 * Las que tenían que haber sonado y no sonaron.
 *
 * Hay que preguntarlo **antes** de reprogramar, porque programar borra la cola.
 * Es lo que convierte un fallo mudo en un fallo que se ve: sin esto, una alarma
 * perdida de madrugada no deja rastro en ninguna parte y nadie puede
 * distinguirla de un despiste propio.
 */
export async function alarmasPerdidas(): Promise<AlarmaPerdida[]> {
  if (!hayDespertador()) return [];
  try {
    const r = await AlarmaExacta.revisarPerdidas();
    const crudas = JSON.parse(r.perdidas) as { cuando: number; titulo: string }[];
    return crudas.map((p) => ({ cuando: new Date(p.cuando), titulo: p.titulo }));
  } catch {
    return [];
  }
}

/** Hace repicar el servicio ahora mismo: es la prueba del ruido en sí. */
export async function sonarYa(): Promise<string | null> {
  if (!hayDespertador()) return "Esto solo funciona en la app de Android.";
  try {
    await AlarmaExacta.sonarYa();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Calla la alarma que esté repicando. */
export async function pararDespertador(): Promise<void> {
  if (!hayDespertador()) return;
  try {
    await AlarmaExacta.parar();
  } catch {
    /* si ya no suena, no hay nada que parar */
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

/**
 * El ahorro de batería es lo que más alarmas mata en los móviles baratos: el
 * sistema congela la app y sus alarmas se quedan esperando. El permiso estaba
 * declarado desde el principio, pero nunca se llegaba a pedir.
 */
export async function pedirExencionBateria(): Promise<void> {
  if (!hayDespertador()) return;
  try {
    await AlarmaExacta.pedirExencionBateria();
  } catch {
    /* algunos fabricantes lo bloquean */
  }
}

export async function pedirAccesoNoMolestar(): Promise<void> {
  if (!hayDespertador()) return;
  try {
    await AlarmaExacta.pedirAccesoNoMolestar();
  } catch {
    /* no todas las versiones lo ofrecen */
  }
}

/**
 * ¿Tiene este móvil un matador de apps propio?
 *
 * Sirve para no enseñar un botón que no lleva a ninguna parte. Un botón que se
 * toca y no hace nada deja la app pareciendo rota, y en la pantalla de «por qué
 * no sonó la alarma» eso es lo último que hace falta.
 */
export async function hayInicioAutomatico(): Promise<{ hay: boolean; fabricante: string }> {
  if (!hayDespertador()) return { hay: false, fabricante: "" };
  try {
    return await AlarmaExacta.hayInicioAutomatico();
  } catch {
    return { hay: false, fabricante: "" };
  }
}

/**
 * Abre la pantalla de «inicio automático» del fabricante.
 *
 * Es **el ajuste que más alarmas mata en Xiaomi** y no aparece en ningún sitio
 * de los ajustes de Android: cada marca lo esconde donde quiere y con otro
 * nombre. A Alex se le dieron las instrucciones por escrito y su respuesta fue
 * «no lo conseguí» — unas instrucciones que no se pueden seguir no sirven, así
 * que ahora se abre la pantalla y punto.
 *
 * Devuelve si se pudo abrir la de verdad o si hubo que caer en los ajustes de
 * la app. Eso cambia lo que se le dice después, y decirlo mal es dejar a
 * alguien buscando algo que no está ahí.
 */
export async function abrirInicioAutomatico(): Promise<boolean> {
  if (!hayDespertador()) return false;
  try {
    return (await AlarmaExacta.abrirInicioAutomatico()).abierta;
  } catch {
    return false;
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
