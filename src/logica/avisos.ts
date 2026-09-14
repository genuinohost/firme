import type { Datos, Suceso } from "@/datos/tipos";
import { claveFecha, sucesosDelDia } from "./dia";

/**
 * Qué avisos van a sonar y cuándo.
 *
 * Es la única fuente de verdad: de aquí salen tanto las horas que se le
 * entregan a Android como el contador que ve el usuario. Si fueran dos
 * cálculos distintos acabarían diciendo cosas diferentes.
 */
export type Aviso = {
  cuando: Date;
  titulo: string;
  cuerpo: string;
  idSuceso: string;
  /** Es el aviso de cortesía de antes del bloque, no el de la hora en punto. */
  previo: boolean;
  nombreBloque: string;
};

function sumarDias(fecha: Date, n: number): Date {
  const f = new Date(fecha);
  f.setDate(f.getDate() + n);
  return f;
}

function textoDe(suceso: Suceso, previo: boolean): string {
  if (suceso.porque) return suceso.porque;
  return previo ? "Ve terminando lo que tienes entre manos." : "Es la hora. Empieza.";
}

/**
 * Los avisos que quedan por delante, en orden. Salta lo ya marcado y los
 * bloques con el timbre quitado, salvo que lo que toque sea su aviso previo.
 */
export function avisosPendientes(datos: Datos, desde: Date, dias: number): Aviso[] {
  const salida: Aviso[] = [];
  const ahora = desde.getTime();

  for (let i = 0; i < dias; i++) {
    const dia = sumarDias(desde, i);
    const fecha = claveFecha(dia);

    for (const suceso of sucesosDelDia(datos, fecha)) {
      if (suceso.minuto === null || suceso.registro) continue;

      const momentos: { minuto: number; previo: boolean }[] = [
        { minuto: suceso.minuto, previo: false },
      ];
      const minutoPrevio = suceso.minuto - suceso.avisoPrevioMin;
      if (suceso.avisoPrevioMin > 0 && minutoPrevio >= 0) {
        momentos.push({ minuto: minutoPrevio, previo: true });
      }

      for (const m of momentos) {
        if (suceso.timbre === "ninguno" && !m.previo) continue;

        const cuando = new Date(dia);
        cuando.setHours(Math.floor(m.minuto / 60), m.minuto % 60, 0, 0);
        if (cuando.getTime() <= ahora) continue;

        salida.push({
          cuando,
          titulo: m.previo ? `En unos minutos: ${suceso.nombre}` : suceso.nombre,
          cuerpo: textoDe(suceso, m.previo),
          idSuceso: suceso.id,
          previo: m.previo,
          nombreBloque: suceso.nombre,
        });
      }
    }
  }

  return salida.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
}

/** El siguiente aviso que va a sonar, mire el día que mire. */
export function proximaAlarma(datos: Datos, ahora: Date): Aviso | null {
  return avisosPendientes(datos, ahora, 8)[0] ?? null;
}

/**
 * Lo que falta, en cifras que no bailan: `mm:ss` por debajo de la hora y
 * `h:mm:ss` por encima.
 */
export function faltaPara(cuando: Date, ahora: Date): string {
  const seg = Math.max(0, Math.round((cuando.getTime() - ahora.getTime()) / 1000));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const dosCifras = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${dosCifras(m)}:${dosCifras(s)}`;
  return `${dosCifras(m)}:${dosCifras(s)}`;
}

/** «hoy», «mañana» o el día de la semana, para situar una alarma lejana. */
export function diaDe(cuando: Date, ahora: Date): string {
  const aMedianoche = (f: Date) =>
    new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  const dias = Math.round((aMedianoche(cuando) - aMedianoche(ahora)) / 86_400_000);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return nombres[cuando.getDay()];
}
