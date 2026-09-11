import { useMemo, useState } from "react";
import type { Ajustes, Motivo, Suceso } from "@/datos/tipos";
import { estaVencido, faseDe, fechaLarga, finDe, minutoActual, sucesoEnCurso } from "@/logica/dia";
import { elegirFrase } from "@/logica/elegirFrase";
import { AreaTexto, Boton, Cita, Etiqueta, Punto, Tarjeta, Vacio, colorDe } from "./piezas";

type Props = {
  fecha: string;
  fechaObjeto: Date;
  esHoy: boolean;
  ahora: Date;
  sucesos: Suceso[];
  ajustes: Ajustes;
  motivos: Motivo[];
  racha: number;
  onCumplir: (suceso: Suceso) => void;
  onSaltar: (suceso: Suceso, excusa: string) => void;
  onDeshacer: (suceso: Suceso) => void;
  onCambiarDia: (dias: number) => void;
  onNuevaTarea: () => void;
  onVerPorque: () => void;
};

function faltanPara(minutoObjetivo: number, ahora: Date): string {
  const restanSeg =
    minutoObjetivo * 60 - (ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds());
  if (restanSeg <= 0) return "ahora";
  const h = Math.floor(restanSeg / 3600);
  const m = Math.floor((restanSeg % 3600) / 60);
  const s = restanSeg % 60;
  if (h > 0) return `en ${h} h ${m} min`;
  if (m > 0) return `en ${m} min`;
  return `en ${s} s`;
}

/** «hoy», «ayer», «mañana» o los días de diferencia. */
function etiquetaRelativa(fecha: Date, ahora: Date): string {
  const aMedianoche = (f: Date) => new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  const dias = Math.round((aMedianoche(fecha) - aMedianoche(ahora)) / 86_400_000);
  if (dias === 0) return "hoy";
  if (dias === -1) return "ayer";
  if (dias === 1) return "mañana";
  return dias < 0 ? `hace ${-dias} días` : `dentro de ${dias} días`;
}

