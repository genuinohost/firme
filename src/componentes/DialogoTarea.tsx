import { useState } from "react";
import { idNuevo } from "@/datos/almacen";
import { CATEGORIAS, TIMBRES, type Categoria, type Tarea, type Timbre } from "@/datos/tipos";
import { desdeClave, diasEnTexto, primerDiaEn } from "@/logica/dia";
import { BotonDictar } from "./BotonDictar";
import { Boton, Campo, Capa, Entrada, Etiqueta, Selector, Tarjeta, colorDe } from "./piezas";

/**
 * "HH:MM" de dentro de `minutos`, en hora local.
 *
 * Una alarma solo tiene hora y minuto, así que al poner los segundos a cero se
 * perdía lo que quedaba del minuto en curso: a las 18:15:45, «2 min» daba las
 * 18:17, o sea minuto y cuarto. Se redondea hacia arriba para que «2 min» nunca
 * sea menos de dos minutos.
 */
function desdeAhora(minutos: number): string {
  const f = momentoDentroDe(minutos);
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/** El instante de «dentro de N min», redondeado como la hora de arriba. */
function momentoDentroDe(minutos: number): Date {
  const f = new Date();
  const extra = f.getSeconds() > 0 ? 1 : 0;
  f.setMinutes(f.getMinutes() + minutos + extra, 0, 0);
  return f;
}

/**
 * El DÍA de «dentro de N min»: a las 23:30, «1 h» es mañana. Con la fecha de
 * hoy la tarea quedaba a las 00:31 de hoy, ya pasada, y no sonaba.
 */
function diaDentroDe(minutos: number): string {
  const f = momentoDentroDe(minutos);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/** Una fecha "AAAA-MM-DD" desplazada unos días, sin tocar husos horarios. */
function dentroDeDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(
    f.getDate(),
  ).padStart(2, "0")}`;
}

/** Hoy, en "AAAA-MM-DD" local. */
function hoyClave(): string {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/** «jueves 1 de octubre», para que no haya dudas de qué día es. */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  // Por partes: todo junto, el navegador pone «jueves, 1 de octubre», con coma.
  return `${f.toLocaleDateString("es", { weekday: "long" })} ${d} de ${f.toLocaleDateString("es", { month: "long" })}`;
}

/**
 * Los botones de «Cada semana», de lunes a domingo, que es como se lee una
 * semana aquí. El valor es el de siempre (0 = domingo … 6 = sábado), el mismo
 * que usan los bloques de la rutina.
 */
const SEMANA = [
  { letra: "L", valor: 1, nombre: "lunes" },
  { letra: "M", valor: 2, nombre: "martes" },
  { letra: "X", valor: 3, nombre: "miércoles" },
  { letra: "J", valor: 4, nombre: "jueves" },
  { letra: "V", valor: 5, nombre: "viernes" },
  { letra: "S", valor: 6, nombre: "sábado" },
  { letra: "D", valor: 0, nombre: "domingo" },
];

export function DialogoTarea({
  fecha,
  tarea,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  fecha: string;
  /** La tarea que se está editando. Si falta, se crea una nueva. */
  tarea?: Tarea;
  onGuardar: (tarea: Tarea) => void;
  onBorrar?: () => void;
  onCerrar: () => void;
}) {
  const editando = tarea !== undefined;
  const hoy = hoyClave();
  /**
   * Qué día. Alex, 28-09-2026, con una reunión el jueves 1 de octubre a las
   * 10:30: «no tengo opción de escoger la fecha para esa tarea y su
   * respectiva alarma». La tarea ya guardaba su fecha (y las alarmas se
   * programan con dos semanas de antelación); faltaba poder elegirla.
   */
  const [dia, setDia] = useState(tarea?.fecha ?? fecha);
  const [nombre, setNombre] = useState(tarea?.nombre ?? "");
  const [conHora, setConHora] = useState(tarea ? tarea.hora !== null : true);
  const [hora, setHora] = useState(tarea?.hora ?? (() => desdeAhora(30)));
  const [duracionMin, setDuracion] = useState(tarea?.duracionMin ?? 30);
  const [categoria, setCategoria] = useState<Categoria>(tarea?.categoria ?? "trabajo");
  const [repeticion, setRepeticion] = useState<"uno" | "varios" | "siempre" | "semana">(
    !tarea?.repiteHasta
      ? "uno"
      : tarea.diasSemana?.length
        ? "semana"
        : tarea.repiteHasta === "siempre"
          ? "siempre"
          : "varios",
  );
  /**
   * Los días de «Cada semana». Alex, 28-09-2026: «No veo la opción de colocar
   * alarma a una tarea cada semana. Por ejemplo, todos los lunes.»
   *
   * null mientras no se toque: entonces vale el día de la semana de la fecha
   * elegida, y sigue a esa fecha si se cambia. En cuanto se pulsa uno, la
   * lista pasa a ser la suya y ya no se mueve sola.
   */
  const [diasTocados, setDiasTocados] = useState<number[] | null>(() => {
    // Sólo los que son un día de verdad: de una copia tocada a mano podría
    // llegar un 7, que no enciende ningún botón y deja la serie sin días.
    const validos = (tarea?.diasSemana ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    return validos.length ? validos : null;
  });
  // Fin de la serie semanal. Lo normal en algo de cada semana es que no acabe;
  // si la tarea ya tenía una fecha de fin, se respeta.
  const [conFin, setConFin] = useState(
    Boolean(tarea?.repiteHasta && tarea.repiteHasta !== "siempre"),
  );
  // Por defecto, una semana: es el plazo con el que la gente piensa.
  const [hasta, setHasta] = useState(
    tarea?.repiteHasta && tarea.repiteHasta !== "siempre"
      ? tarea.repiteHasta
      : dentroDeDias(tarea?.fecha ?? fecha, 7),
  );
  /** Cambiar el día, y que el «hasta» de «varios días» no se quede atrás. */
  const cambiarDia = (nuevo: string) => {
    setDia(nuevo);
    setHasta((h) => (h < nuevo ? dentroDeDias(nuevo, 7) : h));
  };
  const [timbre, setTimbre] = useState<Timbre>(
    tarea?.timbre && tarea.timbre !== "ninguno" ? tarea.timbre : "pulso",
  );

  const diasSemana = diasTocados ?? [desdeClave(dia).getDay()];
  const alternarDia = (valor: number) => {
    if (diasSemana.includes(valor)) {
      // Nunca sin ninguno: una tarea de cada semana sin días no tocaría nunca,
      // y desaparecería sin decir por qué.
      if (diasSemana.length === 1) return;
      setDiasTocados(diasSemana.filter((d) => d !== valor));
    } else {
      setDiasTocados([...diasSemana, valor]);
    }
  };

  /**
   * La fecha que se guarda.
   *
   * En «Cada semana», el primer día marcado desde la fecha elegida: la de los
   * lunes creada un domingo empieza el lunes, y así el «Añadir al lunes 5» del
   * botón y el aviso de dónde quedó guardada dicen la verdad.
   *
   * Salvo al editar una serie que ya empezó sin tocar su fecha: moverla hacia
   * delante le quitaría los días de atrás, y con ellos su historial.
   */
  const fechaFija = editando && tarea.fecha < hoy && dia === tarea.fecha;
  const fechaFinal = repeticion === "semana" && !fechaFija ? primerDiaEn(dia, diasSemana) : dia;
  const hastaFinal = hasta < fechaFinal ? fechaFinal : hasta;
  /** Desde cuándo tiene sentido que acabe una serie semanal: nunca antes de hoy. */
  const finMinimo = fechaFinal > hoy ? fechaFinal : hoy;
  const elegirFin = (valor: boolean) => {
    setConFin(valor);
    // Una serie que empezó hace semanas trae un «hasta» de su primera semana,
    // ya pasado: guardarlo así la cortaría sin querer. Se pone a una semana.
    if (valor) setHasta((h) => (h < finMinimo ? dentroDeDias(finMinimo, 7) : h));
  };

  /*
   * El pegado abajo se hace con `mt-auto`, no con `items-end`.
   *
   * Parece lo mismo y no lo es: con `align-items: flex-end`, si la tarjeta es
   * más alta que la pantalla, el borde de arriba se sale y no hay forma de
   * llegar a él — ni con scroll. Un margen automático empuja igual hacia abajo
   * pero deja el desbordamiento accesible.
   *
   * Importa desde que la tarjeta creció con lo de repetir la tarea: en una
   * pantalla corta, el nombre y la hora quedaban fuera de alcance y editar se
   * volvía imposible.
   */
  return (
    <Capa>
    <div className="velo fixed inset-0 z-40 flex justify-center overflow-y-auto bg-fondo/90 p-4 backdrop-blur-sm">
      <Tarjeta className="entrar mt-auto mb-0 h-fit w-full max-w-md !bg-superficie-alta sm:my-auto">
        <div className="flex items-center justify-between">
          <Etiqueta>{editando ? "editar tarea" : fechaFinal === hoy ? "tarea de hoy" : "nueva tarea"}</Etiqueta>
          <button onClick={onCerrar} className="px-2 text-tenue transition hover:text-texto">
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Campo etiqueta="Qué hay que hacer">
            <Entrada
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Llamar al proveedor"
              autoFocus={!editando}
            />
            {/*
              Dictar la tarea. Alex: «hay veces donde no puedo escribir» — y una
              tarea se apunta justo cuando uno está con las manos ocupadas, que
              es cuando se le ocurre y cuando se le olvida.
            */}
            <div className="mt-2">
              <BotonDictar valor={nombre} onTexto={setNombre} etiqueta="Dictar la tarea" />
            </div>
          </Campo>

          <div>
            <Etiqueta>{repeticion === "semana" ? "¿desde qué día?" : "¿qué día?"}</Etiqueta>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {[
                { nombre: "Hoy", valor: hoy },
                { nombre: "Mañana", valor: dentroDeDias(hoy, 1) },
              ].map((o) => (
                <button
                  key={o.nombre}
                  onClick={() => cambiarDia(o.valor)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    dia === o.valor ? "border-acento bg-acento/[0.08] text-acento" : "border-borde text-tenue"
                  }`}
                  aria-pressed={dia === o.valor}
                >
                  {o.nombre}
                </button>
              ))}
              <input
                type="date"
                value={dia}
                // Hacia atrás sólo si se edita una que ya era de antes.
                min={editando && tarea.fecha < hoy ? tarea.fecha : hoy}
                onChange={(e) => e.target.value && cambiarDia(e.target.value)}
                className="rounded-lg border border-borde bg-superficie-alta px-2 py-1.5 text-sm outline-none focus:border-acento"
                aria-label="Elegir la fecha"
              />
            </div>
            <p className="mt-1.5 text-sm first-letter:uppercase">{fechaLarga(dia)}</p>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-borde px-3 py-2.5">
            <span className="text-sm">Con hora y alarma</span>
            <input
              type="checkbox"
              checked={conHora}
              onChange={(e) => setConHora(e.target.checked)}
              className="size-5 accent-[var(--color-acento)]"
            />
          </label>

          {conHora ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Hora">
                  <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </Campo>
                <Campo etiqueta="Duración (min)">
                  <Entrada
                    type="number"
                    min={5}
                    step={5}
                    value={duracionMin}
                    onChange={(e) => setDuracion(Math.max(5, Number(e.target.value) || 5))}
                  />
                </Campo>
              </div>
              {/* Atajos: sin ellos hay que pelearse con el selector de hora para
                  poner algo dentro de dos minutos, que es lo que hace falta para
                  probar que la alarma suena. */}
              <div className="-mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-tenue">dentro de</span>
                {[2, 5, 15, 30, 60].map((min) => (
                  <button
                    key={min}
                    // «Dentro de» es desde ahora: la tarea pasa a ser de hoy.
                    // Una serie que ya empezó no se mueve: moverla borraba su
                    // historial de los días anteriores.
                    //
                    // En «Cada semana» además se marca el día de hoy: el atajo
                    // es para probar que la alarma suena, y la de los jueves
                    // probada un lunes no sonaría. Se ve encenderse el botón,
                    // y se desmarca con un toque si no se quiere.
                    //
                    // Una serie que ya viene de atrás también: al guardar,
                    // partirSerie la parte (la vieja hasta ayer, la nueva desde
                    // hoy), así que marcar hoy no reescribe los lunes pasados.
                    // Sólo se deja quieta si se movió a mano a una fecha pasada
                    // (ahí no se parte, y el día nuevo contaría hacia atrás).
                    onClick={() => {
                      setHora(desdeAhora(min));
                      const cuando = diaDentroDe(min);
                      const diaDeCuando = desdeClave(cuando).getDay();
                      // También una serie que empieza hoy: pasada la medianoche,
                      // «1 h» es mañana, y con la fecha de hoy nacía vencida.
                      const aHoy = repeticion === "uno" || dia >= hoy;
                      if (aHoy) cambiarDia(cuando);
                      const empiezaAtras = !aHoy && dia < hoy && !fechaFija;
                      if (repeticion === "semana" && !empiezaAtras && !diasSemana.includes(diaDeCuando)) {
                        // Si el día marcado era sólo el implícito de hoy, se
                        // cambia por el de «cuando»; si se eligió, se añade.
                        setDiasTocados(diasTocados === null && dia === hoy ? [diaDeCuando] : [...diasSemana, diaDeCuando]);
                      }
                    }}
                    className="rounded-full border border-borde px-2.5 py-1 text-xs text-tenue transition hover:border-acento hover:text-acento"
                  >
                    {min < 60 ? `${min} min` : "1 h"}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div>
            <Etiqueta>Área</Etiqueta>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoria(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    categoria === c.id ? "text-white font-medium" : "border-borde text-tenue"
                  }`}
                  style={
                    categoria === c.id
                      ? { background: colorDe(c.id), borderColor: colorDe(c.id) }
                      : undefined
                  }
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          {conHora ? (
            <Campo etiqueta="Timbre">
              <Selector value={timbre} onChange={(e) => setTimbre(e.target.value as Timbre)}>
                {TIMBRES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          ) : null}

          {/*
            Cuánto dura la tarea en el calendario, no en el reloj.

            Se guarda una sola tarea y se proyecta sobre los días que le tocan.
            Por eso cambiar la hora la cambia en todos: es la misma tarea, no
            copias. Y el historial de cada día sigue siendo suyo.
          */}
          <div>
            <Etiqueta>¿cuántos días?</Etiqueta>
            {/* Dos por fila en el móvil: cuatro en 360 px dejan unos 50 px de
                texto por botón, y «Varios días» y «Cada semana» se partirían en
                dos líneas. */}
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(
                [
                  { id: "uno", nombre: "Un día" },
                  { id: "varios", nombre: "Varios días" },
                  { id: "siempre", nombre: "Cada día" },
                  { id: "semana", nombre: "Cada semana" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    // «Varios días» con un «hasta» de antes (el de la fecha de
                    // inicio de una serie vieja) cortaba su historial al guardar.
                    if (r.id === "varios" && repeticion !== "varios") {
                      setHasta((h) => (h < finMinimo ? dentroDeDias(finMinimo, 7) : h));
                    }
                    setRepeticion(r.id);
                  }}
                  className={`rounded-xl border px-2 py-2.5 text-xs transition ${
                    repeticion === r.id ? "border-acento bg-acento/[0.08]" : "border-borde"
                  }`}
                  aria-pressed={repeticion === r.id}
                >
                  {r.nombre}
                </button>
              ))}
            </div>

            {repeticion === "varios" ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-tenue">Hasta el</span>
                <input
                  type="date"
                  value={hasta}
                  min={dia}
                  onChange={(e) => setHasta(e.target.value)}
                  className="rounded-lg border border-borde bg-superficie-alta px-2 py-1 text-sm outline-none focus:border-acento"
                />
              </div>
            ) : null}

            {repeticion === "semana" ? (
              <>
                <div className="mt-2 flex justify-between gap-1" role="group" aria-label="Días de la semana">
                  {SEMANA.map((d) => {
                    const marcado = diasSemana.includes(d.valor);
                    return (
                      <button
                        key={d.valor}
                        onClick={() => alternarDia(d.valor)}
                        className={`size-9 shrink-0 rounded-full border text-sm transition ${
                          marcado ? "border-acento bg-acento font-semibold text-sobre-acento" : "border-borde text-tenue"
                        }`}
                        aria-pressed={marcado}
                        aria-label={d.nombre}
                      >
                        {d.letra}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {[
                    { nombre: "Sin fin", valor: false },
                    { nombre: "Hasta el", valor: true },
                  ].map((o) => (
                    <button
                      key={o.nombre}
                      onClick={() => elegirFin(o.valor)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        conFin === o.valor ? "border-acento bg-acento/[0.08] text-acento" : "border-borde text-tenue"
                      }`}
                      aria-pressed={conFin === o.valor}
                    >
                      {o.nombre}
                    </button>
                  ))}
                  {conFin ? (
                    <input
                      type="date"
                      value={hastaFinal}
                      min={finMinimo}
                      onChange={(e) => e.target.value && setHasta(e.target.value)}
                      className="rounded-lg border border-borde bg-superficie-alta px-2 py-1.5 text-sm outline-none focus:border-acento"
                      aria-label="Hasta qué día"
                    />
                  ) : null}
                </div>
              </>
            ) : null}

            <p className="mt-1.5 text-xs leading-relaxed text-tenue">
              {repeticion === "uno"
                ? "Solo aparece ese día."
                : repeticion === "siempre"
                  ? `Aparecerá cada día${dia === hoy ? "" : ` desde el ${fechaLarga(dia)}`}, con su alarma, hasta que la borres.`
                  : repeticion === "varios"
                    ? `Aparecerá cada día desde ${dia === hoy ? "hoy" : `el ${fechaLarga(dia)}`} hasta el ${fechaLarga(
                        hastaFinal,
                      )}, con su alarma.`
                    : [
                        `${conHora ? "Sonará" : "Aparecerá"} ${diasEnTexto(diasSemana)}${conHora ? ` a las ${hora}` : ""}`,
                        // El primer día sólo se dice si no es hoy ni ya pasó.
                        ...(fechaFinal > hoy ? [`desde el ${fechaLarga(fechaFinal)}`] : []),
                        conFin ? `hasta el ${fechaLarga(hastaFinal)}.` : "hasta que la borres.",
                      ].join(", ")}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <div className="flex-1">
            <Boton
              variante="fuerte"
              ancho
              deshabilitado={!nombre.trim()}
              onClick={() =>
                onGuardar({
                  id: tarea?.id ?? idNuevo(),
                  fecha: fechaFinal,
                  nombre: nombre.trim(),
                  hora: conHora ? hora : null,
                  duracionMin,
                  categoria,
                  timbre: conHora ? timbre : "ninguno",
                  // La tarea se escribe entera de nuevo: en los otros modos
                  // `diasSemana` no se pone, y así desaparece si se pasa de
                  // «Cada semana» a otra cosa.
                  ...(repeticion === "uno"
                    ? {}
                    : repeticion === "siempre"
                      ? { repiteHasta: "siempre" }
                      : repeticion === "varios"
                        ? { repiteHasta: hastaFinal }
                        : {
                            repiteHasta: conFin ? hastaFinal : "siempre",
                            diasSemana: [...new Set(diasSemana)].sort((a, b) => a - b),
                          }),
                })
              }
            >
              {editando
                ? "Guardar"
                : fechaFinal === hoy
                  ? "Añadir al día"
                  : `Añadir al ${fechaLarga(fechaFinal).split(" ")[0]} ${Number(fechaFinal.slice(8))}`}
            </Boton>
          </div>
          {editando && onBorrar ? (
            <Boton variante="fallo" onClick={onBorrar}>
              Borrar
            </Boton>
          ) : null}
        </div>
      </Tarjeta>
    </div>
    </Capa>
  );
}
