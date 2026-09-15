import { useEffect, useState, type ReactNode } from "react";
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
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: "normal" | "fuerte" | "logro" | "fallo" | "fantasma";
  ancho?: boolean;
  deshabilitado?: boolean;
  tipo?: "button" | "submit";
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
      className={`rounded-xl border px-4 py-3 text-sm transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${estilos[variante]} ${ancho ? "w-full" : ""}`}
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
    <div className={`rounded-2xl border border-borde bg-superficie p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-tenue">
      {children}
    </span>
  );
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
              className={`rounded-lg px-2 py-1 text-sm transition ${
                guardada ? "text-acento" : "text-tenue hover:text-acento"
              }`}
              aria-label={guardada ? "Quitar de guardadas" : "Guardar esta frase"}
              aria-pressed={guardada}
            >
              {guardada ? "♥" : "♡"}
            </button>
            <button
              onClick={async () => setEstado(await compartirFrase({ texto, fuente }))}
              className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
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
