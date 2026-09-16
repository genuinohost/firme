/**
 * Que ningún mensaje del banco se quede fuera de su área.
 *
 * Las áreas se arman a mano juntando tandas. Si mañana se añade una tanda 16 y
 * nadie se acuerda de meterla aquí, sus mensajes desaparecen de la pantalla del
 * banco sin que salte nada: siguen saliendo por el buscador y como mensaje del
 * día, así que el fallo es invisible. Esto lo hace visible.
 *
 *   npm run revisar-areas
 */
import { AREAS, MENSAJES } from "@/datos/mensajes";

let fallos = 0;
const decir = (bien: boolean, texto: string) => {
  if (!bien) fallos++;
  console.log(`${bien ? "  ok  " : "FALLA "} ${texto}`);
};

const enAreas = AREAS.flatMap((a) => a.mensajes);

console.log(`\nEl banco tiene ${MENSAJES.length} mensajes en ${AREAS.length} áreas.\n`);
for (const a of AREAS) {
  console.log(`  ${a.emoji}  ${a.nombre} · ${a.mensajes.length}`);
}
console.log("");

decir(enAreas.length === MENSAJES.length, `todos los mensajes tienen área (${enAreas.length} de ${MENSAJES.length})`);

const huerfanos = MENSAJES.filter((m) => !enAreas.includes(m));
if (huerfanos.length > 0) {
  console.log(`         sin área: ${huerfanos.map((m) => m.titulo).join(", ")}`);
}

// Un mensaje en dos áreas saldría dos veces y descuadraría las cuentas.
const repetidos = enAreas.filter((m, i) => enAreas.indexOf(m) !== i);
decir(repetidos.length === 0, "ningún mensaje está en dos áreas");
if (repetidos.length > 0) {
  console.log(`         repetidos: ${repetidos.map((m) => m.titulo).join(", ")}`);
}

decir(
  AREAS.every((a) => a.mensajes.length > 0),
  "ninguna área está vacía",
);
decir(
  new Set(AREAS.map((a) => a.id)).size === AREAS.length,
  "los identificadores de área no se repiten",
);

console.log(fallos === 0 ? "\nSin problemas.\n" : `\n${fallos} comprobaciones fallan.\n`);
process.exit(fallos === 0 ? 0 : 1);
