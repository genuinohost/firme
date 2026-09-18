import { useEffect, useMemo, useState } from "react";
import {
  AREAS,
  buscarMensajes,
  componer,
  mensajeDelDia,
  MENSAJES,
  type AreaDelBanco,
  type MensajeDiario,
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
import { despublicarFrase, misFrasesPublicadas, publicarFrase } from "@/logica/muro";
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
  /**
   * Cuáles de las guardadas están en el perfil.
   *
   * La verdad de esto vive **en el servidor**, no aquí: si se guardara en el
   * teléfono, desinstalar y volver a instalar dejaría frases colgadas en el
   * perfil que la app juraría que no están. Se pregunta una vez al abrir.
   */
  const [enElPerfil, setEnElPerfil] = useState<Set<string>>(new Set());
  /** Lo que pasó al mover una frase al perfil. Corto, y se retira solo. */
  const [avisoFrase, setAvisoFrase] = useState("");
  const [preguntando, setPreguntando] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const delDia = useMemo(() => mensajeDelDia(), []);
  const coincidencias = useMemo(() => buscarMensajes(tema), [tema]);

  useEffect(() => {
    if (!avisoFrase) return;
    const id = window.setTimeout(() => setAvisoFrase(""), 4000);
    return () => clearTimeout(id);
  }, [avisoFrase]);

  useEffect(() => {
    let vivo = true;
    void misFrasesPublicadas().then((p) => vivo && setEnElPerfil(p));
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Sacar una frase al perfil, o retirarla.
   *
   * Primero el servidor y sólo después la pantalla, como con las notas del
   * diario: enseñar «en mi perfil» sobre algo que no llegó a subir —o al
   * revés— es peor que no enseñar nada.
   */
  const cambiarEnElPerfil = async (f: Favorita, quiero: boolean) => {
    setPreguntando(null);
    setSubiendo(f.id);
    try {
      if (quiero) await publicarFrase(f);
      else await despublicarFrase(f.id);
      setEnElPerfil((antes) => {
        const ahora = new Set(antes);
        if (quiero) ahora.add(f.id);
        else ahora.delete(f.id);
        return ahora;
      });
      setAvisoFrase(
        quiero ? "En tu perfil. Cualquiera puede leerla." : "Quitada de tu perfil.",
      );
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "";
      setAvisoFrase(
        motivo === "sin-cuenta"
          ? "Para enseñarla hace falta entrar: Más → Mi cuenta."
          : motivo === "sin-perfil"
            ? "Primero completa tu perfil en Más → Mi cuenta."
            : "No se pudo. Prueba otra vez.",
      );
    } finally {
      setSubiendo(null);
    }
  };

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
          Listo para copiar y pegar en tus grupos. Abajo tienes el banco entero por
          áreas, y si no encuentras el que quieres, se genera uno nuevo.
        </p>
      </header>

      {/*
        El orden de esta pantalla es el orden en que se usa.

        Casi todos los días Alex entra, coge el mensaje de hoy y lo pega en sus
        grupos: eso son dos toques y tiene que estar arriba del todo. Buscar un
        tema y generar uno nuevo es lo excepcional, y estaba ocupando el sitio
        de lo corriente.
      */}
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
              {avisoFrase ? (
                <p className="rounded-xl border border-borde px-3 py-2 text-xs leading-relaxed">
                  {avisoFrase}
                </p>
              ) : null}
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
                        disabled={subiendo === f.id}
                        onClick={() =>
                          enElPerfil.has(f.id)
                            ? void cambiarEnElPerfil(f, false)
                            : setPreguntando(preguntando === f.id ? null : f.id)
                        }
                        className={
                          "rounded-lg px-2 py-1 text-xs transition disabled:opacity-50 " +
                          (enElPerfil.has(f.id)
                            ? "text-acento"
                            : "text-tenue hover:text-acento")
                        }
                      >
                        {subiendo === f.id
                          ? "…"
                          : enElPerfil.has(f.id)
                            ? "🌐 en mi perfil"
                            : "a mi perfil"}
                      </button>
                      <button
                        onClick={() => {
                          // Quitar una frase guardada la quita también del
                          // perfil. Dejarla arriba después de borrarla aquí
                          // sería enseñar algo que su dueño ya descartó.
                          if (enElPerfil.has(f.id)) void despublicarFrase(f.id).catch(() => {});
                          quitar(f.id);
                          refrescarGuardadas();
                        }}
                        className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-fallo"
                      >
                        quitar
                      </button>
                    </div>
                  </div>

                  {preguntando === f.id ? (
                    <div className="mt-2 rounded-xl border border-acento/50 bg-acento/5 p-3">
                      <p className="text-xs leading-relaxed">
                        Aparecerá en tu perfil con tu nombre, y{" "}
                        <strong>lo puede leer cualquiera</strong>. Puedes quitarla
                        cuando quieras.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <div className="flex-1">
                          <Boton
                            variante="fuerte"
                            ancho
                            onClick={() => void cambiarEnElPerfil(f, true)}
                          >
                            Ponerla en mi perfil
                          </Boton>
                        </div>
                        <Boton onClick={() => setPreguntando(null)}>Dejarlo</Boton>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )
        ) : null}
      </Tarjeta>

      <Banco
        onElegir={(m) => {
          mostrar(componer(m), "banco");
          setTema(m.tema);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onCambio={refrescarGuardadas}
      />
    </div>
  );
}

/**
 * El banco, para recorrerlo.
 *
 * Antes esto era un muro de **365 etiquetas** en minúscula al final de la
 * pantalla, una por mensaje. Alex: «está bien que se vea, pero no debe verse
 * como un error». Tenía razón: eso no es una lista, es un vertido — nadie
 * encuentra nada en 365 fragmentos, y lo que se lee de un vistazo es que algo
 * se rompió.
 *
 * Ahora son nueve áreas, y cada una se abre. La diferencia no es de adorno: con
 * el muro había que saber ya qué palabra buscar; con las áreas se puede llegar
 * sabiendo sólo cómo está uno hoy, que es como se llega de verdad.
 */
function Banco({
  onElegir,
  onCambio,
}: {
  onElegir: (mensaje: MensajeDiario) => void;
  onCambio: () => void;
}) {
  const [abierta, setAbierta] = useState<AreaDelBanco | null>(null);

  if (abierta) {
    return (
      <Tarjeta>
        <button
          onClick={() => setAbierta(null)}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="text-sm text-tenue">‹</span>
          <span className="text-xl" aria-hidden>
            {abierta.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{abierta.nombre}</span>
            <span className="block truncate text-xs text-tenue">
              {abierta.mensajes.length} mensajes
            </span>
          </span>
        </button>

        <p className="mt-2 text-xs leading-relaxed text-tenue">{abierta.descripcion}</p>

        {/*
          La lista se queda dentro de su propia caja con desplazamiento: sin
          eso, abrir un área de cincuenta mensajes empuja media pantalla hacia
          abajo y se pierde de vista dónde estaba uno.
        */}
        <div className="mt-3 max-h-96 overflow-y-auto pr-0.5">
          <div className="flex flex-col gap-1.5">
            {abierta.mensajes.map((m, i) => (
              <div
                key={`${m.tema}-${i}`}
                className="flex items-center gap-1 rounded-xl border border-borde pr-1 transition hover:border-acento"
              >
                <button
                  onClick={() => onElegir(m)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
                >
                  <span className="shrink-0 text-base" aria-hidden>
                    {m.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{m.titulo}</span>
                    <span className="block truncate text-xs text-tenue">{m.tema}</span>
                  </span>
                  <span className="shrink-0 text-tenue">›</span>
                </button>
                <CorazonPequeno texto={componer(m)} tema={m.tema} onCambio={onCambio} />
              </div>
            ))}
          </div>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Etiqueta>el banco · {MENSAJES.length} mensajes</Etiqueta>
      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Escritos para pegar tal cual. Entra por donde estés hoy.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {AREAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAbierta(a)}
            className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie-alta p-3 text-left transition hover:border-acento"
          >
            <span className="text-xl leading-none" aria-hidden>
              {a.emoji}
            </span>
            <span className="text-[13px] leading-tight font-medium">{a.nombre}</span>
            {/* `mt-auto` y no `items-end`: lo segundo recorta cuando el nombre
                ocupa dos líneas, y aquí hay dos que las ocupan. */}
            <span className="cifras mt-auto text-[11px] text-tenue">{a.mensajes.length}</span>
          </button>
        ))}
      </div>
    </Tarjeta>
  );
}
