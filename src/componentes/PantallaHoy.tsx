import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Ajustes, Motivo, Suceso } from "@/datos/tipos";
import { estaVencido, faseDe, fechaLarga, finDe, minutoActual, sucesoEnCurso } from "@/logica/dia";
import { useAcabaDe, useSubio } from "@/logica/recien";
import { celebrarDia } from "@/logica/celebrar";
import { elegirFrase } from "@/logica/elegirFrase";
import { diaDe, faltaPara, type Aviso } from "@/logica/avisos";
import {
  AreaTexto,
  Boton,
  Capa,
  CheckDibujado,
  Cita,
  Etiqueta,
  Punto,
  Rodillo,
  Tarjeta,
  Vacio,
  colorDe,
  vars,
} from "./piezas";

type Props = {
  fecha: string;
  fechaObjeto: Date;
  esHoy: boolean;
  ahora: Date;
  sucesos: Suceso[];
  ajustes: Ajustes;
  motivos: Motivo[];
  racha: number;
  /** El próximo aviso que va a sonar, para la cuenta atrás. */
  alarma: Aviso | null;
  onCumplir: (suceso: Suceso) => void;
  onSaltar: (suceso: Suceso, excusa: string) => void;
  onDeshacer: (suceso: Suceso) => void;
  onCambiarDia: (dias: number) => void;
  onNuevaTarea: () => void;
  /**
   * Tocar una fila. Recibe el suceso entero, no solo su id, porque cada tipo
   * lleva a un sitio distinto: la tarea suelta a su diálogo, el compromiso de
   * un plan a la ficha del plan, y el bloque de rutina a la rutina.
   */
  onEditarTarea: (suceso: Suceso) => void;
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

/** El trazo de la G del icono (`public/icono.svg`), para dibujarla detrás de la racha. */
const TRAZO_G = "M 357.6 184.9 A 124 124 0 1 0 357.6 327.1 L 357.6 256 L 284 256";

export function PantallaHoy(props: Props) {
  const {
    fecha, fechaObjeto, esHoy, ahora, sucesos, ajustes, motivos, racha, alarma,
    onCumplir, onSaltar, onDeshacer, onCambiarDia, onNuevaTarea, onEditarTarea, onVerPorque,
  } = props;

  const [saltando, setSaltando] = useState<Suceso | null>(null);
  const [excusa, setExcusa] = useState("");
  /** Hacia dónde se pasó de día la última vez: la fecha rueda en ese sentido. */
  const [sentido, setSentido] = useState<0 | 1 | -1>(0);
  const cambiarDia = (d: 1 | -1) => {
    setSentido(d);
    onCambiarDia(d);
  };

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

  /**
   * Celebrar, y sólo cuando toca.
   *
   * La racha se celebra al SUBIR (la G se dibuja detrás, el número crece); el
   * día se celebra al COMPLETARSE con un toque de aquí —no al pasar a un día
   * de ayer que ya estaba completo—, y las motas de oro salen del botón que
   * se tocó. Nada de esto pasa al abrir la pantalla: eso sería decorar.
   */
  // 1400 ms: lo que tarda la G en dibujarse y apagarse (`.trazo` en
  // estilos.css: trazo-fuera empieza a los 900 y dura 500). Si se cambia
  // allí, se cambia aquí; si no, la G se corta a medio fundido.
  const subio = useSubio(racha, 1400);
  const completo = esHoy && sucesos.length > 0 && cumplidos === sucesos.length;
  const ultimoToque = useRef<DOMRect | undefined>(undefined);
  const antes = useRef({ fecha, completo });
  const [celebrando, setCelebrando] = useState(false);
  useEffect(() => {
    const previo = antes.current;
    antes.current = { fecha, completo };
    if (previo.fecha !== fecha || !completo || previo.completo) return;
    setCelebrando(true);
    celebrarDia(ultimoToque.current);
    const id = window.setTimeout(() => setCelebrando(false), 1400);
    return () => {
      clearTimeout(id);
      // Si se deshace antes de tiempo, el barrido no se queda montado: así
      // vuelve a salir cuando se complete otra vez.
      setCelebrando(false);
    };
  }, [fecha, completo]);

  const cumplir = (s: Suceso, desde?: DOMRect) => {
    ultimoToque.current = desde;
    onCumplir(s);
  };

  const titulo = completo ? "Día completo. Sin fisuras." : "No queda nada por delante.";

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      {/* La cabecera entra a tres tiempos: etiqueta, fecha, racha. */}
      <header className="pt-1">
        <div className="primer-tiempo flex items-center justify-between">
          <button
            onClick={() => cambiarDia(-1)}
            className="toque -ml-2 rounded-lg px-2 py-1 text-lg text-tenue hover:text-texto"
            aria-label="Día anterior"
          >
            ‹
          </button>
          <h1 className="text-center text-[13px] font-medium tracking-[0.12em] text-tenue uppercase">
            {etiquetaRelativa(fechaObjeto, ahora)}
          </h1>
          <button
            onClick={() => cambiarDia(1)}
            className="toque -mr-2 rounded-lg px-2 py-1 text-lg text-tenue hover:text-texto"
            aria-label="Día siguiente"
          >
            ›
          </button>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="segundo-tiempo min-w-0">
            {/* La fecha pasa página: sube al ir hacia delante, baja al volver. */}
            <div className="pasa-pagina" data-sentido={sentido}>
              <p key={fecha} className="text-lg font-semibold first-letter:uppercase">
                {fechaLarga(fechaObjeto)}
              </p>
            </div>
            <p className="text-sm text-tenue">
              {sucesos.length === 0
                ? "nada programado"
                : `${cumplidos} de ${sucesos.length} cumplidos`}
            </p>
          </div>
          <div className="tercer-tiempo relative shrink-0 text-right leading-none">
            {subio ? (
              <>
                <span className="halo-destello" aria-hidden />
                <svg
                  // Tamaño fijo y pegada al número: sin él, un svg con viewBox
                  // y sin medidas se estiraba al bloque entero (124 px) y la G
                  // tachaba «DÍAS SEGUIDOS» y bajaba hasta la tarjeta de abajo.
                  className="pointer-events-none absolute -top-3 -right-2 size-14 text-acento"
                  viewBox="0 0 512 512"
                  fill="none"
                  aria-hidden
                >
                  <path
                    className="trazo"
                    pathLength={1}
                    d={TRAZO_G}
                    stroke="currentColor"
                    strokeWidth="34"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            ) : null}
            {/* La racha rueda como un cuentakilómetros: es lo que la app celebra. */}
            <Rodillo
              valor={racha}
              className={`cifras relative text-3xl font-bold text-acento ${subio ? "grande" : ""}`}
            />
            <div className="mt-1">
              <Etiqueta>{racha === 1 ? "día seguido" : "días seguidos"}</Etiqueta>
            </div>
          </div>
        </div>
      </header>

      {/* Cuánto falta para que suene la próxima alarma. Lo primero que se ve. */}
      <ContadorAlarma alarma={alarma} ahora={ahora} />

      {/* El bloque que toca ahora: grande, con la razón y la frase. */}
      {actual && actual.minuto !== null ? (
        <Tarjeta className="relative overflow-hidden !p-5">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: colorDe(actual.categoria) }}
          />
          <Etiqueta>{enCurso ? "ahora mismo" : "lo siguiente"}</Etiqueta>
          <h2 className="mt-1 text-2xl leading-tight font-semibold">{actual.nombre}</h2>
          <p className="cifras mt-1 text-sm text-tenue">
            {actual.hora} · {actual.duracionMin} min ·{" "}
            {enCurso ? (
              <span className="text-acento">
                quedan <Rodillo porSegundos valor={quedanDe(actual, ahora)} />
              </span>
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
              <Boton
                variante="logro"
                ancho
                vivo
                onClick={(e) => cumplir(actual, e.currentTarget.getBoundingClientRect())}
              >
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
        <Tarjeta className="relative !p-5 text-center">
          {/* Con el día completo, la tarjeta queda con brasa; al completarse, la cruza el oro. */}
          {completo ? <span className="brasa" aria-hidden /> : null}
          {celebrando ? <span className="barrido" aria-hidden /> : null}
          <Etiqueta>día terminado</Etiqueta>
          {/* El lector oye el titular entero; las palabras animadas son decoración. */}
          <p className="mt-2 text-lg font-semibold">
            <span className="sr-only">{titulo}</span>
            <span aria-hidden>
              {titulo.split(" ").map((palabra, i) => (
                <Fragment key={`${titulo}|${i}`}>
                  {i > 0 ? " " : null}
                  <span className="palabra" style={vars({ "--i": i })}>
                    <span>{palabra}</span>
                  </span>
                </Fragment>
              ))}
            </span>
          </p>
          {completo ? (
            <svg className="filete mt-3" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
              <line x1="0" y1="1" x2="100" y2="1" pathLength={1} />
            </svg>
          ) : null}
          <div className="mt-3">
            <Cita texto={frase.texto} fuente={frase.fuente} />
          </div>
        </Tarjeta>
      ) : null}

      {/* Recordatorio permanente del porqué. */}
      {ancla && ancla.texto ? (
        <button
          onClick={onVerPorque}
          className="toque rounded-2xl border border-acento/25 bg-acento/[0.06] p-4 text-left hover:border-acento/50"
        >
          <Etiqueta>por esto te esfuerzas</Etiqueta>
          <p className="mt-1.5 text-[15px] leading-relaxed">{ancla.texto}</p>
        </button>
      ) : null}

      {/* La línea del día. Entra escalonada: cada bloque 55 ms después del anterior, y su hora 70 ms después. */}
      <section className="escalonado flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Etiqueta filete>el día</Etiqueta>
          <button
            onClick={onNuevaTarea}
            className="toque -mr-2 rounded-lg px-2 py-1 text-sm text-acento hover:brightness-125"
          >
            + tarea
          </button>
        </div>

        {conHora.length === 0 && sinHora.length === 0 ? (
          <Vacio>Sin bloques para este día. Añade una tarea o revisa tu rutina.</Vacio>
        ) : null}

        {conHora.map((s) => (
          <FilaSuceso
            key={s.id}
            fecha={fecha}
            suceso={s}
            fase={faseDe(s, minuto, esHoy)}
            destacado={actual?.id === s.id}
            vencido={estaVencido(s, minuto, ajustes.graciaMin, esHoy)}
            onCumplir={(desde) => cumplir(s, desde)}
            onSaltar={() => {
              setSaltando(s);
              setExcusa("");
            }}
            onDeshacer={() => onDeshacer(s)}
            onAbrir={() => onEditarTarea(s)}
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
                fecha={fecha}
                suceso={s}
                fase="sinHora"
                destacado={false}
                vencido={false}
                onCumplir={(desde) => cumplir(s, desde)}
                onSaltar={() => {
                  setSaltando(s);
                  setExcusa("");
                }}
                onDeshacer={() => onDeshacer(s)}
                onAbrir={() => onEditarTarea(s)}
              />
            ))}
          </>
        ) : null}
      </section>

      {/* Antes de saltar, el porqué. Esa fricción es intencionada. */}
      {saltando ? (
        <Capa>
        <div className="velo fixed inset-0 z-40 flex items-end justify-center bg-fondo/85 p-4 backdrop-blur-sm sm:items-center">
          <Tarjeta className="w-full max-w-md !bg-superficie-alta">
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
                  onClick={(e) => {
                    cumplir(saltando, e.currentTarget.getBoundingClientRect());
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
        </Capa>
      ) : null}
    </div>
  );
}

