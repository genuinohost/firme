/**
 * Que el día del plan, el comentario y el turno de lectura salgan como en el
 * grupo de WhatsApp.
 *
 *   npm run revisar-turnos
 *
 * Los casos salen del chat de verdad (el 28-09-2026 comentó el puesto 6, el 29
 * le tocó al 7, el 22-09 comentó el 26 y el 23 volvió a empezar por el 1). Los
 * nombres NO: el repositorio es público, y la lista del grupo se queda en el
 * ordenador de Alex. Aquí son «P1»…«P26».
 */
import {
  anteriorLector,
  comentaristaDe,
  diaDelPlan,
  fechaDelDia,
  puestoVivo,
  reanclar,
  siguienteLector,
  type Orden,
} from "../src/logica/devocionales";
import { partirDevocional } from "../src/logica/partirDevocional";

let fallos = 0;
let pasadas = 0;
function debe(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) pasadas++;
  else fallos++;
  console.log(`${ok ? "  ok  " : "FALLA "} ${nombre}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}
const iso = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;

// ── El día del plan ─────────────────────────────────────────────────────────
debe("el 1 de enero es el día 1", diaDelPlan(new Date(2026, 0, 1)), 1);
debe("el 28 de septiembre de 2026 es el 271 (como en el grupo)", diaDelPlan(new Date(2026, 8, 28)), 271);
debe("el 29 es el 272", diaDelPlan(new Date(2026, 8, 29)), 272);
debe("el 31 de diciembre es el 365", diaDelPlan(new Date(2026, 11, 31)), 365);
debe("en bisiesto, el 31 de diciembre sigue siendo el 365", diaDelPlan(new Date(2028, 11, 31)), 365);

// ── Y su fecha, que tiene que ser la inversa ────────────────────────────────
debe("el día 272 de 2026 es el 29 de septiembre", iso(fechaDelDia(272, 2026)), "2026-09-29");
debe("en bisiesto, el día 59 es el 28 de febrero", iso(fechaDelDia(59, 2028)), "2028-02-28");
debe("en bisiesto, el día 60 es el 1 de marzo", iso(fechaDelDia(60, 2028)), "2028-03-01");
debe("en bisiesto, el día 365 es el 31 de diciembre", iso(fechaDelDia(365, 2028)), "2028-12-31");
{
  let ida = 0;
  for (const año of [2026, 2027, 2028]) {
    for (let n = 1; n <= 365; n++) if (diaDelPlan(fechaDelDia(n, año)) !== n) ida++;
  }
  debe("fechaDelDia y diaDelPlan se deshacen la una a la otra, tres años", ida, 0);
}

// ── El comentario ───────────────────────────────────────────────────────────
const P = (i: number) => `P${i}`;
const orden: Orden = {
  lista: Array.from({ length: 26 }, (_, i) => ({ id: `e${i + 1}`, nombre: P(i + 1) })),
  ancla: { fecha: "2026-09-28", puesto: 5 },
};
debe("el 28-09 comenta el 6", comentaristaDe(orden, "2026-09-28")?.nombre, "P6");
debe("el 29-09 le toca al 7", comentaristaDe(orden, "2026-09-29")?.nombre, "P7");
debe("hacia atrás también: el 22-09 comentó el 26", comentaristaDe(orden, "2026-09-22")?.nombre, "P26");
debe("y el 23-09 volvió a empezar por el 1", comentaristaDe(orden, "2026-09-23")?.nombre, "P1");
debe("el 30-08 comentó el 3 (un mes antes, en el chat)", comentaristaDe(orden, "2026-08-30")?.nombre, "P3");

{
  const conHueco: Orden = {
    lista: [{ id: "a", nombre: "A" }, { id: "", nombre: "" }, { id: "b", nombre: "B" }],
    ancla: { fecha: "2026-09-28", puesto: 1 },
  };
  debe("un hueco del orden no comenta: comenta el siguiente de verdad", comentaristaDe(conHueco, "2026-09-28")?.id, "b");
}

// ── Editar la lista no mueve el comentario de hoy ───────────────────────────
{
  const hoy = "2026-10-20";
  const antes = comentaristaDe(orden, hoy)!;
  const conUnoMas = [...orden.lista, { id: "e27", nombre: "P27" }];
  const a1 = reanclar(orden, conUnoMas, hoy);
  debe("añadir a alguien al final: comenta el mismo de antes", comentaristaDe({ lista: conUnoMas, ancla: a1 }, hoy)?.id, antes.id);
  debe("…y mañana el que le seguía", comentaristaDe({ lista: conUnoMas, ancla: a1 }, "2026-10-21")?.id, comentaristaDe(orden, "2026-10-21")?.id);

  const sinElTercero = orden.lista.filter((e) => e.id !== "e3");
  const a2 = reanclar(orden, sinElTercero, hoy);
  debe("quitar a alguien de antes: comenta el mismo", comentaristaDe({ lista: sinElTercero, ancla: a2 }, hoy)?.id, antes.id);

  const sinEl = orden.lista.filter((e) => e.id !== antes.id);
  const a3 = reanclar(orden, sinEl, hoy);
  const siguienteDeAntes = orden.lista[(orden.lista.findIndex((e) => e.id === antes.id) + 1) % 26].id;
  debe("quitar justo al que comentaba: comenta el que le seguía", comentaristaDe({ lista: sinEl, ancla: a3 }, hoy)?.id, siguienteDeAntes);

  const alReves = [...orden.lista].reverse();
  const a4 = reanclar(orden, alReves, hoy);
  debe("darle la vuelta a la lista: comenta el mismo", comentaristaDe({ lista: alReves, ancla: a4 }, hoy)?.id, antes.id);
  debe("con la lista vacía no revienta", reanclar(orden, [], hoy), { fecha: hoy, puesto: 0 });
}

// ── El turno ────────────────────────────────────────────────────────────────
const presentes = new Set(["e1", "e2", "e4"]);
const puede = (l: { id: string }) => presentes.has(l.id);
debe("empieza por el primero que está", siguienteLector(orden.lista, -1, puede)?.lector.nombre, "P1");
debe("después, el siguiente que está", siguienteLector(orden.lista, 0, puede)?.lector.nombre, "P2");
debe("se salta a quien no está (el 3)", siguienteLector(orden.lista, 1, puede)?.lector.nombre, "P4");
debe("y da la vuelta a la lista", siguienteLector(orden.lista, 3, puede)?.lector.nombre, "P1");
debe("con nadie en la sala, nadie", siguienteLector(orden.lista, -1, () => false), null);
debe("con uno solo, siempre él", siguienteLector(orden.lista, 3, (l) => l.id === "e4")?.puesto, 3);

// ── Volver atrás ────────────────────────────────────────────────────────────
debe("atrás: el anterior que está", anteriorLector(orden.lista, 3, puede)?.lector.nombre, "P2");
debe("atrás desde el primero da la vuelta", anteriorLector(orden.lista, 0, puede)?.lector.nombre, "P4");
debe("atrás tras acabar: vuelve a leer el último", anteriorLector(orden.lista, 3 + 1, puede)?.lector.nombre, "P4");
debe("atrás con nadie, nadie", anteriorLector(orden.lista, 3, () => false), null);

// ── Partir un devocional pegado ─────────────────────────────────────────────
// Texto inventado con el formato del prompt maestro: el de verdad lleva la
// Biblia RVR1960, que tiene derechos, y no entra en un repositorio público.
{
  const pegado = [
    "🚶‍♂️ LEYENDO TODA LA BIBLIA EN UN AÑO: DÍA 272 DE 365 🚶‍♂️",
    "",
    "✨ EL TEMA: ¿UNA PREGUNTA DE PRUEBA? ✨",
    "",
    "Libro 16",
    "Libro 16:1-5:",
    "1 Primero.",
    "2 Segundo.",
    "3 Tercero.",
    "4 Cuarto.",
    "5 Quinto.",
    "Libro 16:6-7:",
    "6 Sexto.",
    "7 Séptimo.",
    "Carta 1",
    "Carta 1:1-2:",
    "1 Uno.",
    "2 Dos.",
    "",
    "💬 REFLEXIÓN:",
    "1) Punto uno.",
    "2) Punto dos,",
    "que sigue en otra línea.",
    "",
    "✍️ PARA REFLEXIONAR HOY:",
    "1) ¿Pregunta uno?",
    "2) ¿Pregunta dos?",
    "",
    "🙏 ORACIÓN DEL DÍA:",
    "Señor… En el nombre de nuestro Señor Jesucristo...",
    "",
    "📢 RECORDATORIO DE LECTURA:",
    "Libro 16 y Carta 1.",
    "",
    "🔥 ¡COMPARTE ESTE MENSAJE!",
    "Una frase.",
  ].join("\n");
  const p = partirDevocional(pegado);
  debe("lee el número de día de la cabecera", p.dia, 272);
  debe("y el tema", p.tema, "¿UNA PREGUNTA DE PRUEBA?");
  debe("los capítulos, en orden", p.capitulos, ["Libro 16", "Carta 1"]);
  debe(
    "los trozos, en el orden en que se leen",
    p.trozos.map((t) => t.ref),
    [
      "Libro 16:1-5",
      "Libro 16:6-7",
      "Carta 1:1-2",
      "Reflexión · 1",
      "Reflexión · 2",
      "Para reflexionar hoy · 1",
      "Para reflexionar hoy · 2",
      "Oración del día",
      "Recordatorio de lectura",
      "Comparte este mensaje",
    ],
  );
  debe("un punto de dos líneas queda entero", p.trozos[4].texto, "2) Punto dos,\nque sigue en otra línea.");
  debe("con saltos de Windows, igual", partirDevocional(pegado.replace(/\n/g, "\r\n")).trozos.length, p.trozos.length);
  debe("un texto que no es un devocional no da trozos de lectura", partirDevocional("hola, ¿qué tal?").trozos.length, 0);

  // Lo que llega de verdad al pegar: la revisión final encontró cada uno.
  const refs = (t: string) => partirDevocional(t).trozos.map((x) => x.ref);
  const conNegritas = pegado
    .replace("Libro 16:1-5:", "*Libro 16:1-5:*")
    .replace("💬 REFLEXIÓN:", "**💬 REFLEXIÓN:**")
    .replace("✨ EL TEMA:", "*✨ EL TEMA:");
  debe("con las negritas de WhatsApp y de markdown, igual", refs(conNegritas), refs(pegado));
  const sinEmojis = pegado.replace(/^(💬|✍️|🙏|📢|🔥) ?/gmu, "");
  debe("sin los emojis de los encabezados, igual", refs(sinEmojis), refs(pegado));
  debe("con tono de piel en el emoji («🙏🏻»), igual", refs(pegado.replace("🙏", "🙏🏻").replace("✍️", "✍🏽")), refs(pegado));
  const cuatroBloques = [
    pegado,
    "🎨 BLOQUE 2: PROMPT PARA LA IMAGEN",
    "Vertical, 4K…",
    "🤩 lo que aprendí hoy:",
    "Hoy aprendí algo.",
    "1. ¿QUÉ PASÓ?",
    "🔥 ¡ALERTA DÍA 273: ¡Algo! 🔥",
    "¡Mañana: …!",
  ].join("\n");
  const juntos = partirDevocional(cuatroBloques);
  debe("los cuatro bloques pegados juntos: sólo el 1 da turnos", juntos.trozos.map((x) => x.ref), refs(pegado));
  debe("…el último turno no se traga los otros bloques", juntos.trozos.at(-1)?.texto, "Una frase.");
  debe("…y el 3 sale como «lo que aprendí hoy», sin el emoji de delante", juntos.aprendi, "lo que aprendí hoy:\nHoy aprendí algo.\n1. ¿QUÉ PASÓ?");
  debe(
    "la alerta de mañana pegada detrás también corta",
    partirDevocional(`${pegado}\n🔥 ¡ALERTA DÍA 273: ¡Algo! 🔥\n¡Mañana: …!`).trozos.length,
    p.trozos.length,
  );
  debe("dos días pegados: se cuentan las dos cabeceras", partirDevocional(`${pegado}\n${pegado}`).cabeceras, 2);
  debe("uno solo: una", p.cabeceras, 1);
}

// ── El puesto de quien lee, aunque se edite la lista ───────────────────────
{
  const lista = [
    { id: "a", nombre: "A" },
    { id: "b", nombre: "B" },
    { id: "c", nombre: "C" },
    { id: "d", nombre: "D" },
  ];
  const sinA = lista.slice(1);
  const lee = { lector: "b", puesto: 1 };
  debe("se busca por su id: quitaron a alguien de antes", puestoVivo(sinA, lee), 0);
  debe("…y el siguiente es el que de verdad sigue", siguienteLector(sinA, puestoVivo(sinA, lee), () => true)?.lector.id, "c");
  debe("si ya no está en la lista, vale el puesto guardado", puestoVivo(sinA, { lector: "x", puesto: 2 }), 2);
  debe("sin lector, el puesto guardado", puestoVivo(lista, { lector: "", puesto: 3 }), 3);
}

console.log(fallos === 0 ? `\n${pasadas} comprobaciones, sin problemas.\n` : `\n${fallos} de ${fallos + pasadas} FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
