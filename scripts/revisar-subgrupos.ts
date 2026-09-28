/**
 * Que los subgrupos salgan como pidió Alex: de 2 a 5 grupos, de 2 a 5 personas,
 * parejos, y al azar de verdad.
 *
 *   npm run revisar-subgrupos
 */
import { avisosDelReparto, gruposPosibles, gruposSugeridos, repartir } from "../src/logica/subgrupos";

let fallos = 0;
let pasadas = 0;
function debe(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) pasadas++;
  else fallos++;
  console.log(`${ok ? "  ok  " : "FALLA "} ${nombre}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}
const tamaños = (n: number, k: number) => repartir(Array.from({ length: n }, (_, i) => i), k).map((g) => g.length);

// ── Cuántos grupos ──────────────────────────────────────────────────────────
debe("con 3 no se puede partir", gruposSugeridos(3), null);
debe("con 4, dos grupos de 2", gruposSugeridos(4), 2);
debe("con 10, dos grupos (5 y 5, como el ejemplo)", gruposSugeridos(10), 2);
debe("con 11, tres grupos", gruposSugeridos(11), 3);
debe("con 25, cinco grupos", gruposSugeridos(25), 5);
debe("con 28, siguen siendo cinco: nunca más de cinco grupos", gruposSugeridos(28), 5);
debe("con 5 se puede elegir sólo 2", gruposPosibles(5), [2]);
debe("con 10, de 2 a 5", gruposPosibles(10), [2, 3, 4, 5]);
debe("con 7, 2 o 3 (4 dejaría uno de 1)", gruposPosibles(7), [2, 3]);

// ── Parejos ─────────────────────────────────────────────────────────────────
debe("10 en 2: 5 y 5", tamaños(10, 2), [5, 5]);
debe("11 en 3: 4, 4 y 3 (no 5, 5 y 1)", tamaños(11, 3), [4, 4, 3]);
debe("25 en 5: cinco de 5", tamaños(25, 5), [5, 5, 5, 5, 5]);
debe("28 en 5: 6, 6, 6, 5 y 5", tamaños(28, 5), [6, 6, 6, 5, 5]);
{
  let peor = 0;
  for (let n = 4; n <= 40; n++) {
    const k = gruposSugeridos(n)!;
    const t = tamaños(n, k);
    peor = Math.max(peor, Math.max(...t) - Math.min(...t));
  }
  debe("de 4 a 40 personas, ningún grupo se lleva más de 1 con otro", peor, 1);
}
{
  let fuera = 0;
  for (let n = 4; n <= 25; n++) {
    const t = tamaños(n, gruposSugeridos(n)!);
    if (t.some((x) => x < 2 || x > 5)) fuera++;
  }
  debe("de 4 a 25 personas, todos los grupos entre 2 y 5", fuera, 0);
}

// ── Al azar, y sin perder a nadie ───────────────────────────────────────────
{
  const gente = Array.from({ length: 17 }, (_, i) => `p${i}`);
  const g = repartir(gente, 4);
  debe("nadie se pierde ni se repite", [...g.flat()].sort(), [...gente].sort());
  const primeros = new Set<string>();
  for (let i = 0; i < 200; i++) primeros.add(repartir(gente, 4)[0].join(","));
  debe("doscientos repartos no salen iguales (es azar)", primeros.size > 150, true);
}

// ── Los avisos ──────────────────────────────────────────────────────────────
debe("un reparto bueno no avisa de nada", avisosDelReparto([5, 5, 4]), []);
debe("avisa de un grupo de una persona", avisosDelReparto([5, 1]), ["El grupo B tiene una sola persona."]);
debe("avisa de uno que pasa de 5", avisosDelReparto([6, 5]), ["El grupo A tiene 6: pasa de 5."]);
debe("con gente en un solo grupo, no hay subgrupos", avisosDelReparto([4, 0]), ["Hace falta gente en al menos 2 grupos."]);

console.log(fallos === 0 ? `\n${pasadas} comprobaciones, sin problemas.\n` : `\n${fallos} de ${fallos + pasadas} FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
