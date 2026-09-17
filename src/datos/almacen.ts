import type { Datos, BloqueRutina, Motivo } from "./tipos";

const CLAVE = "firme.datos";
const VERSION = 1;

export function idNuevo(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Una rutina de arranque, para que la primera pantalla no esté vacía. */
function rutinaInicial(): BloqueRutina[] {
  const todos = [0, 1, 2, 3, 4, 5, 6];
  const laborables = [1, 2, 3, 4, 5];
  const base = { avisoPrevioMin: 0, activo: true };
  return [
    { ...base, id: idNuevo(), nombre: "Levantarse", hora: "05:30", duracionMin: 15, dias: todos, categoria: "cuerpo", porque: "El día lo gana quien se levanta primero.", timbre: "diana", avisoPrevioMin: 0 },
    { ...base, id: idNuevo(), nombre: "Oración y lectura", hora: "05:45", duracionMin: 30, dias: todos, categoria: "fe", porque: "Antes de hablar con nadie, hablar con Dios.", timbre: "campana" },
    { ...base, id: idNuevo(), nombre: "Ejercicio", hora: "06:30", duracionMin: 45, dias: [1, 2, 3, 4, 5, 6], categoria: "cuerpo", porque: "Un cuerpo fuerte sostiene todo lo demás.", timbre: "diana", avisoPrevioMin: 5 },
    { ...base, id: idNuevo(), nombre: "Planificar el día", hora: "08:00", duracionMin: 15, dias: laborables, categoria: "mente", porque: "Un día sin plan lo planifica otro.", timbre: "pulso" },
    { ...base, id: idNuevo(), nombre: "Trabajo profundo", hora: "08:30", duracionMin: 120, dias: laborables, categoria: "trabajo", porque: "Aquí se decide si el negocio crece o se queda igual.", timbre: "pulso", avisoPrevioMin: 5 },
    { ...base, id: idNuevo(), nombre: "Comida", hora: "13:00", duracionMin: 45, dias: todos, categoria: "descanso", porque: "Comer despacio también es disciplina.", timbre: "ninguno" },
    { ...base, id: idNuevo(), nombre: "Segundo bloque de trabajo", hora: "15:00", duracionMin: 120, dias: laborables, categoria: "trabajo", porque: "La tarde no es de relleno.", timbre: "pulso" },
    { ...base, id: idNuevo(), nombre: "Tiempo con la familia", hora: "19:00", duracionMin: 90, dias: todos, categoria: "familia", porque: "Por ellos es todo esto. Que lo noten.", timbre: "campana", avisoPrevioMin: 10 },
    { ...base, id: idNuevo(), nombre: "Repaso del día", hora: "21:30", duracionMin: 15, dias: todos, categoria: "mente", porque: "Lo que no se revisa, no mejora.", timbre: "campana" },
    { ...base, id: idNuevo(), nombre: "Apagar pantallas", hora: "22:00", duracionMin: 15, dias: todos, categoria: "descanso", porque: "El día de mañana empieza esta noche.", timbre: "campana" },
  ];
}

function motivosIniciales(): Motivo[] {
  return [
    { id: idNuevo(), texto: "Escribe aquí tu razón principal. La que te levanta cuando no quieres levantarte.", ancla: true },
  ];
}

export function datosIniciales(): Datos {
  return {
    version: VERSION,
    planes: [],
    planesRegistros: {},
    rutina: rutinaInicial(),
    tareas: [],
    registros: {},
    motivos: motivosIniciales(),
    ajustes: {
      nombre: "",
      graciaMin: 20,
      usarVersiculos: true,
      usarEstoicos: true,
      frasesPropias: [],
      volumen: 0.7,
      horaRepaso: "21:30",
      // Diez, que es lo que pidio Alex: cinco no da tiempo a nada y quince ya
      // es volverse a dormir. Se puede cambiar en Ajustes.
      posponerMin: 10,
    },
  };
}

export function cargar(): Datos {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return datosIniciales();
    const datos = JSON.parse(crudo) as Datos;
    return completar(datos);
  } catch {
    return datosIniciales();
  }
}

/**
 * Rellena lo que falte.
 *
 * Quien ya tenía la app instalada no tiene planes guardados, y el reparto de
 * `...datos` pisaría con `undefined` lo que viniera vacío. Se completa campo a
 * campo para que una versión nueva nunca rompa unos datos viejos.
 */
function completar(datos: Partial<Datos>): Datos {
  const base = datosIniciales();
  return {
    ...base,
    ...datos,
    planes: datos.planes ?? base.planes,
    planesRegistros: datos.planesRegistros ?? base.planesRegistros,
    rutina: datos.rutina ?? base.rutina,
    tareas: datos.tareas ?? base.tareas,
    registros: datos.registros ?? base.registros,
    motivos: datos.motivos ?? base.motivos,
    ajustes: { ...base.ajustes, ...datos.ajustes },
  };
}

export function guardar(datos: Datos): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin espacio o en modo privado: la app sigue funcionando en memoria.
  }
}

export function exportar(datos: Datos): string {
  return JSON.stringify(datos, null, 2);
}

export function importar(texto: string): Datos | null {
  try {
    const datos = JSON.parse(texto) as Datos;
    if (!Array.isArray(datos.rutina)) return null;
    return completar(datos);
  } catch {
    return null;
  }
}
