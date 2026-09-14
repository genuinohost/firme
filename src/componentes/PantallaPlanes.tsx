import { useMemo, useState } from "react";
import { PLANTILLAS } from "@/datos/planes/plantillas";
import type { Plan, PlantillaPlan } from "@/datos/planes/tipos";
import type { Datos } from "@/datos/tipos";
import { claveFecha } from "@/logica/dia";
import {
  crearDesdePlantilla,
  diasDesdeElComienzo,
  estadoDelDia,
  puntoMasFlojo,
  rachaDelPlan,
  sucesosDelPlan,
} from "@/logica/planes";
import { Boton, Etiqueta, Tarjeta, Vacio, colorDe } from "./piezas";

/**
 * Los planes: los compromisos que alguien decide sostener, cada uno con su
 * racha aparte.
 *
 * Que las cuentas vayan por separado es lo que hace esto útil: se puede llevar
 * cuarenta días madrugando y haber fallado ayer en santidad, y conviene saber
 * las dos cosas.
 */
export function PantallaPlanes({
  datos,
  ahora,
  onCrear,
  onAbrir,
}: {
  datos: Datos;
  ahora: Date;
  onCrear: (plan: Plan) => void;
  onAbrir: (id: string) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const planes = datos.planes ?? [];
  const hoy = claveFecha(ahora);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Mis planes</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Cada plan lleva su propia cuenta. Empieza por uno: más vale uno sostenido
          que cinco abandonados.
        </p>
      </header>

      {planes.length === 0 ? (
        <Vacio>Todavía no tienes ningún plan. Elige el primero abajo.</Vacio>
      ) : null}

      {planes.map((plan) => (
        <FilaPlan
          key={plan.id}
          plan={plan}
          datos={datos}
          hoy={hoy}
          ahora={ahora}
          onAbrir={() => onAbrir(plan.id)}
        />
      ))}

      <Boton variante="fuerte" ancho onClick={() => setEligiendo(true)}>
        + Empezar un plan
      </Boton>

      {eligiendo ? (
        <ElegirPlan
          yaTiene={planes.map((p) => p.plantilla)}
          onElegir={(plantilla, hora) => {
            onCrear(crearDesdePlantilla(plantilla, { hora, hoy: ahora }));
            setEligiendo(false);
          }}
          onCerrar={() => setEligiendo(false)}
        />
      ) : null}
    </div>
  );
}

function FilaPlan({
  plan,
  datos,
  hoy,
  ahora,
  onAbrir,
}: {
  plan: Plan;
  datos: Datos;
  hoy: string;
  ahora: Date;
  onAbrir: () => void;
}) {
  const racha = useMemo(() => rachaDelPlan(plan, datos, ahora), [plan, datos, ahora]);
  const estado = estadoDelDia(plan, hoy, datos, true);
  const dias = diasDesdeElComienzo(plan, ahora);
  const flojo = useMemo(() => puntoMasFlojo(plan, datos, 30, ahora), [plan, datos, ahora]);

  const leyenda = {
    ganado: { texto: "hoy, cumplido", color: "text-logro" },
    fallado: { texto: "hoy falló algo", color: "text-fallo" },
    pendiente: { texto: "pendiente hoy", color: "text-acento" },
    sinNada: { texto: "sin nada hoy", color: "text-tenue" },
  }[estado];

  return (
    <button
      onClick={onAbrir}
      className={`w-full rounded-2xl border bg-superficie p-4 text-left transition hover:border-tenue ${
        plan.activo ? "border-borde" : "border-borde opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {plan.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{plan.nombre}</p>
          <p className={`mt-0.5 text-xs ${leyenda.color}`}>{leyenda.texto}</p>
        </div>
        <div className="shrink-0 text-right leading-none">
          <span className="cifras text-2xl font-bold text-acento">{racha}</span>
          <div className="mt-1">
            <Etiqueta>{racha === 1 ? "día" : "días"}</Etiqueta>
          </div>
        </div>
      </div>

      {/* La barra de constancia: qué parte de los días desde que empezó se ganaron. */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-superficie-alta">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.min(100, Math.round((racha / Math.max(dias, 1)) * 100))}%`,
            background: colorDe(plan.categoria),
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-tenue">
        {dias === 1 ? "empezado hoy" : `${dias} días desde que empezaste`}
        {plan.puntos.length > 0 ? ` · repaso a las ${plan.horaExamen}` : ""}
      </p>

      {flojo && flojo.fallos >= 3 ? (
        <p className="mt-2 rounded-lg bg-superficie-alta px-2.5 py-1.5 text-xs leading-relaxed text-tenue">
          Donde más te cuesta: <b className="text-texto">{flojo.texto.toLowerCase()}</b> —{" "}
          {flojo.fallos} días de los últimos 30.
        </p>
      ) : null}
    </button>
  );
}

/** El catálogo, con el propósito de cada plan a la vista antes de elegirlo. */
function ElegirPlan({
  yaTiene,
  onElegir,
  onCerrar,
}: {
  yaTiene: string[];
  onElegir: (plantilla: PlantillaPlan, hora?: string) => void;
  onCerrar: () => void;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-fondo/95 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
        <div className="flex items-center justify-between pb-2">
          <Etiqueta>elige un plan</Etiqueta>
          <button onClick={onCerrar} className="px-2 py-1 text-tenue transition hover:text-texto">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {PLANTILLAS.map((p) => {
            const abierto = abierta === p.plantilla;
            const repetido = yaTiene.includes(p.plantilla);
            return (
              <Tarjeta
                key={p.plantilla}
                className={abierto ? "border-acento/50" : repetido ? "opacity-60" : ""}
              >
                <button
                  onClick={() => setAbierta(abierto ? null : p.plantilla)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="text-2xl" aria-hidden>
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">
                      {p.nombre}
                      {repetido ? (
                        <span className="ml-2 text-xs font-normal text-tenue">ya lo tienes</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-tenue">
                      {p.resumen}
                    </span>
                  </span>
                  <span className="shrink-0 text-tenue">{abierto ? "▲" : "▼"}</span>
                </button>

                {abierto ? (
                  <div className="mt-3 border-t border-borde pt-3">
                    <p className="text-sm leading-relaxed">{p.proposito}</p>
                    <p className="cita mt-2 text-sm text-tenue">
                      «{p.versiculo}» <span className="not-italic">{p.cita}</span>
                    </p>

                    {p.puntos.length > 0 ? (
                      <div className="mt-3">
                        <Etiqueta>lo que repasarás cada noche</Etiqueta>
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {p.puntos.map((punto, i) => (
                            <li key={i} className="flex gap-2 text-xs leading-relaxed text-tenue">
                              <span aria-hidden>·</span>
                              <span>{punto.texto}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {p.horasSugeridas && p.horasSugeridas.length > 0 ? (
                      <div className="mt-3">
                        <Etiqueta>¿a qué hora?</Etiqueta>
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {p.horasSugeridas.map((h) => (
                            <Boton key={h.hora} ancho onClick={() => onElegir(p, h.hora)}>
                              {h.etiqueta}
                            </Boton>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-tenue">
                          Podrás cambiarla después.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <Boton variante="fuerte" ancho onClick={() => onElegir(p)}>
                          Empezar este plan
                        </Boton>
                      </div>
                    )}
                  </div>
                ) : null}
              </Tarjeta>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { sucesosDelPlan };
