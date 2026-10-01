import type { VideoJuntos } from "./sala";

/**
 * «Ver juntos»: lo que decide cada móvil, sin YouTube ni React. Se prueba en
 * `scripts/revisar-verjuntos.ts` con escenarios (red lenta, el final, ir por
 * delante, pausar un video terminado…).
 *
 * Nació de la segunda revisión del reproductor (28-09-2026): diez fallos de
 * sincronía, cada uno en un rincón distinto del componente. Juntar la decisión
 * en una función pura es lo que deja probarlos todos.
 */

// Estados del reproductor de YouTube.
export const SIN_EMPEZAR = -1;
export const TERMINADO = 0;
export const EN_MARCHA = 1;
export const EN_PAUSA = 2;
export const CARGANDO = 3;

/** Más de esto de diferencia y se recoloca. Con menos, saltaría sin parar con mala red. */
export const TOLERANCIA_S = 3;

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

/** Dónde tiene que ir el video ahora, según lo que puso el anfitrión (sin pasar del final si se sabe). */
export function dondeVa(v: VideoJuntos, ahora: number): number {
  const pos = v.estado === "play" ? v.pos + Math.max(0, ahora - v.en) / 1000 : v.pos;
  return v.dur && v.dur > 0 ? Math.min(pos, v.dur) : pos;
}

/**
 * Si el video de la sala ya terminó por tiempo: estaba en marcha y, a su
 * ritmo, ya pasó del final. Con la duración en la sala, todos lo saben aunque
 * el anfitrión no esté mirando: antes, si el final le pillaba fuera, la sala
 * se quedaba en «play» para siempre con los micrófonos de todos cerrados.
 */
export function terminoPorTiempo(v: VideoJuntos, ahora: number, dur = v.dur ?? 0): boolean {
  if (v.estado !== "play" || !(dur > 0)) return false;
  return v.pos + Math.max(0, ahora - v.en) / 1000 >= dur - 0.5;
}

/** Si el video está sonando de verdad (en marcha y sin haber terminado): cierra micrófonos. */
export function videoSonando(v: VideoJuntos | undefined | null, ahora: number): boolean {
  return !!v && v.estado === "play" && !terminoPorTiempo(v, ahora);
}

/**
 * Si el reproductor de este móvil se aparta de la sala lo bastante como para
 * que sea una acción del anfitrión (y no el eco de sus propias órdenes).
 */
