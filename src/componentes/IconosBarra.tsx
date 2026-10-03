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
  // Las del menú «Más» (6.35): el mismo trazo fino.
  cuenta: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  fallo: (
    <>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </>
  ),
  pasar: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-5.5" />
    </>
  ),
  // El porqué: una estrella de cuatro puntas, la luz que guía.
  porque: <path d="M12 3c.6 4.7 2.3 6.4 7 7-4.7.6-6.4 2.3-7 7-.6-4.7-2.3-6.4-7-7 4.7-.6 6.4-2.3 7-7zM18.5 16.5v3M17 18h3" />,
  progreso: (
    <>
      <path d="M4 20V13M10 20V8M16 20v-9M21 20H3" />
      <path d="M13 4.5l3-1.5 3 3" opacity=".55" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
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