/**
 * La cuenta atrás hasta el próximo aviso.
 *
 * Sale de la misma lista que se le entrega a Android, así que lo que marca es
 * lo que el sistema tiene programado de verdad, no una cuenta aparte. Los
 * segundos RUEDAN: el tiempo se ve moverse, como en el reloj del móvil.
 */
function ContadorAlarma({ alarma, ahora }: { alarma: Aviso | null; ahora: Date }) {
  if (!alarma) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-borde px-3.5 py-2.5">
        <span className="text-tenue" aria-hidden>
          ⏰
        </span>
        <span className="text-sm text-tenue">No queda ninguna alarma por sonar.</span>
      </div>
    );
  }

  const cuando = alarma.cuando;
  const inminente = cuando.getTime() - ahora.getTime() < 60_000;
  const dia = diaDe(cuando, ahora);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
        inminente ? "border-acento bg-acento/10" : "border-acento/30 bg-acento/[0.05]"
      }`}
    >
      <span className={inminente ? "latido" : ""} aria-hidden>
        ⏰
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {alarma.previo ? `Aviso de «${alarma.nombreBloque}»` : alarma.nombreBloque}
        </p>
        <p className="cifras text-xs text-tenue">
          {dia} a las{" "}
          {`${String(cuando.getHours()).padStart(2, "0")}:${String(cuando.getMinutes()).padStart(2, "0")}`}
        </p>
      </div>
      <Rodillo
        porSegundos
        valor={faltaPara(cuando, ahora)}
        className={`cifras shrink-0 text-xl font-semibold tracking-tight ${
          inminente ? "text-acento" : ""
        }`}
      />
    </div>
  );
}

function FilaSuceso({
  fecha,
  suceso,
  fase,
  destacado,
  vencido,
  onCumplir,
  onSaltar,
  onDeshacer,
  onAbrir,
}: {
  /** El día que se mira: cambiar de día no es cumplir. */
  fecha: string;
  suceso: Suceso;
  fase: ReturnType<typeof faseDe>;
  destacado: boolean;
  vencido: boolean;
  /** Con el rectángulo del botón tocado: de ahí salen las motas si completa el día. */
  onCumplir: (desde?: DOMRect) => void;
  onSaltar: () => void;
  onDeshacer: () => void;
  /** Abre el editor. Solo las tareas sueltas se editan desde aquí; los
      bloques fijos se tocan en la pestaña Rutina. */
  onAbrir: () => void;
}) {
  const registro = suceso.registro;
  const cumplido = registro?.estado === "cumplido";
  const saltado = registro?.estado === "saltado";
  const apagado = (fase === "pasado" && !registro) || saltado;
  /**
   * Sólo la fila que se ACABA de marcar celebra: lavado verde, el nombre se
   * tacha de izquierda a derecha y el ✓ se dibuja. Una fila que ya estaba
   * cumplida al abrir la pantalla se pinta quieta.
   */
  const reciente = useAcabaDe(cumplido, fecha);

  return (
    <div
      className={`fila flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        reciente ? "fila-reciente" : ""
      } ${destacado ? "border-acento/40 bg-superficie" : "border-borde bg-superficie/60"} ${
        apagado ? "fila-apagada" : ""
      }`}
    >
      <div className="fila-hora cifras w-11 shrink-0 text-sm text-tenue">
        {suceso.hora ?? "—"}
      </div>
      <Punto categoria={suceso.categoria} />
      <div className="min-w-0 flex-1">
        {/*
          **Todas** las filas se pueden tocar, cada una lleva a su sitio.

          Antes solo la tarea suelta tenía el lápiz, y los bloques de la rutina
          y los compromisos de los planes no respondían a nada. Desde fuera eso
          no se lee como «esto se edita en otra pantalla»: se lee como que la
          app está rota — que es justo lo que pasó.
        */}
        <button
          onClick={onAbrir}
          className="flex w-full items-center gap-1.5 text-left"
          aria-label={`Editar ${suceso.nombre}`}
        >
          <span className={`relative truncate text-[15px] ${cumplido ? "text-tenue" : ""}`}>
            {suceso.nombre}
            {cumplido ? <i className="tachadura" aria-hidden /> : null}
          </span>
          <span className="shrink-0 text-xs text-tenue" aria-hidden>
            ✎
          </span>
        </button>
        {saltado && registro?.excusa ? (
          <p className="truncate text-xs text-fallo">{registro.excusa}</p>
        ) : vencido ? (
          <p className="text-xs text-fallo">se pasó la hora</p>
        ) : null}
      </div>

      {registro ? (
        <button
          onClick={onDeshacer}
          className={`toque shrink-0 rounded-lg px-2 py-1 text-xs ${
            cumplido ? "text-logro" : "text-fallo"
          } hover:bg-superficie-alta`}
        >
          <span className={`inline-flex items-center gap-1 ${reciente ? "snap-ok" : ""}`}>
            {cumplido ? (
              <>
                <CheckDibujado className="size-3.5" />
                <span className="desde-izquierda-corto">hecho</span>
              </>
            ) : (
              "saltado"
            )}
          </span>
        </button>
      ) : (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={(e) => onCumplir(e.currentTarget.getBoundingClientRect())}
            className="toque rounded-lg border border-borde px-2.5 py-1.5 text-xs hover:border-logro hover:text-logro"
            aria-label={`Marcar ${suceso.nombre} como cumplido`}
          >
            ✓
          </button>
          <button
            onClick={onSaltar}
            className="toque rounded-lg border border-borde px-2.5 py-1.5 text-xs text-tenue hover:border-fallo hover:text-fallo"
            aria-label={`Saltar ${suceso.nombre}`}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
