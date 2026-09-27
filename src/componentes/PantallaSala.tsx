import { useEffect, useMemo, useRef, useState } from "react";
import type { Dentro, Sala } from "@/logica/sala";
import {
  abrirSala,
  alCaducarElToken,
  cambiarDePapel,
  darLaPalabra,
  entrarEnSala,
  expulsar,
  hayVoz,
  leerSala,
  mano,
  miMicro,
  ponerMicLibre,
  porElAltavoz,
  renovarToken,
  salirDeSala,
  verQuienEsta,
  verQuienHabla,
  verSala,
} from "@/logica/sala";
import { puedoModerar } from "@/logica/muro";
import { llamarALaComunidad } from "@/logica/timbre";
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
  nombreSiHayQueAbrirla,
  quienSoy,
  onSalir,
}: {
  canal: string;
  /**
   * Cómo se llamaría la sala si todavía no existe.
   *
   * Viene de la reunión publicada en `comunidad.json`. Una reunión dice **a qué
   * hora** hay devocional; la sala es **el sitio**, y alguien tiene que abrirla.
   * Hasta que esto existió, tocar una reunión a su hora contestaba «esa sala no
   * existe», que es verdad y no sirve de nada: el anfitrión estaba delante,
   * queriendo empezar, y la app le mandaba a buscar otro botón.
   */
  nombreSiHayQueAbrirla?: string;
  quienSoy: { uid: string; nombre: string; usuario: string; foto?: string };
  onSalir: () => void;
}) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [gente, setGente] = useState<Dentro[]>([]);
  const [estado, setEstado] = useState<
    "entrando" | "dentro" | "fuera" | "sin-abrir"
  >("entrando");
  /** Si esta persona puede abrir la sala que falta. */
  const [puedoAbrirla, setPuedoAbrirla] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
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
  const [llamando, setLlamando] = useState(false);
  const [avisoLlamada, setAvisoLlamada] = useState("");

  /**
   * El papel que teníamos la última vez.
   *
   * Hace falta para no pedir un token nuevo en cada repintado: sólo cuando el
   * anfitrión cambia `palabra` de verdad. Sin esto, cualquier cambio en la lista
   * —alguien que entra, una mano que se levanta— dispararía una llamada a la
   * Cloud Function por persona y por cambio.
   */
  const palabraAnterior = useRef<boolean | null>(null);

  /**
   * Entrar de verdad. Se usa al llegar y después de abrir la sala que faltaba.
   *
   * Devuelve si se pudo, para que quien la llama sepa si seguir.
   */
  const entrar = async (sigoAqui: () => boolean) => {
    try {
      const r = await entrarEnSala(canal, quienSoy);
      if (!sigoAqui()) {
        // Se salió de la pantalla mientras entrábamos. Hay que soltar el audio
        // o queda un micrófono abierto en una sala que nadie mira.
        await salirDeSala();
        return;
      }
      setHabla(r.habla);
      setEsAnfitrion(r.esAnfitrion);
      palabraAnterior.current = r.habla;
      setEstado("dentro");
    } catch (e) {
      if (!sigoAqui()) return;
      setError(comoSeDice(e));
      setEstado("fuera");
    }
  };

  // ── entrar, y salir al irse ────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    const sigoAqui = () => vivo;
    void (async () => {
      let laSala;
      try {
        laSala = await leerSala(canal);
      } catch (e) {
        if (!vivo) return;
        // Se distingue el permiso de la red, y no es un detalle. El 27-09-2026
        // Alex vio «mira tu conexión» con la conexión perfecta: lo que fallaba
        // eran unas reglas de Firestore sin desplegar. Un mensaje que manda a
        // mirar donde no está el fallo cuesta más que ninguno.
        const codigo = (e as { code?: string })?.code ?? "";
        setError(
          codigo.includes("permission-denied")
            ? "La app no tiene permiso para mirar esta sala. Avisa a quien lleva la app: es cosa del servidor, no tuya."
            : "No se pudo mirar la sala. Mira tu conexión.",
        );
        setEstado("fuera");
        return;
      }
      if (!vivo) return;
      setSala(laSala);

      // La sala no existe todavía. Si es una reunión programada y quien llega
      // puede abrirla, se le ofrece en vez de darle un error: es exactamente el
      // momento en que la quiere abrir.
      if (!laSala) {
        const puedo = await puedoModerar().catch(() => false);
        if (!vivo) return;
        setPuedoAbrirla(puedo && !!nombreSiHayQueAbrirla);
        setEstado("sin-abrir");
        return;
      }

      await entrar(sigoAqui);
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

  // ── la sala misma: si se cierra, si se sueltan los micrófonos ──────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let dejar: (() => void) | null = null;
    let vivo = true;
    void verSala(canal, (nueva) => vivo && setSala(nueva)).then((f) => {
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

  /**
   * El anfitrión soltó o recogió los micrófonos.
   *
   * El permiso de hablar viaja firmado en el token, así que hay que pedir otro.
   * Y al recibirlo con los micrófonos libres, **el propio queda cerrado**: como
   * en WhatsApp, cada uno lo abre cuando le toca. Treinta micrófonos que se
   * abren solos a la vez no es una lectura, es un ruido. Distinto de cuando el
   * anfitrión le da la palabra a alguien en concreto, que sí se abre — ahí se la
   * dio para que hable ya.
   */
  const micLibreAnterior = useRef<boolean | null>(null);
  useEffect(() => {
    if (estado !== "dentro" || esAnfitrion || !sala) return;
    const libre = sala.micLibre === true;
    if (micLibreAnterior.current === null) {
      micLibreAnterior.current = libre;
      return;
    }
    if (micLibreAnterior.current === libre) return;
    micLibreAnterior.current = libre;
    void (async () => {
      try {
        const ahoraHabla = await cambiarDePapel(canal);
        setHabla(ahoraHabla);
        setMicroAbierto(false);
        if (ahoraHabla) await miMicro(false);
      } catch {
        setError("No se pudo cambiar tu turno. Sal y vuelve a entrar.");
      }
    })();
  }, [sala?.micLibre, sala, canal, estado, esAnfitrion]);

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

  // ── la sala de una reunión que todavía nadie ha abierto ────────────────
  if (estado === "sin-abrir") {
    return (
      <Tarjeta className={puedoAbrirla ? "border-acento/50" : undefined}>
        <Etiqueta>{nombreSiHayQueAbrirla ?? "la sala"}</Etiqueta>
        {puedoAbrirla ? (
          <>
            <p className="mt-2 text-sm leading-relaxed">
              Esta reunión todavía no está abierta. Ábrela y los hermanos la verán
              en «Juntos» al momento.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-tenue">
              Entrarás tú hablando y los demás escuchando. Para que alguien
              comente, levanta la mano y tú le das la palabra.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Boton
                variante="fuerte"
                ancho
                deshabilitado={abriendo}
                onClick={async () => {
                  setAbriendo(true);
                  setError("");
                  try {
                    await abrirSala(canal, nombreSiHayQueAbrirla!, "devocional");
                    setSala(await leerSala(canal));
                    setEstado("entrando");
                    // Ya no se puede volver atrás desde aquí, así que el guardia
                    // es que la pantalla siga montada.
                    await entrar(() => true);
                  } catch {
                    setError("No se pudo abrir la sala. Mira tu conexión.");
                    setAbriendo(false);
                  }
                }}
              >
                {abriendo ? "Abriendo…" : "Abrir la reunión y entrar"}
              </Boton>
              <Boton ancho onClick={onSalir}>
                Ahora no
              </Boton>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed">
              Todavía no la han abierto. Vuelve cuando empiece — en cuanto el
              anfitrión la abra, aparece en «Juntos».
            </p>
            <div className="mt-3">
              <Boton ancho onClick={onSalir}>
                Volver
              </Boton>
            </div>
          </>
        )}
        {error ? (
          <p className="mt-2 text-sm leading-relaxed text-fallo">{error}</p>
        ) : null}
      </Tarjeta>
    );
  }

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
              : sala?.micLibre && !esAnfitrion
                ? "Micrófonos libres. Abre el tuyo cuando te toque."
                : "Tienes la palabra, pero tu micrófono está cerrado."
            : "Estás escuchando. Levanta la mano para comentar."}
        </p>

        {error ? (
          <p className="mt-2 text-sm leading-relaxed text-fallo">{error}</p>
        ) : null}
      </Tarjeta>

      {/*
        Los micrófonos, para el anfitrión: con permiso o libres.

        Alex, el 27-09-2026: «me gusta que el que quiera abrir el micrófono pida
        permiso. Pero cuando viene la lectura, todos deben poder abrir y cerrar
        el micrófono sin mi permiso porque sería muy tedioso. Esa opción debe
        estar a un lado y yo elijo cuándo se activa».

        Va aquí, a la vista, y no en un menú: se cambia varias veces en un mismo
        devocional — libres para leer por turnos, con permiso para comentar.
      */}
      {/*
        Llamar a la comunidad: que suenen los móviles de los apuntados.

        Es lo que Alex pidió como VITAL el 27-09-2026. Va arriba del todo de lo
        que puede hacer el anfitrión, porque es lo primero que hace al abrir:
        abre, llama, y espera a que entren. Lo decide el portero: si quien
        toca no modera, vuelve con su motivo escrito.
      */}
      {esAnfitrion && sala?.tipo !== "llamada" ? (
        <Tarjeta className="border-acento/50">
          <Etiqueta>la comunidad</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Hace sonar el móvil de todos los que se apuntaron, aunque tengan la
            app cerrada.
          </p>
          <div className="mt-3">
            <Boton
              variante="fuerte"
              ancho
              deshabilitado={llamando}
              onClick={async () => {
                setLlamando(true);
                setAvisoLlamada("");
                const r = await llamarALaComunidad(canal, sala?.nombre ?? "Devocional");
                setAvisoLlamada(
                  r.enviado ? "Llamando. Les está sonando ahora mismo." : r.porque,
                );
                setLlamando(false);
              }}
            >
              {llamando ? "Llamando…" : "Llamar a la comunidad"}
            </Boton>
          </div>
          {avisoLlamada ? (
            <p className="mt-2 text-xs leading-relaxed text-acento">{avisoLlamada}</p>
          ) : null}
        </Tarjeta>
      ) : null}

      {esAnfitrion && sala?.tipo !== "llamada" ? (
        <Tarjeta>
          <Etiqueta>micrófonos de los demás</Etiqueta>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Boton
              variante={sala?.micLibre ? "normal" : "fuerte"}
              ancho
              onClick={() => void ponerMicLibre(canal, false)}
            >
              Con permiso
            </Boton>
            <Boton
              variante={sala?.micLibre ? "logro" : "normal"}
              ancho
              onClick={() => void ponerMicLibre(canal, true)}
            >
              Libres
            </Boton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            {sala?.micLibre
              ? "Cualquiera puede abrir el suyo. Para la lectura por turnos."
              : "Levantan la mano y tú das la palabra. Para comentar sin pisarse."}
          </p>
        </Tarjeta>
      ) : null}

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

      {/*
        Los botones, como en una llamada de WhatsApp: tres redondos, el del
        micrófono en medio, el de colgar en rojo. Alex, el 27-09-2026: «está
        bien que diga por escrito cuando está abierto o cerrado, pero más
        importante es que se vea gráficamente muy parecido al de WhatsApp. Así
        los que lo vean se van a familiarizar fácilmente». El texto se queda
        arriba, en la tarjeta; aquí manda el icono.

        En el medio va el micrófono si puedes hablar, y la mano si no: es el
        mismo sitio para «lo que puedes hacer ahora», y el pulgar lo aprende.
      */}
      <div className="flex items-start justify-center gap-6 pt-2">
        <BotonRedondo
          etiqueta={altavoz ? "Altavoz" : "Auricular"}
          activo={altavoz}
          onClick={() => {
            const nuevo = !altavoz;
            setAltavoz(nuevo);
            void porElAltavoz(nuevo);
          }}
        >
          <IconoAltavoz apagado={!altavoz} />
        </BotonRedondo>

        {habla ? (
          <BotonRedondo
            etiqueta={microAbierto ? "Silenciar" : "Abrir micro"}
            activo={microAbierto}
            grande
            onClick={() => {
              const nuevo = !microAbierto;
              setMicroAbierto(nuevo);
              void miMicro(nuevo);
            }}
          >
            <IconoMicro tachado={!microAbierto} />
          </BotonRedondo>
        ) : (
          <BotonRedondo
            etiqueta={yo?.mano ? "Bajar la mano" : "Pedir la palabra"}
            activo={!!yo?.mano}
            grande
            onClick={() => void mano(canal, !yo?.mano)}
          >
            <IconoMano />
          </BotonRedondo>
        )}

        <BotonRedondo etiqueta="Salir" peligro onClick={onSalir}>
          <IconoColgar />
        </BotonRedondo>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ los botones

/**
 * Un botón redondo con su etiqueta debajo, como los de una llamada.
 *
 * Los iconos van en SVG dentro del código y no como emojis: un emoji cambia de
 * dibujo según el móvil, y lo que se busca aquí es justo lo contrario — que el
 * micrófono se vea igual que en la app que ya conocen.
 */
function BotonRedondo({
  children,
  etiqueta,
  activo,
  grande,
  peligro,
  onClick,
}: {
  children: React.ReactNode;
  etiqueta: string;
  activo?: boolean;
  grande?: boolean;
  peligro?: boolean;
  onClick: () => void;
}) {
  const tamano = grande ? "size-[72px]" : "size-14";
  const color = peligro
    ? "bg-fallo text-fondo"
    : activo
      ? "bg-logro text-fondo"
      : "bg-superficie-alta text-texto border border-borde";
  return (
    <button onClick={onClick} className="flex w-20 flex-col items-center gap-1.5">
      <span
        className={`flex ${tamano} items-center justify-center rounded-full transition active:scale-95 ${color}`}
      >
        {children}
      </span>
      <span className="text-center text-[11px] leading-tight text-tenue">{etiqueta}</span>
    </button>
  );
}

function IconoMicro({ tachado }: { tachado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      {tachado ? <path d="M4 4l16 16" strokeWidth={2.5} /> : null}
    </svg>
  );
}

function IconoAltavoz({ apagado }: { apagado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {apagado ? (
        <path d="M17 9l4 6M21 9l-4 6" />
      ) : (
        <>
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function IconoMano() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 13V9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3.6 14a1.6 1.6 0 0 1 2.6-1.8L8 14" />
    </svg>
  );
}

function IconoColgar() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
      <path d="M12 9c-2.6 0-5 .5-7.2 1.5a2 2 0 0 0-1.1 2.3l.6 2.2a1.5 1.5 0 0 0 1.9 1l2.6-.9a1.5 1.5 0 0 0 1-1.3l.1-1.6a12 12 0 0 1 4.2 0l.1 1.6a1.5 1.5 0 0 0 1 1.3l2.6.9a1.5 1.5 0 0 0 1.9-1l.6-2.2a2 2 0 0 0-1.1-2.3A17 17 0 0 0 12 9z" />
    </svg>
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
