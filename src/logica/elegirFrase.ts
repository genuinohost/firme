import { CAIDA, EMPUJE, REPASO, VICTORIA, type Frase } from "@/datos/frases";
import type { Ajustes, Categoria } from "@/datos/tipos";

export type Momento = "empuje" | "victoria" | "caida" | "repaso";

const BANCOS: Record<Momento, Frase[]> = {
  empuje: EMPUJE,
  victoria: VICTORIA,
  caida: CAIDA,
  repaso: REPASO,
};

/**
 * Un número estable a partir de un texto. Con la misma semilla sale la misma
 * frase: así el bloque de las 6:30 no cambia de frase cada vez que se repinta
 * la pantalla, pero sí es distinta mañana.
 */
function semilla(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function bancosPermitidos(ajustes: Ajustes, frase: Frase): boolean {
  if (frase.banco === "versiculos") return ajustes.usarVersiculos;
  if (frase.banco === "estoicos") return ajustes.usarEstoicos;
  return true;
}

/**
 * Elige una frase para el momento. Si el bloque tiene categoría, las frases de
 * esa área entran dos veces en el sorteo para que salgan más a menudo.
 */
export function elegirFrase(
  momento: Momento,
  ajustes: Ajustes,
  clave: string,
  categoria?: Categoria,
): Frase {
  const propias: Frase[] = ajustes.frasesPropias
    .filter((t) => t.trim().length > 0)
    .map((texto) => ({ texto: texto.trim(), banco: "casa" as const }));

  // Una frase atada a un área solo sale en esa área: no tiene sentido hablar
  // del rato a solas en el bloque de ejercicio.
  const base = BANCOS[momento].filter(
    (f) => bancosPermitidos(ajustes, f) && (!f.categoria || f.categoria === categoria),
  );
  const delArea = base.filter((f) => f.categoria === categoria);
  // Las propias y las del área pesan el doble en el sorteo.
  const candidatas: Frase[] = [...base, ...delArea, ...propias, ...propias];
  if (candidatas.length === 0) {
    return { texto: "Sigue.", banco: "casa" };
  }
  return candidatas[semilla(clave) % candidatas.length];
}
