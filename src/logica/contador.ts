import { useEffect, useRef, useState } from "react";

/**
 * Un número que sube contando en vez de saltar.
 *
 * Para la racha, sobre todo: pasar de 6 a 7 días seguidos es lo que la app
 * celebra, y verlo subir —aunque sea cuatro décimas— se siente distinto de que
 * el 6 se convierta en 7 sin más. Es la misma curva que todo lo demás (arranca
 * rápido, frena suave), y respeta «reducir movimiento»: ahí el número cambia
 * de golpe, que es lo que esa persona pidió.
 *
 * Sólo cuenta hacia el valor nuevo desde el que había. Al montar por primera
 * vez, sale directamente en su valor: una racha de 40 días no tiene por qué
 * contarse desde cero cada vez que se abre la app.
 */
export function useContador(valor: number, duracionMs = 420): number {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  const cuadro = useRef(0);

  useEffect(() => {
    const reducido =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducido || desde.current === valor) {
      desde.current = valor;
      setMostrado(valor);
      return;
    }

    const inicio = performance.now();
    const de = desde.current;
    const hasta = valor;
    cancelAnimationFrame(cuadro.current);

    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      // Frenada suave (ease-out cúbica): la misma sensación que --curva.
      const e = 1 - Math.pow(1 - t, 3);
      setMostrado(Math.round(de + (hasta - de) * e));
      if (t < 1) cuadro.current = requestAnimationFrame(paso);
      else desde.current = hasta;
    };
    cuadro.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro.current);
  }, [valor, duracionMs]);

  return mostrado;
}
