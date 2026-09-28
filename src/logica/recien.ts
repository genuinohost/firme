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
 *
 * El estado se fija SIEMPRE al resultado, no sólo a verdadero: si el valor
 * baja dentro de la ventana (marcar y deshacer en un segundo), la limpieza ya
 * borró el temporizador y se quedaría encendido, y la siguiente subida no
 * volvería a animar porque la clase ya estaría puesta. (Revisión de la 6.18.)
 */
export function useSubio(valor: number, ms = 1100): boolean {
  const [subio, setSubio] = useState(false);
  const anterior = useRef(valor);

  useEffect(() => {
    const crecio = valor > anterior.current;
    anterior.current = valor;
    setSubio(crecio);
    if (!crecio) return;
    const id = window.setTimeout(() => setSubio(false), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return subio;
}

/**
 * «Acaba de completarse»: verdadero un instante cuando `hecho` pasa de falso
 * a verdadero. Para la fila que se acaba de cumplir y para el día completo.
 *
 * `clave` es DE QUÉ se habla (la fecha, en las filas): si cambia, `hecho` no
 * «pasó» a verdadero, es que se mira otro día. Se toma el estado nuevo como
 * punto de partida y no se celebra nada. Sin esto, tocar ‹ para ver ayer
 * hacía que cada bloque cumplido ayer se lavara de verde y se tachara como
 * si se acabara de cumplir. (Revisión de la 6.18.)
 */
export function useAcabaDe(hecho: boolean, clave?: unknown, ms = 1200): boolean {
  const [acaba, setAcaba] = useState(false);
  const antes = useRef({ hecho, clave });

  useEffect(() => {
    const previo = antes.current;
    antes.current = { hecho, clave };
    // Cambió de qué se habla: sin celebrar, y apagando lo que hubiera.
    const paso = Object.is(previo.clave, clave) && hecho && !previo.hecho;
    setAcaba(paso);
    if (!paso) return;
    const id = window.setTimeout(() => setAcaba(false), ms);
    return () => clearTimeout(id);
  }, [hecho, clave, ms]);

  return acaba;
}
