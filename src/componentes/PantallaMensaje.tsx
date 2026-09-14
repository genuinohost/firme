import { useEffect, useMemo, useState } from "react";
import {
  buscarMensajes,
  componer,
  mensajeDelDia,
  temasDisponibles,
  MENSAJES,
} from "@/datos/mensajes";
import { generarMensaje, hayClave } from "@/logica/generador";
import { compartirFrase, conFirma, copiar, type ResultadoCompartir } from "@/logica/compartir";
import {
  alternar,
  buscar as buscarGuardadas,
  estaGuardada,
  listar,
  quitar,
  type Favorita,
} from "@/logica/favoritas";
import { Boton, Entrada, Etiqueta, Tarjeta } from "./piezas";

/** El corazón que guarda un mensaje entero para volver a él. */
function Corazon({
  texto,
  tema,
  onCambio,
}: {
  texto: string;
  tema?: string;
  onCambio: () => void;
}) {
  const [guardada, setGuardada] = useState(() => estaGuardada(texto));
  useEffect(() => setGuardada(estaGuardada(texto)), [texto]);

  return (
    <button
      onClick={() => {
        setGuardada(alternar(texto, undefined, tema));
        onCambio();
      }}
      className={`shrink-0 rounded-xl border px-3 text-lg transition ${
        guardada ? "border-acento text-acento" : "border-borde text-tenue hover:text-acento"
      }`}
      aria-label={guardada ? "Quitar de guardadas" : "Guardar este mensaje"}
      aria-pressed={guardada}
    >
      {guardada ? "♥" : "♡"}
    </button>
  );
}

/** El mismo corazón, en tamaño de fila. */
function CorazonPequeno({
  texto,
  tema,
  onCambio,
}: {
  texto: string;
  tema?: string;
  onCambio: () => void;
}) {
  const [guardada, setGuardada] = useState(() => estaGuardada(texto));
  useEffect(() => setGuardada(estaGuardada(texto)), [texto]);

  return (
    <button
      onClick={() => {
        setGuardada(alternar(texto, undefined, tema));
        onCambio();
      }}
      className={`shrink-0 rounded-lg px-2 py-2 text-base transition ${
        guardada ? "text-acento" : "text-tenue hover:text-acento"
      }`}
      aria-label={guardada ? "Quitar de guardadas" : "Guardar este mensaje"}
      aria-pressed={guardada}
    >
      {guardada ? "♥" : "♡"}
    </button>
  );
}

/**
 * El mensaje que Alex comparte cada madrugada.
 *
 * El banco es lo predeterminado y funciona sin internet. Escribir un tema busca
 * primero en el banco; si no hay nada que encaje —o si prefiere uno nuevo— se
 * genera por internet, que cuesta céntimos.
 */
