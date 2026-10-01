/**
 * Monta los devocionales generados (días 272-365) con el formato exacto del
 * prompt maestro, los comprueba y los deja junto al archivo del año.
 *
 *   npx vite-node scripts/devocionales/montar-generados.ts <resultado.json>
 *
 * El resultado es lo que devolvió el flujo de generación: por cada día, el
 * texto redactado en partes (reflexión, preguntas, oración…). Aquí se arma:
 *
 *   - el Bloque 1, con la Biblia de `privado/devocionales/generar/` (RV1909),
 *     partido con el MISMO troceador que el archivo y que la app al pegar;
 *   - el Bloque 2 (la imagen), el 3 («lo que aprendí hoy») y el 4 (la alerta).
 *
 * Y se comprueba lo que un prompt no garantiza: 10 puntos, 3 preguntas, la 🩸
 * del punto 4, el cierre de la oración, que cada pasaje se parta como se
 * preparó, y que CADA cita «…» esté letra por letra en el texto de ese día.
 * Un día que no pasa no se escribe: se lista para rehacerlo.
 *
 * Escribe `privado/devocionales/dia-NNN.json` (ignorado por Git).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { partirDevocional } from "../../src/logica/partirDevocional";

type Generado = {
  dia: number;
  reflexion: string[];
  preguntas: string[];
  oracion: string;
  recordatorio: { intro: string; capitulos: { cap: string; resumen: string }[] };
  comparte: string;
  aprendi: {
    idea: string;
    que_paso: string;
    que_significa: string;
    que_nos_dice_de_jesus: string;
    como_vivirlo_hoy: string;
    pregunta_final: string;
  };
  alerta: { frase: string; manana: string; puntos: { cap: string; texto: string }[]; conexion: string; reto: string };
  imagen: string;
};
type Preparado = {
  dia: number;
  fecha: string;
  tema: string;
  lecturas: string[];
  capitulos: { ref: string; rango: string; texto: string; trozos: { ref: string; texto: string }[] }[];
};

const entrada = process.argv[2];
if (!entrada || !existsSync(entrada)) {
  console.error("Uso: npx vite-node scripts/devocionales/montar-generados.ts <resultado.json>");
  process.exit(1);
}
const crudo = JSON.parse(readFileSync(entrada, "utf8"));
const dias: { dia: number; devocional: Generado }[] = (crudo.result ?? crudo).dias ?? [];
const calendario = JSON.parse(readFileSync("privado/devocionales/calendario-272-365.json", "utf8")) as {
  dias: { dia: number; titulo: string }[];
};
const tituloDe = new Map(calendario.dias.map((d) => [d.dia, d.titulo]));

/** Para comparar citas: sin comillas, sin espacios dobles, sin mayúscula inicial de versículo. */
const normal = (t: string) =>
  t
    .normalize("NFC")
    .replace(/[«»“”"']/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?¡¿]+$/g, "")
    .trim()
    .toLowerCase();

/** «Isaías 16, 17 y 18 | Efesios 1», como en la alerta de Alex. */
function mananaDe(lecturas: string[]): string {
  const porLibro: { libro: string; caps: string[] }[] = [];
  for (const l of lecturas) {
    const m = /^(.*?)\s+(\S+)$/.exec(l)!;
    const ultimo = porLibro[porLibro.length - 1];
    if (ultimo && ultimo.libro === m[1]) ultimo.caps.push(m[2]);
    else porLibro.push({ libro: m[1], caps: [m[2]] });
  }
  return porLibro
    .map(({ libro, caps }) =>
      caps.length === 1 ? `${libro} ${caps[0]}` : `${libro} ${caps.slice(0, -1).join(", ")} y ${caps[caps.length - 1]}`,
    )
    .join(" | ");
}

const fallos: string[] = [];
let escritos = 0;
for (const { dia, devocional: g } of dias.sort((a, b) => a.dia - b.dia)) {
  const archivo = `privado/devocionales/generar/dia-${String(dia).padStart(3, "0")}.json`;
  if (!g || !existsSync(archivo)) {
    fallos.push(`${dia}: sin texto o sin preparar`);
    continue;
  }
  const p = JSON.parse(readFileSync(archivo, "utf8")) as Preparado;
  const problemas: string[] = [];

  // ── Bloque 1 ─────────────────────────────────────────────────────────────
  const pasajes = p.capitulos
    .map((c) => [`${c.ref}:${c.rango}`, "", ...c.trozos.map((t) => `${t.ref}:\n${t.texto}\n`)].join("\n"))
    .join("\n");
  const bloque1 = [
    `🚶‍♂️ LEYENDO TODA LA BIBLIA EN UN AÑO: DÍA ${dia} DE 365 🚶‍♂️`,
    "",
    `✨ EL TEMA: ${p.tema} ✨`,
    "",
    pasajes,
    "💬 REFLEXIÓN:",
    ...g.reflexion.map((x, i) => `${i + 1}) ${x.trim()}`),
    "",
    "✍️ PARA REFLEXIONAR HOY:",
    ...g.preguntas.map((x, i) => `${i + 1}) ${x.trim()}`),
    "",
    "🙏 ORACIÓN DEL DÍA:",
    g.oracion.trim(),
    "",
    "📢 RECORDATORIO DE LECTURA:",
    g.recordatorio.intro.trim(),
    ...g.recordatorio.capitulos.map((c) => `📖 ${c.cap} - ${c.resumen.trim()}`),
    "",
    "🔥 ¡COMPARTE ESTE MENSAJE!",
    g.comparte.trim(),
  ].join("\n");

  // ── Bloques 2, 3 y 4 ─────────────────────────────────────────────────────
  const bloque2 = `🎨 BLOQUE 2: PROMPT PARA LA IMAGEN\n\n${g.imagen.trim()}`;
  const bloque3 = [
    // Sin el 🤩 de delante: así lo guarda el archivo (y la app quita el título).
    "lo que aprendí hoy:",
    "",
    g.aprendi.idea.trim(),
    "",
    "1. ¿QUÉ PASÓ?",
    g.aprendi.que_paso.trim(),
    "",
    "2. ¿QUÉ SIGNIFICA?",
    g.aprendi.que_significa.trim(),
    "",
    "3. ¿QUÉ NOS DICE DE JESÚS?",
    g.aprendi.que_nos_dice_de_jesus.trim(),
    "",
    "4. ¿CÓMO VIVIRLO HOY?",
    g.aprendi.como_vivirlo_hoy.trim(),
    "",
    `*${g.aprendi.pregunta_final.trim().replace(/^\*+|\*+$/g, "")}*`,
  ].join("\n");
  const frase = g.alerta.frase.trim().replace(/^[¡!]+|[!]+$/g, "").toUpperCase();
  const bloque4 = [
    `🔥 ¡ALERTA DÍA ${dia}: ¡${frase}! 🔥`,
    "",
    `¡Mañana: ${g.alerta.manana.trim().replace(/^¡?\s*Mañana:\s*/i, "").replace(/!+$/, "")}!`,
    "",
    `✨ TEMA: ${tituloDe.get(dia) ?? p.tema}`,
    "",
    ...g.alerta.puntos.map((x) => `🔹 ${x.cap}: ${x.texto.trim()}`),
    `🔹 ${g.alerta.conexion.trim()}`,
    "",
    `📖 MAÑANA: ${mananaDe(p.lecturas)}`,
    "",
    `🎯 RETO: ${g.alerta.reto.trim()}`,
    "",
    "¡No faltes! 🙌",
    "",
    "Mañana 5 AM aquí.",
  ].join("\n");

  // ── Comprobaciones ───────────────────────────────────────────────────────
  const partido = partirDevocional(bloque1);
  const esperados = p.capitulos.flatMap((c) => c.trozos.map((t) => t.ref));
  const salen = partido.trozos.filter((t) => t.tipo === "pasaje").map((t) => t.ref);
  if (JSON.stringify(salen) !== JSON.stringify(esperados)) problemas.push(`pasajes: ${salen.length} de ${esperados.length}`);
  if (partido.dia !== dia) problemas.push(`cabecera: día ${partido.dia}`);
  if (partido.trozos.filter((t) => t.tipo === "reflexion").length !== 10) problemas.push("no son 10 puntos");
  if (partido.trozos.filter((t) => t.tipo === "preguntas").length !== 3) problemas.push("no son 3 preguntas");
  if (!g.reflexion[1]?.trim().startsWith("¡Buenos días, familia!")) problemas.push("el punto 2 no saluda");
  if (!/La pregunta es:/i.test(g.reflexion[1] ?? "")) problemas.push("el punto 2 no plantea la pregunta");
  if (!g.reflexion[3]?.includes("🩸")) problemas.push("el punto 4 sin 🩸");
  if (!/En el nombre de nuestro Señor Jesucristo,[^\n]*amén\.\s*$/i.test(g.oracion.trim())) problemas.push("la oración no cierra como debe");
  // Cada cita, letra por letra en el texto del día (RV1909).
  const biblia = normal(p.capitulos.map((c) => c.texto.replace(/^\d+ /gm, "")).join(" "));
  const todo = [bloque1.split("💬 REFLEXIÓN:")[1], bloque3, bloque4].join("\n");
  const citas = [...todo.matchAll(/«([^»]{12,})»/g)].map((m) => m[1]);
  const malas = citas.filter((c) => !c.split(/\s*[.…]{3}\s*|\s*…\s*/).every((trozo) => !trozo.trim() || biblia.includes(normal(trozo))));
  if (malas.length) problemas.push(`${malas.length} cita(s) que no están en la 1909: «${malas[0].slice(0, 60)}…»`);

  if (problemas.length) {
    fallos.push(`${dia}: ${problemas.join("; ")}`);
    continue;
  }

  const salida = {
    dia,
    fecha: p.fecha,
    devocional: bloque1,
    aprendi: bloque3,
    alerta: bloque4,
    imagen: bloque2,
    tema: partido.tema,
    capitulos: partido.capitulos,
    trozos: partido.trozos,
    generado: true,
    version: "RV1909",
  };
  writeFileSync(join("privado/devocionales", `dia-${String(dia).padStart(3, "0")}.json`), JSON.stringify(salida, null, 1));
  escritos++;
}

for (const f of fallos) console.log("FALLA ", f);
console.log(`\n${escritos} días montados y comprobados; ${fallos.length} por rehacer.\n`);
writeFileSync("privado/devocionales/generar/fallidos.json", JSON.stringify(fallos, null, 1));
process.exit(0);
