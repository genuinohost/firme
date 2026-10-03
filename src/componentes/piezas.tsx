import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAcabaDe } from "@/logica/recien";
import { compartirFrase, type ResultadoCompartir } from "@/logica/compartir";
import { alternar, estaGuardada } from "@/logica/favoritas";
import { CATEGORIAS, type Categoria } from "@/datos/tipos";

export function colorDe(categoria: Categoria): string {
  return CATEGORIAS.find((c) => c.id === categoria)?.color ?? "#5a6785";
}

export function nombreCategoria(categoria: Categoria): string {
  return CATEGORIAS.find((c) => c.id === categoria)?.nombre ?? categoria;
}

export function Boton({
  children,
  onClick,
  variante = "normal",
  ancho,
  deshabilitado,
  tipo = "button",
  vivo,
}: {
  children: ReactNode;
  /** Recibe el evento por si hace falta saber DESDE DÓNDE se tocó (celebrar). */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variante?: "normal" | "fuerte" | "logro" | "fallo" | "fantasma";
  ancho?: boolean;
  deshabilitado?: boolean;
  tipo?: "button" | "submit";
  /**
   * El botón principal de la pantalla: con halo debajo y un reflejo que lo
   * recorre tres veces al aparecer. **Uno por pantalla**, o deja de destacar.
   */
  vivo?: boolean;
}) {
  const estilos: Record<string, string> = {
    normal: "bg-superficie-alta border-borde hover:border-tenue",
    fuerte:
      "bg-acento text-sobre-acento border-acento font-semibold shadow-[0_10px_26px_-12px_var(--color-acento)] hover:brightness-110",
    logro:
      "bg-logro text-sobre-color border-logro font-semibold shadow-[0_10px_26px_-12px_var(--color-logro)] hover:brightness-110",
    fallo: "bg-transparent border-borde text-tenue hover:text-fallo hover:border-fallo",
    fantasma: "bg-transparent border-transparent text-tenue hover:text-texto",
  };
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado}
      className={`toque rounded-xl border px-4 py-3 text-sm disabled:opacity-40 ${estilos[variante]} ${ancho ? "w-full" : ""} ${vivo ? "boton-vivo" : ""}`}
    >
      {children}
    </button>
  );
}

export function Tarjeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`aparece cristal rounded-2xl border border-borde p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Etiqueta({
  children,
  filete,
}: {
  children: ReactNode;
  /** Con una línea de oro debajo que se dibuja al entrar. Para la primera
      etiqueta de sección de cada pantalla, no para todas. */
  filete?: boolean;
}) {
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-[0.14em] text-tenue ${
        filete ? "etiqueta-filete" : ""
      }`}
    >
      {children}
    </span>
  );
}

/** Tres vueltas de 0 a 9: la del medio es la que se ve; las otras dos dan
    sitio para pasar de 9 a 0 (y de 0 a 9) sin desandar la tira entera. */
const TIRA = Array.from({ length: 30 }, (_, i) => String(i % 10));

/**
 * Un número que RUEDA, como un cuentakilómetros.
 *
 * Cada dígito es una columna de 1em con una tira de dígitos detrás; al
 * cambiar, la tira se desplaza con `transform` y se pasa un poco antes de
 * asentarse (`.rodillo-tira` en estilos.css). Sólo transform: un móvil viejo
 * lo mueve sin recalcular nada, aunque ruede cada segundo en la cuenta atrás.
 *
 * La clave de cada columna cuenta DESDE LA DERECHA: al pasar de 9 a 10 la
 * columna de las unidades conserva su identidad y rueda, y la nueva —las
 * decenas— entra apareciendo. Lo que no es dígito (los dos puntos de «12:34»)
 * se pinta quieto.
 *
 * Y rueda **por el camino corto**: de 9 a 0 sigue hacia delante un paso, no
 * vuelve nueve hacia atrás; en una cuenta atrás, de 0 a 9 sigue hacia atrás.
 * Para eso la tira lleva tres vueltas y cada columna recuerda su posición
 * (`Columna`); cuando se sale de la vuelta del medio, salta a la equivalente
 * sin transición, que es el truco de todos los cuentakilómetros de pantalla.
 */
