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

/**
 * Cómo se repasa el día.
 *
 * - `puntoAPunto`: se responde uno por uno. Sirve para planes donde cada cosa
 *   es independiente —trabajo, familia, gratitud.
 * - `unSoloCheck`: una sola pregunta para todo, con la posibilidad de decir en
 *   qué se falló. Es lo que pide la santidad: no se anda midiendo el día en
 *   porcentajes, se guardó o no se guardó.
 */
export type ModoExamen = "puntoAPunto" | "unSoloCheck";

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

  /** Cómo se repasa. Si falta, se responde punto por punto. */
  modoExamen?: ModoExamen;

  /**
   * ¿Una caída reconocida y llevada a Dios en arrepentimiento mantiene la racha?
   *
   * Tratar una caída confesada igual que una escondida sería mal consejo: lo que
   * rompe la comunión no es tropezar, es quedarse en el suelo. En estos planes
   * un día con caída **y arrepentimiento** cuenta como restaurado, y la racha
   * sigue en pie — pero se lleva la cuenta aparte, porque acudir muy seguido al
   * arrepentimiento es señal de algo que hay que mirar.
   */
  admiteRestauracion?: boolean;

  /**
   * Las áreas donde la persona reconoce su mayor debilidad.
   *
   * Cada uno tiene la suya, y la app no puede suponerla. Estas se preguntan
   * siempre y se destacan: vencer justo ahí es la victoria que más cuenta.
   */
  debilidades?: string[];
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

  /**
   * Hubo caída, y se llevó a Dios en oración de arrepentimiento.
   *
   * El día cuenta como ganado y la racha no se rompe, pero queda constancia: la
   * cuenta de días restaurados es lo que permite decirle a alguien, sin
   * condenarlo, que lleva demasiadas veces volviendo por lo mismo.
   */
  restaurado?: boolean;

  /** En qué áreas se falló, si se quisieron señalar. Ids de puntos. */
  caidas?: string[];

  /** ¿Se venció la debilidad que la persona declaró como la suya? */
  vencioSuDebilidad?: boolean;
};

/**
 * Cómo acabó un día.
 *
 * `restaurado` es un día en que hubo caída y hubo arrepentimiento: cuenta como
 * ganado para la racha, pero se distingue para poder llevarle la cuenta.
 */
export type EstadoDia = "ganado" | "restaurado" | "fallado" | "pendiente" | "sinNada";

/** Una plantilla es un plan listo para estrenar, sin identificadores todavía. */
export type PlantillaPlan = Omit<
  Plan,
  | "id"
  | "activo"
  | "desde"
  | "compromisos"
  | "puntos"
  | "horaExamen"
  | "timbreExamen"
  | "debilidades"
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
