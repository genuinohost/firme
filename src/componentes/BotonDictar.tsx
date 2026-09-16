import { useEffect, useRef, useState } from "react";
import { dictar, hayDictado, pegar, type Dictando } from "@/logica/dictado";

/**
 * El micrófono.
 *
 * Alex: «hay veces donde no puedo escribir». Este botón está pensado para esas
 * veces —de madrugada, con una mano, con prisa— y por eso hace tres cosas que
 * no son decorativas:
 *
 *  - **No aparece si el móvil no sabe transcribir.** Se pregunta al sistema. Un
 *    micrófono que se toca y no hace nada deja la app pareciendo rota, que es
 *    peor que no ofrecerlo.
 *  - **Enseña lo que va oyendo** mientras se habla. Dictar a ciegas y descubrir
 *    al final que no cogió nada es lo que hace que la gente no vuelva a usarlo.
 *  - **Late al ritmo de la voz**, para saber sin mirar que te está oyendo.
 *
 * Lo dictado se **añade** a lo que hubiera escrito, nunca lo sustituye: se
 * empieza a teclear, uno se cansa, y se termina hablando.
 */
export function BotonDictar({
  valor,
  onTexto,
  etiqueta = "Dictar",
}: {
  /** Lo que hay escrito ahora, para pegar detrás sin comerse nada. */
  valor: string;
  onTexto: (nuevo: string) => void;
  etiqueta?: string;
}) {
  const [sePuede, setSePuede] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [nivel, setNivel] = useState(0);
  const [error, setError] = useState("");
  const sesion = useRef<Dictando | null>(null);

  // El valor de ahora, leído en el momento de pegar: si se capturase al
  // arrancar, dictar dos veces seguidas pisaría lo de la primera.
  const valorAhora = useRef(valor);
  valorAhora.current = valor;

  useEffect(() => {
    let vivo = true;
    void hayDictado().then((h) => {
      if (vivo) setSePuede(h);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Si la pantalla se cierra mientras escucha, se suelta el micrófono.
  useEffect(
    () => () => {
      void sesion.current?.cancelar();
    },
    [],
  );

  const terminar = () => {
    sesion.current = null;
    setEscuchando(false);
    setParcial("");
    setNivel(0);
  };

  const empezar = async () => {
    setError("");
    setParcial("");
    setEscuchando(true);
    const s = await dictar({
      onParcial: setParcial,
      onNivel: setNivel,
      onTexto: (texto) => {
        onTexto(pegar(valorAhora.current, texto));
      },
      onError: (motivo) => setError(motivo),
      onFin: terminar,
    });
    if (s) sesion.current = s;
    else terminar();
  };

  const parar = async () => {
    await sesion.current?.parar();
  };

  if (!sePuede) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void (escuchando ? parar() : empezar())}
        aria-label={escuchando ? "Dejar de dictar" : etiqueta}
        aria-pressed={escuchando}
        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
          escuchando
            ? "border-acento bg-acento/15 text-acento"
            : "border-borde text-tenue hover:border-acento hover:text-acento"
        }`}
        style={
          escuchando
            ? // El latido va del propio nivel de voz, no de una animación fija:
              // así se sabe sin mirar la pantalla que te está oyendo.
              { boxShadow: `0 0 0 ${Math.round(nivel * 10)}px var(--color-acento-suave, transparent)` }
            : undefined
        }
      >
        <span aria-hidden>{escuchando ? "■" : "🎙"}</span>
        <span>{escuchando ? "Estoy oyendo… toca para parar" : etiqueta}</span>
      </button>

      {escuchando && parcial ? (
        <p className="px-1 text-xs leading-relaxed text-tenue italic">{parcial}…</p>
      ) : null}

      {error ? <p className="px-1 text-xs text-fallo">{error}</p> : null}
    </div>
  );
}
