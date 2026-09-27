import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Ajustes, Suceso } from "@/datos/tipos";
import { aHora, claveFecha, minutoActual } from "./dia";
import { parar, sonar } from "./sonido";

export type TipoAviso = "inicio" | "previo";

export type Disparo = {
  suceso: Suceso;
  tipo: TipoAviso;
  /** Clave única del disparo, para no repetirlo. */
  clave: string;
  /** Disparo lanzado a mano desde Ajustes: no registra nada. */
  esPrueba?: boolean;
};

/** El siguiente aviso que va a sonar hoy, o null si ya no queda ninguno. */
export function proximoAviso(
  sucesos: Suceso[],
  minutoAhora: number,
): { suceso: Suceso; minuto: number; tipo: TipoAviso } | null {
  let mejor: { suceso: Suceso; minuto: number; tipo: TipoAviso } | null = null;
  for (const suceso of sucesos) {
    if (suceso.minuto === null || suceso.registro) continue;
    if (suceso.timbre === "ninguno" && suceso.avisoPrevioMin === 0) continue;

    const momentos: { minuto: number; tipo: TipoAviso }[] = [
      { minuto: suceso.minuto, tipo: "inicio" },
    ];
    const previo = suceso.minuto - suceso.avisoPrevioMin;
    if (suceso.avisoPrevioMin > 0 && previo >= 0) {
      momentos.push({ minuto: previo, tipo: "previo" });
    }
    for (const m of momentos) {
      if (m.minuto < minutoAhora) continue;
      if (mejor === null || m.minuto < mejor.minuto) {
        mejor = { suceso, minuto: m.minuto, tipo: m.tipo };
      }
    }
  }
  return mejor;
}

/** Cuánto margen se da a una alarma perdida (app cerrada) para saltar al volver. */
const MARGEN_RECUPERACION_MIN = 3;

function claveDisparo(fecha: string, suceso: Suceso, tipo: TipoAviso): string {
  return `${fecha}|${suceso.id}|${tipo}`;
}

function leerDisparadas(fecha: string): Set<string> {
  try {
    const crudo = localStorage.getItem(`firme.disparadas.${fecha}`);
    return new Set<string>(crudo ? (JSON.parse(crudo) as string[]) : []);
  } catch {
    return new Set();
  }
}

function escribirDisparadas(fecha: string, valores: Set<string>): void {
  try {
    localStorage.setItem(`firme.disparadas.${fecha}`, JSON.stringify([...valores]));
    // Se limpian los días viejos para no dejar basura en el almacenamiento.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("firme.disparadas.") && k !== `firme.disparadas.${fecha}`) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* modo privado */
  }
}

/** Un reloj que avanza cada segundo y fuerza el repintado. */
export function useReloj(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), 1000);
    // Al volver de segundo plano el intervalo puede haberse congelado:
    // se sincroniza a mano.
    const alVolver = () => setAhora(new Date());
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, []);
  return ahora;
}

export async function pedirPermisoAvisos(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Muestra la notificación del sistema. Se hace desde el service worker cuando
 * lo hay: es la única vía que sigue viva con la app en segundo plano y la que
 * permite los botones de acción.
 */
export async function avisarSistema(disparo: Disparo, porque: string): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const titulo =
    disparo.tipo === "previo"
      ? `En unos minutos: ${disparo.suceso.nombre}`
      : disparo.suceso.nombre;
  const opciones: NotificationOptions = {
    body: porque || (disparo.tipo === "previo" ? "Ve terminando lo que tienes entre manos." : "Es la hora. Empieza."),
    tag: disparo.clave,
    icon: "/icono-192.png",
    badge: "/icono-192.png",
    requireInteraction: true,
    silent: false,
    data: { clave: disparo.clave },
  };
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (registro) {
      await registro.showNotification(titulo, opciones);
      return;
    }
  } catch {
    /* se cae al aviso normal */
  }
  try {
    new Notification(titulo, opciones);
  } catch {
    /* Android exige el service worker; si no hay, queda la alarma en pantalla */
  }
}

/**
 * Vigila la línea del día y dispara el aviso cuando llega la hora.
 *
 * Cubre tres casos: la hora exacta con la app delante, el aviso previo, y la
 * alarma que saltó mientras la app estaba en segundo plano (se recupera si no
 * han pasado más de unos minutos).
 */
