/**
 * Que lo dictado no se pegue mal con lo escrito.
 *
 * Dictar encima de un texto a medias pasa más de lo que parece: se escribe un
 * poco, se cansa uno, y se sigue hablando. Si esto falla, lo que sale es
 * «Hoy me costólevantarme» — y quien lo ve no vuelve a usar el micrófono.
 *
 *   npm run revisar-dictado
 */
import { pegar } from "@/logica/dictado";

let fallos = 0;
function comprobar(nombre: string, real: string, esperado: string) {
  const bien = real === esperado;
  if (!bien) fallos++;
  console.log(`${bien ? "  ok  " : "FALLA "} ${nombre}`);
  if (!bien) console.log(`         esperaba «${esperado}», dio «${real}»`);
}

console.log("\nPEGAR LO DICTADO\n");

comprobar("sobre vacío, empieza en mayúscula", pegar("", "hoy me costó"), "Hoy me costó");
comprobar("sobre vacío con espacios", pegar("   ", "hoy me costó"), "Hoy me costó");
comprobar(
  "detrás de texto, con un espacio",
  pegar("Hoy me costó", "pero Dios me sostuvo"),
  "Hoy me costó pero Dios me sostuvo",
);
comprobar(
  "no dobla el espacio que ya había",
  pegar("Hoy me costó ", "mucho"),
  "Hoy me costó mucho",
);
comprobar(
  "detrás de un punto",
  pegar("Hoy me costó.", "Pero seguí"),
  "Hoy me costó. Pero seguí",
);
comprobar("lo vacío no toca nada", pegar("Hoy me costó", "   "), "Hoy me costó");
comprobar("recorta lo dictado", pegar("Hoy", "  mucho  "), "Hoy mucho");
comprobar(
  "no toca las mayúsculas de dentro",
  pegar("", "Dios me sostuvo"),
  "Dios me sostuvo",
);
comprobar(
  "un salto de línea escrito a mano se respeta como separación",
  pegar("Primera línea\n", "segunda"),
  "Primera línea segunda",
);

console.log(fallos === 0 ? "\nSin problemas.\n" : `\n${fallos} comprobaciones fallan.\n`);
process.exit(fallos === 0 ? 0 : 1);
