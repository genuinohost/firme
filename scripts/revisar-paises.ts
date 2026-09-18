/**
 * Que la lista de países sirva para cualquiera.
 *
 * José, el primer amigo que probó la app, dijo que **no salían todos los
 * países**. Tenía razón: eran 32 escritos a mano. Una lista recortada funciona
 * hasta que alguien de un país que no está abre la app y descubre que para
 * esta app su país no existe — y eso, en algo que se comparte para que «muchos
 * se registren», es un muro.
 *
 *   npm run revisar-paises
 */
import { PAISES, paisDe } from "@/datos/paises";

let fallos = 0;
const comprobar = (bien: boolean, que: string, detalle = "") => {
  if (!bien) fallos++;
  console.log(`${bien ? "  ok  " : "FALLA "} ${que}${detalle ? " — " + detalle : ""}`);
};

console.log(`\n${PAISES.length} países en la lista.\n`);

comprobar(PAISES.length >= 240, `están todos (${PAISES.length} de 249)`);

// Los de habla hispana, arriba y en orden. No es favoritismo: es de dónde
// viene la gente, y bajar hasta la uve para encontrar Venezuela es un roce
// tonto en la primera pantalla que alguien ve.
comprobar(PAISES[0]?.codigo === "VE", "Venezuela, la primera", PAISES[0]?.nombre);

const imprescindibles = ["VE", "CO", "MX", "ES", "AR", "PE", "CL", "EC", "US", "PA", "DO"];
for (const c of imprescindibles.slice(0, 4)) {
  const p = PAISES.find((x) => x.codigo === c);
  comprobar(p !== undefined, `está ${c}`, p?.nombre);
}

// Los que faltaban antes y ahora tienen que estar.
for (const c of ["BR", "IT", "PH", "MA", "SN", "IN", "NG", "JP"]) {
  const p = PAISES.find((x) => x.codigo === c);
  comprobar(p !== undefined, `está ${c}, que antes no`, p?.nombre);
}

comprobar(
  PAISES.every((p) => p.nombre.trim().length > 0),
  "todos tienen nombre",
);
comprobar(
  PAISES.every((p) => p.bandera.length > 0),
  "todos tienen bandera",
);
comprobar(
  new Set(PAISES.map((p) => p.codigo)).size === PAISES.length,
  "ningún código repetido",
);
// Dos países con el mismo nombre romperían `paisDe`, que busca por nombre —
// y el perfil guarda el nombre, no el código.
comprobar(
  new Set(PAISES.map((p) => p.nombre)).size === PAISES.length,
  "ningún nombre repetido",
);

const ve = PAISES.find((p) => p.codigo === "VE");
comprobar(ve?.bandera === "🇻🇪", "la bandera se calcula bien", ve?.bandera);
comprobar(paisDe(ve?.nombre)?.codigo === "VE", "se encuentra por su nombre");
comprobar(paisDe("Un país que no existe") === null, "lo que no está, devuelve null");

console.log(
  fallos === 0 ? "\nSin problemas.\n" : `\n${fallos} comprobaciones fallan.\n`,
);
process.exit(fallos === 0 ? 0 : 1);
