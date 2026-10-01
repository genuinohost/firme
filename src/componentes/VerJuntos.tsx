import { useEffect, useRef, useState } from "react";
import { ahoraServidor, ponerVideo, volumenMultimedia, type Sala, type VideoJuntos } from "@/logica/sala";
import {
  CARGANDO,
  EN_MARCHA,
  EN_PAUSA,
  TERMINADO,
  TOLERANCIA_S,
  decidir,
  dondeVa as dondeVaEn,
  idDeYouTube,
  medirLatencia,
  seAparta as seApartaEn,
  terminoPorTiempo,
} from "@/logica/verJuntos";
import { Boton, Entrada, Etiqueta, Tarjeta } from "./piezas";

export { idDeYouTube };
/** Dónde tiene que ir el video ahora (con la hora del servidor por defecto). */
export const dondeVa = (v: VideoJuntos, ahora = ahoraServidor()) => dondeVaEn(v, ahora);
export const seAparta = (estado: number, va: number, sala: VideoJuntos, ahora = ahoraServidor()) =>
  seApartaEn(estado, va, sala, ahora);

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
 * ── El modelo ─────────────────────────────────────────────────────────────
 *
 * - **El anfitrión manda.** Publica cuando se APARTA de lo que dice la sala
 *   —play, pausa, un salto, el final—; lo que coincide es el eco de sus
 *   propias órdenes. Con la duración: así todos saben cuándo terminó.
 * - **Los demás siguen**, con lo que decide `decidir` (src/logica/verJuntos.ts):
 *   recolocarse a más de 3 s, con paciencia según la red, sin volver a empezar
 *   un video terminado.
 * - **Fuera de la vista, pausa**, también el anfitrión: YouTube no deja que
 *   suene sin verse. Al volver a verse, se pone donde va la sala (que siguió).
 * - **A 1x y con su video.** La velocidad del anfitrión se devuelve a 1x y un
 *   video sugerido de YouTube se cambia por el de la sala: los dos rompían la
 *   sincronía de todos (segunda revisión de la 6.27).
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
  getPlaybackRate?(): number;
  setPlaybackRate?(r: number): void;
  getVideoUrl?(): string;
  cueVideoById?(o: { videoId: string; startSeconds?: number }): void;
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
        onPlaybackRateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => Reproductor;
};

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
  /** Un salto hecho para seguir a la sala que aún no ha arrancado: cuándo (hora local). */
  const saltoDesde = useRef<number | null>(null);
  /** Lo que tardó en arrancar el último salto (s): se adelanta el siguiente. */
  const latencia = useRef(1.5);
  /** Cuándo se hicieron los últimos saltos, para saber si la red va mal. */
  const saltos = useRef<number[]>([]);
  /**
   * El anfitrión se está recolocando él solo (no es un gesto suyo): mientras
   * tanto lo que haga su reproductor no se publica; si no quedó a la par, se
   * vuelve a recolocar. Sin esto, su propio retraso al volver se publicaba
   * como orden y toda la sala retrocedía.
   */
  const reajustePropio = useRef(false);
  /** Un directo de YouTube: su duración crece sin parar y no se puede ver a la par. */
  const durAntes = useRef(0);
  const enDirecto = useRef(false);
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

  /** Si el reproductor tiene cargado el video de la sala (y no uno sugerido de YouTube). */
  const conSuVideo = (r: Reproductor, v: VideoJuntos): boolean => {
    const url = r.getVideoUrl?.();
    if (!url) return true;
    const id = idDeYouTube(url);
    return !id || id === v.id;
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
            onPlaybackRateChange: (e) => {
              // A 1x siempre: a otra velocidad el anfitrión se apartaba de la
              // sala cada pocos segundos y todos saltaban en bucle.
              if (e.data !== 1) {
                reproductor.current?.setPlaybackRate?.(1);
                if (anfitrionAhora.current) setAviso("La velocidad se queda en 1x: así todos van a la par.");
              }
            },
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
    saltoDesde.current = null;
    pausadoPorOculto.current = false;
    reajustePropio.current = false;
    durAntes.current = 0;
    enDirecto.current = false;
  };
  useEffect(() => {
    if (video) return;
    soltar();
    setFallo("");
    setHayQueTocar(false);
  }, [!!video]);
  useEffect(() => soltar, []);

  /**
   * Poner el reproductor donde dice la sala, con lo que decide `decidir`.
   * Para quien sigue, en cada cambio y cada 4 s; para el anfitrión, sólo al
   * abrirse, al volver de fuera y al volver a verse (`forzar`).
   */
  const seguir = (forzar = false) => {
    const r = reproductor.current;
    const v = ultimo.current;
    if (!r || !listo.current || !v) return;
    if (anfitrionAhora.current && !forzar) return;
    // Un video sugerido de YouTube no es el de la sala: se vuelve al suyo.
    if (!conSuVideo(r, v)) {
      r.cueVideoById?.({ videoId: v.id, startSeconds: Math.floor(dondeVa(v)) });
      if (anfitrionAhora.current) setAviso("Para poner otro video, quita éste y pega su enlace: así lo ven todos.");
      return;
    }
    const ahoraLocal = Date.now();
    saltos.current = saltos.current.filter((t) => ahoraLocal - t < 60_000);
    const visible = aLaVista();
    const accion = decidir({
      estado: r.getPlayerState(),
      va: r.getCurrentTime(),
      dur: r.getDuration(),
      visible,
      sala: v,
      ahora: ahoraServidor(),
      ahoraLocal,
      saltoDesde: saltoDesde.current,
      latencia: latencia.current,
      saltosRecientes: saltos.current.length,
      estricto: anfitrionAhora.current && forzar,
    });
    if (anfitrionAhora.current && (accion.tipo === "play" || (accion.tipo === "saltar" && accion.luego !== "pausar"))) {
      reajustePropio.current = true;
    }
    if (visible) pausadoPorOculto.current = false;
    switch (accion.tipo) {
      case "pausar":
        if (accion.porOculto) pausadoPorOculto.current = true;
        saltoDesde.current = null;
        r.pauseVideo();
        return;
      case "saltar":
        r.seekTo(accion.a, true);
        saltos.current.push(ahoraLocal);
        if (accion.luego === "pausar") {
          saltoDesde.current = null;
          r.pauseVideo();
        } else {
          saltoDesde.current = ahoraLocal;
          if (accion.luego === "play") arrancar();
        }
        return;
      case "play":
        arrancar();
        return;
      default:
        return;
    }
  };

  /** Dar al play y, si el navegador no deja sin un toque, pedirlo. */
  const arrancar = () => {
    reproductor.current?.playVideo();
    despues(() => {
      const e = reproductor.current?.getPlayerState();
      const v = ultimo.current;
      if (v?.estado === "play" && !terminoPorTiempo(v, ahoraServidor()) && e !== EN_MARCHA && e !== CARGANDO && aLaVista()) {
        setHayQueTocar(true);
      }
    }, 2500);
  };

  // Quien sigue: cada vez que el anfitrión mueve algo, y cada 4 s. El anfitrión
  // no se corrige a sí mismo (lo suyo va abajo).
  useEffect(() => {
    if (!video) return;
    seguir();
    const t = window.setInterval(() => seguir(), 4000);
    return () => window.clearInterval(t);
  }, [video?.estado, video?.pos, video?.en, esAnfitrion]);

  /** Publicar lo que hace el anfitrión (si se aparta de la sala), con la duración. */
  const publicar = (estado: VideoJuntos["estado"], pos: number) => {
    if (enDirecto.current) return;
    const v = ultimo.current;
    const r = reproductor.current;
    if (!v) return;
    const dur = r && r.getDuration() > 0 ? r.getDuration() : v.dur;
    void ponerVideo(canal, {
      id: v.id,
      estado,
      pos: Math.max(0, dur ? Math.min(pos, dur) : pos),
      en: ahoraServidor(),
      ...(dur ? { dur } : {}),
    }).catch(() => setAviso("No se pudo avisar a los demás. Mira tu conexión."));
  };

  const alCambiarEstado = (estado: number) => {
    const r = reproductor.current;
    if (!r) return;
    // Nunca suena sin verse: si arranca con la app detrás o fuera de la
    // pantalla, se para aquí.
    if (estado === EN_MARCHA && !aLaVista()) {
      pausadoPorOculto.current = true;
      saltoDesde.current = null;
      r.pauseVideo();
      return;
    }
    if (estado === EN_MARCHA) {
      setHayQueTocar(false);
      // Un salto propio que arrancó: se mide lo que tardó (si es reciente).
      const medida = medirLatencia(saltoDesde.current, Date.now());
      if (medida != null) latencia.current = medida;
      saltoDesde.current = null;
    } else if (estado === EN_PAUSA || estado === TERMINADO) {
      // Un salto que se quedó a medias por una pausa ya no mide nada; y una
      // pausa o el final sí son gestos del anfitrión.
      saltoDesde.current = null;
      reajustePropio.current = false;
    }
    if (!anfitrionAhora.current || !listo.current || pausadoPorOculto.current) return;
    if (document.visibilityState !== "visible") return;
    const v = ultimo.current;
    if (!v) return;
    // Un video sugerido de YouTube no se publica como orden sobre el de la sala.
    if (!conSuVideo(r, v)) {
      seguir(true);
      return;
    }
    const va = estado === TERMINADO ? r.getDuration() : r.getCurrentTime();
    const nuevo = seAparta(estado, va, v);
    if (estado === EN_MARCHA && reajustePropio.current) {
      // Era su recolocación: si quedó a la par, listo; si no, otra (no se publica).
      if (nuevo) seguir(true);
      else reajustePropio.current = false;
      return;
    }
    if (nuevo) publicar(nuevo, va);
  };

  // El anfitrión, cada 2 s:
  // - fuera de la vista, su video se pausa aquí (sin publicarlo: la sala sigue);
  // - al volver a verse, se pone donde va la sala (antes se quedaba con la marca
  //   de «pausado por no verse» y ya no publicaba nada nunca más);
  // - si salta con la barra sin pausar, se publica la posición nueva;
  // - si la sala terminó por tiempo y él no está sonando, se publica la pausa
  //   del final, para que la sala no se quede en «play»;
  // - y la duración, en cuanto se sabe.
  useEffect(() => {
    if (!esAnfitrion || !video) return;
    const t = window.setInterval(() => {
      const r = reproductor.current;
      const v = ultimo.current;
      if (!r || !v || !listo.current) return;
      const estado = r.getPlayerState();
      if (!aLaVista()) {
        if (estado === EN_MARCHA || estado === CARGANDO) {
          pausadoPorOculto.current = true;
          r.pauseVideo();
        }
        return;
      }
      if (pausadoPorOculto.current) {
        seguir(true);
        return;
      }
      if (!conSuVideo(r, v)) return;
      // Un directo: la duración crece sonando. No se puede ver a la par.
      if (estado === EN_MARCHA) {
        const d = r.getDuration();
        if (durAntes.current > 0 && d - durAntes.current > 1) {
          enDirecto.current = true;
          setAviso("Los directos no se pueden ver juntos: elige un video normal.");
          void ponerVideo(canal, null).catch(() => {});
          return;
        }
        durAntes.current = d;
      }
      const ahora = ahoraServidor();
      if (v.estado === "play" && estado === EN_MARCHA && Math.abs(r.getCurrentTime() - dondeVa(v, ahora)) > TOLERANCIA_S) {
        // Si es su propia recolocación, se recoloca otra vez; si no, la publica.
        if (reajustePropio.current) seguir(true);
        else publicar("play", r.getCurrentTime());
        return;
      }
      if (v.estado === "play" && estado !== EN_MARCHA && estado !== CARGANDO && terminoPorTiempo(v, ahora, r.getDuration() || v.dur)) {
        publicar("pausa", r.getDuration() || v.dur || v.pos);
        return;
      }
      if (!v.dur && r.getDuration() > 0 && (estado === EN_MARCHA || estado === EN_PAUSA)) {
        publicar(v.estado, estado === EN_MARCHA ? r.getCurrentTime() : v.pos);
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [esAnfitrion, !!video]);

  // Con la app en segundo plano, se pausa aquí siempre (esté sonando o
  // cargando). Al volver, se pone donde van los demás.
  useEffect(() => {
    let volver = 0;
    const cambio = () => {
      const r = reproductor.current;
      if (!r || !listo.current) return;
      window.clearTimeout(volver);
      if (document.visibilityState !== "visible") {
        const e = r.getPlayerState();
        if (e === EN_MARCHA || e === CARGANDO) {
          pausadoPorOculto.current = true;
          saltoDesde.current = null;
          r.pauseVideo();
        }
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

  // Con la sala parada, el botón de «Ver con los demás» sobra: tocarlo haría
  // sonar el video encima de quien habla.
  useEffect(() => {
    if (video?.estado !== "play") setHayQueTocar(false);
  }, [video?.estado]);

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
        {video.estado === "play" && !terminoPorTiempo(video, ahoraServidor())
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
