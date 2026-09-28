/**
 * Partir el texto de un devocional en los trozos que se leen por turnos.
 *
 * Lo usan dos sitios, y por eso vive aquí y no en uno de ellos:
 *
 * - `scripts/devocionales/extraer-chat.mjs`, que saca el archivo del año de la
 *   exportación del grupo de WhatsApp;
 * - la app, cuando quien modera **pega el devocional del día** (el Bloque 1
 *   del prompt, el mismo que manda al grupo a las 4:50).
 *
 * Si los dos partieran distinto, el mismo día se leería de dos maneras. El
 * extractor comprueba que, pasado por aquí, el archivo sale idéntico.
 *
 * ── Qué entiende ──────────────────────────────────────────────────────────
 *
 * El formato del prompt maestro (`docs/devocionales/prompt-maestro.md`) y los
 * que hubo antes durante el año: la cabecera «DÍA N DE 365», el tema, los
 * capítulos con sus trozos de ≤5 versículos, la reflexión punto a punto, las
 * preguntas, la oración, el recordatorio y el cierre.
 */

import type { Trozo } from "./devocionales";

/** «LEYENDO TODA LA BIBLIA EN UN AÑO: DÍA 272 DE 365» (y «CAMINEMOS CON LA PALABRA: …» en enero). */
export const RE_DIA = /(?:CAMINEMOS CON LA PALABRA|LEYENDO TODA LA BIBLIA EN UN A[ÑN]O)\s*:\s*D[IÍ]A\s+(\d{1,3})\s+DE\s+365/i;
/** «🔥 ¡ALERTA DÍA 272: …!», el Bloque 4 de la víspera. */
export const RE_ALERTA = /ALERTA\s+D[IÍ]A\s+(\d{1,3})/i;

