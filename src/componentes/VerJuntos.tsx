import { useEffect, useRef, useState } from "react";
import { ahoraServidor, ponerVideo, volumenMultimedia, type Sala, type VideoJuntos } from "@/logica/sala";
import { Boton, Entrada, Etiqueta, Tarjeta } from "./piezas";

/**
 * «Ver juntos»: un video de YouTube que todos ven a la par, dentro de la sala.
 *
 * Alex, 28-09-2026: «compartir pantalla para ver, por ejemplo, un video de
 * YouTube. Si hay algún reproductor integrado y que todos escuchen lo que
 * coloco, mejor aún». La investigación (docs/investigacion/video-pantalla-
 * reproductor.md) lo dejó claro: compartir pantalla se vería a saltos, sonaría
 * a teléfono y choca con los términos de YouTube. Esto no: cada móvil reproduce
 * el video con el reproductor oficial, y el anfitrión manda play, pausa y el
 * segundo. No cuesta nada en Agora ni pide permisos.
 *
 * ── El modelo (tras la revisión de la 6.27) ───────────────────────────────
 *
 * - **El anfitrión manda.** Su reproductor no se corrige nunca (sólo al abrirse
 *   y al volver de segundo plano). Publica cuando se APARTA de lo que dice la
 *   sala —play, pausa, un salto, el final—; lo que coincide es el eco de sus
 *   propias órdenes y no se vuelve a publicar.
 * - **Los demás siguen.** Se recolocan si van a más de 3 s, pero con paciencia:
 *   mientras un salto está cargando no se vuelve a saltar, y se adelanta lo que
 *   tardó en arrancar el anterior. Un video terminado no se vuelve a empezar.
 * - **Fuera de la vista, pausa.** Con la app detrás, el reproductor fuera de
 *   la pantalla o algo encima, el video se pausa aquí (sin decírselo a nadie):
 *   YouTube no deja que suene sin verse. Al volver, se pone donde van.
 *
 * El micrófono lo cierra la sala mientras suena (PantallaSala), no esto.
 */

// ── La API del reproductor de YouTube, lo justo ─────────────────────────────
type Reproductor = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(segundos: number, permitirBuscar: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume(v: number): void;
  destroy(): void;
};
type ApiYouTube = {
  Player: new (
    elemento: HTMLElement,
    opciones: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => Reproductor;
};
const TERMINADO = 0;
const EN_MARCHA = 1;
const EN_PAUSA = 2;
const CARGANDO = 3;

type VentanaYT = { YT?: (ApiYouTube & { Player?: unknown }) | undefined; onYouTubeIframeAPIReady?: () => void };
let cargando: Promise<ApiYouTube> | null = null;
/**
 * Carga la API una sola vez para toda la app, con plazo: si falla (la segunda
 * parte de YouTube no llega), se limpia para poder reintentar.
 */
function apiYouTube(): Promise<ApiYouTube> {
  const w = window as unknown as VentanaYT;
  if (w.YT?.Player) return Promise.resolve(w.YT as ApiYouTube);
  if (cargando) return cargando;
  cargando = new Promise((bien, mal) => {
    const s = document.createElement("script");
    let plazo = 0;
    const fracaso = () => {
      window.clearTimeout(plazo);
      if (w.YT?.Player) return bien(w.YT as ApiYouTube);
      cargando = null;
      // El cargador de YouTube se salta una segunda carga si ve YT a medias.
      w.YT = undefined;
      document.getElementById("www-widgetapi-script")?.remove();
      s.remove();
      mal(new Error("sin-youtube"));
    };
    const antes = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(plazo);
      antes?.();
      bien(w.YT as ApiYouTube);
    };
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = fracaso;
    plazo = window.setTimeout(fracaso, 20_000);
    document.head.appendChild(s);
  });
  return cargando;
}