function quedanDe(suceso: Suceso, ahora: Date): string {
  if (suceso.minuto === null) return "";
  const finSeg = finDe(suceso) * 60;
  const ahoraSeg = ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds();
  const restan = Math.max(0, finSeg - ahoraSeg);
  // Por encima de la hora se cuenta en horas y minutos: «120:00» no se lee.
  if (restan >= 3600) {
    const h = Math.floor(restan / 3600);
    const m = Math.floor((restan % 3600) / 60);
    return `${h} h ${String(m).padStart(2, "0")} min`;
  }
  const m = Math.floor(restan / 60);
  const s = restan % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PantallaHoy(props: Props) {
  const {
    fecha, fechaObjeto, esHoy, ahora, sucesos, ajustes, motivos, racha,
    onCumplir, onSaltar, onDeshacer, onCambiarDia, onNuevaTarea, onVerPorque,
  } = props;

  const [saltando, setSaltando] = useState<Suceso | null>(null);
  const [excusa, setExcusa] = useState("");

  const minuto = minutoActual(ahora);
  const conHora = useMemo(() => sucesos.filter((s) => s.minuto !== null), [sucesos]);
  const sinHora = useMemo(() => sucesos.filter((s) => s.minuto === null), [sucesos]);
  const actual = esHoy ? sucesoEnCurso(conHora, minuto) : null;
  const enCurso = actual !== null && actual.minuto !== null && minuto >= actual.minuto;

  const cumplidos = sucesos.filter((s) => s.registro?.estado === "cumplido").length;
  const ancla = motivos.find((m) => m.ancla) ?? motivos[0];

  const frase = actual
    ? elegirFrase("empuje", ajustes, `${fecha}|${actual.id}`, actual.categoria)
    : elegirFrase("repaso", ajustes, fecha);

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <header className="pt-1">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onCambiarDia(-1)}
            className="-ml-2 px-2 py-1 text-lg text-tenue transition hover:text-texto"
            aria-label="Día anterior"
          >
            ‹
          </button>
          <h1 className="text-center text-[13px] font-medium tracking-[0.12em] text-tenue uppercase">
            {etiquetaRelativa(fechaObjeto, ahora)}
          </h1>
          <button
            onClick={() => onCambiarDia(1)}
            className="-mr-2 px-2 py-1 text-lg text-tenue transition hover:text-texto"
            aria-label="Día siguiente"
          >
            ›
          </button>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold first-letter:uppercase">
              {fechaLarga(fechaObjeto)}
            </p>
            <p className="text-sm text-tenue">
              {sucesos.length === 0
                ? "nada programado"
                : `${cumplidos} de ${sucesos.length} cumplidos`}
            </p>
          </div>
          <div className="shrink-0 text-right leading-none">
            <span className="cifras text-3xl font-bold text-acento">{racha}</span>
            <div className="mt-1">
              <Etiqueta>{racha === 1 ? "día seguido" : "días seguidos"}</Etiqueta>
            </div>
          </div>
        </div>
      </header>

      {/* El bloque que toca ahora: grande, con la razón y la frase. */}
      {actual && actual.minuto !== null ? (
        <Tarjeta className="entrar relative overflow-hidden !p-5">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: colorDe(actual.categoria) }}
          />
          <Etiqueta>{enCurso ? "ahora mismo" : "lo siguiente"}</Etiqueta>
          <h2 className="mt-1 text-2xl leading-tight font-semibold">{actual.nombre}</h2>
          <p className="cifras mt-1 text-sm text-tenue">
            {actual.hora} · {actual.duracionMin} min ·{" "}
            {enCurso ? (
              <span className="text-acento">quedan {quedanDe(actual, ahora)}</span>
            ) : (
              faltanPara(actual.minuto, ahora)
            )}
          </p>

          {actual.porque ? (
            <p className="mt-3 border-l-2 border-acento/60 pl-3 text-[15px] leading-relaxed">
              {actual.porque}
            </p>
          ) : null}

          <div className="mt-4 rounded-xl bg-superficie-alta p-3.5">
            <Cita texto={frase.texto} fuente={frase.fuente} />
          </div>

          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <Boton variante="logro" ancho onClick={() => onCumplir(actual)}>
                Cumplido
              </Boton>
            </div>
            <Boton
              variante="fallo"
              onClick={() => {
                setSaltando(actual);
                setExcusa("");
              }}
            >
              Lo salto
            </Boton>
          </div>
        </Tarjeta>
      ) : esHoy && conHora.length > 0 ? (
        <Tarjeta className="!p-5 text-center">
          <Etiqueta>día terminado</Etiqueta>
          <p className="mt-2 text-lg font-semibold">
            {cumplidos === sucesos.length ? "Día completo. Sin fisuras." : "No queda nada por delante."}
          </p>
          <div className="mt-3">
            <Cita texto={frase.texto} fuente={frase.fuente} />
          </div>
        </Tarjeta>
      ) : null}

      {/* Recordatorio permanente del porqué. */}
      {ancla && ancla.texto ? (
        <button
          onClick={onVerPorque}
          className="rounded-2xl border border-acento/25 bg-acento/[0.06] p-4 text-left transition hover:border-acento/50"
        >
          <Etiqueta>por esto te esfuerzas</Etiqueta>
          <p className="mt-1.5 text-[15px] leading-relaxed">{ancla.texto}</p>
        </button>
      ) : null}

      {/* La línea del día. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Etiqueta>el día</Etiqueta>
          <button onClick={onNuevaTarea} className="text-sm text-acento transition hover:brightness-125">
            + tarea
          </button>
        </div>

        {conHora.length === 0 && sinHora.length === 0 ? (
          <Vacio>Sin bloques para este día. Añade una tarea o revisa tu rutina.</Vacio>
        ) : null}

        {conHora.map((s) => (
          <FilaSuceso
            key={s.id}
            suceso={s}
            fase={faseDe(s, minuto, esHoy)}
            destacado={actual?.id === s.id}
            vencido={estaVencido(s, minuto, ajustes.graciaMin, esHoy)}
            onCumplir={() => onCumplir(s)}
            onSaltar={() => {
              setSaltando(s);
              setExcusa("");
            }}
            onDeshacer={() => onDeshacer(s)}
          />
        ))}

        {sinHora.length > 0 ? (
          <>
            <div className="mt-3">
              <Etiqueta>sin hora fija</Etiqueta>
            </div>
            {sinHora.map((s) => (
              <FilaSuceso
                key={s.id}
                suceso={s}
                fase="sinHora"
                destacado={false}
                vencido={false}
                onCumplir={() => onCumplir(s)}
                onSaltar={() => {
                  setSaltando(s);
                  setExcusa("");
                }}
                onDeshacer={() => onDeshacer(s)}
              />
            ))}
          </>
        ) : null}
      </section>

      {/* Antes de saltar, el porqué. Esa fricción es intencionada. */}
      {saltando ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-fondo/85 p-4 backdrop-blur-sm sm:items-center">
          <Tarjeta className="entrar w-full max-w-md !bg-superficie-alta">
            <Etiqueta>antes de saltarlo</Etiqueta>
            <h3 className="mt-1 text-lg font-semibold">{saltando.nombre}</h3>
            {saltando.porque ? (
              <p className="mt-2 border-l-2 border-acento/60 pl-3 text-[15px] leading-relaxed">
                {saltando.porque}
              </p>
            ) : null}
            {ancla?.texto ? (
              <p className="mt-3 text-sm leading-relaxed text-tenue">{ancla.texto}</p>
            ) : null}

            <div className="mt-4">
              <Etiqueta>¿qué te lo impidió?</Etiqueta>
              <AreaTexto
                rows={2}
                value={excusa}
                onChange={(e) => setExcusa(e.target.value)}
                placeholder="Escríbelo. Mañana lo vas a leer."
                className="mt-1.5 w-full"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <div className="flex-1">
                <Boton
                  variante="fuerte"
                  ancho
                  onClick={() => {
                    onCumplir(saltando);
                    setSaltando(null);
                  }}
                >
                  Mejor lo hago
                </Boton>
              </div>
              <Boton
                variante="fallo"
                onClick={() => {
                  onSaltar(saltando, excusa.trim());
                  setSaltando(null);
                }}
              >
                Saltarlo
              </Boton>
            </div>
            <div className="mt-2">
              <Boton variante="fantasma" ancho onClick={() => setSaltando(null)}>
                Cancelar
              </Boton>
            </div>
          </Tarjeta>
        </div>
      ) : null}
    </div>
  );
}

