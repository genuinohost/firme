import type { Amigo, Perfil } from "./nube";
import { leerPerfil } from "./nube";

/**
 * A quién buscar hoy.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * Alex, el 24-09-2026, pidió poder llamar a sus hermanos desde la app. El botón
 * ya está. Pero un botón de llamar no resuelve el problema de verdad, que es
 * **acordarse**: nadie abre una lista de treinta hermanos a preguntarse a quién
 * le hará falta una llamada hoy. Cuando uno se acuerda, suele ser tarde.
 *
 * Esto es la otra mitad del botón: la app dice **un nombre**, con el motivo, y
 * al lado el botón para llamarle.
 *
 * ── Un nombre, no una lista ───────────────────────────────────────────────
 *
 * Se enseña **uno solo**, a propósito. Una lista de cinco hermanos a los que
 * convendría llamar es una lista que no se atiende: se mira, se siente culpa, y
 * se cierra. Un nombre se llama.
 *
 * ── Las tres señales, y lo que cada una vale ───────────────────────────────
 *
 * 1. **Se le rompió la racha.** La más fuerte. No se calcula en ningún
 *    servidor: este móvil se acuerda de qué racha llevaba cada hermano la
 *    última vez que la vio, y si ahora es menor, se cayó. Cero datos nuevos
 *    publicados, cero vigilancia añadida.
 * 2. **Lleva días en cero.** Cayó hace tiempo y no ha vuelto a levantarse. Es
 *    el que más falta hace y el que menos se nota, porque no hay caída reciente
 *    que llame la atención.
 * 3. **Hace mucho que no le buscas.** La más humilde y la que nunca falla:
 *    mide lo tuyo, no lo suyo. Funciona igual con quien tiene las rachas
 *    apagadas —que para las señales 1 y 2 es invisible— y no depende de que el
 *    otro publique nada.
 *
 * Con el tiempo la tercera va a ser la que más suene, y está bien: lo normal
 * entre hermanos no es que alguien se esté cayendo, es que se dejó de llamar.
 *
 * ── Lo que esto NO hace ────────────────────────────────────────────────────
 *
 * No manda nada a nadie. El hermano **no se entera** de que su nombre salió
 * aquí: sólo se lee lo que él ya decidió publicar, y si apagó sus rachas, ni
 * eso.
 *
 * Tampoco avisa al que se cayó. Un aviso automático a quien acaba de fallar es
 * una regañina de una máquina; una llamada de un hermano es otra cosa. La app
 * no llama por él.
 */

const GUARDADO = "firme.rastroHermanos";

/** Lo que este móvil recuerda de cada hermano. Nunca sale de aquí. */
export type Rastro = {
  /** La racha que llevaba la última vez que se miró. */
  racha?: number;
  /** Cuándo se miró. Sin esto, una racha vieja mentiría. */
  visto: number;
  /** Desde cuándo está en cero. Se borra en cuanto vuelve a levantarse. */
  ceroDesde?: number;
  /** Cuándo se le llamó o escribió desde la app por última vez. */
  buscado?: number;
};

export type Sugerencia = {
  uid: string;
  nombre: string;
  usuario: string;
  foto?: string;
  /** Por qué él y no otro, en una frase que se lea de un vistazo. */
  motivo: string;
  /** Qué hacer. */
  empuje: string;
};

const DIA = 86_400_000;

/**
 * Cuántos días puede envejecer un rastro y seguir sirviendo para comparar.
 *
 * Si alguien no abre la app en un mes, la racha guardada es de otra época y
 * «se le rompió la racha» sería ruido: se rompió, sí, hace tres semanas.
 */
const CADUCA_DIAS = 14;

/** Tras buscarle, no se le vuelve a proponer en un día. Ya le llamaste. */
const DESCANSO_DIAS = 1;

/** Días en cero a partir de los cuales deja de ser un tropiezo. */
const CERO_DIAS = 3;

/** Días sin buscar a alguien a partir de los cuales ya es mucho. */
const SILENCIO_DIAS = 10;

function leerRastros(): Record<string, Rastro> {
  try {
    const crudo = localStorage.getItem(GUARDADO);
    if (!crudo) return {};
    const x = JSON.parse(crudo) as Record<string, Rastro>;
    return x && typeof x === "object" ? x : {};
  } catch {
    return {};
  }
}

function guardarRastros(rastros: Record<string, Rastro>): void {
  try {
    localStorage.setItem(GUARDADO, JSON.stringify(rastros));
  } catch {
    // Sin sitio para guardar, la sugerencia sale peor y nada más se rompe.
  }
}

/**
 * Anota que se le buscó. Se llama al tocar «Llamarle» o «Escribirle», no al
 * abrir su ficha: mirar a alguien no es buscarle.
 */
export function anotarQueSeBusco(uid: string, ahora = Date.now()): void {
  const rastros = leerRastros();
  rastros[uid] = { ...(rastros[uid] ?? { visto: ahora }), buscado: ahora };
  guardarRastros(rastros);
}

