/**
 * Que el informe de la llamada diga la verdad de cada móvil: a quién le sonó,
 * a quién no y por qué. Alex, 28-09-2026: «no suena la llamada a mis amigos».
 *
 *   npm run revisar-llamada
 */
import {
  ESPERA_ACUSE_MS,
  filasDeLlamada,
  pegasDelMovil,
  resumenDeLlamada,
  type Acuse,
  type ResultadoLlamada,
} from "../src/logica/llamada";

let fallos = 0;
let pasadas = 0;
function debe(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) pasadas++;
  else fallos++;
  console.log(`${ok ? "  ok  " : "FALLA "} ${nombre}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}

const r = (uid: string, estado: ResultadoLlamada["estado"]): ResultadoLlamada => ({
  uid,
  nombre: uid[0].toUpperCase() + uid.slice(1),
  estado,
});
const acuse = (para: string, estado: Acuse["estado"] = { sono: true }, tarda = 3200): Acuse => ({
  llamada: "abc",
  para,
  tarda,
  estado,
  en: 1,
});
const como = (filas: ReturnType<typeof filasDeLlamada>) => Object.fromEntries(filas.map((f) => [f.uid, f.como]));

// ── Lo básico ───────────────────────────────────────────────────────────────
{
  const res = [r("pepa", "enviado"), r("luis", "enviado")];
  const filas = filasDeLlamada(res, new Map([["pepa", acuse("pepa")]]), 5_000, true);
  debe("a quien contestó le sonó; al otro se le espera", como(filas), { luis: "esperando", pepa: "sono" });
  debe("dice cuánto tardó", filas.find((f) => f.uid === "pepa")?.texto, "Le sonó (a los 3 s)");
  debe("el resumen cuenta los que sonaron", resumenDeLlamada(filas), "Sonó en 1 de 2 · esperando 1.");
}
{
  const filas = filasDeLlamada([r("luis", "enviado")], new Map(), ESPERA_ACUSE_MS + 1, true);
  debe("pasado el minuto sin contestar, «no contestó»", filas[0].como, "sin-respuesta");
  debe("y se le dice qué hacer", filas[0].texto.includes("Probar mi timbre"), true);
}
{
  const filas = filasDeLlamada([r("luis", "enviado")], new Map(), ESPERA_ACUSE_MS + 1, false);
  debe("sin vuelta no se acusa a nadie de no contestar", filas[0].como, "sin-confirmar");
  debe("ni se le manda a llamar «desde la app» a quien ya está en ella", filas[0].texto.includes("desde la app"), false);
  const dos = filasDeLlamada([r("ana", "enviado"), r("luis", "enviado")], new Map(), ESPERA_ACUSE_MS + 1, false);
  debe("sin vuelta, el resumen no dice lo mismo dos veces", resumenDeLlamada(dos), "Llamada enviada a 2, sin confirmación.");
}
{
  const conTema = filasDeLlamada([r("pepa", "fallo")], new Map(), 1_000, true, true);
  debe("si su aviso falló pero el general salió, no se pide volver a llamar", [conTema[0].como, conTema[0].texto.includes("Vuelve a llamar")], ["sin-confirmar", false]);
  const sinTema = filasDeLlamada([r("pepa", "fallo")], new Map(), 1_000, true, false);
  debe("y si tampoco salió el general, sí", sinTema[0].como, "fallo");
}
{
  const filas = filasDeLlamada(
    [r("ana", "sin-token"), r("rita", "no-registrado"), r("tito", "fallo"), r("zoe", "solo-tema")],
    new Map(),
    1_000,
    true,
  );
  debe(
    "app vieja, móvil que ya no está, fallo de Google y aviso general, cada uno con su nombre",
    como(filas),
    { rita: "no-esta", tito: "fallo", ana: "app-vieja", zoe: "sin-confirmar" },
  );
  debe(
    "el resumen lo dice todo, y los que no pueden confirmar no cuentan en el «de»",
    resumenDeLlamada(filas),
    "Sonó en 0 de 2 · 1 con la app vieja · 1 sin móvil registrado · 1 sin confirmar · 1 con fallo de Google.",
  );
}
{
  const filas = filasDeLlamada([r("ana", "sin-token"), r("luis", "sin-token")], new Map(), 1_000, true);
  debe("todos con la app vieja: no se dice «Sonó en 0 de 2»", resumenDeLlamada(filas), "Llamada enviada a 2, sin confirmación · 2 con la app vieja.");
}
{
  const filas = filasDeLlamada([r("rita", "no-registrado")], new Map(), 1_000, true, true);
  debe("a quien Google no encontró por su token NO se le promete el aviso general (no tiene la app)", filas[0].texto.includes("aviso general"), false);
  const sinTema = filasDeLlamada([r("rita", "no-registrado")], new Map(), 1_000, true, null);
  debe("y si el aviso general no salió, no se promete", sinTema[0].texto.includes("aviso general"), false);
}
{
  // Un móvil con la app vieja no manda acuse; uno nuevo que recibió por el
  // tema antes que por su token, sí: el acuse manda sobre lo que dijo Google.
  const filas = filasDeLlamada([r("pepa", "fallo")], new Map([["pepa", acuse("pepa")]]), 1_000, true);
  debe("si el móvil contestó, le sonó, diga lo que diga el envío", filas[0].como, "sono");
}
{
  const filas = filasDeLlamada([r("pepa", "enviado")], new Map([["pepa", acuse("pepa", { sono: false })]]), 1_000, true);
  debe("le llegó pero su móvil frenó el timbre", filas[0].como, "frenado");
  debe("y eso también cuenta como que le llegó", resumenDeLlamada(filas), "Sonó en 1 de 1.");
}
debe("sin nadie más en la comunidad, se dice", resumenDeLlamada([]), "No hay nadie más en la comunidad a quien llamar.");

// ── Lo que tiene mal un móvil al que le sonó ───────────────────────────────
debe("un móvil bien no tiene pegas", pegasDelMovil({ sono: true, avisos: true, canal: true, pantalla: true, bateria: true }), []);
debe(
  "silencio total",
  pegasDelMovil({ noMolestar: "SILENCIO TOTAL" }),
  ["tiene «No molestar» en silencio total: su móvil calla hasta las alarmas"],
);
debe("avisos apagados", pegasDelMovil({ avisos: false }).length, 1);
debe("el canal apagado es lo mismo que los avisos apagados (una sola pega)", pegasDelMovil({ avisos: false, canal: false }).length, 1);
debe("sin pantalla completa", pegasDelMovil({ pantalla: false })[0]?.includes("pantalla completa"), true);
debe("Xiaomi en el ahorro de batería", pegasDelMovil({ bateria: false, fabricante: "Xiaomi" }).length, 1);
debe("otro móvil en el ahorro de batería no se señala (no suele fallar por eso)", pegasDelMovil({ bateria: false, fabricante: "samsung" }), []);
debe("la app restringida por Android", pegasDelMovil({ cajon: "RESTRINGIDA" }).length, 1);
{
  const filas = filasDeLlamada(
    [r("pepa", "enviado"), r("ana", "enviado")],
    new Map([
      ["pepa", acuse("pepa", { sono: true, pantalla: false })],
      ["ana", acuse("ana")],
    ]),
    1_000,
    true,
  );
  debe("entre los que sonaron, primero el que tiene pegas", filas.map((f) => f.uid), ["pepa", "ana"]);
  debe("y las pegas van en su fila", filas[0].pegas.length, 1);
}
{
  const filas = filasDeLlamada([r("pepa", "enviado"), r("rita", "no-registrado")], new Map([["pepa", acuse("pepa")]]), 1_000, true);
  debe("primero lo que hay que mirar, al final lo que sonó bien", filas.map((f) => f.uid), ["rita", "pepa"]);
}

console.log(fallos === 0 ? `\n${pasadas} comprobaciones, sin problemas.\n` : `\n${fallos} de ${fallos + pasadas} FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
