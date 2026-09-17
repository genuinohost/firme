/**
 * Que ninguna plantilla de plan salga rota.
 *
 * Un plan mal formado no revienta: se ofrece en la lista, alguien lo empieza,
 * y **falla el día que tenía que sonar** — o peor, se queda sin repaso y la
 * racha no avanza nunca. Es la clase de fallo que este proyecto ya ha pagado
 * seis veces: no da error, da un comportamiento de aspecto normal.
 *
 *   npm run revisar-planes
 */
import { PLANTILLAS } from "@/datos/planes/plantillas";
import { CATEGORIAS, TIMBRES } from "@/datos/tipos";

let fallos = 0;
const mal = (plan: string, queja: string) => {
  fallos++;
  console.log(`FALLA  ${plan}: ${queja}`);
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const categorias = new Set(CATEGORIAS.map((c) => c.id));
const timbres = new Set(TIMBRES.map((t) => t.id));

console.log(`\n${PLANTILLAS.length} plantillas de plan.\n`);

const vistos = new Set<string>();

for (const p of PLANTILLAS) {
  const n = p.plantilla;

  if (vistos.has(n)) mal(n, "el identificador está repetido");
  vistos.add(n);

  if (!p.nombre?.trim()) mal(n, "sin nombre");
  if (!p.emoji?.trim()) mal(n, "sin emoji");
  if (!p.resumen?.trim()) mal(n, "sin resumen para la lista");
  if (!p.proposito?.trim()) mal(n, "sin propósito — es lo que se lee al flojear");
  if (!categorias.has(p.categoria)) mal(n, `categoría desconocida: ${p.categoria}`);

  // El versículo y su cita van juntos o no van. Una cita sin texto deja una
  // referencia colgando, y un texto sin cita no se puede comprobar.
  if (p.plantilla !== "personalizado") {
    if (!p.versiculo?.trim()) mal(n, "sin versículo");
    if (!p.cita?.trim()) mal(n, "sin cita del versículo");
  }

  for (const c of p.compromisos) {
    if (!c.nombre?.trim()) mal(n, "un compromiso sin nombre");
    if (!HORA.test(c.hora)) mal(n, `hora mal escrita: ${c.hora}`);
    if (!(c.duracionMin > 0)) mal(n, `duración inválida en ${c.nombre}`);
    if (!c.dias?.length) mal(n, `${c.nombre} no tiene ningún día: no sonaría nunca`);
    if (c.dias?.some((d) => d < 0 || d > 6)) mal(n, `${c.nombre} tiene un día fuera de 0..6`);
    if (!timbres.has(c.timbre)) mal(n, `timbre desconocido en ${c.nombre}: ${c.timbre}`);
    if (!c.porque?.trim()) mal(n, `${c.nombre} sin porqué — sale en la alarma`);
  }

  for (const pt of p.puntos) {
    if (!pt.texto?.trim()) mal(n, "un punto de examen sin texto");
    // El versículo de un punto es opcional, pero si está tiene que llevar cita.
    if (pt.versiculo && !pt.cita) mal(n, `«${pt.texto}» tiene versículo sin cita`);
    if (pt.cita && !pt.versiculo) mal(n, `«${pt.texto}» tiene cita sin versículo`);
  }

  // Un plan con puntos y sin hora de repaso no avisaría nunca, y la racha se
  // quedaría parada sin que nadie entienda por qué.
  if (p.puntos.length > 0) {
    if (!p.horaExamen || !HORA.test(p.horaExamen)) {
      mal(n, "tiene puntos de examen pero no una hora de repaso válida");
    }
    if (!p.timbreExamen || !timbres.has(p.timbreExamen)) {
      mal(n, "tiene puntos de examen pero no un timbre válido");
    }
  }

  // Y un plan sin nada que hacer no es un plan.
  if (p.plantilla !== "personalizado" && p.compromisos.length === 0 && p.puntos.length === 0) {
    mal(n, "no tiene ni compromisos ni puntos: no habría nada que cumplir");
  }

  for (const h of p.horasSugeridas ?? []) {
    if (!HORA.test(h.hora)) mal(n, `hora sugerida mal escrita: ${h.hora}`);
    if (!h.etiqueta?.trim()) mal(n, "una hora sugerida sin etiqueta");
  }
}

if (fallos === 0) {
  for (const p of PLANTILLAS) {
    console.log(
      `  ${p.emoji}  ${p.nombre.padEnd(26)} ${p.compromisos.length} bloque(s) · ${p.puntos.length} punto(s)` +
        (p.admiteRestauracion ? " · con restauración" : ""),
    );
  }
}

console.log(fallos === 0 ? "\nSin problemas.\n" : `\n${fallos} problemas.\n`);
process.exit(fallos === 0 ? 0 : 1);