export function seAparta(
  estadoReproductor: number,
  va: number,
  sala: VideoJuntos,
  ahora: number,
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

/** Lo que un móvil sabe para decidir. */
export type Situacion = {
  /** Estado del reproductor de YouTube. */
  estado: number;
  /** Dónde va (getCurrentTime). */
  va: number;
  /** Duración del video según el reproductor (0 si aún no se sabe). */
  dur: number;
  /** Si el reproductor se ve: app delante, en pantalla y sin nada encima. */
  visible: boolean;
  sala: VideoJuntos;
  /** Hora del servidor (ms). */
  ahora: number;
  /** Hora de este móvil (ms), para los plazos propios. */
  ahoraLocal: number;
  /** Cuándo se hizo el último salto que todavía no arrancó (hora local), o null. */
  saltoDesde: number | null;
  /** Lo que tardó en arrancar el último salto (s). */
  latencia: number;
  /** Cuántos saltos se hicieron en el último minuto. */
  saltosRecientes: number;
  /**
   * El anfitrión recolocándose (al abrirse, al volver a verse): con margen
   * mínimo y siempre con salto compensado. Un simple «play» desde donde se
   * quedó arrancaba segundos por detrás, y eso se publicaba como orden y
   * arrastraba a toda la sala hacia atrás. (Revisión del reproductor.)
   */
  estricto?: boolean;
};

export type Accion =
  | { tipo: "nada" }
  | { tipo: "pausar"; porOculto: boolean }
  | { tipo: "saltar"; a: number; luego: "pausar" | "play" | "nada" }
  | { tipo: "play" };

/**
 * Cuánto se espera a que arranque un salto antes de darlo por perdido. Mucho, a
 * propósito: con una paciencia corta, un salto que tardaba 9 s se repetía
 * antes de arrancar, nunca se medía lo que tardaba y el video no sonaba nunca
 * (lo enseñó la simulación de revisar-verjuntos).
 */
export const PLAZO_SALTO_MS = 25_000;

/**
 * Qué hacer para ir con la sala. Para quien sigue, en cada cambio y cada 4 s;
 * para el anfitrión, sólo al abrirse, al volver de fuera y al volver a verse.
 */
export function decidir(s: Situacion): Accion {
  const marcha = s.estado === EN_MARCHA || s.estado === CARGANDO;
  // No se ve: aquí no suena (YouTube no deja que suene sin verse), y al
  // volver a verse se recoloca.
  if (!s.visible) return marcha ? { tipo: "pausar", porOculto: true } : { tipo: "nada" };

  const dur = s.dur > 0 ? s.dur : (s.sala.dur ?? 0);
  const debe = dondeVa(s.sala, s.ahora);

  // Al final, quien va un poco por detrás termina solo sus últimos segundos
  // (llega a TERMINADO, que no hace volver a empezar): pausarlo antes le
  // quitaba la frase o la música del cierre.
  const acabando =
    marcha && dur > 0 && s.va < dur && s.va >= Math.min(debe, dur) - TOLERANCIA_S && Math.min(debe, dur) >= dur - 0.5;

  if (s.sala.estado === "pausa") {
    if (acabando) return { tipo: "nada" };
    // Después de un salto, SIEMPRE pausar: sobre un video terminado, seekTo
    // lo pone a sonar, y la comprobación de antes del salto ya no vale.
    if (Math.abs(s.va - debe) > TOLERANCIA_S) return { tipo: "saltar", a: debe, luego: "pausar" };
    return marcha ? { tipo: "pausar", porOculto: false } : { tipo: "nada" };
  }

  // En marcha, pero ya pasó del final: se para, no se vuelve a empezar.
  if (terminoPorTiempo(s.sala, s.ahora, dur)) {
    if (acabando) return { tipo: "nada" };
    return marcha ? { tipo: "pausar", porOculto: false } : { tipo: "nada" };
  }

  // Este móvil iba por delante y llegó antes al final: espera ahí. Un
  // playVideo sobre un video terminado lo arranca desde el principio.
  if (s.estado === TERMINADO && dur > 0 && debe >= dur - TOLERANCIA_S - 1) return { tipo: "nada" };

  // Un salto propio que aún está cargando: paciencia, no otro salto. Si se
  // pasa del plazo, el siguiente apunta tan lejos como lo que ya lleva.
  let latencia = s.latencia;
  if (s.saltoDesde != null && s.estado === CARGANDO) {
    const lleva = s.ahoraLocal - s.saltoDesde;
    if (lleva < PLAZO_SALTO_MS) return { tipo: "nada" };
    latencia = Math.min(20, Math.max(latencia, lleva / 1000));
  }

  // Con mala red (tres saltos en un minuto), se da más margen: perseguir la
  // sala a saltos es peor que ir unos segundos por detrás.
  const tolerancia = s.estricto ? 0.75 : s.saltosRecientes >= 3 ? TOLERANCIA_S * 2 : TOLERANCIA_S;
  if (Math.abs(s.va - debe) > tolerancia) {
    const a = dur > 0 ? Math.min(debe + latencia, dur - 1) : debe + latencia;
    return { tipo: "saltar", a: Math.max(0, a), luego: marcha ? "nada" : "play" };
  }
  return marcha ? { tipo: "nada" } : { tipo: "play" };
}

/**
 * Lo que tardó en arrancar un salto, si el salto es reciente: uno viejo (el
 * salto que se quedó a medias por una pausa) no mide nada. Antes se medía
 * contra él, la latencia subía al tope y el siguiente salto se pasaba de largo.
 */
export function medirLatencia(saltoDesde: number | null, ahoraLocal: number): number | null {
  if (saltoDesde == null) return null;
  const s = (ahoraLocal - saltoDesde) / 1000;
  if (s < 0 || s > 20) return null;
  return Math.min(12, Math.max(0.5, s));
}
