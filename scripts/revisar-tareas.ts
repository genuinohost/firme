/**
 * Qué días le toca a una tarea suelta, y que «cada semana» no rompa lo de antes.
 *
 *   npm run revisar-tareas
 *
 * Alex, 28-09-2026: «No veo la opción de colocar alarma a una tarea cada
 * semana. Por ejemplo, todos los lunes.» `tocaHoy` es el único sitio que decide
 * qué días toca una tarea: de él salen la línea del día, las rachas y las
 * alarmas que se le entregan a Android con dos semanas de antelación. Si se
 * equivoca, una alarma no suena, o suena el día que no es.
 *
 * El calendario de referencia: el lunes 28 de septiembre de 2026, el jueves 1
 * de octubre, el domingo 4 y el lunes 5.
 */
import { datosIniciales, exportar, importar } from "@/datos/almacen";
import type { Tarea } from "@/datos/tipos";
import { avisosPendientes } from "@/logica/avisos";
import { cadenaDe, diasEnTexto, juntarConLaPrevia, partirSerie, primerDiaEn, proximoDia, soltarHoy, sucesosDelDia, tocaHoy, vivaDe } from "@/logica/dia";

let fallos = 0;
let pasadas = 0;
function debe(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) pasadas++;
  else fallos++;
  console.log(`${ok ? "  ok  " : "FALLA "} ${nombre}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}

/** Una tarea de prueba. Pepa es inventada: el repositorio es público. */
const tarea = (resto: Partial<Tarea>): Tarea => ({
  id: "t1",
  fecha: "2026-09-28",
  nombre: "Llamar a Pepa",
  hora: "10:30",
  duracionMin: 30,
  categoria: "trabajo",
  timbre: "pulso",
  ...resto,
});

// ── Lo de antes, que tiene que seguir igual ─────────────────────────────────
{
  const unDia = tarea({});
  debe("un día: toca ese día", tocaHoy(unDia, "2026-09-28"), true);
  debe("un día: no toca el siguiente", tocaHoy(unDia, "2026-09-29"), false);
  debe("un día: no toca el anterior", tocaHoy(unDia, "2026-09-27"), false);

  const varios = tarea({ repiteHasta: "2026-10-02" });
  debe("varios días: toca en medio", tocaHoy(varios, "2026-09-30"), true);
  debe("varios días: toca el último, incluido", tocaHoy(varios, "2026-10-02"), true);
  debe("varios días: no toca después del hasta", tocaHoy(varios, "2026-10-03"), false);
  debe("varios días: no toca antes de empezar", tocaHoy(varios, "2026-09-27"), false);

  const siempre = tarea({ repiteHasta: "siempre" });
  debe("siempre: toca un año después", tocaHoy(siempre, "2027-09-28"), true);
  debe("siempre: no toca antes de empezar", tocaHoy(siempre, "2026-09-27"), false);
}

// ── Cada semana ─────────────────────────────────────────────────────────────
{
  const lunes = tarea({ repiteHasta: "siempre", diasSemana: [1] });
  debe("los lunes: toca el lunes 28", tocaHoy(lunes, "2026-09-28"), true);
  debe("los lunes: no toca el martes 29", tocaHoy(lunes, "2026-09-29"), false);
  debe("los lunes: no toca el jueves 1", tocaHoy(lunes, "2026-10-01"), false);
  debe("los lunes: toca el lunes 5", tocaHoy(lunes, "2026-10-05"), true);
  debe("los lunes: toca un lunes de dentro de un año", tocaHoy(lunes, "2027-09-27"), true);
  debe("los lunes: no toca el lunes de antes de empezar", tocaHoy(lunes, "2026-09-21"), false);

  const conHasta = tarea({ repiteHasta: "2026-10-12", diasSemana: [1] });
  debe("los lunes hasta el 12: toca el 12, incluido", tocaHoy(conHasta, "2026-10-12"), true);
  debe("los lunes hasta el 12: no toca el lunes 19", tocaHoy(conHasta, "2026-10-19"), false);

  const lunesYJueves = tarea({ repiteHasta: "siempre", diasSemana: [1, 4] });
  debe("lunes y jueves: toca el jueves 1", tocaHoy(lunesYJueves, "2026-10-01"), true);
  debe("lunes y jueves: toca el lunes 5", tocaHoy(lunesYJueves, "2026-10-05"), true);
  debe("lunes y jueves: no toca el viernes 2", tocaHoy(lunesYJueves, "2026-10-02"), false);

  const domingos = tarea({ repiteHasta: "siempre", diasSemana: [0], fecha: "2026-10-04" });
  debe("domingo es el 0: toca el domingo 4", tocaHoy(domingos, "2026-10-04"), true);
  debe("domingo es el 0: toca el domingo 11", tocaHoy(domingos, "2026-10-11"), true);
  debe("domingo es el 0: no toca el sábado 10", tocaHoy(domingos, "2026-10-10"), false);

  // Una serie diaria que ya empezó y pasa a semanal: su `fecha` se queda en
  // un martes, y ese martes ya no toca, porque no está en la lista.
  const serieVieja = tarea({ fecha: "2026-09-15", repiteHasta: "siempre", diasSemana: [1] });
  debe("serie vieja pasada a los lunes: no toca el martes en que empezó", tocaHoy(serieVieja, "2026-09-15"), false);
  debe("serie vieja pasada a los lunes: toca el lunes 21", tocaHoy(serieVieja, "2026-09-21"), true);
}

// ── Compatibilidad: sin días, o con la lista vacía, como siempre ───────────
{
  const vacia = tarea({ repiteHasta: "siempre", diasSemana: [] });
  debe("días vacíos = cada día: toca el martes", tocaHoy(vacia, "2026-09-29"), true);
  debe("días vacíos = cada día: toca el jueves", tocaHoy(vacia, "2026-10-01"), true);

  const sinRepetir = tarea({ diasSemana: [4] });
  debe("días sin repetición no cuentan: toca su lunes", tocaHoy(sinRepetir, "2026-09-28"), true);
  debe("días sin repetición no cuentan: no toca el jueves", tocaHoy(sinRepetir, "2026-10-01"), false);

  // Una tarea guardada antes de esto, tal cual salía del almacén.
  const vieja = JSON.parse(
    '{"id":"v","fecha":"2026-09-20","repiteHasta":"2026-09-30","nombre":"Leer","hora":null,"duracionMin":30,"categoria":"mente","timbre":"ninguno"}',
  ) as Tarea;
  debe("tarea vieja sin diasSemana: toca cada día del tramo", tocaHoy(vieja, "2026-09-26"), true);
  debe("tarea vieja sin diasSemana: no toca después", tocaHoy(vieja, "2026-10-01"), false);
}

// ── El primer día de la serie ───────────────────────────────────────────────
debe("los lunes, eligiendo el domingo 4: empieza el lunes 5", primerDiaEn("2026-10-04", [1]), "2026-10-05");
debe("los lunes, eligiendo el lunes 28: empieza ese mismo día", primerDiaEn("2026-09-28", [1]), "2026-09-28");
debe("lunes y jueves, eligiendo el martes 29: el jueves 1", primerDiaEn("2026-09-29", [1, 4]), "2026-10-01");
debe("cambia de mes y de año", primerDiaEn("2026-12-30", [5]), "2027-01-01");
debe("sin días, la propia fecha", primerDiaEn("2026-09-29", []), "2026-09-29");

// ── El próximo día que toca, para el aviso de «Guardada» ────────────────────
debe(
  "serie de los jueves que empezó hace semanas: la próxima desde hoy es el jueves 1",
  proximoDia(tarea({ fecha: "2026-09-03", repiteHasta: "siempre", diasSemana: [4] }), "2026-09-28"),
  "2026-10-01",
);
debe(
  "si ya acabó, ninguna",
  proximoDia(tarea({ fecha: "2026-09-03", repiteHasta: "2026-09-24", diasSemana: [4] }), "2026-09-28"),
  null,
);
debe("una de un día en el futuro: ese día", proximoDia(tarea({ fecha: "2026-10-01" }), "2026-09-28"), "2026-10-01");

// ── Cómo se dicen los días ──────────────────────────────────────────────────
debe("uno: «todos los lunes»", diasEnTexto([1]), "todos los lunes");
debe("dos, en orden de la semana: «los lunes y jueves»", diasEnTexto([4, 1]), "los lunes y jueves");
debe("el fin de semana, en plural", diasEnTexto([0, 6]), "los sábados y domingos");
debe("tres: «los lunes, miércoles y viernes»", diasEnTexto([5, 3, 1]), "los lunes, miércoles y viernes");
debe("laborables: «de lunes a viernes»", diasEnTexto([1, 2, 3, 4, 5]), "de lunes a viernes");
debe("los siete: «todos los días»", diasEnTexto([0, 1, 2, 3, 4, 5, 6]), "todos los días");
debe("ninguno válido no da «los  y undefined»", diasEnTexto([7]), "ningún día");

// ── Lo que se proyecta: la línea del día y las alarmas ──────────────────────
{
  const datos = datosIniciales();
  datos.tareas = [tarea({ id: "semanal", repiteHasta: "siempre", diasSemana: [1] })];
  const esta = (fecha: string) => sucesosDelDia(datos, fecha).some((s) => s.id === "semanal");
  debe("la línea del lunes la trae", esta("2026-09-28"), true);
  debe("la del martes no", esta("2026-09-29"), false);

  // Desde el domingo 27 a mediodía, las dos semanas que se programan en Android.
  const alarmas = avisosPendientes(datos, new Date(2026, 8, 27, 12, 0), 14)
    .filter((a) => a.idSuceso === "semanal")
    .map((a) => `${a.cuando.getDate()}/${a.cuando.getMonth() + 1} ${a.cuando.getHours()}:${a.cuando.getMinutes()}`);
  debe("en catorce días suena sólo los dos lunes, a las 10:30", alarmas, ["28/9 10:30", "5/10 10:30"]);
}

// ── Cambiar el ritmo no reescribe el pasado ─────────────────────────────────
{
  const HOY = "2026-09-28"; // lunes
  const id = () => "t2";
  // Una de los jueves que empezó el 3 de septiembre; hoy se le añade el lunes.
  const antes = tarea({ fecha: "2026-09-03", repiteHasta: "siempre", diasSemana: [4] });
  const despues = { ...antes, diasSemana: [1, 4] };
  const { quedan, idDesdeHoy } = partirSerie(antes, despues, HOY, id);
  debe("se parte en dos", quedan.length, 2);
  debe("la vieja termina ayer, con sus jueves", [quedan[0].repiteHasta, quedan[0].diasSemana], ["2026-09-27", [4]]);
  debe("la nueva empieza hoy (lunes), con otro id", [quedan[1].id, quedan[1].fecha, quedan[1].diasSemana], ["t2", HOY, [1, 4]]);
  debe("lo de hoy en adelante va a la nueva", idDesdeHoy, "t2");
  const lunesPasado = [...quedan].some((t) => tocaHoy(t, "2026-09-21"));
  debe("el lunes pasado NO aparece sin hacer", lunesPasado, false);
  debe("el jueves pasado sigue siendo de la vieja", tocaHoy(quedan[0], "2026-09-24") && !tocaHoy(quedan[1], "2026-09-24"), true);
  debe("el jueves que viene es de la nueva", tocaHoy(quedan[1], "2026-10-01") && !tocaHoy(quedan[0], "2026-10-01"), true);
}
{
  const HOY = "2026-09-29"; // martes
  const antes = tarea({ fecha: "2026-09-03", repiteHasta: "siempre", diasSemana: [4] });
  const r = partirSerie(antes, { ...antes, diasSemana: [1, 4] }, HOY, () => "t2");
  debe("si hoy no toca, la nueva empieza el primer día que toque (jueves 1)", r.quedan[1].fecha, "2026-10-01");
}
{
  const HOY = "2026-09-28";
  const antes = tarea({ fecha: "2026-09-03", repiteHasta: "siempre", diasSemana: [4] });
  debe("cambiar sólo la hora no parte nada", partirSerie(antes, { ...antes, hora: "11:00" }, HOY, () => "x").quedan.length, 1);
  debe("cambiar el nombre tampoco", partirSerie(antes, { ...antes, nombre: "Otra" }, HOY, () => "x").quedan.length, 1);
  debe(
    "si se movió a mano la fecha de inicio, se respeta (no se parte)",
    partirSerie(antes, { ...antes, fecha: "2026-09-10", diasSemana: [1, 4] }, HOY, () => "x").quedan.length,
    1,
  );
  debe(
    "una serie que empieza hoy o después no se parte",
    partirSerie(tarea({ fecha: HOY, repiteHasta: "siempre", diasSemana: [1] }), tarea({ fecha: HOY, repiteHasta: "siempre", diasSemana: [1, 4] }), HOY, () => "x").quedan.length,
    1,
  );
  {
    const r = partirSerie(antes, { ...antes, repiteHasta: undefined, diasSemana: undefined }, HOY, () => "x");
    debe(
      "pasarla a «Un día» también se parte: la serie acaba ayer y la suelta va al próximo día que la serie tocaba (el jueves 1), no a uno que nunca tuvo",
      [r.quedan.length, r.quedan[0].repiteHasta, r.quedan[1]?.fecha, r.quedan[1]?.repiteHasta],
      [2, "2026-09-27", "2026-10-01", undefined],
    );
    debe("y la vieja apunta a la nueva (para editarla o borrarla entera)", r.quedan[0].sigue, r.quedan[1]?.id);
  }
  {
    // Moverle el inicio a HOY a una serie que viene de atrás: se parte.
    const r = partirSerie(antes, { ...antes, fecha: HOY, diasSemana: [1] }, HOY, () => "x");
    debe("mover el inicio a hoy no borra los jueves de atrás", [r.quedan.length, r.quedan[0].repiteHasta, r.quedan[1]?.fecha], [2, "2026-09-27", HOY]);
  }
  {
    // Moverlo a mañana: la nueva empieza el primer día marcado desde mañana.
    const r = partirSerie(antes, { ...antes, fecha: "2026-09-29", diasSemana: [4] }, HOY, () => "x");
    debe("mover el inicio a otro día futuro también parte, y la nueva empieza ese día", [r.quedan.length, r.quedan[1]?.fecha], [2, "2026-10-01"]);
  }
  {
    // Hoy ya cumplida y la nueva no toca hoy: la vieja se cierra HOY.
    const diaria = tarea({ fecha: "2026-09-01", repiteHasta: "siempre" });
    const r = partirSerie(diaria, { ...diaria, diasSemana: [4] }, HOY, () => "t9", { registradoHoy: true });
    debe("con hoy ya apuntado y la nueva sin hoy, la vieja acaba hoy (el cumplido no se pierde)", r.quedan[0].repiteHasta, HOY);
    const r2 = partirSerie(diaria, { ...diaria, diasSemana: [4] }, HOY, () => "t9", { registradoHoy: false });
    debe("sin nada apuntado hoy, acaba ayer", r2.quedan[0].repiteHasta, "2026-09-27");
  }
  {
    // La nueva tocaría hoy a una hora que ya pasó: empieza el próximo día.
    const lunesYJueves = tarea({ fecha: "2026-09-03", repiteHasta: "siempre", diasSemana: [4], hora: "08:00", duracionMin: 30 });
    const r = partirSerie(lunesYJueves, { ...lunesYJueves, diasSemana: [1, 4] }, HOY, () => "x", { minutoAhora: 20 * 60, graciaMin: 30 });
    debe("si la hora de hoy ya pasó, la nueva no nace con una tarea vencida: empieza el jueves 1", r.quedan[1]?.fecha, "2026-10-01");
    const r2 = partirSerie(lunesYJueves, { ...lunesYJueves, diasSemana: [1, 4] }, HOY, () => "x", { minutoAhora: 7 * 60, graciaMin: 30 });
    debe("y si todavía no pasó, empieza hoy", r2.quedan[1]?.fecha, HOY);
  }
  {
    // Un fin nuevo en el pasado: una sola tarea, con lo editado y su ritmo de siempre.
    const diaria = tarea({ fecha: "2026-09-20", repiteHasta: "siempre", nombre: "Leer" });
    const r = partirSerie(diaria, { ...diaria, repiteHasta: "2026-09-25", nombre: "Leer la Biblia" }, HOY, () => "x");
    debe(
      "un fin ya pasado termina la serie ese día, con el nombre nuevo",
      [r.quedan.length, r.quedan[0].id, r.quedan[0].repiteHasta, r.quedan[0].nombre],
      [1, "t1", "2026-09-25", "Leer la Biblia"],
    );
  }
  {
    // Una serie que empezó HOY, ya cumplida hoy, pasada a días que no son hoy.
    const deHoy = tarea({ fecha: HOY, repiteHasta: "siempre" });
    const r = partirSerie(deHoy, { ...deHoy, fecha: "2026-09-30", diasSemana: [3] }, HOY, () => "t9", { registradoHoy: true });
    debe("una serie de hoy ya apuntada se parte: hoy se queda con la suya", [r.quedan.length, r.quedan[0].repiteHasta, r.quedan[1]?.fecha], [2, HOY, "2026-09-30"]);
    const r2 = partirSerie(deHoy, { ...deHoy, fecha: "2026-09-30", diasSemana: [3] }, HOY, () => "t9", { registradoHoy: false });
    debe("sin apuntar hoy, es sólo editarla", r2.quedan.length, 1);
  }
  {
    // Una suelta pasada YA apuntada que se mueve: su día conserva lo apuntado.
    const suelta = tarea({ fecha: "2026-09-20" });
    const r = partirSerie(suelta, { ...suelta, fecha: "2026-09-29" }, HOY, () => "t9", { registradoSuDia: true });
    debe("mover una suelta ya apuntada no le quita el día a su registro", [r.quedan.length, r.quedan[0].fecha, r.quedan[1]?.fecha, r.idDesdeHoy], [2, "2026-09-20", "2026-09-29", "t9"]);
  }
  {
    // Una serie ya terminada pasada a «Un día»: no resucita.
    const acabada = tarea({ fecha: "2026-09-01", repiteHasta: "2026-09-10" });
    const r = partirSerie(acabada, { ...acabada, repiteHasta: undefined }, HOY, () => "x");
    debe("una serie que ya terminó, pasada a «Un día», no vuelve a sonar", [r.quedan.length, r.quedan[0].repiteHasta], [1, "2026-09-10"]);
  }
  {
    // Mover una tarea HECHA de hoy a mañana y devolverla a hoy: una sola fila, hecha.
    const x = tarea({ id: "x", fecha: HOY });
    const r = partirSerie(x, { ...x, fecha: "2026-09-29" }, HOY, () => "y", { registradoHoy: true });
    const y = r.quedan.find((t) => t.id === "y")!;
    const devuelta = { ...y, fecha: HOY };
    const tareas = r.quedan.map((t) => (t.id === "y" ? devuelta : t));
    const j = juntarConLaPrevia(tareas, { [`${HOY}|x`]: { estado: "cumplido", momento: 1 } }, devuelta, HOY);
    debe("devolverla a hoy la junta: queda una sola tarea", j.tareas.map((t) => t.id), ["y"]);
    debe("y lo apuntado hoy pasa a ella", Object.keys(j.registros), [`${HOY}|y`]);
  }
  {
    // Deshacer lo apuntado hoy de una parte que se cerró hoy sólo por eso.
    const a = tarea({ id: "a", fecha: "2026-09-01", repiteHasta: HOY, sigue: "b" });
    const b = tarea({ id: "b", fecha: "2026-10-05", repiteHasta: "siempre", diasSemana: [1] });
    const quedan = soltarHoy([a, b], "a", HOY);
    debe("al deshacerlo, hoy deja de ser suyo (no vuelve a sonar)", quedan.find((t) => t.id === "a")?.repiteHasta, "2026-09-27");
    const sinTocar = soltarHoy([tarea({ id: "a", fecha: "2026-09-01", repiteHasta: "siempre" })], "a", HOY);
    debe("una tarea sin partir no se toca", sinTocar[0].repiteHasta, "siempre");
  }
  {
    // El hilo entre las partes.
    const a = tarea({ id: "a", sigue: "b" });
    const b = tarea({ id: "b", sigue: "c" });
    const c = tarea({ id: "c" });
    const otra = tarea({ id: "z" });
    debe("abrir una parte vieja abre la viva", vivaDe([a, b, c, otra], "a"), "c");
    debe("una sin hilo es ella misma", vivaDe([a, b, c, otra], "z"), "z");
    debe("borrar desde el medio se lleva la serie entera, y nada más", [...cadenaDe([a, b, c, otra], "b")].sort(), ["a", "b", "c"]);
    debe("un hilo roto (la siguiente ya no está) no se rompe", vivaDe([tarea({ id: "a", sigue: "fantasma" })], "a"), "a");
  }
  {
    // Una suelta pasada que se mueve a otro día: es cambiarla de día.
    const suelta = tarea({ fecha: "2026-09-20" });
    debe("mover una suelta pasada a mañana no la parte", partirSerie(suelta, { ...suelta, fecha: "2026-09-29" }, HOY, () => "x").quedan.length, 1);
  }
  const diaria = tarea({ fecha: "2026-09-01", repiteHasta: "siempre" });
  const r = partirSerie(diaria, { ...diaria, diasSemana: [1] }, HOY, () => "t9");
  debe("de diaria a semanal: la diaria acaba ayer y la semanal empieza hoy", [r.quedan[0].repiteHasta, r.quedan[1].fecha], ["2026-09-27", HOY]);
  const acabada = tarea({ fecha: "2026-09-01", repiteHasta: "2026-09-10" });
  const r2 = partirSerie(acabada, { ...acabada, repiteHasta: "siempre" }, HOY, () => "t9");
  debe("una que ya había terminado conserva su fin, y la nueva va de hoy en adelante", [r2.quedan[0].repiteHasta, r2.quedan[1].fecha], ["2026-09-10", HOY]);
  const suelta = tarea({ fecha: "2026-09-20" });
  const r3 = partirSerie(suelta, { ...suelta, repiteHasta: "siempre", diasSemana: [1] }, HOY, () => "t9");
  debe("una de un día ya pasado que se vuelve semanal: la suelta se queda, la serie empieza hoy", [r3.quedan[0].repiteHasta, r3.quedan[1].fecha], [undefined, HOY]);
  const conFinPasado = partirSerie(antes, { ...antes, repiteHasta: "2026-09-20", diasSemana: [1, 4] }, HOY, () => "x");
  debe("si el nuevo fin ya pasó, sólo queda la vieja", conFinPasado.quedan.length, 1);
}

// ── Y sobrevive a la copia de seguridad ─────────────────────────────────────
{
  const datos = datosIniciales();
  datos.tareas = [tarea({ repiteHasta: "2026-12-31", diasSemana: [1, 4] })];
  const vuelta = importar(exportar(datos));
  debe("exportar e importar conserva los días", vuelta?.tareas[0]?.diasSemana, [1, 4]);
  debe("…y la fecha de fin", vuelta?.tareas[0]?.repiteHasta, "2026-12-31");
}

console.log(fallos === 0 ? `\n${pasadas} comprobaciones, sin problemas.\n` : `\n${fallos} de ${fallos + pasadas} FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
