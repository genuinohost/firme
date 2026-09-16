/**
 * Pruebas de las rachas.
 *
 * Alex: «la racha inicial sigue en cero… verifica profundamente que las rachas
 * no fallen». Comprobarlo a ojo no vale: una racha se equivoca en silencio y
 * solo se nota semanas después, cuando ya no hay forma de saber qué pasó.
 *
 *   npx vite-node scripts/revisar-rachas.ts
 */
import { datosIniciales } from "@/datos/almacen";
import { sucesosDelDia } from "@/logica/dia";
import { rachaActual, resumenDe } from "@/logica/racha";
import type { Datos } from "@/datos/tipos";
import type { Plan } from "@/datos/planes/tipos";
import { PLANTILLAS } from "@/datos/planes/plantillas";
import { claveRegistro, crearDesdePlantilla, rachaDelPlan } from "@/logica/planes";

let fallos = 0;
function comprobar(nombre: string, real: unknown, esperado: unknown) {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? "  ok  " : "FALLA "} ${nombre}`);
  if (!bien) console.log(`         esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`);
}

const clave = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
const menos = (f: Date, n: number) => {
  const r = new Date(f);
  r.setDate(r.getDate() - n);
  return r;
};

/** Marca como cumplidos los primeros `cuantos` bloques de ese día. */
function cumplir(datos: Datos, fecha: string, cuantos: number) {
  const sucesos = sucesosDelDia(datos, fecha);
  for (const s of sucesos.slice(0, cuantos)) {
    datos.registros[`${fecha}|${s.id}`] = { estado: "cumplido", momento: Date.now() };
  }
}

/** Cuántos bloques de hoy ya tocaron a esta hora, con su margen de gracia. */
function yaTocaron(datos: Datos, fecha: string, ahora: Date): number {
  const minuto = ahora.getHours() * 60 + ahora.getMinutes();
  const gracia = datos.ajustes.graciaMin;
  return sucesosDelDia(datos, fecha).filter(
    (s) => s.minuto !== null && s.minuto + gracia <= minuto,
  ).length;
}

// El día se fija a media mañana: es cuando Alex mira la app y ve el cero.
const HOY = new Date(2026, 8, 16, 10, 0, 0);
const hoy = clave(HOY);
const bloquesPorDia = sucesosDelDia(datosIniciales(), hoy).length;

console.log(`\nLa rutina de ejemplo tiene ${bloquesPorDia} bloques al día.\n`);

// ---------------------------------------------------------------- el caso real

console.log("EL CASO DE ALEX: cumple lo de la mañana y mira la app");
{
  const d = datosIniciales();
  const tocaron = yaTocaron(d, hoy, HOY);
  cumplir(d, hoy, tocaron); // cumple todo lo que ya tocaba
  const r = resumenDe(d, hoy, HOY);
  console.log(
    `  a las ${HOY.getHours()}:00 ya tocaron ${tocaron} bloques de ${bloquesPorDia}`,
  );
  console.log(`  cumplidos ${r.cumplidos} de ${r.total} · ratio ${r.ratio.toFixed(2)}`);
  comprobar("cumplir lo que ya tocaba da racha 1", rachaActual(d, HOY), 1);
}
{
  const d = datosIniciales();
  const tocaron = yaTocaron(d, hoy, HOY);
  cumplir(d, hoy, Math.max(1, Math.floor(tocaron / 2))); // va a medias
  comprobar("ir a medias no da racha", rachaActual(d, HOY), 0);
}

// ------------------------------------------------------------ días anteriores

console.log("\nDÍAS ANTERIORES");
{
  const d = datosIniciales();
  // Tres días seguidos cumplidos enteros, y hoy a medias.
  for (let i = 1; i <= 3; i++) cumplir(d, clave(menos(HOY, i)), bloquesPorDia);
  cumplir(d, hoy, yaTocaron(d, hoy, HOY));
  comprobar("tres días enteros + hoy al día = 4", rachaActual(d, HOY), 4);
}
{
  const d = datosIniciales();
  for (let i = 1; i <= 3; i++) cumplir(d, clave(menos(HOY, i)), bloquesPorDia);
  comprobar("tres días enteros y hoy sin tocar = 3", rachaActual(d, HOY), 3);
}
{
  const d = datosIniciales();
  cumplir(d, clave(menos(HOY, 1)), bloquesPorDia);
  cumplir(d, clave(menos(HOY, 2)), 1); // ese día se abandonó
  cumplir(d, clave(menos(HOY, 3)), bloquesPorDia);
  comprobar("un día fallado corta la racha", rachaActual(d, HOY), 1);
}

// ---------------------------------------------------------------- primer día

console.log("\nEL PRIMER DÍA, que es donde más duele el cero");
{
  // Muy temprano: solo ha tocado el primer bloque y lo cumplió.
  const TEMPRANO = new Date(2026, 8, 16, 6, 30, 0);
  const d = datosIniciales();
  cumplir(d, hoy, yaTocaron(d, hoy, TEMPRANO));
  comprobar("el primer día, al día desde el primer bloque", rachaActual(d, TEMPRANO), 1);
}
{
  const d = datosIniciales();
  comprobar("sin tocar nada, la racha es 0", rachaActual(d, HOY), 0);
}

// ------------------------------------------------------- las rachas de planes

console.log("\nLAS RACHAS DE LOS PLANES");
{
  const santidad = PLANTILLAS.find((p) => p.plantilla === "santidad")!;
  const base = () => {
    const d = datosIniciales();
    const plan = crearDesdePlantilla(santidad, { hoy: menos(HOY, 5) });
    d.planes = [plan];
    return { d, plan };
  };

  /** Cierra la noche de ese plan: `limpio` o caída llevada a Dios. */
  const guardar = (d: Datos, plan: Plan, fecha: string, limpio: boolean) => {
    const puntos: Record<string, boolean> = {};
    for (const pt of plan.puntos) puntos[pt.id] = limpio;
    d.planesRegistros[claveRegistro(fecha, plan.id)] = {
      puntos,
      repasado: Date.now(),
      ...(limpio ? {} : { restaurado: true }),
    };
  };

  {
    const { d, plan } = base();
    comprobar("plan recién puesto, sin repasar: 0", rachaDelPlan(plan, d, HOY), 0);
  }
  {
    const { d, plan } = base();
    for (let i = 1; i <= 3; i++) guardar(d, plan, clave(menos(HOY, i)), true);
    comprobar("tres noches guardadas seguidas: 3", rachaDelPlan(plan, d, HOY), 3);
  }
  {
    const { d, plan } = base();
    for (let i = 1; i <= 3; i++) guardar(d, plan, clave(menos(HOY, i)), true);
    guardar(d, plan, hoy, true);
    comprobar("y cerrando también hoy: 4", rachaDelPlan(plan, d, HOY), 4);
  }
  {
    // La pieza que más importa: una caída llevada a Dios NO rompe la racha.
    const { d, plan } = base();
    guardar(d, plan, clave(menos(HOY, 3)), true);
    guardar(d, plan, clave(menos(HOY, 2)), false);
    guardar(d, plan, clave(menos(HOY, 1)), true);
    comprobar("una caída restaurada no rompe la racha: 3", rachaDelPlan(plan, d, HOY), 3);
  }
  {
    // Y una noche sin repasar sí la corta: lo que aparta es quedarse en el suelo.
    const { d, plan } = base();
    guardar(d, plan, clave(menos(HOY, 3)), true);
    guardar(d, plan, clave(menos(HOY, 1)), true);
    comprobar("una noche sin repasar sí la corta: 1", rachaDelPlan(plan, d, HOY), 1);
  }
}

console.log(
  fallos === 0 ? "\nSin problemas.\n" : `\n${fallos} comprobaciones fallan.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