/** Los días enteros que han pasado, para poder decirlos en voz alta. */
function diasDesde(cuando: number, ahora: number): number {
  return Math.floor((ahora - cuando) / DIA);
}

/**
 * Ordena a quién buscar y actualiza lo que este móvil recuerda.
 *
 * Devuelve la lista **ordenada**, no sólo el primero, y por un motivo concreto:
 * a un hermano que no publicó su WhatsApp no se le puede llamar, y enseñar su
 * nombre con un botón que no existe es peor que no decir nada. Quien pinta la
 * tarjeta baja por la lista hasta encontrar a uno al que se pueda llamar.
 *
 * Vacía cuando no hay nada que decir, que es lo normal y lo bueno. Los perfiles
 * se leen todos a la vez; si uno falla se ignora, porque una sugerencia no
 * puede depender de que treinta lecturas salgan bien.
 */
export async function aQuienBuscar(
  amigos: Amigo[],
  ahora = Date.now(),
): Promise<Sugerencia[]> {
  const aceptados = amigos.filter((a) => a.estado === "aceptada");
  if (aceptados.length === 0) return [];

  const perfiles = await Promise.all(
    aceptados.map((a) => leerPerfil(a.uid).catch(() => null)),
  );

  const rastros = leerRastros();
  const candidatos: { s: Sugerencia; peso: number; espera: number }[] = [];

  aceptados.forEach((amigo, i) => {
    const perfil: Perfil | null = perfiles[i];
    const antes = rastros[amigo.uid];
    const racha = typeof perfil?.racha === "number" ? perfil.racha : undefined;

    // ── Lo primero, dejar el rastro al día ────────────────────────────────
    const alDia: Rastro = { ...(antes ?? {}), visto: ahora, racha };
    if (racha === 0) {
      alDia.ceroDesde = antes?.ceroDesde ?? ahora;
    } else if (racha !== undefined && racha > 0) {
      delete alDia.ceroDesde;
    }
    rastros[amigo.uid] = alDia;

    const nombre = perfil?.nombre || amigo.nombre;
    const usuario = perfil?.usuario || amigo.usuario;
    const foto = perfil?.foto ?? amigo.foto;
    const base = { uid: amigo.uid, nombre, usuario, foto };
    const primero = nombre.split(" ")[0] || nombre;

    // Recién buscado: se le deja en paz.
    if (antes?.buscado && ahora - antes.buscado < DESCANSO_DIAS * DIA) return;

    const fresco = antes != null && ahora - antes.visto < CADUCA_DIAS * DIA;

    // ── 1 · Se le rompió la racha ─────────────────────────────────────────
    if (
      fresco &&
      racha !== undefined &&
      typeof antes?.racha === "number" &&
      racha < antes.racha
    ) {
      candidatos.push({
        peso: 3,
        espera: ahora - (antes.buscado ?? antes.visto),
        s: {
          ...base,
          motivo:
            antes.racha === 1
              ? "Se le cortó la racha que empezaba."
              : `Se le rompió la racha de ${antes.racha} días.`,
          empuje: "Llámale hoy. Mañana ya es otra conversación.",
        },
      });
      return;
    }

    // ── 2 · Lleva días en el suelo ────────────────────────────────────────
    const ceroDesde = alDia.ceroDesde;
    if (racha === 0 && ceroDesde && diasDesde(ceroDesde, ahora) >= CERO_DIAS) {
      const d = diasDesde(ceroDesde, ahora);
      candidatos.push({
        peso: 2,
        espera: ahora - (antes?.buscado ?? ceroDesde),
        s: {
          ...base,
          motivo: `Lleva ${d} días sin levantar la racha.`,
          empuje: "Nadie se levanta solo del todo. Llámale.",
        },
      });
      return;
    }

    // ── 3 · Hace mucho que no le buscas ───────────────────────────────────
    const ultimaVez = antes?.buscado;
    if (!ultimaVez) {
      // Primer arranque: no hay nada anotado de nadie, y proponer a los treinta
      // el mismo día sería ruido. Sólo entran si la amistad no es de ayer.
      const antiguedad = amigo.cuando ? diasDesde(amigo.cuando, ahora) : 99;
      if (antiguedad < SILENCIO_DIAS) return;
      candidatos.push({
        peso: 1,
        espera: ahora - (amigo.cuando ?? 0),
        s: {
          ...base,
          motivo: "No le has buscado desde aquí.",
          empuje: "Una llamada sin motivo es la que más se recuerda.",
        },
      });
      return;
    }
    const d = diasDesde(ultimaVez, ahora);
    if (d >= SILENCIO_DIAS) {
      candidatos.push({
        peso: 1,
        espera: ahora - ultimaVez,
        s: {
          ...base,
          motivo: `Llevas ${d} días sin buscar a ${primero}.`,
          empuje: "Una llamada sin motivo es la que más se recuerda.",
        },
      });
    }
  });

  guardarRastros(rastros);

  // Primero la señal más fuerte; entre iguales, el que lleva más esperando.
  candidatos.sort((a, b) => b.peso - a.peso || b.espera - a.espera);
  return candidatos.map((c) => c.s);
}
