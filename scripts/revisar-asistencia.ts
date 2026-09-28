/**
 * Que la racha y las faltas del devocional se cuenten como se dice.
 *
 *   npm run revisar-asistencia
 *
 * Es la parte pura de `src/logica/asistencia.ts`; lo de Firestore lo cubren
 * las reglas (`revisar-reglas.mjs`).
 */
import { calcularAsistencia } from "../src/logica/asistencia";

let fallos = 0;
let pasadas = 0;
function debe(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) pasadas++;
  else fallos++;
  console.log(`${ok ? "  ok  " : "FALLA "} ${nombre}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}

// Un día sí y hoy: racha de 2, sin faltas.
debe("dos días seguidos", calcularAsistencia(["2026-09-27", "2026-09-28"], "2026-09-28"), { racha: 2, faltas: 0 });

// Vino el 25, faltó el 26 y el 27, vino hoy: racha 1, dos faltas.
debe(
  "un hueco de dos días rompe la racha y suma dos faltas",
  calcularAsistencia(["2026-09-25", "2026-09-28"], "2026-09-28"),
  { racha: 1, faltas: 2 },
);

// El primer día: racha 1 y ninguna falta, aunque el mes anterior no viniera.
debe("quien acaba de llegar no trae faltas", calcularAsistencia(["2026-09-28"], "2026-09-28"), {
  racha: 1,
  faltas: 0,
});

// Una racha larga, sin huecos.
const treinta = Array.from({ length: 30 }, (_, i) => {
  const f = new Date(2026, 8, 28);
  f.setDate(f.getDate() - i);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
});
debe("treinta días seguidos", calcularAsistencia(treinta, "2026-09-28"), { racha: 30, faltas: 0 });

// Las faltas sólo miran los últimos treinta días: un hueco de julio a agosto
// no cuenta si de ahí en adelante vino todos los días.
const treintaYUno = [...treinta, "2026-08-29", "2026-08-28"];
debe(
  "un hueco de hace dos meses ya no cuenta",
  calcularAsistencia(["2026-07-01", ...treintaYUno], "2026-09-28"),
  { racha: 32, faltas: 0 },
);
// Y un hueco de un día dentro de la ventana sí: el 29 de agosto.
debe(
  "un día sin venir dentro del mes es una falta",
  calcularAsistencia(["2026-08-01", ...treinta], "2026-09-28"),
  { racha: 30, faltas: 1 },
);

// Reunión sólo de lunes a viernes (1-5): el fin de semana ni suma ni resta.
// El 26 y el 27 de septiembre de 2026 son sábado y domingo.
debe(
  "el fin de semana no rompe la racha si la reunión es entre semana",
  calcularAsistencia(["2026-09-25", "2026-09-28"], "2026-09-28", [1, 2, 3, 4, 5]),
  { racha: 2, faltas: 0 },
);

// Cruzar el cambio de mes.
debe(
  "la racha cruza el mes",
  calcularAsistencia(["2026-08-31", "2026-09-01"], "2026-09-01"),
  { racha: 2, faltas: 0 },
);

console.log(
  fallos === 0
    ? `\n${pasadas} comprobaciones, sin problemas.\n`
    : `\n${fallos} de ${fallos + pasadas} comprobaciones FALLARON.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
