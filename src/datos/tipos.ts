/** Tipos del dominio. Todo el vocabulario de la app vive aquí. */

/** Las seis áreas en las que se reparte un día. Ordenan colores y frases. */
export type Categoria =
  | "fe"
  | "cuerpo"
  | "mente"
  | "trabajo"
  | "familia"
  | "descanso";

export const CATEGORIAS: { id: Categoria; nombre: string; color: string }[] = [
  { id: "fe", nombre: "Fe", color: "#c9a227" },
  { id: "cuerpo", nombre: "Cuerpo", color: "#d05a3e" },
  { id: "mente", nombre: "Mente", color: "#5b86c4" },
  { id: "trabajo", nombre: "Trabajo", color: "#3f9e7a" },
  { id: "familia", nombre: "Familia", color: "#b0609b" },
  { id: "descanso", nombre: "Descanso", color: "#6b7280" },
];

/** Timbres de alarma. Se generan con Web Audio, no hay archivos de sonido. */
export type Timbre = "campana" | "diana" | "pulso" | "ninguno";

export const TIMBRES: { id: Timbre; nombre: string }[] = [
  { id: "campana", nombre: "Campana" },
  { id: "diana", nombre: "Diana" },
  { id: "pulso", nombre: "Pulso" },
  { id: "ninguno", nombre: "Solo vibrar" },
];

/** Un bloque de la rutina fija: se repite los días marcados. */
export type BloqueRutina = {
  id: string;
  nombre: string;
  /** "HH:MM" en hora local. */
  hora: string;
  duracionMin: number;
  /** 0 = domingo … 6 = sábado. */
  dias: number[];
  categoria: Categoria;
  /** El porqué concreto de este bloque. Se muestra en la alarma. */
  porque: string;
  timbre: Timbre;
  /** Minutos de aviso antes de la hora. 0 = sin aviso previo. */
  avisoPrevioMin: number;
  activo: boolean;
};

/** Una tarea suelta, de un día concreto. */
export type Tarea = {
  id: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  nombre: string;
  /** "HH:MM" o null si es una tarea sin hora fija. */
  hora: string | null;
  duracionMin: number;
  categoria: Categoria;
  timbre: Timbre;
};

export type EstadoCumplimiento = "cumplido" | "saltado";

/** Qué pasó con un bloque o tarea en un día. Clave: `fecha|id`. */
export type Registro = {
  estado: EstadoCumplimiento;
  momento: number;
  /** Si se saltó, el motivo que escribió. La honestidad es parte del método. */
  excusa?: string;
};

/** Una razón para no rendirse, escrita por él. */
export type Motivo = {
  id: string;
  texto: string;
  /** El motivo ancla: el que se muestra primero y en cada alarma. */
  ancla: boolean;
};

export type Ajustes = {
  nombre: string;
  /** Minutos tras la hora en que todavía se puede marcar cumplido. */
  graciaMin: number;
  /** Bancos de frases activos. */
  usarVersiculos: boolean;
  usarEstoicos: boolean;
  frasesPropias: string[];
  volumen: number;
  /** Hora del repaso de la noche. "HH:MM" */
  horaRepaso: string;
  /** Minutos que añade el botón «5 min más». */
  posponerMin: number;
};

/** Todo el estado que se guarda. Una sola pieza, fácil de exportar. */
export type Datos = {
  version: number;
  rutina: BloqueRutina[];
  tareas: Tarea[];
  registros: Record<string, Registro>;
  motivos: Motivo[];
  ajustes: Ajustes;
};

/** Lo que se pinta en la línea del día: bloque de rutina o tarea, ya resuelto. */
export type Suceso = {
  id: string;
  origen: "rutina" | "tarea";
  nombre: string;
  /** Minutos desde medianoche. null en tareas sin hora. */
  minuto: number | null;
  hora: string | null;
  duracionMin: number;
  categoria: Categoria;
  porque: string;
  timbre: Timbre;
  avisoPrevioMin: number;
  registro: Registro | null;
};
