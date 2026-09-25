import { useEffect, useMemo, useRef, useState } from "react";
import type { Dentro, Sala } from "@/logica/sala";
import {
  alCaducarElToken,
  cambiarDePapel,
  darLaPalabra,
  entrarEnSala,
  expulsar,
  hayVoz,
  leerSala,
  mano,
  miMicro,
  porElAltavoz,
  renovarToken,
  salirDeSala,
  verQuienEsta,
  verQuienHabla,
} from "@/logica/sala";
import { Boton, Etiqueta, Tarjeta, Vacio } from "./piezas";

/**
 * La sala: el devocional de treinta y la llamada de dos.
 *
 * ── Las tres decisiones de esta pantalla ──────────────────────────────────
 *
 * **Se ve quién habla.** Es lo único que se le pide a Agora aparte del audio, y
 * es lo que convierte treinta nombres en una lista en treinta personas. Sin eso,
 * un devocional de treinta suena a radio sin locutor.
 *
 * **Se entra escuchando, y se dice.** No en letra pequeña: en grande, porque
 * alguien que cree tener el micrófono abierto y no lo tiene se pasa el devocional
 * hablándole a nadie. Y el permiso de verdad no lo da esta pantalla — lo da el
 * token— así que aquí sólo se refleja lo que ya es cierto.
 *
 * **La mano se levanta, no se interrumpe.** Es la diferencia entre comentar un
 * devocional y treinta personas hablando encima. El anfitrión ve las manos en
 * orden y da la palabra.
 */
