import { useMemo, useState } from "react";
import type { Plan } from "@/datos/planes/tipos";
import type { Datos } from "@/datos/tipos";
import { claveFecha } from "@/logica/dia";
import {
  balanceDeLaDebilidad,
  diasDesdeElComienzo,
  diasLimpios,
  diasRestaurados,
  estadoDelDia,
  puntoMasFlojo,
  rachaDelPlan,
  rachaMaximaDelPlan,
} from "@/logica/planes";
import { AreaTexto, Boton, Cita, Etiqueta, Tarjeta } from "./piezas";

/**
 * La ficha de un plan: cómo va, dónde flaquea y qué batalla eligió pelear.
 *
 * Las cifras están puestas para que enseñen algo, no para adornar. Un
 * porcentaje no le dice nada a nadie; «llevas once días fallando en lo mismo» sí.
 */
export function DetallePlan({
  plan,
  datos,
  ahora,
  onRepasar,
  onCambiar,
  onAnotar,
  onEliminar,
  onVolver,
}: {
  plan: Plan;
  datos: Datos;
  ahora: Date;
  onRepasar: () => void;
  onCambiar: (plan: Plan) => void;
  /** Escribir una nota de este plan sin pasar por el repaso de la noche. */
  onAnotar: (texto: string) => void;
  onEliminar: () => void;
  onVolver: () => void;
}) {
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrador, setBorrador] = useState("");

  const hoy = claveFecha(ahora);
  const estado = estadoDelDia(plan, hoy, datos, true);
  const racha = useMemo(() => rachaDelPlan(plan, datos, ahora), [plan, datos, ahora]);
  const maxima = useMemo(() => rachaMaximaDelPlan(plan, datos, ahora), [plan, datos, ahora]);
  const limpios = useMemo(() => diasLimpios(plan, datos, 30, ahora), [plan, datos, ahora]);
  const restaurados = useMemo(
    () => diasRestaurados(plan, datos, 30, ahora),
    [plan, datos, ahora],
  );
  const flojo = useMemo(() => puntoMasFlojo(plan, datos, 30, ahora), [plan, datos, ahora]);
  const debilidades = plan.debilidades ?? [];
  const balance = useMemo(
    () => balanceDeLaDebilidad(plan, datos, 30, ahora),
    [plan, datos, ahora],
  );

  // Las últimas de este plan. Cinco bastan: lo demás está en el diario entero,
  // y una ficha que se vuelve un archivo deja de servir para lo que sirve.
  const notasDelPlan = useMemo(
    () =>
      (datos.notas ?? [])
        .filter((n) => n.plan === plan.id)
        .sort((a, b) => b.momento - a.momento)
        .slice(0, 5),
    [datos.notas, plan.id],
  );

  const alternarDebilidad = (id: string) =>
    onCambiar({
      ...plan,
      debilidades: debilidades.includes(id)
        ? debilidades.filter((x) => x !== id)
        : [...debilidades, id],
    });

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="flex items-center gap-1 pt-2">
        <button
          onClick={onVolver}
          className="-ml-2 rounded-lg px-3 py-2 text-sm text-tenue transition hover:text-texto"
        >
          ‹ Planes
        </button>
      </div>

      <header>
        <h1 className="text-xl font-semibold">
          <span className="mr-2" aria-hidden>
            {plan.emoji}
          </span>
          {plan.nombre}
        </h1>
        <p className="mt-2 text-sm leading-relaxed">{plan.proposito}</p>
        <div className="mt-3">
          <Cita texto={plan.versiculo} fuente={plan.cita} />
        </div>
      </header>

      {/* El repaso de hoy, arriba, mientras esté pendiente. */}
      {plan.puntos.length > 0 && estado === "pendiente" ? (
        <Boton variante="fuerte" ancho onClick={onRepasar}>
          Hacer el repaso de hoy
        </Boton>
      ) : null}
      {plan.puntos.length > 0 && estado !== "pendiente" ? (
        <Boton ancho onClick={onRepasar}>
          {estado === "restaurado"
            ? "Hoy quedó restaurado · revisar"
            : estado === "ganado"
              ? "Hoy quedó guardado · revisar"
              : "Revisar el repaso de hoy"}
        </Boton>
      ) : null}

      {/*
        Escribir sobre el plan cualquier día, sin esperar a la noche.

        Alex: «aún no veo la opción de hacer comentarios cada día del plan
        activo». El repaso cierra la jornada y pide un veredicto; esto es otra
        cosa — apuntar algo a media tarde, cuando aprieta, sin tener que
        declarar todavía si el día se ganó o se perdió.
      */}
      <Tarjeta>
        <Etiqueta>escribe sobre este plan</Etiqueta>
        <div className="mt-2">
          <AreaTexto
            rows={2}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            placeholder="Lo que quieras dejar anotado hoy..."
          />
        </div>
        <div className="mt-2">
          <Boton
            ancho
            deshabilitado={borrador.trim().length === 0}
            onClick={() => {
              onAnotar(borrador.trim());
              setBorrador("");
            }}
          >
            Guardar en mi diario
          </Boton>
        </div>

        {notasDelPlan.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2.5 border-t border-borde pt-3">
            <Etiqueta>lo que llevas escrito</Etiqueta>
            {notasDelPlan.map((n) => (
              <div key={n.id}>
                <p className="cifras text-xs text-tenue">
                  {n.fecha === hoy ? "hoy" : n.fecha}
                  {n.estado === "ganado"
                    ? " · día guardado"
                    : n.estado === "restaurado"
                      ? " · restaurado"
                      : n.estado === "fallado"
                        ? " · día caído"
                        : ""}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{n.texto}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Tarjeta>

      <div className="grid grid-cols-3 gap-2.5">
        <Cifra valor={racha} etiqueta="racha" acento />
        <Cifra valor={maxima} etiqueta="tu récord" />
        <Cifra valor={diasDesdeElComienzo(plan, ahora)} etiqueta="días en pie" />
      </div>

      {/* Los últimos treinta días, separando lo limpio de lo restaurado. */}
      {plan.puntos.length > 0 ? (
        <Tarjeta>
          <Etiqueta>los últimos 30 días</Etiqueta>
          <div className="mt-3 flex flex-col gap-2.5">
            <Barra
              titulo="Días guardados"
              valor={limpios}
              total={30}
              color="var(--color-logro)"
            />
            {plan.admiteRestauracion ? (
              <Barra
                titulo="Días restaurados por arrepentimiento"
                valor={restaurados}
                total={30}
                color="var(--color-acento)"
              />
            ) : null}
          </div>

          {plan.admiteRestauracion && restaurados >= 4 ? (
            <p className="mt-3 rounded-xl border border-acento/25 bg-acento/[0.06] px-3 py-2.5 text-xs leading-relaxed">
              Su misericordia no se agota, pero <b>{restaurados} veces en un mes</b> es un
              aviso. Mira qué te está llevando ahí y quita de en medio lo que haga falta.
            </p>
          ) : null}

          {flojo && flojo.fallos >= 3 ? (
            <p className="mt-2 text-xs leading-relaxed text-tenue">
              Donde más te cuesta: <b className="text-texto">{flojo.texto.toLowerCase()}</b>,{" "}
              {flojo.fallos} días de los últimos 30.
            </p>
          ) : null}
        </Tarjeta>
      ) : null}

      {/* La batalla propia. Esto es lo que hace el plan de cada uno. */}
      {plan.puntos.length > 0 ? (
        <Tarjeta>
          <Etiqueta>mi batalla</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed text-tenue">
            Cada uno tiene la suya, y no es la misma para todos. Marca dónde está tu
            mayor debilidad: se te preguntará siempre por ella y vencer ahí es la
            victoria que más cuenta.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {plan.puntos.map((punto) => {
              const elegida = debilidades.includes(punto.id);
              return (
                <button
                  key={punto.id}
                  onClick={() => alternarDebilidad(punto.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    elegida ? "border-acento bg-acento/[0.08]" : "border-borde"
                  }`}
                  aria-pressed={elegida}
                >
                  <span className={elegida ? "text-acento" : "text-tenue"} aria-hidden>
                    {elegida ? "★" : "☆"}
                  </span>
                  <span className="min-w-0 flex-1">{punto.texto}</span>
                </button>
              );
            })}
          </div>

          {debilidades.length > 0 && balance.vencidos + balance.caidos > 0 ? (
            <p className="mt-3 rounded-xl bg-superficie-alta px-3 py-2.5 text-xs leading-relaxed">
              En tu batalla llevas <b className="text-logro">{balance.vencidos} días vencidos</b>
              {balance.caidos > 0 ? (
                <>
                  {" "}
                  y <b className="text-fallo">{balance.caidos} caídos</b>
                </>
              ) : null}{" "}
              en los últimos 30.
            </p>
          ) : debilidades.length === 0 ? (
            <p className="mt-3 text-xs text-tenue">
              Sin marcar todavía. No pasa nada por reconocerla: el que sabe dónde es
              débil ya está peleando mejor que el que lo niega.
            </p>
          ) : null}
        </Tarjeta>
      ) : null}

      {/* Las horas, si el plan las tiene. */}
      {plan.compromisos.length > 0 ? (
        <Tarjeta>
          <Etiqueta>a qué hora</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {plan.compromisos.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="cifras w-12 shrink-0 text-sm text-tenue">{c.hora}</span>
                <span className="min-w-0 flex-1 text-sm">{c.nombre}</span>
                <input
                  type="time"
                  value={c.hora}
                  onChange={(e) =>
                    onCambiar({
                      ...plan,
                      compromisos: plan.compromisos.map((x) =>
                        x.id === c.id ? { ...x, hora: e.target.value } : x,
                      ),
                    })
                  }
                  className="rounded-lg border border-borde bg-superficie-alta px-2 py-1 text-sm outline-none focus:border-acento"
                />
              </div>
            ))}
          </div>
        </Tarjeta>
      ) : null}

      {plan.puntos.length > 0 ? (
        <Tarjeta>
          <Etiqueta>recordatorio del repaso</Etiqueta>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-sm text-tenue">A qué hora te lo recuerda</span>
            <input
              type="time"
              value={plan.horaExamen}
              onChange={(e) => onCambiar({ ...plan, horaExamen: e.target.value })}
              className="rounded-lg border border-borde bg-superficie-alta px-2 py-1 text-sm outline-none focus:border-acento"
            />
          </div>
        </Tarjeta>
      ) : null}

      <div className="mt-2 flex flex-col gap-2">
        <Boton
          ancho
          onClick={() => onCambiar({ ...plan, activo: !plan.activo })}
        >
          {plan.activo ? "Pausar este plan" : "Retomar este plan"}
        </Boton>

        {confirmandoBorrado ? (
          <Tarjeta className="border-fallo/40">
            <p className="text-sm leading-relaxed">
              Se va el plan y su historial: {racha} días de racha y todo lo anotado. No
              se puede deshacer.
            </p>
            <p className="mt-2 text-xs text-tenue">
              Si solo quieres descansar de él, púlsalo en «Pausar» y vuelve cuando quieras.
            </p>
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <Boton ancho onClick={() => setConfirmandoBorrado(false)}>
                  Mejor no
                </Boton>
              </div>
              <Boton variante="fallo" onClick={onEliminar}>
                Eliminar
              </Boton>
            </div>
          </Tarjeta>
        ) : (
          <Boton variante="fantasma" ancho onClick={() => setConfirmandoBorrado(true)}>
            Eliminar el plan
          </Boton>
        )}
      </div>
    </div>
  );
}

function Cifra({
  valor,
  etiqueta,
  acento,
}: {
  valor: number;
  etiqueta: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie px-2 py-4 text-center">
      <div className={`cifras text-3xl font-bold ${acento ? "text-acento" : ""}`}>{valor}</div>
      <div className="mt-1">
        <Etiqueta>{etiqueta}</Etiqueta>
      </div>
    </div>
  );
}

function Barra({
  titulo,
  valor,
  total,
  color,
}: {
  titulo: string;
  valor: number;
  total: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0">{titulo}</span>
        <span className="cifras shrink-0 text-tenue">
          {valor}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-alta">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.round((valor / total) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

