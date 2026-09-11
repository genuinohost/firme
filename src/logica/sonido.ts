import type { Timbre } from "@/datos/tipos";

/**
 * Los timbres se sintetizan con Web Audio: no hay archivos que descargar y
 * suenan igual sin conexión.
 *
 * El navegador no deja sonar hasta que el usuario ha tocado la pantalla al
 * menos una vez, así que `despertar()` se llama en el primer toque para dejar
 * el contexto listo.
 */

let contexto: AudioContext | null = null;
/**
 * Lo último que se mandó sonar. Si el navegador aún no permitía audio cuando
 * saltó la alarma, `reanudar()` la arranca en cuanto haya un toque.
 */
let ultimo: { timbre: Timbre; volumen: number } | null = null;

let sonando: { parar: () => void } | null = null;

export function despertar(): void {
  if (!contexto) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    contexto = new Ctor();
  }
  if (contexto.state === "suspended") void contexto.resume();
}


type Patron = {
  /** [frecuencia Hz, duración s, retraso s desde el inicio del ciclo] */
  notas: [number, number, number][];
  cicloS: number;
  onda: OscillatorType;
};

const PATRONES: Record<Exclude<Timbre, "ninguno">, Patron> = {
  campana: {
    notas: [[880, 1.6, 0], [1320, 1.4, 0.08], [660, 1.8, 0.5]],
    cicloS: 2.6,
    onda: "sine",
  },
  diana: {
    notas: [
      [784, 0.18, 0], [784, 0.18, 0.22], [1046, 0.36, 0.44],
      [784, 0.18, 0.9], [1046, 0.5, 1.12],
    ],
    cicloS: 2.0,
    onda: "square",
  },
  pulso: {
    notas: [[523, 0.12, 0], [523, 0.12, 0.3]],
    cicloS: 1.4,
    onda: "triangle",
  },
};

function tocarCiclo(ctx: AudioContext, patron: Patron, desde: number, volumen: number): void {
  for (const [frecuencia, duracion, retraso] of patron.notas) {
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = patron.onda;
    osc.frequency.value = frecuencia;
    const t0 = desde + retraso;
    // Ataque corto y caída suave: sin el sobre, cada nota chasquea.
    gan.gain.setValueAtTime(0, t0);
    gan.gain.linearRampToValueAtTime(volumen, t0 + 0.01);
    gan.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
    osc.connect(gan).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duracion + 0.05);
  }
}

/**
 * Arranca el timbre en bucle hasta que se llame a `parar()`. Una alarma que
 * suena una vez y calla no despierta a nadie.
 */
export function sonar(timbre: Timbre, volumen = 0.7): void {
  parar();
  ultimo = { timbre, volumen };
  if (timbre === "ninguno") {
    vibrar([400, 200, 400, 200, 600]);
    return;
  }
  despertar();
  if (!contexto) return;
  const ctx = contexto;
  const patron = PATRONES[timbre];

  let siguiente = ctx.currentTime + 0.05;
  // Se programan los ciclos con antelación y se rellenan con un intervalo:
  // así el audio no depende de que el hilo principal vaya fino.
  const rellenar = () => {
    while (siguiente < ctx.currentTime + 3) {
      tocarCiclo(ctx, patron, siguiente, volumen);
      siguiente += patron.cicloS;
    }
  };
  rellenar();
  const reloj = window.setInterval(rellenar, 1000);
  const vibracion = window.setInterval(() => vibrar([300, 150, 300]), 1800);
  vibrar([300, 150, 300]);

  sonando = {
    parar: () => {
      clearInterval(reloj);
      clearInterval(vibracion);
      // Cortar de golpe deja colgando las notas ya programadas; se silencia
      // el destino recreando el contexto solo si hiciera falta.
      try {
        navigator.vibrate?.(0);
      } catch {
        /* no todos los navegadores lo traen */
      }
    },
  };
}

export function parar(): void {
  ultimo = null;
  if (!sonando) return;
  sonando.parar();
  sonando = null;
  // Un contexto nuevo corta en seco cualquier nota que siguiera programada.
  if (contexto) {
    void contexto.close();
    contexto = null;
    despertar();
  }
}

export function vibrar(patron: number[]): void {
  // El navegador rechaza vibrar mientras no haya habido un toque en la página,
  // y además lo deja escrito en la consola. Se comprueba antes de pedirlo.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* iOS no vibra desde la web */
  }
}

export function reanudar(): void {
  if (!ultimo) return;
  if (contexto && contexto.state === "running") return;
  const { timbre, volumen } = ultimo;
  sonar(timbre, volumen);
}

/** ¿Se está pidiendo sonido pero el navegador todavía no lo deja salir? */
export function audioBloqueado(): boolean {
  return ultimo !== null && (contexto === null || contexto.state !== "running");
}

/** Un toque corto de confirmación al marcar un bloque cumplido. */
export function tintineo(volumen = 0.4): void {
  despertar();
  if (!contexto) return;
  const ctx = contexto;
  const t = ctx.currentTime;
  for (const [f, r] of [[784, 0], [1175, 0.09]] as const) {
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gan.gain.setValueAtTime(0, t + r);
    gan.gain.linearRampToValueAtTime(volumen, t + r + 0.01);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + r + 0.35);
    osc.connect(gan).connect(ctx.destination);
    osc.start(t + r);
    osc.stop(t + r + 0.4);
  }
}