export function PantallaSala({
  canal,
  quienSoy,
  onSalir,
}: {
  canal: string;
  quienSoy: { uid: string; nombre: string; usuario: string; foto?: string };
  onSalir: () => void;
}) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [gente, setGente] = useState<Dentro[]>([]);
  const [estado, setEstado] = useState<"entrando" | "dentro" | "fuera">("entrando");
  const [error, setError] = useState("");
  const [habla, setHabla] = useState(false);
  const [esAnfitrion, setEsAnfitrion] = useState(false);
  const [microAbierto, setMicroAbierto] = useState(true);
  const [altavoz, setAltavoz] = useState(true);
  /** Las cuentas de quien está sonando ahora mismo, y si soy yo. */
  const [sonando, setSonando] = useState<{ cuentas: Set<string>; yo: boolean }>({
    cuentas: new Set(),
    yo: false,
  });
  const [tocando, setTocando] = useState<string | null>(null);

  /**
   * El papel que teníamos la última vez.
   *
   * Hace falta para no pedir un token nuevo en cada repintado: sólo cuando el
   * anfitrión cambia `palabra` de verdad. Sin esto, cualquier cambio en la lista
   * —alguien que entra, una mano que se levanta— dispararía una llamada a la
   * Cloud Function por persona y por cambio.
   */
  const palabraAnterior = useRef<boolean | null>(null);

  // ── entrar, y salir al irse ────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        setSala(await leerSala(canal));
        const r = await entrarEnSala(canal, quienSoy);
        if (!vivo) {
          // Se salió de la pantalla mientras entrábamos. Hay que soltar el
          // audio o queda un micrófono abierto en una sala que nadie mira.
          await salirDeSala();
          return;
        }
        setHabla(r.habla);
        setEsAnfitrion(r.esAnfitrion);
        palabraAnterior.current = r.habla;
        setEstado("dentro");
      } catch (e) {
        if (!vivo) return;
        setError(comoSeDice(e));
        setEstado("fuera");
      }
    })();
    return () => {
      vivo = false;
      void salirDeSala();
    };
    // Sólo al entrar en esta sala. `quienSoy` no puede cambiar sin cambiar de
    // cuenta, y cambiar de cuenta desmonta la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal]);

  // ── quién está dentro ───────────────────────────────────────────────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let dejar: (() => void) | null = null;
    let vivo = true;
    void verQuienEsta(canal, (g) => vivo && setGente(g)).then((f) => {
      if (!vivo) f();
      else dejar = f;
    });
    return () => {
      vivo = false;
      dejar?.();
    };
  }, [canal, estado]);

  // ── quién habla ahora mismo ─────────────────────────────────────────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let quitar: (() => Promise<void>) | null = null;
    let vivo = true;
    void verQuienHabla((quienes) => {
      if (!vivo) return;
      // Por debajo de 15 sobre 255 es respirar, no hablar. Sin este corte el
      // indicador se enciende con el ruido de la habitación y deja de significar
      // nada.
      const fuertes = quienes.filter((q) => q.volumen > 15);
      setSonando({
        cuentas: new Set(fuertes.filter((q) => !q.yo && q.cuenta).map((q) => q.cuenta!)),
        yo: fuertes.some((q) => q.yo),
      });
    }).then((o) => {
      if (!vivo) void o.remove();
      else quitar = () => o.remove();
    });
    return () => {
      vivo = false;
      void quitar?.();
    };
  }, [estado]);

  // ── renovar el token antes de que corte la voz ──────────────────────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let quitar: (() => Promise<void>) | null = null;
    let vivo = true;
    void alCaducarElToken(() => {
      void renovarToken(canal).catch(() => {
        // Si no se puede renovar, la voz se va a cortar y hay que decirlo: un
        // micrófono que deja de funcionar sin aviso es el peor fallo posible
        // aquí, y este proyecto ya lo ha pagado con las alarmas.
        if (vivo) setError("Se perdió el permiso de la sala. Vuelve a entrar.");
      });
    }).then((o) => {
      if (!vivo) void o.remove();
      else quitar = () => o.remove();
    });
    return () => {
      vivo = false;
      void quitar?.();
    };
  }, [canal, estado]);

  const yo = useMemo(() => gente.find((g) => g.uid === quienSoy.uid), [gente, quienSoy.uid]);

  // ── el anfitrión me dio o me quitó la palabra ───────────────────────────
  useEffect(() => {
    if (estado !== "dentro" || !yo) return;
    if (palabraAnterior.current === null) {
      palabraAnterior.current = yo.palabra;
      return;
    }
    if (palabraAnterior.current === yo.palabra) return;
    palabraAnterior.current = yo.palabra;
    void (async () => {
      try {
        // El papel va firmado en el token, así que cambiar de papel es pedir otro.
        const ahoraHabla = await cambiarDePapel(canal);
        setHabla(ahoraHabla);
        if (ahoraHabla) {
          setMicroAbierto(true);
          await miMicro(true);
        }
      } catch {
        setError("No se pudo cambiar tu turno. Sal y vuelve a entrar.");
      }
    })();
  }, [yo?.palabra, canal, estado, yo]);

  // ── lo que se ve ────────────────────────────────────────────────────────

  if (!hayVoz()) {
    return (
      <Tarjeta>
        <Etiqueta>la sala de voz</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed">
          Las salas funcionan en la app de Android. En el navegador no se puede
          prometer que el audio entre en todos los aparatos, y una sala que falla
          a la hora del devocional es peor que no tenerla.
        </p>
        <div className="mt-3">
          <Boton ancho onClick={onSalir}>
            Volver
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  if (estado === "entrando") return <Vacio>Entrando en la sala…</Vacio>;

  if (estado === "fuera") {
    return (
      <Tarjeta className="border-fallo/40">
        <Etiqueta>no se pudo entrar</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed">{error}</p>
        <div className="mt-3">
          <Boton ancho onClick={onSalir}>
            Volver
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  const manos = gente.filter((g) => g.mano && !g.palabra);
  const conLaPalabra = gente.filter((g) => g.palabra || g.uid === sala?.anfitrion);

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta>
        <Etiqueta>
          {sala?.tipo === "llamada" ? "llamada" : "devocional"} · {gente.length}{" "}
          {gente.length === 1 ? "dentro" : "dentro"}
        </Etiqueta>
        <h2 className="mt-1 text-xl font-semibold">{sala?.nombre ?? "Una sala"}</h2>

        {/*
          El estado propio, en grande y sin ambigüedad.

          Alguien que cree tener el micrófono abierto y no lo tiene se pasa el
          devocional hablándole a nadie. Es el fallo más fácil de cometer aquí y
          el más humillante de descubrir, así que ocupa sitio.
        */}
        <p
          className={`mt-3 text-sm leading-relaxed ${habla ? "text-logro" : "text-tenue"}`}
        >
          {habla
            ? microAbierto
              ? sonando.yo
                ? "Tienes la palabra y se te está oyendo."
                : "Tienes la palabra. Habla."
              : "Tienes la palabra, pero tu micrófono está cerrado."
            : "Estás escuchando. Levanta la mano para comentar."}
        </p>

        {error ? (
          <p className="mt-2 text-sm leading-relaxed text-fallo">{error}</p>
        ) : null}
      </Tarjeta>

      {/* Las manos levantadas, arriba y en orden: es lo único que pide algo. */}
      {esAnfitrion && manos.length > 0 ? (
        <Tarjeta className="border-acento/50">
          <Etiqueta>quieren comentar · {manos.length}</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {manos
              .slice()
              .sort((a, b) => a.entro - b.entro)
              .map((g) => (
                <div key={g.uid} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{g.nombre}</span>
                  <Boton variante="fuerte" onClick={() => void darLaPalabra(canal, g.uid, true)}>
                    Darle la palabra
                  </Boton>
                </div>
              ))}
          </div>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Etiqueta>en la sala</Etiqueta>
        <div className="mt-3 flex flex-col gap-1.5">
          {gente
            .slice()
            .sort((a, b) => a.entro - b.entro)
            .map((g) => {
              const suena = g.uid === quienSoy.uid ? sonando.yo : sonando.cuentas.has(g.uid);
              const puedeHablar = g.palabra || g.uid === sala?.anfitrion;
              return (
                <div key={g.uid}>
                  <button
                    onClick={() =>
                      esAnfitrion && g.uid !== quienSoy.uid
                        ? setTocando(tocando === g.uid ? null : g.uid)
                        : undefined
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left"
                  >
                    {/*
                      El aro verde es el indicador de quien habla. Va en el
                      retrato y no en un icono aparte porque lo que se busca con
                      la vista es la cara, no una lista de estados.
                    */}
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full border bg-superficie-alta text-sm transition ${
                        suena ? "border-logro ring-2 ring-logro/60" : "border-borde text-tenue"
                      }`}
                    >
                      {g.foto ? (
                        <img
                          src={g.foto}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="size-full rounded-full object-cover"
                        />
                      ) : (
                        (g.nombre.trim().charAt(0).toUpperCase() || "·")
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {g.nombre}
                        {g.uid === quienSoy.uid ? " · tú" : ""}
                      </span>
                      <span className="block truncate text-xs text-tenue">
                        {g.uid === sala?.anfitrion
                          ? "anfitrión"
                          : puedeHablar
                            ? "tiene la palabra"
                            : g.mano
                              ? "levantó la mano"
                              : "escuchando"}
                      </span>
                    </span>
                    {g.mano && !puedeHablar ? (
                      <span className="shrink-0 text-acento" aria-label="levantó la mano">
                        ✋
                      </span>
                    ) : null}
                  </button>

                  {/* Lo que puede hacer el anfitrión, y sólo al tocar a alguien. */}
                  {tocando === g.uid ? (
                    <div className="mt-1 mb-2 ml-12 flex flex-col gap-2">
                      <Boton
                        ancho
                        onClick={() => {
                          void darLaPalabra(canal, g.uid, !g.palabra);
                          setTocando(null);
                        }}
                      >
                        {g.palabra ? "Quitarle la palabra" : "Darle la palabra"}
                      </Boton>
                      <Boton
                        variante="fallo"
                        ancho
                        onClick={() => {
                          void expulsar(canal, g.uid);
                          setTocando(null);
                        }}
                      >
                        Sacarlo de la sala
                      </Boton>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
        {conLaPalabra.length === 1 && gente.length > 3 ? (
          <p className="mt-3 text-xs leading-relaxed text-tenue">
            Sólo habla el anfitrión. Los demás escuchan hasta que él dé la palabra —
            treinta micrófonos abiertos no son un devocional.
          </p>
        ) : null}
      </Tarjeta>

      {/* Los botones, abajo y al alcance del pulgar. */}
      <div className="flex flex-col gap-2">
        {habla ? (
          <Boton
            variante={microAbierto ? "logro" : "normal"}
            ancho
            onClick={() => {
              const nuevo = !microAbierto;
              setMicroAbierto(nuevo);
              void miMicro(nuevo);
            }}
          >
            {microAbierto ? "Cerrar mi micrófono" : "Abrir mi micrófono"}
          </Boton>
        ) : (
          <Boton
            variante={yo?.mano ? "fuerte" : "normal"}
            ancho
            onClick={() => void mano(canal, !yo?.mano)}
          >
            {yo?.mano ? "Bajar la mano" : "Levantar la mano para comentar"}
          </Boton>
        )}

        <Boton
          ancho
          onClick={() => {
            const nuevo = !altavoz;
            setAltavoz(nuevo);
            void porElAltavoz(nuevo);
          }}
        >
          {altavoz ? "Pasar al auricular" : "Poner el altavoz"}
        </Boton>

        <Boton variante="fallo" ancho onClick={onSalir}>
          Salir de la sala
        </Boton>
      </div>
    </div>
  );
}

/**
 * El motivo, dicho para una persona.
 *
 * Los que vienen de la Cloud Function ya están escritos así —«la sala está
 * cerrada»—, y los de aquí hay que traducirlos: `sin-microfono` no le dice nada
 * a nadie.
 */
function comoSeDice(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("sin-microfono")) {
    return "Sin permiso del micrófono no se puede entrar a hablar. Puedes dárselo en los ajustes del móvil.";
  }
  if (m.includes("solo-en-la-app")) return "Las salas funcionan en la app de Android.";
  if (m.includes("sin-cuenta")) return "Hace falta entrar con tu cuenta.";
  if (m.includes("no-se-pudo-entrar")) {
    return "No se pudo conectar con la sala. Mira tu conexión y vuelve a probar.";
  }
  // Lo que venga del portero ya está en español y dice el motivo de verdad.
  return m || "No se pudo entrar.";
}
