import { useEffect, useRef, useState } from "react";

/**
 * «Acaba de cambiar»: verdadero durante `ms` después de que `valor` cambie.
 *
 * Es lo que distingue celebrar de decorar. Un ✓ que rebota cada vez que se
 * abre la pantalla es ruido; el que rebota **sólo en la fila que se acaba de
 * marcar** es una celebración. Por eso nunca es verdadero al montar: una
 * racha de 40 días no se celebra cada vez que se abre la app, se celebra el
 * día que pasa a 41.
 *
 * Con «menos movimiento» sigue funcionando igual —es estado, no animación—;
 * lo que se apaga es lo que el CSS haga con él.
 */
export function useRecien(valor: unknown, ms = 900): boolean {
  const [recien, setRecien] = useState(false);
  const anterior = useRef(valor);

  useEffect(() => {
    if (Object.is(anterior.current, valor)) return;
    anterior.current = valor;
    setRecien(true);
    const id = window.setTimeout(() => setRecien(false), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return recien;
}

/**
 * «Acaba de subir»: como `useRecien`, pero sólo cuando el número crece.
 *
 * Para la racha. Que baje —se rompió— no se celebra; se deja pasar en
 * silencio, que ya duele bastante.
 */
export function useSubio(valor: number, ms = 1100): boolean {
  const [subio, setSubio] = useState(false);
  const anterior = useRef(valor);

  useEffect(() => {
    const crecio = valor > anterior.current;
    anterior.current = valor;
    if (!crecio) return;
    setSubio(true);
    const id = window.setTimeout(() => setSubio(false), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return subio;
}

/**
 * «Acaba de completarse»: verdadero un instante cuando `hecho` pasa de falso
 * a verdadero. Para la fila que se acaba de cumplir y para el día completo.
 */
export function useAcabaDe(hecho: boolean, ms = 1200): boolean {
  const [acaba, setAcaba] = useState(false);
  const antes = useRef(hecho);

  useEffect(() => {
    const paso = hecho && !antes.current;
    antes.current = hecho;
    if (!paso) return;
    setAcaba(true);
    const id = window.setTimeout(() => setAcaba(false), ms);
    return () => clearTimeout(id);
  }, [hecho, ms]);

  return acaba;
}
