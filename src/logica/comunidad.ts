/**
 * La comunidad: los grupos y las reuniones en vivo.
 *
 * **Los enlaces no van dentro de la app.** Se leen de un archivo publicado en
 * internet, y esto no es un capricho técnico: un grupo de WhatsApp se llena a
 * los 1.024 miembros y hay que abrir otro, y el enlace de una reunión cambia
 * cada semana. Si vivieran dentro del APK, cada cambio obligaría a publicar una
 * versión nueva y esperar a que Google la apruebe — días para cambiar una URL.
 *
 * Así Alex edita un archivo, lo sube, y a todos les cambia al instante.
 *
 * Lo último que se descargó queda guardado, así que la pantalla funciona sin
 * conexión con la información de la última vez.
 */

const URL_COMUNIDAD = "https://genuino-pro.web.app/comunidad.json";
const GUARDADO = "firme.comunidad";
const GUARDADO_FECHA = "firme.comunidad.fecha";

/** Cada cuánto se vuelve a preguntar. Más a menudo no aporta y gasta datos. */
const HORAS_ENTRE_CONSULTAS = 6;

export type Enlace = {
  id: string;
  /** "whatsapp" · "telegram" · "instagram" · "youtube" · "web" */
  tipo: string;
  nombre: string;
  /** Para qué es este grupo, en una línea. */
  descripcion?: string;
  url: string;
};

export type Reunion = {
  id: string;
  nombre: string;
  /** Qué se hace: devocional, predicación, enseñanza… */
  descripcion?: string;
  /** 0 = domingo … 6 = sábado. Vacío significa todos los días. */
  dias: number[];
  /** "HH:MM" en la zona horaria de abajo. */
  hora: string;
  duracionMin: number;
  /** Zona del anfitrión, para que la hora sea la misma para todos. */
  zona: string;
  url: string;
};

export type Comunidad = {
  /** Un saludo breve encima de todo. Opcional. */
  bienvenida?: string;
  enlaces: Enlace[];
  reuniones: Reunion[];
};

const VACIA: Comunidad = { enlaces: [], reuniones: [] };

export function leerGuardada(): Comunidad {
  try {
    const crudo = localStorage.getItem(GUARDADO);
    if (!crudo) return VACIA;
    const c = JSON.parse(crudo) as Comunidad;
    return {
      bienvenida: c.bienvenida,
      enlaces: Array.isArray(c.enlaces) ? c.enlaces : [],
      reuniones: Array.isArray(c.reuniones) ? c.reuniones : [],
    };
  } catch {
    return VACIA;
  }
}

function tocaConsultar(): boolean {
  try {
    const ultima = Number(localStorage.getItem(GUARDADO_FECHA) ?? 0);
    return Date.now() - ultima > HORAS_ENTRE_CONSULTAS * 3600_000;
  } catch {
    return true;
  }
}

/**
 * Trae la comunidad de internet. Si falla —sin conexión, servidor caído— se
 * queda lo último que se guardó, que es mejor que una pantalla vacía.
 */
export async function actualizar(forzar = false): Promise<Comunidad> {
  if (!forzar && !tocaConsultar()) return leerGuardada();

  try {
    const respuesta = await fetch(URL_COMUNIDAD, { cache: "no-cache" });
    if (!respuesta.ok) return leerGuardada();
    const datos = (await respuesta.json()) as Comunidad;
    if (!Array.isArray(datos.enlaces)) return leerGuardada();

    localStorage.setItem(GUARDADO, JSON.stringify(datos));
    localStorage.setItem(GUARDADO_FECHA, String(Date.now()));
    return datos;
  } catch {
    return leerGuardada();
  }
}

/**
 * Los minutos que faltan para una reunión, o los que lleva en marcha.
 *
 * La hora se publica en la zona del anfitrión para que todos vean lo mismo, y
 * aquí se traduce a la hora local de cada uno.
 */
export function estadoReunion(
  reunion: Reunion,
  ahora = new Date(),
): { estado: "enVivo" | "hoy" | "otroDia"; minutos: number } {
  const [h, m] = reunion.hora.split(":").map(Number);

  // La hora del anfitrión, convertida al reloj de quien mira.
  const enSuZona = desplazamientoHorario(reunion.zona, ahora);
  const enLaMia = -ahora.getTimezoneOffset();
  const minutosLocal = h * 60 + m + (enLaMia - enSuZona);

  const minutoAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const hoyToca = reunion.dias.length === 0 || reunion.dias.includes(ahora.getDay());

  if (hoyToca) {
    const desdeElInicio = minutoAhora - minutosLocal;
    if (desdeElInicio >= 0 && desdeElInicio < reunion.duracionMin) {
      return { estado: "enVivo", minutos: desdeElInicio };
    }
    if (desdeElInicio < 0) return { estado: "hoy", minutos: -desdeElInicio };
  }
  return { estado: "otroDia", minutos: 0 };
}

/** Minutos de diferencia de una zona respecto a UTC, ese día concreto. */
function desplazamientoHorario(zona: string, cuando: Date): number {
  try {
    const formato = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      timeZoneName: "longOffset",
    });
    const parte = formato
      .formatToParts(cuando)
      .find((p) => p.type === "timeZoneName")?.value;
    // Viene como "GMT-04:00"; también puede ser "GMT" a secas.
    const m = parte?.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return 0;
    const signo = m[1] === "-" ? -1 : 1;
    return signo * (Number(m[2]) * 60 + Number(m[3]));
  } catch {
    return 0;
  }
}

/** La hora de la reunión en el reloj de quien la mira. */
export function horaLocalDe(reunion: Reunion, ahora = new Date()): string {
  const [h, m] = reunion.hora.split(":").map(Number);
  const minutos =
    h * 60 + m + (-ahora.getTimezoneOffset() - desplazamientoHorario(reunion.zona, ahora));
  const norm = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(norm / 60)).padStart(2, "0")}:${String(norm % 60).padStart(2, "0")}`;
}
