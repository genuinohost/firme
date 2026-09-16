import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { Datos, Nota } from "@/datos/tipos";
import { copiar, type ResultadoCompartir } from "./compartir";

/**
 * Sacar del teléfono lo que uno ha escrito.
 *
 * Alex: «la app debe tener opción para poder guardar, compartir o descargar las
 * notas… para muchos es muy importante poder escribir día a día». Detrás de esa
 * frase hay un miedo razonable: que años de diario se queden atrapados dentro
 * de una app, a merced de un móvil que se pierde o de una desinstalación por
 * error. Un diario del que no se puede sacar nada no es un diario, es un pozo.
 *
 * Aquí no se envía nada a ningún sitio. El archivo se escribe en el teléfono y
 * se abre el menú de compartir del sistema, que es quien decide dónde acaba: el
 * usuario elige, y nosotros no vemos ni una línea.
 */

export type ResultadoExportar =
  | { como: "archivo"; donde: string }
  | { como: "descarga" }
  | { como: "compartido" }
  | { como: "copiado" }
  | { como: "fallo"; motivo: string };

const dosCifras = (n: number) => String(n).padStart(2, "0");

/** «16 de septiembre de 2026», que es como se lee un diario. */
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaLarga(clave: string): string {
  const [a, m, d] = clave.split("-").map(Number);
  if (!a || !m || !d) return clave;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/**
 * El diario entero como texto corrido.
 *
 * Agrupado por día y en orden, del primero al último: se lee como un cuaderno,
 * no como un volcado. Las notas que nacieron del repaso de un plan llevan
 * escrito de cuál y cómo acabó aquel día, porque eso es la mitad de su valor.
 */
export function diarioComoTexto(datos: Datos, notas?: Nota[]): string {
  const lista = [...(notas ?? datos.notas ?? [])].sort((a, b) =>
    a.fecha === b.fecha ? a.momento - b.momento : a.fecha.localeCompare(b.fecha),
  );
  if (lista.length === 0) return "";

  const nombrePlan = (id?: string) =>
    (datos.planes ?? []).find((p) => p.id === id)?.nombre ?? "un plan";

  const l: string[] = [];
  l.push("MI DIARIO");
  const quien = datos.ajustes?.nombre?.trim();
  if (quien) l.push(quien);
  l.push(`${lista.length} ${lista.length === 1 ? "nota" : "notas"}`);
  l.push("");

  let diaActual = "";
  for (const n of lista) {
    if (n.fecha !== diaActual) {
      diaActual = n.fecha;
      l.push("");
      l.push(fechaLarga(n.fecha));
      l.push("-".repeat(fechaLarga(n.fecha).length));
    }
    const f = new Date(n.momento);
    const marca = `${dosCifras(f.getHours())}:${dosCifras(f.getMinutes())}`;
    const contexto = n.plan
      ? ` · ${nombrePlan(n.plan)}${
          n.estado === "ganado"
            ? " (día guardado)"
            : n.estado === "restaurado"
              ? " (restaurado)"
              : n.estado === "fallado"
                ? " (día caído)"
                : ""
        }`
      : "";
    l.push(`[${marca}${contexto}]`);
    l.push(n.texto);
    l.push("");
  }

  l.push("");
  l.push("Escrito en Genuino · Disciplina Cristiana");
  return l.join("\n");
}

/** Un nombre de archivo que ordena solo y no choca con el del mes pasado. */
export function nombreDeArchivo(ahora = new Date()): string {
  return `diario-genuino-${ahora.getFullYear()}-${dosCifras(ahora.getMonth() + 1)}-${dosCifras(
    ahora.getDate(),
  )}.txt`;
}

/**
 * Escribe el archivo y ofrece el menú de compartir del sistema.
 *
 * En Android el archivo queda en Documentos, dentro de la carpeta de la app, y
 * desde el menú se puede mandar a Drive, a WhatsApp o guardarlo donde se
 * quiera. Si algo de eso falla se baja escalón por escalón —compartir el texto
 * suelto, y al final copiarlo— porque lo que no puede pasar es que el botón no
 * haga nada.
 */
export async function exportarTexto(
  texto: string,
  nombre: string,
  titulo: string,
): Promise<ResultadoExportar> {
  if (!texto.trim()) return { como: "fallo", motivo: "No hay nada escrito todavía." };

  if (Capacitor.isNativePlatform()) {
    try {
      const escrito = await Filesystem.writeFile({
        path: nombre,
        data: texto,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      try {
        await Share.share({ title: titulo, url: escrito.uri, dialogTitle: titulo });
        return { como: "archivo", donde: nombre };
      } catch {
        // Cancelar el menú también cae aquí, y el archivo ya está guardado.
        return { como: "archivo", donde: nombre };
      }
    } catch {
      // Sin permiso de escritura queda mandar el texto suelto.
    }
    try {
      await Share.share({ title: titulo, text: texto, dialogTitle: titulo });
      return { como: "compartido" };
    } catch {
      return desdeCopia(await copiar(texto));
    }
  }

  // En el navegador, un archivo de verdad que se descarga.
  try {
    const bolsa = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(bolsa);
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    // Se suelta después del clic: revocarla antes deja la descarga a medias.
    setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000);
    return { como: "descarga" };
  } catch {
    return desdeCopia(await copiar(texto));
  }
}

function desdeCopia(r: ResultadoCompartir): ResultadoExportar {
  if (r === "copiado") return { como: "copiado" };
  if (r === "compartido") return { como: "compartido" };
  return { como: "fallo", motivo: "No se pudo sacar el texto del teléfono." };
}

/** Compartir una sola nota, sin firma de marca: esto es suyo, no propaganda. */
export async function compartirNota(nota: Nota, datos: Datos): Promise<ResultadoExportar> {
  const plan = (datos.planes ?? []).find((p) => p.id === nota.plan);
  const encabezado = `${fechaLarga(nota.fecha)}${plan ? ` · ${plan.nombre}` : ""}`;
  const texto = `${encabezado}\n\n${nota.texto}`;

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ text: texto, dialogTitle: "Compartir la nota" });
      return { como: "compartido" };
    } catch {
      return desdeCopia(await copiar(texto));
    }
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texto });
      return { como: "compartido" };
    } catch {
      return desdeCopia(await copiar(texto));
    }
  }
  return desdeCopia(await copiar(texto));
}

/** Frase para el aviso, según por dónde salió. */
export function comoFue(r: ResultadoExportar): string {
  switch (r.como) {
    case "archivo":
      return `Guardado en Documentos como ${r.donde}`;
    case "descarga":
      return "Descargado";
    case "compartido":
      return "Compartido";
    case "copiado":
      return "Copiado al portapapeles";
    case "fallo":
      return r.motivo;
  }
}