export function useAlarmas(
  sucesos: Suceso[],
  ajustes: Ajustes,
  ahora: Date,
  activas: boolean,
): {
  disparo: Disparo | null;
  cerrar: () => void;
  posponer: (minutos: number) => void;
  probar: () => void;
} {
  const [disparo, setDisparo] = useState<Disparo | null>(null);
  const pospuestas = useRef<Map<string, number>>(new Map());

  /**
   * Las que llegaron mientras había otra en pantalla.
   *
   * ── El fallo que esto arregla ─────────────────────────────────────────
   *
   * Alex, el 27-09-2026: «cuando a una de las alarmas no me doy en Cumplido,
   * es como que se traba, se queda en esa alarma y no avanza a la otra».
   * Tenía razón, y era peor de lo que parecía.
   *
   * Aquí ponía `if (!activas || disparo) return;`: **mientras hubiera una
   * alarma sin contestar, la app dejaba de mirar si tocaba otra**. Y como el
   * margen de recuperación son tres minutos, todo lo que pasara desde el
   * cuarto minuto no se mostraba, **no se registraba, y no salía como
   * perdida** — porque nativamente sí había sonado. Desaparecía en silencio,
   * que es la peor forma de fallar que tiene esta app.
   *
   * Ahora se sigue mirando siempre. Lo que llega mientras hay una en pantalla
   * se apunta aquí y sale en cuanto se contesta la anterior. **No se pierde
   * ninguna**: cada una es un bloque de la rutina que alguien tiene que marcar
   * como cumplido o saltado, y esa decisión no la toma la app.
   */
  const cola = useRef<Disparo[]>([]);
  const fecha = claveFecha(ahora);
  const minuto = minutoActual(ahora);

  useEffect(() => {
    if (!activas) return;
    const disparadas = leerDisparadas(fecha);

    for (const suceso of sucesos) {
      if (suceso.minuto === null || suceso.registro) continue;

      const candidatos: { tipo: TipoAviso; minutoObjetivo: number }[] = [
        { tipo: "inicio", minutoObjetivo: suceso.minuto },
      ];
      // Un aviso previo que caería antes de medianoche pertenece al día anterior:
      // se descarta en vez de quedarse esperando un minuto que nunca llega.
      const minutoPrevio = suceso.minuto - suceso.avisoPrevioMin;
      if (suceso.avisoPrevioMin > 0 && minutoPrevio >= 0) {
        candidatos.push({ tipo: "previo", minutoObjetivo: minutoPrevio });
      }

      for (const { tipo, minutoObjetivo } of candidatos) {
        const clave = claveDisparo(fecha, suceso, tipo);
        const aplazadoHasta = pospuestas.current.get(clave);
        const objetivo = aplazadoHasta ?? minutoObjetivo;
        if (aplazadoHasta === undefined && disparadas.has(clave)) continue;
        const retraso = minuto - objetivo;
        if (retraso < 0 || retraso > MARGEN_RECUPERACION_MIN) continue;

        const nuevo: Disparo = { suceso, tipo, clave };
        // Se apunta como disparada **aunque vaya a la cola**: si no, se
        // volvería a detectar cada minuto y acabaría repetida.
        disparadas.add(clave);
        escribirDisparadas(fecha, disparadas);
        pospuestas.current.delete(clave);

        if (disparo) {
          // Hay otra en pantalla. Ésta espera su turno, sin sonar: el ruido ya
          // lo está poniendo la de delante.
          if (!cola.current.some((d) => d.clave === clave)) cola.current.push(nuevo);
          return;
        }

        setDisparo(nuevo);

        // En Android el ruido lo pone el servicio nativo, que repica por el
        // canal de alarma y no se calla hasta que alguien lo para. Tocar aquí
        // además el tono web sonaría encima, desacompasado.
        if (!Capacitor.isNativePlatform()) {
          if (tipo === "inicio") sonar(suceso.timbre, ajustes.volumen);
          else sonar("pulso", ajustes.volumen * 0.6);
          void avisarSistema(nuevo, suceso.porque);
        }
        return;
      }
    }
  }, [sucesos, fecha, minuto, activas, disparo, ajustes.volumen]);

  /**
   * Lanza la alarma a mano, tal cual sonaría de verdad. Es la forma de separar
   * «la alarma está rota» de «la programación no llegó a dispararse» sin tener
   * que esperar a que llegue una hora.
   */
  const probar = useCallback(() => {
    const suceso: Suceso = {
      id: "prueba",
      origen: "rutina",
      nombre: "Prueba de alarma",
      minuto,
      hora: aHora(minuto),
      duracionMin: 1,
      categoria: "cuerpo",
      porque: "Si ves esta pantalla y la oyes sonar, la alarma funciona.",
      timbre: "diana",
      avisoPrevioMin: 0,
      registro: null,
    };
    const nuevo: Disparo = { suceso, tipo: "inicio", clave: "prueba", esPrueba: true };
    setDisparo(nuevo);
    sonar("diana", ajustes.volumen);
    void avisarSistema(nuevo, suceso.porque);
  }, [minuto, ajustes.volumen]);

  /**
   * Da paso a la siguiente de la cola, si hay.
   *
   * Sale la más vieja primero: son bloques de la rutina en el orden en que
   * pasaron, y contestarlos al revés confunde.
   */
  const siguiente = useCallback(() => {
    const queda = cola.current.shift() ?? null;
    setDisparo(queda);
    if (queda && !Capacitor.isNativePlatform()) {
      if (queda.tipo === "inicio") sonar(queda.suceso.timbre, ajustes.volumen);
      else sonar("pulso", ajustes.volumen * 0.6);
    }
  }, [ajustes.volumen]);

  const cerrar = useCallback(() => {
    parar();
    siguiente();
  }, [siguiente]);

  const posponer = useCallback(
    (minutos: number) => {
      if (disparo) {
        pospuestas.current.set(disparo.clave, minutoActual(new Date()) + minutos);
      }
      parar();
      siguiente();
    },
    [disparo, siguiente],
  );

  return { disparo, cerrar, posponer, probar };
}
