import type { ReactNode } from "react";

/**
 * Los iconos de la barra: trazo fino, extremos redondos (Genuino Cristal, 6.33).
 * Antes eran signos de texto (◎ ≡ ✎ ✉ ◈ ⋯), que cambiaban de aspecto según el
 * móvil; así se ven igual en todos y toman el color de la pestaña.
 */
const TRAZOS: Record<string, ReactNode> = {
  // El amanecer: un sol que asoma sobre el horizonte.
  hoy: (
    <>
      <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0" />
      <path d="M12 6.5v2.5M4.6 10.1l1.8 1.8M19.4 10.1l-1.8 1.8" />
    </>
  ),
  // Capas: los planes se apilan.
  planes: (
    <>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" opacity=".55" />
    </>
  ),
  // La pluma del diario.
  diario: (
    <>
      <path d="M5 19.5 6 15 16.5 4.5a2 2 0 0 1 3 3L9 18z" />
      <path d="m14.5 6.5 3 3M4.5 20.5h8" />
    </>
  ),
  // Un mensaje, con su destello.
  mensaje: (
    <>
      <path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z" />
      <path d="M12 8.5v5M9.5 11h5" />
    </>
  ),
  // Juntos: dos personas y la luz entre ellas.
  comunidad: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6a3 3 0 0 1 0 5.6M17.5 14.6A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  mas: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
};

export function IconoBarra({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {TRAZOS[id] ?? TRAZOS.mas}
    </svg>
  );
}
