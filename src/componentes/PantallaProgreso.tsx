import { useMemo } from "react";
import type { Datos } from "@/datos/tipos";
import { CATEGORIAS } from "@/datos/tipos";
import { desdeClave, fechaLarga, sucesosDelDia } from "@/logica/dia";
import { porCategoria, rachaActual, rachaMaxima, totalCumplidos, ultimosDias } from "@/logica/racha";
import { Etiqueta, Tarjeta, Vacio, colorDe } from "./piezas";

export function PantallaProgreso({ datos, hoy }: { datos: Datos; hoy: Date }) {
  const racha = rachaActual(datos, hoy);
  const maxima = rachaMaxima(datos, hoy);
  const total = totalCumplidos(datos);
  const dias = useMemo(() => ultimosDias(datos, 35, hoy), [datos, hoy]);
  const areas = useMemo(() => porCategoria(datos, 30, hoy), [datos, hoy]);

  // La media solo mira días en que se anotó algo: los anteriores al primer uso
  // no son fallos, son días en que la app no existía.
  const conDatos = dias.filter((d) => d.registrado);
  const media =
    conDatos.length > 0
      ? Math.round((conDatos.reduce((s, d) => s + d.ratio, 0) / conDatos.length) * 100)
      : 0;

  // Las últimas excusas, en orden inverso. Leerlas en frío es el mejor espejo.
  const excusas = useMemo(() => {
    const salida: { fecha: string; nombre: string; excusa: string; momento: number }[] = [];
    for (const d of dias) {
      for (const s of sucesosDelDia(datos, d.fecha)) {
        if (s.registro?.estado === "saltado" && s.registro.excusa) {
          salida.push({
            fecha: d.fecha,
            nombre: s.nombre,
            excusa: s.registro.excusa,
            momento: s.registro.momento,
          });
        }
      }
    }
    return salida.sort((a, b) => b.momento - a.momento).slice(0, 8);
  }, [datos, dias]);

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Progreso</h1>
        <p className="mt-1 text-sm text-tenue">
          Un día se gana cumpliendo al menos el 80 % de sus bloques.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2.5">
        <Marcador valor={racha} etiqueta="racha" acento />
        <Marcador valor={maxima} etiqueta="tu récord" />
        <Marcador valor={media} etiqueta="% medio" sufijo="%" />
      </div>

      <Tarjeta>
        <Etiqueta>últimos 35 días</Etiqueta>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {dias.map((d) => (
            <div
              key={d.fecha}
              title={`${fechaLarga(desdeClave(d.fecha))} · ${d.cumplidos}/${d.total}`}
              className={`aspect-square rounded-md border ${
                d.registrado ? "border-borde" : "border-borde/40"
              }`}
              style={{
                background: d.registrado
                  ? `color-mix(in oklab, var(--color-logro) ${Math.round(d.ratio * 100)}%, var(--color-superficie-alta))`
                  : "transparent",
                borderColor: d.ganado ? "var(--color-logro)" : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-tenue">
          <span>hace 5 semanas</span>
          <span className="cifras">
            {total} {total === 1 ? "bloque cumplido" : "bloques cumplidos"}
          </span>
          <span>hoy</span>
        </div>
      </Tarjeta>

      <Tarjeta>
        <Etiqueta>por área, últimos 30 días</Etiqueta>
        <div className="mt-3 flex flex-col gap-2.5">
          {CATEGORIAS.map((c) => {
            const a = areas[c.id];
            if (!a || a.total === 0) return null;
            const pct = Math.round((a.cumplidos / a.total) * 100);
            return (
              <div key={c.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{c.nombre}</span>
                  <span className="cifras text-tenue">
                    {a.cumplidos}/{a.total} · {pct} %
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-alta">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: colorDe(c.id) }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(areas).length === 0 ? (
            <p className="text-sm text-tenue">Todavía no hay nada registrado.</p>
          ) : null}
        </div>
      </Tarjeta>

      <section>
        <Etiqueta>tus últimas excusas</Etiqueta>
        <div className="mt-2 flex flex-col gap-2">
          {excusas.length === 0 ? (
            <Vacio>Ninguna excusa registrada. Que siga así.</Vacio>
          ) : (
            excusas.map((e, i) => (
              <div key={i} className="rounded-xl border border-borde bg-superficie px-3 py-2.5">
                <p className="text-sm">{e.excusa}</p>
                <p className="mt-1 text-xs text-tenue">
                  {e.nombre} · {fechaLarga(desdeClave(e.fecha))}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Marcador({
  valor,
  etiqueta,
  sufijo = "",
  acento,
}: {
  valor: number;
  etiqueta: string;
  sufijo?: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie px-3 py-4 text-center">
      <div className={`cifras text-3xl font-bold ${acento ? "text-acento" : ""}`}>
        {valor}
        <span className="text-lg">{sufijo}</span>
      </div>
      <div className="mt-1">
        <Etiqueta>{etiqueta}</Etiqueta>
      </div>
    </div>
  );
}