/** El identificador de un enlace de YouTube (watch, youtu.be, shorts, embed, live), o null. */
export function idDeYouTube(texto: string): string | null {
  const t = texto.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return /^[A-Za-z0-9_-]{11}/.exec(u.pathname.slice(1))?.[0] ?? null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
      return m?.[1] ?? null;
    }
  } catch {
    // No es un enlace.
  }
  return null;
}

/** Dónde tiene que ir el video ahora, según lo que puso el anfitrión. */
export function dondeVa(v: VideoJuntos, ahora = ahoraServidor()): number {
  return v.estado === "play" ? v.pos + Math.max(0, ahora - v.en) / 1000 : v.pos;
}

/**
 * Si el reproductor de este móvil se aparta de la sala lo bastante como para
 * que sea una acción del anfitrión (y no el eco de sus propias órdenes).
 */
export function seAparta(
  estadoReproductor: number,
  va: number,
  sala: VideoJuntos,
  ahora = ahoraServidor(),
): VideoJuntos["estado"] | null {
  if (estadoReproductor === EN_MARCHA) {
    if (sala.estado === "play" && Math.abs(va - dondeVa(sala, ahora)) <= TOLERANCIA_S) return null;
    return "play";
  }
  if (estadoReproductor === EN_PAUSA || estadoReproductor === TERMINADO) {
    if (sala.estado === "pausa" && Math.abs(va - sala.pos) <= TOLERANCIA_S) return null;
    return "pausa";
  }
  return null;
}

/** Más de esto de diferencia y se recoloca. Con menos, saltaría sin parar con mala red. */
const TOLERANCIA_S = 3;