// Una referencia que encabeza: «Isaías 13:1-5:», «1 Samuel 14:6-10:», «Cantar
// de los Cantares 2:1-5». Y una corta, la de enero: «6-10:» (el libro y el
// capítulo los pone el encabezado de capítulo de encima).
const RE_REFERENCIA =
  /^((?:[1-3]\s)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s(?:de|los|las|del|[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+))*)\s+(\d{1,3}):(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*:?\s*$/;
const RE_CORTA = /^(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*:\s*$/;
const RE_VERSICULO = /^\s*\d{1,3}\s+\S/;
// «1)», «1.», y también «1.«Por lo cual…» sin espacio (así salió en enero).
const RE_PUNTO = /^\s*\d{1,2}[.)](?!\d)/;
// El emoji del encabezado es opcional de verdad (con la bandera `u`: sin ella,
// «💬?» sólo hacía opcional la segunda mitad del emoji), y admite el tono de
// piel que pone el teclado del móvil («🙏🏻», «✍🏽»).
const EMOJI = (e: string) => `(?:${e}\uFE0F?[\u{1F3FB}-\u{1F3FF}]?)?`;
const SECCIONES: { clave: Trozo["tipo"]; titulo: string; re: RegExp }[] = [
  { clave: "reflexion", titulo: "Reflexión", re: new RegExp(`^${EMOJI("💬")}\\s*REFLEXI[ÓO]N\\s*:?`, "iu") },
  { clave: "preguntas", titulo: "Para reflexionar hoy", re: new RegExp(`^${EMOJI("✍")}\\s*PARA REFLEXIONAR HOY`, "iu") },
  { clave: "oracion", titulo: "Oración del día", re: new RegExp(`^${EMOJI("🙏")}\\s*ORACI[ÓO]N DEL D[IÍ]A`, "iu") },
  { clave: "recordatorio", titulo: "Recordatorio de lectura", re: new RegExp(`^${EMOJI("📢")}\\s*RECORDATORIO DE LECTURA`, "iu") },
  { clave: "comparte", titulo: "Comparte este mensaje", re: new RegExp(`^${EMOJI("🔥")}\\s*¡?COMPARTE ESTE (MENSAJE|RETO)`, "iu") },
  { clave: "clave", titulo: "Versículos clave", re: new RegExp(`^${EMOJI("🛡")}\\s*VERS[IÍ]CULOS CLAVE`, "iu") },
];

/**
 * Donde acaba el Bloque 1. DeepSeek entrega los cuatro bloques seguidos y es
 * fácil copiarlos juntos: sin este corte, el prompt de la imagen, «lo que
 * aprendí hoy» y la alerta de mañana acababan dentro del turno «Comparte».
 */
const RE_OTRO_BLOQUE = /BLOQUE\s*[234]\b|lo que aprend[ií] hoy|ALERTA\s+D[IÍ]A\s+\d/i;
const RE_APRENDI = /lo que aprend[ií] hoy/i;

type Parte = { tipo: Trozo["tipo"]; titulo?: string; ref?: string; lineas: string[]; texto?: string };

export type DevocionalPartido = {
  /** El número de la cabecera, si la trae. Sirve para comprobar que se pega en el día que toca. */
  dia: number | null;
  /** Cuántas cabeceras «DÍA N DE 365» trae: más de una es que se pegaron dos días. */
  cabeceras: number;
  tema: string;
  capitulos: string[];
  trozos: Trozo[];
  /** «Lo que aprendí hoy» (Bloque 3), si venía pegado detrás. */
  aprendi?: string;
};

/**
 * Lo mismo que hace el extractor con el chat antes de partir: sin las
 * negritas de WhatsApp («*Éxodo 9:1-5:*») y el «**» de markdown, sin espacios
 * duros ni al final de línea. Sin esto, un texto copiado del grupo perdía
 * todos los pasajes.
 */
export function limpiarPegado(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/\*/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n");
}

export function partirDevocional(pegado: string): DevocionalPartido {
  const limpio = limpiarPegado(pegado);
  const todas = limpio.split("\n");
  // El Bloque 1 acaba donde empieza otro bloque. Lo que venga detrás, si es
  // «lo que aprendí hoy», se devuelve aparte.
  let corte = todas.length;
  let aprendi: string | undefined;
  for (let i = 0; i < todas.length; i++) {
    if (i > 0 && RE_OTRO_BLOQUE.test(todas[i]) && todas.slice(0, i).some((l) => l.trim())) {
      corte = i;
      const resto = todas.slice(i);
      const j = resto.findIndex((l) => RE_APRENDI.test(l));
      if (j >= 0) {
        const fin = resto.findIndex((l, k) => k > j && /BLOQUE\s*[24]\b|ALERTA\s+D[IÍ]A/i.test(l));
        // Desde la frase, no desde la línea: igual que el extractor, que corta
        // el «🤩 » de delante. Si no, el título salía repetido en la sección.
        const bloque = resto.slice(j, fin < 0 ? undefined : fin).join("\n");
        aprendi = bloque.slice(bloque.search(RE_APRENDI)).trim() || undefined;
      }
      break;
    }
  }
  const lineas = todas.slice(0, corte);
  const devocional = lineas.join("\n");
  const cabecera = RE_DIA.exec(devocional) ?? RE_ALERTA.exec(devocional);
  const cabeceras = (devocional.match(new RegExp(RE_DIA.source, "gi")) ?? []).length;
  // «✨ EL TEMA: …» casi siempre; «✨ TEMA: …» el día que salió con la cabecera
  // de la alerta.
  const tema = (lineas.find((l) => /(?:EL\s+)?TEMA\s*:/i.test(l)) ?? "")
    .replace(/.*?(?:EL\s+)?TEMA\s*:\s*/i, "")
    .replace(/✨/g, "")
    .trim();

  /** La siguiente línea con algo, para decidir qué es la actual. */
  const siguiente = (i: number) => {
    for (let k = i + 1; k < lineas.length; k++) if (lineas[k].trim()) return lineas[k].trim();
    return "";
  };

  const partes: Parte[] = [];
  const capitulos: string[] = [];
  let actual: Parte | null = null;
  let capitulo: { libro: string; cap: string } | null = null; // el del último encabezado de capítulo
  const cerrar = () => {
    if (actual) {
      actual.texto = actual.lineas.join("\n").trim();
      if (actual.texto) partes.push(actual);
    }
    actual = null;
  };

  lineas.forEach((l, i) => {
    const t = l.trim();
    if (!t || /^-{3,}$/.test(t)) {
      if (actual) actual.lineas.push("");
      return;
    }
    if (RE_DIA.test(t) || RE_ALERTA.test(t) || /^✨?\s*(?:EL\s+)?TEMA\s*:/i.test(t)) return; // la cabecera

    const sec = SECCIONES.find((s) => s.re.test(t));
    if (sec) {
      cerrar();
      actual = { tipo: sec.clave, titulo: sec.titulo, lineas: [] };
      return;
    }

    // ¿Un encabezado de pasaje, o de capítulo? Lo decide la línea de debajo:
    // si es un versículo, empieza un trozo que se lee; si es otra referencia,
    // esto encabeza el capítulo entero.
    const ref = RE_REFERENCIA.exec(t);
    const corta = !ref && capitulo ? RE_CORTA.exec(t) : null;
    if (ref || corta) {
      const debajo = siguiente(i);
      if (RE_VERSICULO.test(debajo)) {
        if (ref) capitulo = { libro: ref[1], cap: ref[2] };
        const [a, b] = ref ? [ref[3], ref[4]] : [corta![1], corta![2]];
        cerrar();
        actual = {
          tipo: "pasaje",
          ref: `${capitulo!.libro} ${capitulo!.cap}:${a}${b && b !== a ? `-${b}` : ""}`,
          lineas: [],
        };
        return;
      }
      if (ref) {
        cerrar();
        capitulo = { libro: ref[1], cap: ref[2] };
        capitulos.push(`${ref[1]} ${ref[2]}`);
        return;
      }
    }

    // Los primeros días la reflexión no llevaba encabezado: empezaba con «1.»
    // justo después del último pasaje. Un «1.» no es un versículo («1 Y…»).
    const enCurso = actual as Parte | null;
    if ((!enCurso || enCurso.tipo === "pasaje") && RE_PUNTO.test(t)) {
      cerrar();
      actual = { tipo: "reflexion", titulo: "Reflexión", lineas: [] };
    }
    if (!actual) return;
    (actual as Parte).lineas.push(l);
  });
  cerrar();

  // La reflexión y las preguntas se leen punto a punto: «1)» o «1.», cada
  // uno lo lee una persona. El resto, cada sección entera.
  const trozos: Trozo[] = [];
  for (const p of partes) {
    const texto = p.texto ?? "";
    if (p.tipo === "reflexion" || p.tipo === "preguntas") {
      const puntos: string[][] = [];
      for (const linea of texto.split("\n")) {
        if (RE_PUNTO.test(linea) || !puntos.length) puntos.push([linea]);
        else puntos[puntos.length - 1].push(linea);
      }
      puntos
        .map((x) => x.join("\n").trim())
        .filter(Boolean)
        .forEach((t, i) => trozos.push({ tipo: p.tipo, ref: `${p.titulo} · ${i + 1}`, texto: t }));
    } else if (p.tipo === "pasaje") {
      // La referencia se saca de los versículos que trae de verdad: en el
      // chat hay etiquetas que no cuadran («2 Reyes 6:6-10» con el 11
      // dentro), y lo que se lee es lo que está escrito, no la etiqueta.
      const numeros = texto
        .split("\n")
        .map((l) => /^\s*(\d{1,3})\s+\S/.exec(l)?.[1])
        .filter((x): x is string => !!x)
        .map(Number);
      const base = (p.ref ?? "").replace(/:\d.*$/, "");
      const ref = numeros.length
        ? `${base}:${numeros[0]}${numeros[numeros.length - 1] !== numeros[0] ? `-${numeros[numeros.length - 1]}` : ""}`
        : (p.ref ?? "");
      trozos.push({ tipo: "pasaje", ref, texto });
    } else {
      trozos.push({ tipo: p.tipo, ref: p.titulo ?? "", texto });
    }
  }
  // Los capítulos de la cabecera a veces sólo nombran el Antiguo Testamento
  // (día 262: «Eclesiastés 7-9» y luego viene 2 Corintios 11). Mandan los
  // pasajes que de verdad se copiaron, en su orden.
  for (const t of trozos) {
    if (t.tipo !== "pasaje") continue;
    const cap = t.ref.replace(/:\d.*$/, "");
    if (!capitulos.includes(cap)) capitulos.push(cap);
  }
  return {
    dia: cabecera ? Number(cabecera[1]) : null,
    cabeceras,
    tema,
    capitulos,
    trozos,
    ...(aprendi ? { aprendi } : {}),
  };
}
