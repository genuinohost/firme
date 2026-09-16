/**
 * El código que protege lo que se escribe.
 *
 * Alex: «la app debería tener la opción, en ajustes, de poder establecer un
 * código de seguridad o abrir con la huella para que nadie pueda leer las cosas
 * privadas». Tiene toda la razón: el diario y el repaso de santidad son lo más
 * íntimo que guarda esta app —ahí se anota una caída y lo que se le dijo a Dios
 * por ella— y hoy los lee cualquiera que coja el teléfono desbloqueado.
 *
 * **Qué es esto y qué no es.** Esto impide que alguien abra la app y se ponga a
 * leer. No cifra el almacenamiento: quien tenga el móvil desbloqueado, sepa lo
 * que hace y se ponga a ello, puede llegar a los datos por debajo. Decirlo es
 * parte del trabajo — prometer una caja fuerte donde hay un pestillo sería
 * peor que no poner nada, porque se escribiría confiando en algo que no es.
 *
 * El código no se guarda. Se guarda su huella digital (SHA-256 con sal), que no
 * se puede deshacer: ni leyendo el almacenamiento se recupera el número.
 */

const CLAVE = "firme.cerradura";

/** Cuánto puede estar fuera antes de volver a pedirlo. */
export const GRACIA_MIN = 2;

type Guardado = {
  huella: string;
  sal: string;
  /** Minutos fuera de la app antes de volver a pedir el código. */
  graciaMin: number;
};

function leer(): Guardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as Guardado;
    if (!g?.huella || !g?.sal) return null;
    return { huella: g.huella, sal: g.sal, graciaMin: g.graciaMin ?? GRACIA_MIN };
  } catch {
    return null;
  }
}

export function hayCodigo(): boolean {
  return leer() !== null;
}

export function graciaDeLaCerradura(): number {
  return leer()?.graciaMin ?? GRACIA_MIN;
}

function salNueva(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * La huella del código.
 *
 * `crypto.subtle` sólo existe en contexto seguro. La app de Android lo es
 * (Capacitor sirve por https) y la web también, pero si algún día faltara, más
 * vale una huella pobre que dejar el código a la vista.
 */
async function huellaDe(codigo: string, sal: string): Promise<string> {
  const texto = `${sal}·genuino·${codigo}`;
  if (crypto?.subtle) {
    const datos = new TextEncoder().encode(texto);
    const resumen = await crypto.subtle.digest("SHA-256", datos);
    return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Último recurso, y bien marcado como tal.
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
  return `debil:${(h >>> 0).toString(16)}`;
}

export async function ponerCodigo(codigo: string, graciaMin = GRACIA_MIN): Promise<void> {
  const sal = salNueva();
  const huella = await huellaDe(codigo, sal);
  localStorage.setItem(CLAVE, JSON.stringify({ huella, sal, graciaMin } satisfies Guardado));
}

export async function acierta(codigo: string): Promise<boolean> {
  const g = leer();
  if (!g) return true; // sin código puesto, no hay nada que acertar
  return (await huellaDe(codigo, g.sal)) === g.huella;
}

/** Quitar el código exige saberlo: si no, no protegería de nada. */
export async function quitarCodigo(codigo: string): Promise<boolean> {
  if (!(await acierta(codigo))) return false;
  localStorage.removeItem(CLAVE);
  return true;
}

// ------------------------------------------------------- cuándo volver a pedir

const ULTIMA_VEZ = "firme.cerradura.visto";

/** Se apunta al salir: al volver se mira cuánto tiempo pasó. */
export function apuntarQueSeSalio(): void {
  try {
    sessionStorage.setItem(ULTIMA_VEZ, String(Date.now()));
  } catch {
    /* modo privado */
  }
}

/**
 * ¿Toca pedir el código?
 *
 * Al arrancar, siempre. Al volver de segundo plano, sólo si estuvo fuera más
 * del margen: pedirlo cada vez que se mira un mensaje de WhatsApp y se vuelve
 * acabaría con que Alex lo quita, y entonces no protege nada.
 */
export function tocaPedirlo(): boolean {
  if (!hayCodigo()) return false;
  try {
    const ultima = Number(sessionStorage.getItem(ULTIMA_VEZ) ?? 0);
    if (!ultima) return true;
    return Date.now() - ultima > graciaDeLaCerradura() * 60_000;
  } catch {
    return true;
  }
}

export function darPorAbierta(): void {
  try {
    sessionStorage.setItem(ULTIMA_VEZ, String(Date.now()));
  } catch {
    /* modo privado */
  }
}
