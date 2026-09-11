import { useCallback, useEffect, useRef, useState } from "react";
import type { Ajustes, Suceso } from "@/datos/tipos";
import { claveFecha, minutoActual } from "./dia";
import { parar, sonar } from "./sonido";

export type TipoAviso = "inicio" | "previo";

export type Disparo = {
  suceso: Suceso;
  tipo: TipoAviso;
  /** Clave única del disparo, para no repetirlo. */
  clave: string;
};

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
): { disparo: Disparo | null; cerrar: () => void; posponer: (minutos: number) => void } {
  const [disparo, setDisparo] = useState<Disparo | null>(null);
  const pospuestas = useRef<Map<string, number>>(new Map());
  const fecha = claveFecha(ahora);
  const minuto = minutoActual(ahora);

  useEffect(() => {
    if (!activas || disparo) return;
    const disparadas = leerDisparadas(fecha);

    for (const suceso of sucesos) {
      if (suceso.minuto === null || suceso.registro) continue;

      const candidatos: { tipo: TipoAviso; minutoObjetivo: number }[] = [
        { tipo: "inicio", minutoObjetivo: suceso.minuto },
      ];
      if (suceso.avisoPrevioMin > 0) {
        candidatos.push({ tipo: "previo", minutoObjetivo: suceso.minuto - suceso.avisoPrevioMin });
      }

      for (const { tipo, minutoObjetivo } of candidatos) {
        const clave = claveDisparo(fecha, suceso, tipo);
        const aplazadoHasta = pospuestas.current.get(clave);
        const objetivo = aplazadoHasta ?? minutoObjetivo;
        if (aplazadoHasta === undefined && disparadas.has(clave)) continue;
        const retraso = minuto - objetivo;
        if (retraso < 0 || retraso > MARGEN_RECUPERACION_MIN) continue;

        const nuevo: Disparo = { suceso, tipo, clave };
        disparadas.add(clave);
        escribirDisparadas(fecha, disparadas);
        pospuestas.current.delete(clave);
        setDisparo(nuevo);
        if (tipo === "inicio") sonar(suceso.timbre, ajustes.volumen);
        else sonar("pulso", ajustes.volumen * 0.6);
        void avisarSistema(nuevo, suceso.porque);
        return;
      }
    }
  }, [sucesos, fecha, minuto, activas, disparo, ajustes.volumen]);

  const cerrar = useCallback(() => {
    parar();
    setDisparo(null);
  }, []);

  const posponer = useCallback(
    (minutos: number) => {
      if (disparo) {
        pospuestas.current.set(disparo.clave, minutoActual(new Date()) + minutos);
      }
      parar();
      setDisparo(null);
    },
    [disparo],
  );

  return { disparo, cerrar, posponer };
}
