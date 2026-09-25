import { useEffect, useState } from "react";
import { miUid, puedoModerar } from "@/logica/muro";
import type { Sala } from "@/logica/sala";
import { abrirSala, canalDesdeNombre, cerrarSala, salasAbiertas } from "@/logica/sala";
import { Boton, Entrada, Etiqueta } from "./piezas";

/**
 * Lo que está sonando ahora, y el botón para abrirlo.
 *
 * ── Por qué esto y no sólo `comunidad.json` ───────────────────────────────
 *
 * Un devocional se puede publicar como reunión en `comunidad.json`, con su hora
 * y su día, y así es como se avisa de que **va a haber uno**. Pero una reunión
 * publicada no sabe si está pasando: es un horario.
 *
 * Esto es lo otro — **qué hay abierto ahora mismo**. Alex toca un botón y la
 * sala aparece aquí para los treinta, sin que nadie edite un archivo ni espere
 * las seis horas que tarda en refrescarse la comunidad. El día que el devocional
 * empiece veinte minutos tarde, que es lo que pasa siempre, la gente lo ve.
 *
 * ── Abrir salas sólo quien modera ─────────────────────────────────────────
 *
 * No es desconfianza: **cada minuto de voz lo paga Alex** en Agora. Se comprueba
 * aquí para no enseñar un botón que no va a funcionar, y otra vez en las reglas
 * de Firestore, que es donde de verdad se impide. Hay una prueba con ese nombre.
 */
export function SalasAbiertas({
  onEntrar,
  onHayAlgo,
}: {
  onEntrar: (canal: string) => void;
  /**
   * Avisa a la pantalla de si aquí hay algo que enseñar.
   *
   * Sin esto, «Juntos» decía «todavía no hay grupos ni reuniones publicados»
   * **justo encima de un devocional sonando**. Se vio en una captura: el aviso
   * de vacío mira los enlaces y las reuniones publicadas, y no sabe nada de las
   * salas abiertas, que son lo más vivo de la pantalla.
   */
  onHayAlgo?: (hay: boolean) => void;
}) {
  const [salas, setSalas] = useState<Sala[] | null>(null);
  const [modero, setModero] = useState(false);
  /** Para saber qué salas son mías: sólo la propia se puede cerrar. */
  const [yo, setYo] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  const mirar = async () => {
    try {
      setSalas(await salasAbiertas());
    } catch {
      // Sin conexión no se inventa una lista: no hay sección y ya está.
      setSalas([]);
    }
  };

  useEffect(() => {
    let vivo = true;
    void puedoModerar().then((s) => vivo && setModero(s));
    void miUid().then((u) => vivo && setYo(u));
    void salasAbiertas()
      .catch(() => [])
      .then((s) => vivo && setSalas(s));
    return () => {
      vivo = false;
    };
  }, []);

  const abrir = async () => {
    const limpio = nombre.trim();
    if (limpio.length < 3) return;
    setError("");
    try {
      const canal = canalDesdeNombre(limpio);
      await abrirSala(canal, limpio, "devocional");
      setNombre("");
      setAbriendo(false);
      await mirar();
      // Se entra de una vez. Abrir una sala y quedarse fuera no tiene sentido:
      // quien la abre es quien va a leer.
      onEntrar(canal);
    } catch {
      setError("No se pudo abrir la sala. Mira tu conexión.");
    }
  };

  const hay = salas != null && salas.length > 0;

  // Se avisa de lo que se va a pintar, no de lo que hay en la base: para el
  // aviso de «aquí no hay nada» cuenta igual el botón de abrir que una sala.
  useEffect(() => {
    onHayAlgo?.(hay || modero);
  }, [hay, modero, onHayAlgo]);

  if (!hay && !modero) return null;

  return (
    <section className="flex flex-col gap-2">
      <Etiqueta>{hay ? "sonando ahora" : "abrir un devocional"}</Etiqueta>

      {salas?.map((s) => (
        <div
          key={s.canal}
          className="flex items-center gap-3 rounded-xl border border-logro/50 bg-logro/5 p-3"
        >
          {/* El punto que late: se distingue de un horario de un vistazo. */}
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-logro opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-logro" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{s.nombre}</p>
            <p className="truncate text-xs text-tenue">
              {s.tipo === "llamada" ? "llamada" : "devocional"} · abierto desde las{" "}
              {new Date(s.desde).toLocaleTimeString("es", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Boton variante="fuerte" onClick={() => onEntrar(s.canal)}>
              Entrar
            </Boton>
            {/*
              Cerrar, sólo la propia. Las reglas no dejan cerrar la sala de otro
              —ni a quien modera—, así que enseñar el botón a todo el mundo sería
              ofrecer algo que va a fallar.
            */}
            {s.anfitrion === yo ? (
              <button
                onClick={async () => {
                  await cerrarSala(s.canal, s.nombre, s.tipo).catch(() =>
                    setError("No se pudo cerrar."),
                  );
                  await mirar();
                }}
                className="text-xs text-tenue transition hover:text-fallo"
              >
                cerrar
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {modero && !abriendo ? (
        <Boton ancho onClick={() => setAbriendo(true)}>
          Abrir un devocional
        </Boton>
      ) : null}

      {modero && abriendo ? (
        <div className="rounded-xl border border-borde p-3">
          <p className="text-sm leading-relaxed">
            ¿Cómo se llama? Los demás lo verán aquí en cuanto lo abras.
          </p>
          <div className="mt-2">
            <Entrada
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Devocional de la mañana"
              onKeyDown={(e) => {
                if (e.key === "Enter") void abrir();
              }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Entrarás tú hablando y los demás escuchando. Para que alguien comente,
            levanta la mano y tú le das la palabra.
          </p>
          {error ? <p className="mt-2 text-xs text-fallo">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <Boton
                variante="fuerte"
                ancho
                deshabilitado={nombre.trim().length < 3}
                onClick={() => void abrir()}
              >
                Abrir y entrar
              </Boton>
            </div>
            <Boton onClick={() => setAbriendo(false)}>Dejarlo</Boton>
          </div>
        </div>
      ) : null}

    </section>
  );
}