export function Rodillo({
  valor,
  minimo = 1,
  className = "",
  porSegundos = false,
}: {
  valor: number | string;
  /** Cifras mínimas: con 2, el 5 se pinta «05». */
  minimo?: number;
  className?: string;
  /** Cuenta atrás con segundos: la última cifra rueda corto (200 ms) para
      que el compositor descanse la mayor parte de cada segundo. */
  porSegundos?: boolean;
}) {
  const texto =
    typeof valor === "number"
      ? String(Math.max(0, Math.round(valor))).padStart(minimo, "0")
      : valor;
  const letras = texto.split("");
  return (
    <span className={`rodillo ${porSegundos ? "rodillo-segundos" : ""} ${className}`}>
      <span className="sr-only">{texto}</span>
      {letras.map((c, i) =>
        /\d/.test(c) ? (
          <Columna key={letras.length - i} digito={Number(c)} />
        ) : (
          <span key={`s${letras.length - i}`} className="rodillo-digito" aria-hidden>
            {c}
          </span>
        ),
      )}
    </span>
  );
}

/** La posición equivalente en la vuelta del medio de la tira (10 a 19). */
const alMedio = (p: number) => (((p % 10) + 10) % 10) + 10;

/** Una columna del rodillo: recuerda dónde está y va por el camino corto. */
function Columna({ digito }: { digito: number }) {
  // La posición en la tira, en dígitos. Arranca en la vuelta del medio.
  const [pos, setPos] = useState(10 + digito);
  const anterior = useRef(digito);
  const posActual = useRef(pos);
  posActual.current = pos;
  const tira = useRef<HTMLSpanElement>(null);

  // Fuera de la vuelta del medio: al acabar de rodar, saltar a la posición
  // equivalente sin que se vea (mismo dígito). El salto se aplica a mano,
  // sin transición y forzando el reflow entre medias: así el navegador lo
  // pinta de golpe aunque la pestaña esté detrás (un requestAnimationFrame
  // no correría ahí), y React después sólo confirma el mismo valor.
  const saltarAlMedio = (): number => {
    const p = posActual.current;
    const m = alMedio(p);
    if (m === p) return p;
    const el = tira.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translateY(${-m}em)`;
      void el.offsetHeight;
      el.style.transition = "";
    }
    posActual.current = m;
    return m;
  };
  const recolocar = () => {
    const antes = posActual.current;
    const m = saltarAlMedio();
    if (m !== antes) setPos(m);
  };

  useEffect(() => {
    if (anterior.current === digito) return;
    // El paso más corto entre los dos dígitos, entre -5 y +4.
    const paso = ((digito - anterior.current + 15) % 10) - 5;
    anterior.current = digito;
    // Si se quedó fuera del medio —la pantalla estuvo apagada, o el tick
    // anterior aún rueda—, PRIMERO se salta al medio sin transición y después
    // se da el paso: así nunca se sale de la tira ni da una vuelta casi
    // entera por partir de la posición vieja. (Revisión de la 6.18.)
    setPos(saltarAlMedio() + paso);
    // Y por si el transitionend no llega (pestaña detrás), se recoloca igual.
    const id = window.setTimeout(recolocar, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digito]);

  return (
    <span className="rodillo-col aparece" aria-hidden>
      <span
        ref={tira}
        className="rodillo-tira"
        style={{ transform: `translateY(${-pos}em)` }}
        onTransitionEnd={recolocar}
      >
        {TIRA.map((d, i) => (
          <span key={i} className="rodillo-digito">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * El ✓ como trazo, para que pueda DIBUJARSE: dentro de `.snap-ok`, el CSS lo
 * traza de izquierda a derecha en 380 ms. Fuera, es un ✓ normal.
 */
export function CheckDibujado({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path className="trazo-check" pathLength={1} d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

/** Para poner `--i` y demás variables en `style` sin pelearse con TypeScript. */
export function vars(v: Record<string, number | string>): CSSProperties {
  return v as CSSProperties;
}

/**
 * Lo que va en `position: fixed` no puede vivir dentro de `<main>`: mientras
 * `.pantalla-entra` lo transforma (450 ms), `main` pasa a ser el bloque
 * contenedor de todo `fixed` de dentro, y un diálogo que se abre en ese
 * instante —el editor de la rutina al tocar un bloque desde Hoy— se desliza
 * con la pantalla y pega un salto al asentarse. Esto lo saca al `body`,
 * fuera de cualquier transform. Los eventos de React siguen subiendo por el
 * árbol de componentes, así que nada más cambia. (Revisión de la 6.18.)
 */
export function Capa({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

export function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Etiqueta>{etiqueta}</Etiqueta>
      {children}
    </label>
  );
}

/**
 * El `w-full` no es adorno: sin él, una entrada fuera de `Campo` se queda con
 * el ancho por defecto del navegador y se descoloca. Dentro de `Campo` no se
 * notaba porque ese contenedor la estiraba, así que el fallo solo aparecía al
 * usarlas sueltas.
 */
const claseEntrada =
  "w-full rounded-xl border border-borde bg-superficie-alta px-3 py-2.5 outline-none transition focus:border-acento";

export function Entrada(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${claseEntrada} ${props.className ?? ""}`} />;
}

