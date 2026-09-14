/**
 * Las frases y los mensajes que Alex quiere conservar.
 *
 * Se guardan enteros, no por referencia: una frase generada por internet no
 * existe en ningún banco, y una del banco podría cambiar de redacción más
 * adelante. Lo que se guardó es lo que se vuelve a leer.
 */

const CLAVE = "firme.favoritas";

export type Favorita = {
  /** Huella del texto: evita guardar dos veces lo mismo. */
  id: string;
  texto: string;
  /** El autor o la cita bíblica, cuando la frase lo trae. */
  fuente?: string;
  /** Milisegundos. Para ordenar de lo más reciente a lo más antiguo. */
  guardada: number;
  /** De qué iba, si se guardó desde la pantalla de mensajes. */
  tema?: string;
};

/** Una huella estable del texto, para reconocerlo aunque venga de otro sitio. */
export function huella(texto: string): string {
  let h = 2166136261;
  const limpio = texto.trim();
  for (let i = 0; i < limpio.length; i++) {
    h ^= limpio.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function listar(): Favorita[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const lista = JSON.parse(crudo) as Favorita[];
    return Array.isArray(lista) ? lista.sort((a, b) => b.guardada - a.guardada) : [];
  } catch {
    return [];
  }
}

function escribir(lista: Favorita[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* sin espacio o en modo privado */
  }
}

export function estaGuardada(texto: string): boolean {
  const id = huella(texto);
  return listar().some((f) => f.id === id);
}

/** Guarda o quita, según esté. Devuelve si quedó guardada. */
export function alternar(texto: string, fuente?: string, tema?: string): boolean {
  const id = huella(texto);
  const lista = listar();
  const yaEsta = lista.some((f) => f.id === id);

  if (yaEsta) {
    escribir(lista.filter((f) => f.id !== id));
    return false;
  }
  escribir([{ id, texto: texto.trim(), fuente, tema, guardada: Date.now() }, ...lista]);
  return true;
}

export function quitar(id: string): void {
  escribir(listar().filter((f) => f.id !== id));
}

/** Quita tildes y mayúsculas, para que «oracion» encuentre «Oración». */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function buscar(consulta: string): Favorita[] {
  const q = normalizar(consulta.trim());
  const lista = listar();
  if (!q) return lista;
  return lista.filter((f) =>
    normalizar(`${f.texto} ${f.fuente ?? ""} ${f.tema ?? ""}`).includes(q),
  );
}

export function cuantas(): number {
  return listar().length;
}
