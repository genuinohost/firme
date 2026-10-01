import type { Datos, Registro, Suceso, Tarea } from "@/datos/tipos";

export const DIAS_CORTOS = ["D", "L", "M", "X", "J", "V", "S"];
export const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "AAAA-MM-DD" en hora local (no UTC: `toISOString` desplazaría el día). */
export function claveFecha(f: Date): string {
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

export function desdeClave(clave: string): Date {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function fechaLarga(f: Date): string {
  return `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

/** "HH:MM" → minutos desde medianoche. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function minutoActual(ahora = new Date()): number {
  return ahora.getHours() * 60 + ahora.getMinutes();
}

/**
 * La línea del día: bloques de la rutina que tocan hoy más las tareas de la
 * fecha, ordenados por hora. Las tareas sin hora van al final.
 */
/**
 * Si una tarea le toca a este día.
 *
 * Las fechas van en "AAAA-MM-DD", que se ordena bien comparando cadenas: no
 * hace falta convertirlas a Date ni preocuparse por husos horarios.
 */
export function tocaHoy(tarea: Tarea, fecha: string): boolean {
  /*
   * Cada semana (Alex, 28-09-2026: «todos los lunes»): dentro del tramo
   * `fecha`…`repiteHasta`, sólo los días marcados. El día de `fecha` no se
   * salva por serlo: el diálogo ya la pone en uno de los días marcados, y una
   * serie vieja que pasa a semanal no tiene por qué empezar en uno de ellos.
   */
  if (tarea.repiteHasta && tarea.diasSemana?.length) {
    if (fecha < tarea.fecha) return false;
    if (tarea.repiteHasta !== "siempre" && fecha > tarea.repiteHasta) return false;
    return tarea.diasSemana.includes(desdeClave(fecha).getDay());
  }
  if (tarea.fecha === fecha) return true;
  if (!tarea.repiteHasta) return false;
  if (fecha < tarea.fecha) return false;
  return tarea.repiteHasta === "siempre" || fecha <= tarea.repiteHasta;
}

/** "AAAA-MM-DD" desplazada `n` días, sin pasar por UTC. */
function sumarDias(fecha: string, n: number): string {
  const f = desdeClave(fecha);
  f.setDate(f.getDate() + n);
  return claveFecha(f);
}

/**
 * El primer día desde `fecha` (incluida) que cae en uno de `dias`
 * (0 = domingo … 6 = sábado). Sin días, la propia `fecha`.
 *
 * Es lo que hace verdad «Guardada para el lunes 5 de octubre»: una tarea de
 * los lunes creada un domingo empieza el lunes, no el domingo.
 */
export function primerDiaEn(fecha: string, dias: number[]): string {
  if (dias.length === 0) return fecha;
  for (let i = 0; i < 7; i++) {
    const candidato = sumarDias(fecha, i);
    if (dias.includes(desdeClave(candidato).getDay())) return candidato;
  }
  return fecha;
}

/** Qué días le tocan a una tarea, sin contar desde cuándo: su «ritmo». */
function ritmoDe(t: Tarea): string {
  const dias = t.repiteHasta && t.diasSemana?.length ? [...new Set(t.diasSemana)].sort().join(",") : "";
  return `${t.repiteHasta ?? ""}|${dias}`;
}

/**
 * Guardar una tarea editada sin reescribir su pasado.
 *
 * Cambiar el ritmo de una serie que ya empezó —añadirle el jueves a una de
 * los lunes, pasarla de semanal a diaria, quitarle el fin, volverla de un solo
 * día— cambiaba también los días de atrás: aparecían jueves pasados «sin
 * hacer», o desaparecían días ya cumplidos, y se caía la racha. (Revisiones de
 * la 6.27, 28-09 y 1-10-2026.) Así que en esos casos la serie se parte: la de
 * antes se cierra (ayer, o hoy si hoy ya está apuntado y la nueva no lo toca),
 * tal cual era, y la nueva empieza hoy —o el día elegido, o el primero que le
 * toque— con otro id. La vieja apunta a la nueva (`sigue`): editar o borrar
 * desde cualquiera de las dos actúa sobre la que sigue viva (`vivaDe`,
 * `cadenaDe`); sin ese hilo, volver a editarla duplicaba las alarmas.
 *
 * Sin partir: si la tarea todavía no empezó (o empezó hoy y hoy no está
 * apuntado), si sólo cambian el nombre o la hora, o si se movió a mano a una
 * fecha PASADA (eso es redefinirla, y lo pidió así). Una suelta que se mueve
 * es cambiarla de día, salvo que su día ya esté apuntado: entonces ese día se
 * queda con la suya y la tarea reaparece en el nuevo.
 *
 * `contexto` afina el día de hoy: si ya está apuntado (`registradoHoy`), si
 * el día de la suelta lo está (`registradoSuDia`), y si su hora ya pasó
 * (`minutoAhora`, `graciaMin`): una serie nueva no empieza hoy con una tarea
 * ya vencida que nadie podría marcar.
 */
export function partirSerie(
  anterior: Tarea | undefined,
  nueva: Tarea,
  hoy: string,
  nuevoId: () => string,
  contexto: { registradoHoy?: boolean; registradoSuDia?: boolean; minutoAhora?: number; graciaMin?: number } = {},
): { quedan: Tarea[]; idDesdeHoy: string } {
  const igual = { quedan: [nueva], idDesdeHoy: nueva.id };
  if (!anterior || anterior.id !== nueva.id) return igual;
  if (anterior.fecha > hoy) return igual;
  const movida = nueva.fecha !== anterior.fecha;

  if (!anterior.repiteHasta) {
    // Una suelta. Moverla es cambiarla de día; pero si su día ya está
    // apuntado, ese día se queda con la suya y la tarea sale en el nuevo.
    const apuntada = anterior.fecha === hoy ? contexto.registradoHoy : contexto.registradoSuDia;
    if (movida) {
      if (!apuntada) return igual;
      const otra: Tarea = { ...nueva, id: nuevoId() };
      return { quedan: [{ ...anterior, sigue: otra.id }, otra], idDesdeHoy: otra.id };
    }
    // Sin moverla: si sigue suelta, o es de hoy, es sólo editarla. Si una de
    // un día pasado se vuelve serie, la suelta se queda y la serie empieza ya.
    if (!nueva.repiteHasta || anterior.fecha === hoy) return igual;
  } else {
    // Empezó hoy: sólo se parte si hoy ya está apuntado y la nueva no lo toca.
    if (anterior.fecha === hoy && (!contexto.registradoHoy || tocaHoy(nueva, hoy))) return igual;
    if (movida && nueva.fecha < hoy) return igual;
    if (!movida && ritmoDe(anterior) === ritmoDe(nueva)) return igual;
  }

  const ayer = sumarDias(hoy, -1);
  // Un fin nuevo que ya pasó: no hay nada que empezar. Se termina la serie de
  // siempre en ese día (o en el suyo, si acababa antes), con lo editado.
  if (anterior.repiteHasta && nueva.repiteHasta && nueva.repiteHasta !== "siempre" && nueva.repiteHasta < hoy) {
    const suFin =
      anterior.repiteHasta !== "siempre" && anterior.repiteHasta < nueva.repiteHasta ? anterior.repiteHasta : nueva.repiteHasta;
    // Sin `diasSemana: undefined`: la copia en la nube no admite claves vacías.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { diasSemana: _sinDias, ...resto } = nueva;
    return {
      quedan: [
        {
          ...resto,
          fecha: anterior.fecha,
          ...(anterior.diasSemana?.length ? { diasSemana: anterior.diasSemana } : {}),
          repiteHasta: suFin < anterior.fecha ? anterior.fecha : suFin,
        },
      ],
      idDesdeHoy: anterior.id,
    };
  }

  const yaPaso = (): boolean => {
    if (!nueva.hora || contexto.minutoAhora == null) return false;
    return aMinutos(nueva.hora) + Math.min(nueva.duracionMin, 1440) + (contexto.graciaMin ?? 0) < contexto.minutoAhora;
  };
  let desde: string | null;
  if (!nueva.repiteHasta) {
    // «Un día» desde una serie: el próximo día que la serie tocaba (hoy, si
    // toca y no ha pasado o ya está apuntado), no un día que nunca tuvo.
    desde = movida
      ? nueva.fecha
      : tocaHoy(anterior, hoy) && (contexto.registradoHoy || !yaPaso())
        ? hoy
        : proximoDia(anterior, sumarDias(hoy, 1));
  } else {
    const semanal = !!nueva.diasSemana?.length;
    const base = movida ? nueva.fecha : hoy;
    desde = semanal ? primerDiaEn(base, nueva.diasSemana!) : base;
    if (!movida && desde === hoy && !tocaHoy(anterior, hoy) && yaPaso()) {
      const manana = sumarDias(hoy, 1);
      desde = semanal ? primerDiaEn(manana, nueva.diasSemana!) : manana;
    }
  }

  // Hasta cuándo va la vieja: ayer, salvo que hoy ya esté apuntado en ella y
  // la nueva no toque hoy (si no, el cumplido de hoy se quedaba sin serie).
  const cierre = contexto.registradoHoy && tocaHoy(anterior, hoy) && desde !== hoy ? hoy : ayer;
  const vieja: Tarea = !anterior.repiteHasta
    ? anterior
    : {
        ...anterior,
        repiteHasta: anterior.repiteHasta !== "siempre" && anterior.repiteHasta < cierre ? anterior.repiteHasta : cierre,
      };

  // Sin ningún día por delante: sólo queda la vieja.
  if (!desde || (nueva.repiteHasta && nueva.repiteHasta !== "siempre" && nueva.repiteHasta < desde)) {
    return { quedan: [vieja], idDesdeHoy: anterior.id };
  }
  const siguiente: Tarea = { ...nueva, id: nuevoId(), fecha: desde };
  return { quedan: [{ ...vieja, sigue: siguiente.id }, siguiente], idDesdeHoy: siguiente.id };
}

/**
 * Si al volver a editar la parte viva ésta toca HOY, y la parte anterior
 * también (se cerró hoy porque hoy ya estaba apuntado), se juntan: la anterior
 * se recorta a antes de la nueva y lo apuntado hoy pasa a la nueva. Sin esto,
 * mover una tarea hecha a mañana y devolverla a hoy la dejaba dos veces en el
 * día, con una alarma de más. (Cuarta revisión de la 6.27.)
 */
export function juntarConLaPrevia(
  tareas: Tarea[],
  registros: Record<string, Registro>,
  viva: Tarea,
  hoy: string,
): { tareas: Tarea[]; registros: Record<string, Registro> } {
  const previa = tareas.find((t) => t.sigue === viva.id);
  if (!previa || !tocaHoy(previa, hoy) || !tocaHoy(viva, hoy)) return { tareas, registros };
  const nuevos = { ...registros };
  const suyo = `${hoy}|${previa.id}`;
  if (nuevos[suyo]) {
    if (!nuevos[`${hoy}|${viva.id}`]) nuevos[`${hoy}|${viva.id}`] = nuevos[suyo];
    delete nuevos[suyo];
  }
  const corte = sumarDias(viva.fecha, -1);
  const recortadas =
    previa.repiteHasta && corte >= previa.fecha
      ? tareas.map((t) => (t.id === previa.id ? { ...t, repiteHasta: corte } : t))
      : tareas.filter((t) => t.id !== previa.id).map((t) => (t.sigue === previa.id ? { ...t, sigue: previa.sigue } : t));
  return { tareas: recortadas, registros: nuevos };
}

/**
 * Al deshacer lo apuntado HOY de una parte que se cerró hoy sólo para
 * guardarlo (su siguiente ya no toca hoy), hoy deja de ser suyo: si no, volvía
 * a sonar un día que la persona ya había quitado. (Cuarta revisión de la 6.27.)
 */
export function soltarHoy(tareas: Tarea[], id: string, hoy: string): Tarea[] {
  const t = tareas.find((x) => x.id === id);
  const sig = t?.sigue ? tareas.find((x) => x.id === t.sigue) : undefined;
  if (!t || !sig || tocaHoy(sig, hoy)) return tareas;
  if (!(t.repiteHasta === hoy || (!t.repiteHasta && t.fecha === hoy))) return tareas;
  const corte = sumarDias(hoy, -1);
  if (t.repiteHasta && corte >= t.fecha) return tareas.map((x) => (x.id === t.id ? { ...x, repiteHasta: corte } : x));
  return tareas.filter((x) => x.id !== t.id).map((x) => (x.sigue === t.id ? { ...x, sigue: t.sigue } : x));
}

/** La parte viva de una tarea partida: se sigue el hilo `sigue` hasta el final. */
export function vivaDe(tareas: Tarea[], id: string): string {
  let actual = id;
  const vistos = new Set<string>();
  for (;;) {
    vistos.add(actual);
    const t = tareas.find((x) => x.id === actual);
    if (!t?.sigue || vistos.has(t.sigue) || !tareas.some((x) => x.id === t.sigue)) return actual;
    actual = t.sigue;
  }
}

/** Todas las partes de una tarea partida, hacia atrás y hacia delante: para borrarla entera. */
export function cadenaDe(tareas: Tarea[], id: string): Set<string> {
  const ids = new Set([id]);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const t of tareas) {
      if (ids.has(t.id) && t.sigue && !ids.has(t.sigue)) {
        ids.add(t.sigue);
        crecio = true;
      }
      if (t.sigue && ids.has(t.sigue) && !ids.has(t.id)) {
        ids.add(t.id);
        crecio = true;
      }
    }
  }
  return ids;
}

/**
 * El próximo día, desde `desde` (incluido), en que le toca a la tarea, o null
 * si ya no le toca ninguno.
 *
 * Se pregunta a `tocaHoy`, que es quien decide, en vez de repetir sus reglas:
 * una semana basta para dar con el siguiente de cualquier repetición.
 */
export function proximoDia(tarea: Tarea, desde: string): string | null {
  const inicio = desde > tarea.fecha ? desde : tarea.fecha;
  for (let i = 0; i < 7; i++) {
    const candidato = sumarDias(inicio, i);
    if (tocaHoy(tarea, candidato)) return candidato;
  }
  return null;
}

/**
 * Los días de una tarea semanal, para meter detrás de un verbo: «todos los
 * lunes», «los lunes y jueves», «de lunes a viernes», «todos los días».
 *
 * Se leen de lunes a domingo, que es como se piensa la semana aunque la cuenta
 * empiece en domingo. Sábado y domingo son los únicos que cambian en plural.
 */
export function diasEnTexto(dias: number[]): string {
  const orden = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d));
  // Sin ninguno válido (una copia tocada a mano, un 7 que se coló) salía
  // «los  y undefined». Con esa lista `tocaHoy` no la pone ningún día.
  if (orden.length === 0) return "ningún día";
  if (orden.length === 7) return "todos los días";
  if (orden.join() === "1,2,3,4,5") return "de lunes a viernes";
  const plurales = orden.map((d) => (d === 0 || d === 6 ? `${DIAS_LARGOS[d]}s` : DIAS_LARGOS[d]));
  if (plurales.length === 1) return `todos los ${plurales[0]}`;
  return `los ${plurales.slice(0, -1).join(", ")} y ${plurales[plurales.length - 1]}`;
}

export function sucesosDelDia(datos: Datos, fecha: string): Suceso[] {
  const diaSemana = desdeClave(fecha).getDay();

  /**
   * Los compromisos de los planes se convierten en bloques del día.
   *
   * Así heredan de una vez las alarmas, la línea del día y las rachas, sin
   * repetir esa lógica en otro sitio: para el resto de la app un compromiso de
   * un plan es un bloque más, solo que con dueño.
   */
  const dePlanes: Suceso[] = (datos.planes ?? [])
    .filter((plan) => plan.activo && fecha >= plan.desde)
    .flatMap((plan) =>
      plan.compromisos
        .filter((c) => c.dias.includes(diaSemana))
        .map((c) => ({
          id: c.id,
          origen: "rutina" as const,
          nombre: c.nombre,
          minuto: aMinutos(c.hora),
          hora: c.hora,
          duracionMin: c.duracionMin,
          categoria: plan.categoria,
          porque: c.porque || plan.proposito,
          timbre: c.timbre,
          avisoPrevioMin: c.avisoPrevioMin,
          registro: datos.registros[`${fecha}|${c.id}`] ?? null,
          plan: plan.id,
        })),
    );

  const deRutina: Suceso[] = datos.rutina
    .filter((b) => b.activo && b.dias.includes(diaSemana))
    .map((b) => ({
      id: b.id,
      origen: "rutina" as const,
      nombre: b.nombre,
      minuto: aMinutos(b.hora),
      hora: b.hora,
      duracionMin: b.duracionMin,
      categoria: b.categoria,
      porque: b.porque,
      timbre: b.timbre,
      avisoPrevioMin: b.avisoPrevioMin,
      registro: datos.registros[`${fecha}|${b.id}`] ?? null,
      ...(b.sala ? { sala: b.sala } : {}),
    }));

  const deTareas: Suceso[] = datos.tareas
    .filter((t) => tocaHoy(t, fecha))
    .map((t) => ({
      id: t.id,
      origen: "tarea" as const,
      nombre: t.nombre,
      minuto: t.hora ? aMinutos(t.hora) : null,
      hora: t.hora,
      duracionMin: t.duracionMin,
      categoria: t.categoria,
      porque: "",
      timbre: t.timbre,
      avisoPrevioMin: 0,
      registro: datos.registros[`${fecha}|${t.id}`] ?? null,
    }));

  return [...dePlanes, ...deRutina, ...deTareas].sort((a, b) => {
    if (a.minuto === null) return b.minuto === null ? 0 : 1;
    if (b.minuto === null) return -1;
    return a.minuto - b.minuto;
  });
}

export const MINUTOS_DEL_DIA = 1440;

/** ¿Este bloque se pasa de la medianoche? (dormir, un turno de noche…) */
export function cruzaMedianoche(minuto: number, duracionMin: number): boolean {
  return minuto + duracionMin > MINUTOS_DEL_DIA;
}

/**
 * El minuto en que se da por cerrado un suceso, **recortado a medianoche**.
 *
 * Un bloque de dormir de 22:00 a 06:00 pertenece al día en que empieza; si se
 * dejara su fin real (1800) nunca llegaría a «pasado» ni vencería, porque el
 * reloj del día no pasa de 1440. Se cierra a medianoche y el día siguiente
 * empieza limpio.
 */
export function finDe(suceso: Suceso): number {
  if (suceso.minuto === null) return MINUTOS_DEL_DIA;
  return Math.min(suceso.minuto + suceso.duracionMin, MINUTOS_DEL_DIA);
}

export type FaseSuceso = "pasado" | "ahora" | "proximo" | "futuro" | "sinHora";

/** En qué punto del día está cada suceso, para saber qué destacar. */
export function faseDe(
  suceso: Suceso,
  minutoAhora: number,
  esHoy: boolean,
): FaseSuceso {
  if (suceso.minuto === null) return "sinHora";
  if (!esHoy) return "futuro";
  const fin = finDe(suceso);
  if (minutoAhora >= suceso.minuto && minutoAhora < fin) return "ahora";
  if (minutoAhora >= fin) return "pasado";
  return "futuro";
}

/** El bloque que toca: el que está en curso o, si no hay, el siguiente. */
export function sucesoEnCurso(
  sucesos: Suceso[],
  minutoAhora: number,
): Suceso | null {
  const enCurso = sucesos.find(
    (s) => s.minuto !== null && minutoAhora >= s.minuto && minutoAhora < finDe(s),
  );
  if (enCurso) return enCurso;
  return sucesos.find((s) => s.minuto !== null && s.minuto > minutoAhora) ?? null;
}

/**
 * Un suceso está vencido cuando pasó su hora más la ventana de gracia y sigue
 * sin marcar. A partir de ahí ya no se puede marcar cumplido: cuenta como caída.
 */
export function estaVencido(
  suceso: Suceso,
  minutoAhora: number,
  graciaMin: number,
  esHoy: boolean,
): boolean {
  if (suceso.registro || suceso.minuto === null) return false;
  if (!esHoy) return false;
  return minutoAhora > finDe(suceso) + graciaMin;
}
