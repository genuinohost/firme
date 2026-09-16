import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * Dictar en voz alta.
 *
 * Alex: «necesito poder crear tareas y comentarios en mi diario con voz. Hay
 * veces donde no puedo escribir». No es comodidad: esta app se usa a las tres
 * de la madrugada, medio dormido y con una mano. Una nota que hay que teclear
 * en esas condiciones es una nota que no se escribe, y el diario vale justo por
 * lo que se anota **cuando aprieta**, no por lo que se redacta tranquilo al día
 * siguiente.
 *
 * En Android lo hace el plugin propio (`Dictado.java`). En el navegador se cae
 * a la API del propio navegador, que existe en Chrome de escritorio: no es para
 * el usuario final, es para poder probar la pantalla sin compilar un APK cada
 * vez.
 *
 * **Nada de esto sale del teléfono por nuestra cuenta.** El motor de voz es el
 * del sistema; si Google transcribe en sus servidores, eso es cosa del móvil y
 * de la cuenta de quien lo usa, igual que cuando se dicta en WhatsApp. Nosotros
 * no guardamos audio ni lo mandamos a ningún sitio.
 */

type PluginDictado = {
  disponible(): Promise<{ disponible: boolean }>;
  empezar(opciones: { idioma: string }): Promise<void>;
  parar(): Promise<void>;
  cancelar(): Promise<void>;
  addListener(
    suceso: "texto" | "parcial" | "error" | "nivel" | "listo",
    fn: (datos: { texto?: string; motivo?: string; nivel?: number }) => void,
  ): Promise<PluginListenerHandle>;
};

const Nativo = registerPlugin<PluginDictado>("Dictado");

export type EscuchaDictado = {
  /** Lo que se va oyendo mientras se habla. Aún puede cambiar. */
  onParcial?: (texto: string) => void;
  /** Lo definitivo. Llega una vez y se acabó. */
  onTexto: (texto: string) => void;
  /** Ya no escucha, salga bien o mal. Para devolver el botón a su sitio. */
  onFin?: () => void;
  onError?: (motivo: string) => void;
  /** 0 a 1, para que el botón lata al ritmo de la voz. */
  onNivel?: (nivel: number) => void;
};

/** Se para sola, se cancela, o se pregunta si sigue. */
export type Dictando = {
  parar: () => Promise<void>;
  cancelar: () => Promise<void>;
};

const IDIOMA = "es-ES";

// --------------------------------------------------------------- el navegador

type ReconocimientoWeb = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

function constructorWeb(): (new () => ReconocimientoWeb) | null {
  const w = window as unknown as Record<string, unknown>;
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return (C as (new () => ReconocimientoWeb) | undefined) ?? null;
}

/**
 * Si este aparato sabe transcribir.
 *
 * Se pregunta **al sistema**, no se supone. Hay móviles que salen de fábrica
 * sin motor de voz, y enseñar un micrófono que no hace nada es peor que no
 * enseñarlo: se toca, no pasa nada, y la app parece rota.
 */
export async function hayDictado(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      return (await Nativo.disponible()).disponible;
    } catch {
      return false;
    }
  }
  return constructorWeb() !== null;
}

export async function dictar(escucha: EscuchaDictado): Promise<Dictando | null> {
  return Capacitor.isNativePlatform() ? dictarNativo(escucha) : dictarWeb(escucha);
}

async function dictarNativo(escucha: EscuchaDictado): Promise<Dictando | null> {
  const sueltas: PluginListenerHandle[] = [];
  let terminado = false;

  /** Recoger los oyentes una sola vez, salga como salga. */
  const recoger = async () => {
    if (terminado) return;
    terminado = true;
    for (const s of sueltas) {
      try {
        await s.remove();
      } catch {
        /* si ya no existe, mejor */
      }
    }
    escucha.onFin?.();
  };

  try {
    sueltas.push(
      await Nativo.addListener("parcial", (d) => escucha.onParcial?.(d.texto ?? "")),
    );
    sueltas.push(
      await Nativo.addListener("nivel", (d) => escucha.onNivel?.(d.nivel ?? 0)),
    );
    sueltas.push(
      await Nativo.addListener("texto", (d) => {
        const t = (d.texto ?? "").trim();
        if (t) escucha.onTexto(t);
        void recoger();
      }),
    );
    sueltas.push(
      await Nativo.addListener("error", (d) => {
        escucha.onError?.(d.motivo ?? "No se pudo dictar.");
        void recoger();
      }),
    );

    await Nativo.empezar({ idioma: IDIOMA });
    return {
      parar: async () => {
        try {
          await Nativo.parar();
        } catch {
          await recoger();
        }
      },
      cancelar: async () => {
        try {
          await Nativo.cancelar();
        } finally {
          await recoger();
        }
      },
    };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    escucha.onError?.(
      motivo.includes("sin-permiso")
        ? "Hace falta el permiso del micrófono."
        : motivo.includes("sin-motor")
          ? "Este móvil no trae dictado por voz."
          : "No se pudo empezar a dictar.",
    );
    await recoger();
    return null;
  }
}

async function dictarWeb(escucha: EscuchaDictado): Promise<Dictando | null> {
  const C = constructorWeb();
  if (!C) {
    escucha.onError?.("Este navegador no sabe dictar. En la app de Android sí funciona.");
    escucha.onFin?.();
    return null;
  }

  const r = new C();
  r.lang = IDIOMA;
  r.continuous = false;
  r.interimResults = true;

  r.onresult = (e: unknown) => {
    const ev = e as { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
    let parcial = "";
    for (let i = 0; i < ev.results.length; i++) {
      const tramo = ev.results[i];
      const texto = tramo[0]?.transcript ?? "";
      if (tramo.isFinal) {
        const t = texto.trim();
        if (t) escucha.onTexto(t);
      } else {
        parcial += texto;
      }
    }
    if (parcial) escucha.onParcial?.(parcial);
  };
  r.onerror = (e: unknown) => {
    const codigo = (e as { error?: string }).error ?? "";
    escucha.onError?.(
      codigo === "not-allowed"
        ? "Hace falta el permiso del micrófono."
        : codigo === "no-speech"
          ? "No te oí. Prueba otra vez."
          : "No se pudo dictar.",
    );
  };
  r.onend = () => escucha.onFin?.();

  try {
    r.start();
  } catch {
    escucha.onError?.("No se pudo empezar a dictar.");
    escucha.onFin?.();
    return null;
  }

  return {
    parar: async () => r.stop(),
    cancelar: async () => r.abort(),
  };
}

/**
 * Pegar lo dictado a lo que ya había.
 *
 * Se dicta encima de un texto a medias más veces de las que parece: se escribe
 * un poco, se cansa uno, y se sigue hablando. Sin este cuidado salen cosas como
 * «Hoy me costólevantarme».
 */
export function pegar(actual: string, añadido: string): string {
  const base = actual.trimEnd();
  const trozo = añadido.trim();
  if (!trozo) return actual;
  if (!base) return trozo.charAt(0).toUpperCase() + trozo.slice(1);
  const separador = /[.!?…]$/.test(base) ? " " : /[,;:]$/.test(base) ? " " : " ";
  return `${base}${separador}${trozo}`;
}