export function AreaTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${claseEntrada} resize-none leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Selector(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${claseEntrada} ${props.className ?? ""}`} />;
}

export function Punto({ categoria }: { categoria: Categoria }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: colorDe(categoria) }}
      aria-hidden
    />
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-borde px-4 py-8 text-center text-sm text-tenue">
      {children}
    </p>
  );
}

export function Cita({
  texto,
  fuente,
  grande,
  compartible = true,
}: {
  texto: string;
  fuente?: string;
  grande?: boolean;
  /** Las frases efímeras (el aviso al cumplir) no llevan botón. */
  compartible?: boolean;
}) {
  const [estado, setEstado] = useState<ResultadoCompartir | null>(null);
  const [guardada, setGuardada] = useState(() => estaGuardada(texto));
  // El ♥ celebra sólo cuando se ACABA de guardar, no cuando ya lo estaba al
  // abrir la pantalla (regla 3 del movimiento). Mismo plazo que el ✓ de la
  // fila: cubre el rebote (600 ms) y el anillo (710 ms).
  const recienGuardada = useAcabaDe(guardada);

  // El aviso de «copiado» se retira solo.
  useEffect(() => {
    if (!estado) return;
    const id = window.setTimeout(() => setEstado(null), 2200);
    return () => clearTimeout(id);
  }, [estado]);

  // Al cambiar de frase hay que volver a mirar si esta está guardada.
  useEffect(() => setGuardada(estaGuardada(texto)), [texto]);

  return (
    <figure className="m-0">
      <blockquote className={`cita m-0 ${grande ? "text-lg" : "text-[15px]"}`}>
        «{texto}»
      </blockquote>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <figcaption className="text-xs tracking-wide text-tenue">
          {fuente ? `— ${fuente}` : ""}
        </figcaption>
        {compartible ? (
          <div className="-mr-1 flex shrink-0 items-center gap-1">
            <button
              onClick={() => setGuardada(alternar(texto, fuente))}
              className={`toque rounded-lg px-2 py-1 text-sm ${
                guardada ? "text-acento" : "text-tenue hover:text-acento"
              }`}
              aria-label={guardada ? "Quitar de guardadas" : "Guardar esta frase"}
              aria-pressed={guardada}
            >
              <span className={recienGuardada ? "snap-ok inline-block" : "inline-block"}>
                {guardada ? "♥" : "♡"}
              </span>
            </button>
            <button
              onClick={async () => setEstado(await compartirFrase({ texto, fuente }))}
              className="toque rounded-lg px-2 py-1 text-xs text-tenue hover:text-acento"
              aria-label="Compartir esta frase"
            >
              {estado === "copiado"
                ? "copiada ✓"
                : estado === "fallo"
                  ? "no se pudo"
                  : "compartir"}
            </button>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