export function PantallaMensaje() {
  const [tema, setTema] = useState("");
  const [texto, setTexto] = useState<string | null>(null);
  const [origen, setOrigen] = useState<"banco" | "internet" | null>(null);
  const [coste, setCoste] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState<ResultadoCompartir | null>(null);

  const [verGuardadas, setVerGuardadas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [guardadas, setGuardadas] = useState<Favorita[]>(() => listar());

  const delDia = useMemo(() => mensajeDelDia(), []);
  const coincidencias = useMemo(() => buscarMensajes(tema), [tema]);
  const temas = useMemo(() => temasDisponibles(), []);

  const refrescarGuardadas = () => setGuardadas(listar());

  const mostrar = (t: string, de: "banco" | "internet", c: number | null = null) => {
    setTexto(t);
    setOrigen(de);
    setCoste(c);
    setError("");
    setCopiado(null);
  };

  const generar = async () => {
    setGenerando(true);
    setError("");
    const r = await generarMensaje(tema);
    setGenerando(false);
    if (r.ok) mostrar(r.texto, "internet", r.coste);
    else setError(r.error);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Mensaje del día</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Listo para copiar y pegar en WhatsApp. Escribe el tema de hoy y busca en el
          banco; si no encuentras el que quieres, se genera uno nuevo.
        </p>
      </header>

      <Tarjeta>
        <Etiqueta>el tema de hoy</Etiqueta>
        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <Entrada
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="esfuerzo, gratitud, no rendirse…"
              className="w-full"
            />
          </div>
          <Boton
            variante="fuerte"
            deshabilitado={!tema.trim() || generando}
            onClick={generar}
          >
            {generando ? "…" : "Generar"}
          </Boton>
        </div>

        {!hayClave() ? (
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Para generar por internet hace falta la clave de OpenRouter, en Ajustes. Sin
            ella el banco sigue funcionando entero.
          </p>
        ) : null}

        {error ? (
          <p className="mt-2 rounded-xl border border-fallo/40 bg-fallo/10 px-3 py-2 text-xs leading-relaxed">
            {error}
          </p>
        ) : null}

        {tema.trim() && coincidencias.length > 0 ? (
          <div className="mt-3">
            <Etiqueta>en el banco ({coincidencias.length})</Etiqueta>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {coincidencias.slice(0, 6).map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded-xl border border-borde pr-1 transition hover:border-acento"
                >
                  <button
                    onClick={() => mostrar(componer(m), "banco")}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <span aria-hidden>{m.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{m.titulo}</span>
                    <span className="shrink-0 text-tenue">›</span>
                  </button>
                  <CorazonPequeno texto={componer(m)} tema={m.tema} onCambio={refrescarGuardadas} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tema.trim() && coincidencias.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-tenue">
            Nada en el banco sobre «{tema.trim()}». Pulsa <b>Generar</b> para escribir uno
            nuevo.
          </p>
        ) : null}
      </Tarjeta>

      {/* El mensaje elegido o generado, listo para llevárselo. */}
      {texto ? (
        <Tarjeta className="entrar border-acento/30">
          <div className="flex items-center justify-between">
            <Etiqueta>{origen === "internet" ? "generado ahora" : "del banco"}</Etiqueta>
            {coste !== null ? (
              <span className="cifras text-xs text-tenue">
                costó ${coste.toFixed(6)}
              </span>
            ) : null}
          </div>

          <pre className="mt-3 font-sans text-[15px] leading-relaxed whitespace-pre-wrap">
            {texto}
          </pre>

          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <Boton
                variante="fuerte"
                ancho
                onClick={async () => setCopiado(await compartirFrase({ texto }))}
              >
                Compartir
              </Boton>
            </div>
            <Boton onClick={async () => setCopiado(await copiar(conFirma(texto)))}>
              {copiado === "copiado" ? "copiado ✓" : "Copiar"}
            </Boton>
            <Corazon texto={texto} tema={tema.trim() || undefined} onCambio={refrescarGuardadas} />
          </div>
        </Tarjeta>
      ) : null}

      {/* Lo que toca hoy, sin tener que buscar nada. */}
      {!texto && delDia ? (
        <Tarjeta>
          <Etiqueta>sugerencia de hoy</Etiqueta>
          <pre className="mt-2 font-sans text-[15px] leading-relaxed whitespace-pre-wrap">
            {componer(delDia)}
          </pre>
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <Boton
                variante="fuerte"
                ancho
                onClick={async () => setCopiado(await compartirFrase({ texto: componer(delDia) }))}
              >
                Compartir
              </Boton>
            </div>
            <Boton onClick={() => mostrar(componer(delDia), "banco")}>Fijar</Boton>
            <Corazon texto={componer(delDia)} tema={delDia.tema} onCambio={refrescarGuardadas} />
          </div>
        </Tarjeta>
      ) : null}

      {/* Lo que guardó con el corazón, para volver a buscarlo. */}
      <Tarjeta>
        <button
          onClick={() => setVerGuardadas((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <Etiqueta>guardadas · {guardadas.length}</Etiqueta>
          <span className="text-sm text-tenue">{verGuardadas ? "▲" : "▼"}</span>
        </button>

        {verGuardadas ? (
          guardadas.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-tenue">
              Todavía no has guardado ninguna. Toca el ♡ que hay junto a cualquier frase o
              mensaje, aquí o en la pantalla de Hoy.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <Entrada
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar entre las guardadas…"
                className="w-full"
              />
              {buscarGuardadas(busqueda).map((f) => (
                <div key={f.id} className="rounded-xl border border-borde bg-superficie-alta p-3">
                  <pre className="font-sans text-[14px] leading-relaxed whitespace-pre-wrap">
                    {f.texto}
                  </pre>
                  {f.fuente ? (
                    <p className="mt-1 text-xs text-tenue">— {f.fuente}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-tenue">
                      {new Date(f.guardada).toLocaleDateString("es", {
                        day: "numeric",
                        month: "short",
                      })}
                      {f.tema ? ` · ${f.tema}` : ""}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={async () =>
                          setCopiado(await compartirFrase({ texto: f.texto, fuente: f.fuente }))
                        }
                        className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
                      >
                        compartir
                      </button>
                      <button
                        onClick={() => {
                          quitar(f.id);
                          refrescarGuardadas();
                        }}
                        className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-fallo"
                      >
                        quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
      </Tarjeta>

      <Tarjeta>
        <Etiqueta>el banco · {MENSAJES.length} mensajes</Etiqueta>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {temas.map((t) => (
            <button
              key={t}
              onClick={() => setTema(t)}
              className="rounded-full border border-borde px-2.5 py-1 text-xs text-tenue transition hover:border-acento hover:text-acento"
            >
              {t}
            </button>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}
