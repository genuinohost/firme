import type { Categoria, Timbre } from "@/datos/tipos";

/**
 * Los planes.
 *
 * Un plan es un compromiso delante de Dios con nombre, propósito y racha propia.
 * No es una lista de tareas: es una carrera concreta que alguien decide correr
 * —madrugar a orar, andar en santidad, leer la Palabra— y que se puede mirar a
 * los ojos cada día.
 *
 * Hay dos formas de cumplir un plan, y muchos usan las dos:
 *
 *  - **Bloques**: algo que se hace a una hora. Genera alarma y se marca al
 *    hacerlo. «Orar a las 5:00».
 *  - **Puntos de examen**: algo que no tiene hora porque dura todo el día, y se
 *    repasa al acostarse. «Hoy no murmuré». Para esto suena un recordatorio por
 *    la noche.
 */

/** Algo que se hace a una hora concreta y avisa. */
export type CompromisoConHora = {
  id: string;
  clase: "bloque";
  nombre: string;
  /** "HH:MM" */
  hora: string;
  duracionMin: number;
  /** 0 = domingo … 6 = sábado */
  dias: number[];
  timbre: Timbre;
  avisoPrevioMin: number;
  /** El porqué de este compromiso. Sale en la alarma. */
  porque: string;
};

/** Algo que se sostiene todo el día y se repasa de noche. */
export type PuntoDeExamen = {
  id: string;
  /** Redactado en positivo: lo que se logró, no lo que se prohíbe. */
  texto: string;
  /** El versículo que lo sostiene. Se puede ver al tocarlo. */
  versiculo?: string;
  cita?: string;
};

export type Compromiso = CompromisoConHora;

export type Plan = {
  id: string;
  /** De qué plantilla salió. Sirve para saber qué frases usar. */
  plantilla: string;
  nombre: string;
  /** Por qué existe este plan, con fundamento. Se lee al empezar y al flojear. */
  proposito: string;
  /** El versículo que lo resume. */
  versiculo: string;
  cita: string;
  emoji: string;
  categoria: Categoria;
  compromisos: Compromiso[];
  puntos: PuntoDeExamen[];
  /** "HH:MM" del repaso nocturno. Solo cuenta si hay puntos. */
  horaExamen: string;
  /** Timbre del recordatorio del examen. */
  timbreExamen: Timbre;
  activo: boolean;
  /** Cuándo se empezó, para poder decir «llevas 34 días». */
  desde: string;
};

/**
 * Lo anotado de un plan en un día.
 *
 * Los puntos se guardan uno a uno para poder decirle a alguien en qué está
 * fallando, en vez de un sí o un no que no enseña nada.
 */
export type RegistroPlan = {
  /** Qué puntos se cumplieron. La clave es el id del punto. */
  puntos: Record<string, boolean>;
  /** Cuándo se hizo el repaso. 0 si aún no se ha hecho. */
  repasado: number;
};

/**
 * Un día de un plan está ganado cuando se cumplieron sus bloques **y** todos
 * sus puntos de examen. La santidad no admite el ochenta por ciento.
 */
export type EstadoDia = "ganado" | "fallado" | "pendiente" | "sinNada";

/** Una plantilla es un plan listo para estrenar, sin identificadores todavía. */
export type PlantillaPlan = Omit<
  Plan,
  "id" | "activo" | "desde" | "compromisos" | "puntos" | "horaExamen" | "timbreExamen"
> & {
  /** Solo los planes con puntos de examen los necesitan. */
  horaExamen?: string;
  timbreExamen?: Timbre;
  /** Descripción corta para la pantalla de elegir plan. */
  resumen: string;
  compromisos: Omit<CompromisoConHora, "id">[];
  puntos: Omit<PuntoDeExamen, "id">[];
  /** Variantes de hora que se ofrecen al crearlo. Vacío si no aplica. */
  horasSugeridas?: { etiqueta: string; hora: string }[];
};
