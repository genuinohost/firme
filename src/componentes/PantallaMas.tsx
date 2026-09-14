import type { ReactNode } from "react";

/**
 * El menú de lo que no cabe en la barra de abajo.
 *
 * Con planes, mensajes y comunidad, las pestañas pasaron de cinco a ocho, y en
 * un móvil de 375 píxeles ocho no se pueden tocar sin fallar. Aquí viven las que
 * se usan de vez en cuando; las diarias siguen a un toque.
 */
export function PantallaMas({
  nombre,
  racha,
  opciones,
}: {
  nombre: string;
  racha: number;
  opciones: { id: string; icono: string; titulo: string; detalle: string; onIr: () => void }[];
}) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">{nombre ? `Hola, ${nombre}` : "Más"}</h1>
        <p className="mt-1 text-sm text-tenue">
          {racha > 0
            ? `Llevas ${racha} ${racha === 1 ? "día seguido" : "días seguidos"}. No lo sueltes.`
            : "Todo lo que no usas cada día."}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        {opciones.map((o) => (
          <button
            key={o.id}
            onClick={o.onIr}
            className="flex items-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3.5 text-left transition hover:border-acento"
          >
            <span className="text-xl" aria-hidden>
              {o.icono}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">{o.titulo}</span>
              <span className="block text-xs text-tenue">{o.detalle}</span>
            </span>
            <span className="shrink-0 text-tenue">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cabecera con vuelta atrás, para las pantallas que se abren desde el menú. */
export function ConVuelta({
  titulo,
  onVolver,
  children,
}: {
  titulo: string;
  onVolver: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 px-2 pt-2">
        <button
          onClick={onVolver}
          className="rounded-lg px-3 py-2 text-sm text-tenue transition hover:text-texto"
        >
          ‹ Más
        </button>
        <span className="text-sm text-tenue">/ {titulo}</span>
      </div>
      {children}
    </div>
  );
}