export function VerJuntos({ canal, sala, esAnfitrion }: { canal: string; sala: Sala; esAnfitrion: boolean }) {
  const video = sala.video;
  const [enlace, setEnlace] = useState("");
  const [aviso, setAviso] = useState("");
  const [volumen, setVolumen] = useState(80);
  /** El reproductor no pudo arrancar solo (el navegador pide un toque). */
  const [hayQueTocar, setHayQueTocar] = useState(false);
  const [fallo, setFallo] = useState("");
  /** El volumen multimedia del móvil está a cero: el video no se oiría. */
  const [mudo, setMudo] = useState(false);
  const [intento, setIntento] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const reproductor = useRef<Reproductor | null>(null);
  const listo = useRef(false);
  const idCargado = useRef<string | null>(null);
  const volumenAhora = useRef(volumen);
  volumenAhora.current = volumen;
  /** Lo último que puso la sala, para los avisos del reproductor. */
  const ultimo = useRef<VideoJuntos | undefined>(video);
  ultimo.current = video;
  const anfitrionAhora = useRef(esAnfitrion);
  anfitrionAhora.current = esAnfitrion;
  /** Pausado aquí porque no se ve (no porque lo pidiera nadie). */
  const pausadoPorOculto = useRef(false);
  /** Un salto hecho para seguir a la sala que aún no ha arrancado: cuándo. */
  const saltoPendiente = useRef<number | null>(null);
  /** Lo que tardó en arrancar el último salto (s): se adelanta el siguiente. */
  const latencia = useRef(1.5);
  const temporizadores = useRef<number[]>([]);
  const despues = (f: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      temporizadores.current = temporizadores.current.filter((x) => x !== t);
      f();
    }, ms);
    temporizadores.current.push(t);
  };
  const limpiarTemporizadores = () => {
    temporizadores.current.forEach((t) => window.clearTimeout(t));
    temporizadores.current = [];
  };

  /** Si el reproductor se ve de verdad: la app delante, en pantalla y sin nada encima. */
  const aLaVista = (): boolean => {
    if (document.visibilityState !== "visible") return false;
    const el = caja.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight || r.height < 100) return false;
    const x = r.left + r.width / 2;
    // Tres alturas: con dos libres, más de la mitad se ve y no hay nada encima.
    const libres = [0.25, 0.5, 0.75].filter((f) => {
      const y = r.top + r.height * f;
      if (y < 0 || y > window.innerHeight) return false;
      const e = document.elementFromPoint(x, y);
      return !!e && (el.contains(e) || e === el);
    });
    return libres.length >= 2;
  };

  // ── crear el reproductor cuando hay video ────────────────────────────────
  useEffect(() => {
    if (!video?.id || !caja.current) return;
    let vivo = true;
    if (reproductor.current && idCargado.current === video.id) return;
    void apiYouTube()
      .then((YT) => {
        if (!vivo || !caja.current) return;
        reproductor.current?.destroy();
        listo.current = false;
        idCargado.current = video.id;
        const hueco = document.createElement("div");
        caja.current.replaceChildren(hueco);
        reproductor.current = new YT.Player(hueco, {
          videoId: video.id,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            rel: 0,
            // Los mandos, sólo al anfitrión: los demás siguen lo que él haga.
            controls: esAnfitrion ? 1 : 0,
            disablekb: esAnfitrion ? 0 : 1,
            origin: window.location.origin,
            start: Math.floor(dondeVa(video)),
          },
          events: {
            onReady: () => {
              listo.current = true;
              reproductor.current?.setVolume(volumenAhora.current);
              seguir(true);
            },
            onStateChange: (e) => alCambiarEstado(e.data),
            onError: (e) =>
              setFallo(
                e.data === 101 || e.data === 150
                  ? "Este video no deja verse fuera de YouTube. Elige otro."
                  : `No se pudo cargar el video (código ${e.data}).`,
              ),
          },
        });
      })
      .catch(() => setFallo("No se pudo cargar YouTube. Mira tu conexión y vuelve a probar."));
    return () => {
      vivo = false;
    };
  }, [video?.id, intento]);

  // Al quitarse el video, o al salir, fuera el reproductor y sus temporizadores.
  const soltar = () => {
    limpiarTemporizadores();
    reproductor.current?.destroy();
    reproductor.current = null;
    idCargado.current = null;
    listo.current = false;
  };
  useEffect(() => {
    if (video) return;
    soltar();
    setFallo("");
    setHayQueTocar(false);
  }, [!!video]);
  useEffect(() => soltar, []);

  /**
   * Poner el reproductor donde dice la sala. Para quien sigue, en cada cambio y
   * cada 4 s; para el anfitrión, sólo al abrirse y al volver (`forzar`).
   */
  const seguir = (forzar = false) => {
    const r = reproductor.current;
    const v = ultimo.current;
    if (!r || !listo.current || !v) return;
    if (anfitrionAhora.current && !forzar) return;
    if (!aLaVista()) {
      // No se ve: aquí no suena, y al volver a verse se recoloca.
      if (r.getPlayerState() === EN_MARCHA || r.getPlayerState() === CARGANDO) {
        pausadoPorOculto.current = true;
        r.pauseVideo();
      }
      return;
    }
    pausadoPorOculto.current = false;
    const estado = r.getPlayerState();
    const debe = dondeVa(v);
    const va = r.getCurrentTime();
    const dur = r.getDuration();
    if (v.estado === "pausa") {
      if (Math.abs(va - debe) > TOLERANCIA_S) r.seekTo(debe, true);
      if (estado !== EN_PAUSA && estado !== TERMINADO) r.pauseVideo();
      return;
    }
    // En marcha. Un video que ya terminó, y la sala también pasó del final, no
    // se vuelve a empezar (playVideo lo arrancaría desde el principio).
    if (dur > 0 && debe >= dur - 1) {
      if (estado === EN_MARCHA) r.pauseVideo();
      return;
    }
    // Un salto propio que aún está cargando: paciencia, no otro salto.
    if (saltoPendiente.current && Date.now() - saltoPendiente.current < 10_000 && estado === CARGANDO) return;
    if (Math.abs(va - debe) > TOLERANCIA_S) {
      saltoPendiente.current = Date.now();
      r.seekTo(Math.min(debe + latencia.current, dur > 0 ? dur - 1 : debe + latencia.current), true);
    }
    if (estado !== EN_MARCHA && estado !== CARGANDO) {
      r.playVideo();
      despues(() => {
        const e = reproductor.current?.getPlayerState();
        if (ultimo.current?.estado === "play" && e !== EN_MARCHA && e !== CARGANDO && aLaVista()) setHayQueTocar(true);
      }, 2500);
    }
  };

  // Quien sigue: cada vez que el anfitrión mueve algo, y cada 4 s. El anfitrión
  // no se corrige a sí mismo.
  useEffect(() => {
    if (!video) return;
    seguir();
    const t = window.setInterval(() => seguir(), 4000);
    return () => window.clearInterval(t);
  }, [video?.estado, video?.pos, video?.en, esAnfitrion]);

  /** Publicar lo que hace el anfitrión (si se aparta de la sala). */
  const publicar = (estado: VideoJuntos["estado"], pos: number) => {
    const v = ultimo.current;
    if (!v) return;
    void ponerVideo(canal, { id: v.id, estado, pos: Math.max(0, pos), en: ahoraServidor() }).catch(() =>
      setAviso("No se pudo avisar a los demás. Mira tu conexión."),
    );
  };

  const alCambiarEstado = (estado: number) => {
    const r = reproductor.current;
    if (!r) return;
    // Nunca suena sin verse: si arranca con la app detrás, se para aquí.
    if (estado === EN_MARCHA && !aLaVista()) {
      pausadoPorOculto.current = true;
      r.pauseVideo();
      return;
    }
    if (estado === EN_MARCHA) {
      setHayQueTocar(false);
      // Un salto propio que arrancó: se mide lo que tardó.
      if (saltoPendiente.current) {
        latencia.current = Math.min(5, Math.max(0.5, (Date.now() - saltoPendiente.current) / 1000));
        saltoPendiente.current = null;
      }
    }
    if (!anfitrionAhora.current || !listo.current || pausadoPorOculto.current) return;
    if (document.visibilityState !== "visible") return;
    const v = ultimo.current;
    if (!v) return;
    const va = estado === TERMINADO ? r.getDuration() : r.getCurrentTime();
    const nuevo = seAparta(estado, va, v);
    if (nuevo) publicar(nuevo, va);
  };

  // El anfitrión salta con la barra sin pausar: va por otro sitio del que la
  // sala cree. Se publica la posición nueva (él es la referencia).
  useEffect(() => {
    if (!esAnfitrion || !video) return;
    const t = window.setInterval(() => {
      const r = reproductor.current;
      const v = ultimo.current;
      if (!r || !v || !listo.current || v.estado !== "play" || !aLaVista()) return;
      if (r.getPlayerState() !== EN_MARCHA) return;
      if (Math.abs(r.getCurrentTime() - dondeVa(v)) > TOLERANCIA_S) publicar("play", r.getCurrentTime());
    }, 2000);
    return () => window.clearInterval(t);
  }, [esAnfitrion, !!video]);

  // Con la app en segundo plano, se pausa aquí siempre (esté sonando o
  // cargando). Al volver, se pone donde van los demás (también el anfitrión,
  // cuya pausa por ocultarse no se publicó).
  useEffect(() => {
    let volver = 0;
    const cambio = () => {
      const r = reproductor.current;
      if (!r || !listo.current) return;
      window.clearTimeout(volver);
      if (document.visibilityState !== "visible") {
        pausadoPorOculto.current = true;
        r.pauseVideo();
      } else {
        volver = window.setTimeout(() => seguir(true), 300);
      }
    };
    document.addEventListener("visibilitychange", cambio);
    return () => {
      window.clearTimeout(volver);
      document.removeEventListener("visibilitychange", cambio);
    };
  }, []);

  // El volumen multimedia a cero hace que el video no se oiga (la voz de la
  // sala va por otro volumen). Se mira al sonar.
  useEffect(() => {
    if (video?.estado !== "play") return;
    void volumenMultimedia()
      .then((v) => setMudo(!!v && v.nivel === 0))
      .catch(() => {});
  }, [video?.estado]);

  const poner = async () => {
    const id = idDeYouTube(enlace);
    if (!id) {
      setAviso("Eso no parece un enlace de YouTube.");
      return;
    }
    setAviso("");
    setFallo("");
    try {
      await ponerVideo(canal, { id, estado: "pausa", pos: 0, en: ahoraServidor() });
      setEnlace("");
    } catch {
      setAviso("No se pudo poner el video. Mira tu conexión.");
    }
  };

  // ── sin video: el anfitrión puede poner uno ─────────────────────────────
  if (!video) {
    if (!esAnfitrion) return null;
    return (
      <Tarjeta>
        <Etiqueta>ver juntos</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed text-tenue">
          Pega un enlace de YouTube y todos lo verán a la par, cada uno en su móvil. Tú lo pones en marcha, lo
          pausas o lo adelantas, y los demás te siguen.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void poner();
          }}
        >
          <Entrada
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://youtu.be/…"
            inputMode="url"
            aria-label="Enlace de YouTube"
          />
          <Boton tipo="submit" deshabilitado={!enlace.trim()}>
            Poner
          </Boton>
        </form>
        {aviso ? <p className="mt-2 text-sm text-fallo">{aviso}</p> : null}
      </Tarjeta>
    );
  }

  // ── con video ────────────────────────────────────────────────────────────
  return (
    <Tarjeta className="!p-3">
      <Etiqueta>ver juntos</Etiqueta>
      {/* El reproductor: a lo ancho y 16:9 (nunca por debajo de 200 px de alto),
          sin nada encima. */}
      <div
        className="relative mt-2 w-full overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: "16 / 9", minHeight: 200 }}
      >
        <div ref={caja} className="absolute inset-0" />
      </div>
      {fallo ? (
        <div className="mt-2">
          <p className="text-sm text-fallo">{fallo}</p>
          <div className="mt-2">
            <Boton
              onClick={() => {
                setFallo("");
                soltar();
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </Boton>
          </div>
        </div>
      ) : null}
      {hayQueTocar ? (
        <div className="mt-2">
          <Boton
            variante="fuerte"
            ancho
            onClick={() => {
              reproductor.current?.playVideo();
              setHayQueTocar(false);
              despues(() => seguir(true), 500);
            }}
          >
            ▶ Ver con los demás
          </Boton>
        </div>
      ) : null}
      {mudo ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-acento/40 px-3 py-2 text-xs">
          <span className="flex-1">El volumen multimedia de tu móvil está a cero: el video no se oye.</span>
          <Boton
            onClick={() =>
              void volumenMultimedia(0.6)
                .then(() => setMudo(false))
                .catch(() => {})
            }
          >
            Subirlo
          </Boton>
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-tenue" aria-hidden>
          🔊
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={volumen}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolumen(v);
            if (listo.current) reproductor.current?.setVolume(v);
          }}
          className="flex-1 accent-[var(--color-acento)]"
          aria-label="Volumen del video"
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-tenue">
        {video.estado === "play"
          ? "Mientras suena, los micrófonos se cierran para que no haya eco. Para hablar, pausa."
          : esAnfitrion
            ? "Dale al play en el video: todos lo verán a la vez."
            : "El anfitrión lo pondrá en marcha."}
      </p>
      {esAnfitrion ? (
        <div className="mt-2">
          <Boton
            variante="fantasma"
            ancho
            onClick={() => void ponerVideo(canal, null).catch(() => setAviso("No se pudo quitar. Mira tu conexión."))}
          >
            Quitar el video
          </Boton>
        </div>
      ) : null}
      {aviso ? <p className="mt-2 text-sm text-fallo">{aviso}</p> : null}
    </Tarjeta>
  );
}
