import { useEffect, useState } from "react";
import { claveDia, listarAsistencia, type Asistencia as Registro } from "@/logica/asistencia";
import { puedoModerar } from "@/logica/muro";
import { Etiqueta, Tarjeta } from "./piezas";

/**
 * El control de asistencias, para quien modera.
 *
 * Alex, 28-09-2026: «debo tener un control de asistencias e inasistencias».
 * Cada hermano, con su racha 🔥 (días seguidos viniendo al devocional) y sus
 * faltas 😢 del último mes, y si vino hoy. Los de racha más larga arriba.
 *
 * Para los demás no se pinta: las reglas no les darían la lista.
 */
export function Asistencia() {
  const [lista, setLista] = useState<Registro[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void puedoModerar().then(async (modero) => {
      if (!vivo || !modero) return;
      const l = await listarAsistencia().catch(() => []);
      if (vivo) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!lista) return null;
  const hoy = claveDia(new Date());

  return (
    <Tarjeta>
      <Etiqueta>asistencia al devocional</Etiqueta>
      <p className="mt-2 text-xs leading-relaxed text-tenue">
        🔥 días seguidos viniendo · 😢 faltas en el último mes. Se apunta solo, al entrar a
        la sala.
      </p>
      {lista.length === 0 ? (
        <p className="mt-3 text-sm text-tenue">Nadie ha entrado todavía a un devocional.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {lista.map((a) => (
            <li
              key={a.uid}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                a.ultimo === hoy ? "border-logro/40 bg-superficie" : "border-borde bg-superficie/60"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{a.nombre || `@${a.usuario}`}</p>
                <p className="truncate text-xs text-tenue">
                  {a.ultimo === hoy ? "vino hoy" : a.ultimo ? `último día: ${a.ultimo}` : ""}
                </p>
              </div>
              <p className="shrink-0 text-sm" aria-label={`${a.racha} días seguidos, ${a.faltas} faltas`}>
                <span className="text-acento">🔥{a.racha}</span>
                {a.faltas > 0 ? <span className="ml-2 text-tenue">😢{a.faltas}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
