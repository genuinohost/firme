import { nube } from "./nube";

/**
 * «Me gusta» a quien habla, dentro de una sala.
 *
 * Alex, 28-09-2026: «todos los miembros de una comunidad deben ser animados, de
 * alguna manera, a agregarse mutuamente. Mientras alguien habla, debe estar la
 * opción de darle me gusta y de agregar, además de lo que ya agregaste: la
 * racha».
 *
 * Un «me gusta» es un documento pequeño, de quién a quién, en la sala:
 * `salas/{canal}/gustos/{de}_{a}`. Uno por pareja y sala —se da o se quita—,
 * así nadie llena la sala de corazones a toques. Lo ve todo el que está
 * dentro, y cada móvil lo cuenta.
 */

export type Gusto = { de: string; a: string; cuando: number };

/*
 * Cada «me gusta» lleva la sesión (el `desde` de la sala): la reunión del
 * devocional usa siempre el mismo canal, y los de ayer no cuentan hoy.
 */

/** Dar o quitar el «me gusta» a alguien. Sólo a nombre propio (reglas). */
export async function darGusto(canal: string, sesion: number, de: string, a: string, si: boolean): Promise<void> {
  if (!de || !a || de === a) return;
  const { bd } = await nube();
  const { doc, setDoc, deleteDoc } = await import("firebase/firestore");
  const ref = doc(bd, "salas", canal, "gustos", `${de}_${a}`);
  if (si) await setDoc(ref, { de, a, cuando: Date.now(), sesion });
  else await deleteDoc(ref);
}

/** Los «me gusta» de la sala, en vivo. Devuelve la función para dejar de escuchar. */
export function verGustos(canal: string, sesion: number, alCambiar: (gustos: Gusto[]) => void): () => void {
  let fin: (() => void) | null = null;
  let vivo = true;
  void (async () => {
    try {
      const { bd } = await nube();
      const { collection, onSnapshot } = await import("firebase/firestore");
      if (!vivo) return;
      fin = onSnapshot(
        collection(bd, "salas", canal, "gustos"),
        (r) =>
          alCambiar(
            r.docs
              .map((d) => d.data())
              .filter((x) => x.sesion === sesion)
              .filter((x): x is Gusto => typeof x.de === "string" && typeof x.a === "string")
              .map((x) => ({ de: x.de, a: x.a, cuando: Number(x.cuando) || 0 })),
          ),
        () => alCambiar([]),
      );
    } catch {
      // Sin «me gusta» la sala sigue igual.
    }
  })();
  return () => {
    vivo = false;
    fin?.();
  };
}

/** Cuántos «me gusta» tiene cada uno. */
export function contarGustos(gustos: Gusto[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of gustos) m.set(g.a, (m.get(g.a) ?? 0) + 1);
  return m;
}