function FilaSuceso({
  suceso,
  fase,
  destacado,
  vencido,
  onCumplir,
  onSaltar,
  onDeshacer,
}: {
  suceso: Suceso;
  fase: ReturnType<typeof faseDe>;
  destacado: boolean;
  vencido: boolean;
  onCumplir: () => void;
  onSaltar: () => void;
  onDeshacer: () => void;
}) {
  const registro = suceso.registro;
  const cumplido = registro?.estado === "cumplido";
  const saltado = registro?.estado === "saltado";
  const apagado = (fase === "pasado" && !registro) || saltado;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
        destacado ? "border-acento/40 bg-superficie" : "border-borde bg-superficie/60"
      } ${apagado ? "opacity-55" : ""}`}
    >
      <div className="cifras w-11 shrink-0 text-sm text-tenue">
        {suceso.hora ?? "—"}
      </div>
      <Punto categoria={suceso.categoria} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] ${cumplido ? "text-tenue line-through" : ""}`}>
          {suceso.nombre}
        </p>
        {saltado && registro?.excusa ? (
          <p className="truncate text-xs text-fallo">{registro.excusa}</p>
        ) : vencido ? (
          <p className="text-xs text-fallo">se pasó la hora</p>
        ) : null}
      </div>

      {registro ? (
        <button
          onClick={onDeshacer}
          className={`shrink-0 rounded-lg px-2 py-1 text-xs transition ${
            cumplido ? "text-logro" : "text-fallo"
          } hover:bg-superficie-alta`}
        >
          {cumplido ? "✓ hecho" : "saltado"}
        </button>
      ) : (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onCumplir}
            className="rounded-lg border border-borde px-2.5 py-1.5 text-xs transition hover:border-logro hover:text-logro"
            aria-label={`Marcar ${suceso.nombre} como cumplido`}
          >
            ✓
          </button>
          <button
            onClick={onSaltar}
            className="rounded-lg border border-borde px-2.5 py-1.5 text-xs text-tenue transition hover:border-fallo hover:text-fallo"
            aria-label={`Saltar ${suceso.nombre}`}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

