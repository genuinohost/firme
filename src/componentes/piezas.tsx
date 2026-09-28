import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { compartirFrase, type ResultadoCompartir } from "@/logica/compartir";
import { alternar, estaGuardada } from "@/logica/favoritas";
import { CATEGORIAS, type Categoria } from "@/datos/tipos";

export function colorDe(categoria: Categoria): string {
  return CATEGORIAS.find((c) => c.id === categoria)?.color ?? "#8b949e";
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
   * recorre cada siete segundos. **Uno por pantalla**, o deja de destacar.
   */
  vivo?: boolean;
}) {
  const estilos: Record<string, string> = {
    normal: "bg-superficie-alta border-borde hover:border-tenue",
    fuerte: "bg-acento text-fondo border-acento font-semibold hover:brightness-110",
    logro: "bg-logro text-fondo border-logro font-semibold hover:brightness-110",
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
    <div className={`aparece rounded-2xl border border-borde bg-superficie p-4 ${className}`}>
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

const DIGITOS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Un número que RUEDA, como un cuentakilómetros.
 *
 * Cada dígito es una columna de 1em con la tira 0-9 detrás; al cambiar, la
 * tira se desplaza con `transform` y se pasa un poco antes de asentarse
 * (`.rodillo-tira` en estilos.css). Sólo transform: un móvil viejo lo mueve
 * sin recalcular nada, aunque ruede cada segundo en la cuenta atrás.
 *
 * La clave de cada columna cuenta DESDE LA DERECHA: al pasar de 9 a 10 la
 * columna de las unidades conserva su identidad y rueda, y la nueva —las
 * decenas— entra apareciendo. Lo que no es dígito (los dos puntos de «12:34»)
 * se pinta quieto.
 *
 * De 9 a 0 la tira vuelve hacia atrás en vez de dar la vuelta completa (eso
 * pediría una tira doble). En la racha pasa una vez cada diez días y en la
 * cuenta atrás se ve como el giro rápido de un contador: está bien así.
 */
export function Rodillo({
  valor,
  minimo = 1,
  className = "",
}: {
  valor: number | string;
  /** Cifras mínimas: con 2, el 5 se pinta «05». */
  minimo?: number;
  className?: string;
}) {
  const texto =
    typeof valor === "number"
      ? String(Math.max(0, Math.round(valor))).padStart(minimo, "0")
      : valor;
  const letras = texto.split("");
  return (
    <span className={`rodillo ${className}`} aria-label={texto} role="text">
      {letras.map((c, i) =>
        /\d/.test(c) ? (
          <span key={letras.length - i} className="rodillo-col aparece" aria-hidden>
            <span
              className="rodillo-tira"
              style={{ transform: `translateY(-${Number(c) * 10}%)` }}
            >
              {DIGITOS.map((d) => (
                <span key={d} className="rodillo-digito">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={`s${letras.length - i}`} className="rodillo-digito" aria-hidden>
            {c}
          </span>
        ),
      )}
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
              <span key={String(guardada)} className={guardada ? "snap-ok inline-block" : "inline-block"}>
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
