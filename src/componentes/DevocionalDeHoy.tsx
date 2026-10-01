import { useEffect, useState } from "react";
import { estadoReunion, finLocalDe, horaLocalDe, salaDeLaUrl, type Reunion } from "@/logica/comunidad";
import {
  DIAS_DEL_PLAN,
  NOMBRE_PLAN,
  comentaristaDe,
  diaCompleto,
  diaDelPlan,
  leerDia,
  leerOrden,
} from "@/logica/devocionales";
import { miUid, puedoModerar } from "@/logica/muro";
import { reducido } from "@/logica/resorte";
import { abrirSala, enQueSalaEstoy, hayVoz, salasAbiertas, type Sala } from "@/logica/sala";
import { hayTimbre, soyMiembroOnull } from "@/logica/timbre";
import { CAMBIO_DE_COMUNIDAD } from "./ComunidadDeVoz";
import { Boton, Capa, Etiqueta, Tarjeta } from "./piezas";
import { PantallaDevocional } from "./PantallaDevocional";

/**
 * El canal de la sala de cada día.
 *
 * Es el de la reunión fija de `comunidad.json` («Devocional de la madrugada»,
 * `genuino://sala/devocional-madrugada`): el mismo sitio todos los días, que
 * `abrirSala` reabre limpio si quedó cerrado de ayer.
 */
const CANAL_DEL_DEVOCIONAL = "devocional-madrugada";

/** Si `comunidad.json` no trae la reunión, la sala se abre con este nombre. */
const NOMBRE_POR_DEFECTO = "Devocional de la madrugada";

/** Cada cuánto se vuelve a mirar si hay sala abierta, con la tarjeta a la vista. */
const MIRAR_CADA_MS = 30_000;

/**
 * Cada cuánto se comprueba, sin tocar la nube, si se acaba de salir de una
 * sala. Al volver de la sala la tarjeta tiene que decir la verdad ya, no a
 * los treinta segundos: si el anfitrión la terminó, seguía «En vivo» y
 * «Entrar» llevaba a «La sala está cerrada».
 */
const VIGILAR_CADA_MS = 3_000;

/** En plural: «abre los domingos», no «los domingo». */
const DIAS_EN_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

/**
 * La sala de voz del devocional que está sonando ahora, si hay una.
 *
 * Un subgrupo o una llamada no son el devocional: se va a ellos desde su sala.
 * Si entre las abiertas está la de cada día, es esa; si no, la más reciente
 * (Alex abrió el 28-09-2026 una aparte, «DEVOCIONALES diarios», desde «Abrir
 * un devocional», y también cuenta).
 */
function elegirDevocional(salas: Sala[]): Sala | null {
  const devocionales = salas.filter((s) => s.tipo !== "subgrupo" && s.tipo !== "llamada");
  return (
    devocionales.find((s) => s.canal === CANAL_DEL_DEVOCIONAL) ??
    [...devocionales].sort((a, b) => b.desde - a.desde)[0] ??
    null
  );
}

/**
 * La reunión de cada día en `comunidad.json`: la que apunta a su canal, o la
 * que se llama como él.
 *
 * `comunidad.json` se edita a mano: si no tiene la forma esperada se trata
 * como si no estuviera —nombre por defecto y sin hora— en vez de romper la
 * tarjeta más importante de la app o pintar «a las NaN:NaN».
 */
function reunionDelDevocional(reuniones: Reunion[]): Reunion | undefined {
  const r =
    reuniones.find((x) => salaDeLaUrl(x?.url) === CANAL_DEL_DEVOCIONAL) ??
    reuniones.find((x) => x?.id === CANAL_DEL_DEVOCIONAL);
  const bien =
    !!r &&
    typeof r.nombre === "string" &&
    typeof r.hora === "string" &&
    /^\d{1,2}:\d{2}$/.test(r.hora) &&
    typeof r.zona === "string" &&
    Array.isArray(r.dias) &&
    typeof r.duracionMin === "number";
  return bien ? r : undefined;
}

/** «05:00» → «5:00», que es como lo dice la gente. */
function sinCeroDelante(hora: string): string {
  return hora.replace(/^0(\d)/, "$1");
}

/**
 * Cuándo abre la sala, sacado de la reunión publicada.
 *
 * Si la reunión no está o no trae una hora que se entienda, no se inventa
 * ninguna: se dice que aparecerá aquí cuando la abran. Quien vive fuera de
 * Venezuela ve primero SU hora, que es la que le sirve para poner el
 * despertador, y la de allí entre paréntesis.
 */
function cuandoAbre(reunion: Reunion | undefined, ahora: Date): string {
  if (!reunion) return "La sala de voz aparecerá aquí, en vivo, en cuanto la abran.";
  if (estadoReunion(reunion, ahora).estado === "enVivo") {
    return "Ya es la hora del devocional: en cuanto abran la sala de voz, aparecerá aquí.";
  }
  const dias =
    reunion.dias.length === 0
      ? "cada día"
      : `los ${reunion.dias.map((d) => DIAS_EN_PLURAL[d]).filter(Boolean).join(", ")}`;
  const suya = sinCeroDelante(reunion.hora);
  const mia = sinCeroDelante(horaLocalDe(reunion, ahora));
  const donde =
    reunion.zona === "America/Caracas"
      ? "Venezuela"
      : (reunion.zona.split("/").pop() || reunion.zona).replace(/_/g, " ");
  return mia === suya
    ? `La sala de voz abre ${dias} a las ${suya} (hora de ${donde}).`
    : `La sala de voz abre ${dias} a las ${mia} en tu hora (las ${suya} en ${donde}).`;
}

/**
 * La campana con la que nace la sala de cada día: a la hora en que acaba la
 * reunión, si todavía no pasó. Es lo mismo que hace la pantalla de la sala
 * cuando se abre desde dentro (`campanaPrevista`), para que abrir desde aquí
 * o desde allí dé la misma sala.
 */
function campanaAl(fin: string | undefined): Sala["campana"] {
  if (!fin) return undefined;
  const [h, m] = fin.split(":").map(Number);
  const f = new Date();
  f.setHours(h || 0, m || 0, 0, 0);
  return f.getTime() > Date.now() ? { cuando: f.getTime(), activa: true } : undefined;
}

/** Bajar hasta la tarjeta de la comunidad de voz, más abajo en «Juntos». */
function irAComunidadDeVoz() {
  document
    .getElementById("comunidad-de-voz")
    ?.scrollIntoView({ behavior: reducido() ? "auto" : "smooth", block: "center" });
}

/**
 * La puerta al devocional de hoy, arriba del todo en «Juntos».
 *
 * Alex, 28-09-2026: la sala de devocionales, todos los días de 5 a 6, es
 * «junto a las alarmas, LO MÁS IMPORTANTE de la aplicación». Así que va lo
 * primero: el día, el tema, a quién le toca comentar y un botón.
 *
 * Sin cuenta no se pinta. Con cuenta pero fuera de la comunidad, dice cómo
 * entrar: el texto es para la comunidad, como el grupo.
 *
 * ── La sala de voz va dentro ──────────────────────────────────────────────
 *
 * Alex, el mismo 28-09-2026, mirando «Juntos»: «No veo la opción de que el
 * DEVOCIONAL sea una comunidad de voz». Tenía el devocional arriba, la sala
 * abierta más abajo entre las demás y la comunidad de voz al final: tres
 * piezas sueltas de lo que para él es una sola cosa. Así que la tarjeta del
 * día lleva dentro su sala: si está sonando, se entra desde aquí; si no, quien
 * modera la abre desde aquí, y los demás ven a qué hora abre. Y debajo, si a
 * esta persona le sonará cuando llamen o qué le falta para que le suene.
 *
 * La sala sigue saliendo también abajo, en «sonando ahora»: allí está la lista
 * de todo lo abierto, con su botón de cerrar, y quitarla de allí sería
 * esconder una sala a quien la busque donde siempre estuvo.
 */
export function DevocionalDeHoy({
  reuniones = [],
  onEntrarEnSala,
}: {
  /** Las reuniones de `comunidad.json`: de la de cada día salen el nombre y la hora de la sala. */
  reuniones?: Reunion[];
  /** Lo mismo que recibe `PantallaComunidad`: entrar en una sala de voz de la app. */
  onEntrarEnSala?: (canal: string, nombre?: string, fin?: string) => void;
}) {
  const hoy = diaDelPlan();
  const [estado, setEstado] = useState<"mirando" | "sin-cuenta" | "fuera" | "dentro">("mirando");
  const [tema, setTema] = useState("");
  const [comenta, setComenta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [leido, setLeido] = useState(() => diaCompleto(hoy, null));
  /** Si el devocional de hoy ya está. Si no, quien modera lo pega desde aquí. */
  const [hayDia, setHayDia] = useState(true);
  const [modero, setModero] = useState(false);
  /** Para volver a mirar al cerrar la pantalla: quizá se acaba de pegar. */
  const [vuelta, setVuelta] = useState(0);
  /**
   * La sala del devocional que suena ahora. `undefined` mientras no se ha
   * mirado ninguna vez: así no sale «abre a las 5:00» un instante antes de
   * «En vivo».
   */
  const [enVivo, setEnVivo] = useState<Sala | null | undefined>(undefined);
  /** Cuándo se miró por última vez: el «ya es la hora» depende del reloj. */
  const [mirado, setMirado] = useState(() => Date.now());
  /** Si esta persona está en la comunidad de voz. null: no se sabe, o no hay timbre (la web). */
  const [miembro, setMiembro] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (!(await miUid())) {
        if (vivo) setEstado("sin-cuenta");
        return;
      }
      // Sólo donde hay timbre: en la web nadie puede apuntarse a que le suene.
      const soyP = hayTimbre() ? soyMiembroOnull() : Promise.resolve(null);
      try {
        // Tras unirse o salirse (vuelta > 0), del servidor: la copia del móvil
        // seguiría enseñando el día a quien acaba de salirse.
        const [dev, mod] = await Promise.all([leerDia(hoy, { fresco: vuelta > 0 }), puedoModerar().catch(() => false)]);
        if (!vivo) return;
        setTema(dev?.tema ?? "");
        setHayDia(!!dev);
        setModero(mod);
        setEstado("dentro");
        const orden = await leerOrden().catch(() => null);
        const f = new Date();
        const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
        if (vivo && orden) setComenta(comentaristaDe(orden, iso)?.nombre ?? "");
      } catch (e) {
        if (!vivo) return;
        const codigo = String((e as { code?: string })?.code ?? "");
        setEstado(codigo.includes("permission-denied") ? "fuera" : "dentro");
      }
      const soy = await soyP;
      if (vivo) setMiembro(soy);
    })();
    return () => {
      vivo = false;
    };
  }, [hoy, vuelta]);

  // «Únete abajo y aparecerá aquí»: al unirse, se vuelve a mirar.
  useEffect(() => {
    const otraVez = () => setVuelta((n) => n + 1);
    window.addEventListener(CAMBIO_DE_COMUNIDAD, otraVez);
    return () => window.removeEventListener(CAMBIO_DE_COMUNIDAD, otraVez);
  }, []);

  /**
   * Mirar si hay sala abierta: al aparecer, al volver a primer plano y cada
   * medio minuto mientras se ve.
   *
   * Medio minuto porque el devocional empieza cuando el anfitrión llega, no a
   * las 5:00 en punto, y quien espera con la app abierta tiene que ver el
   * «En vivo» sin salir y entrar. Pero no se mira con la app en segundo plano
   * ni con la sala de voz abierta encima: ahí nadie ve la tarjeta, y cada
   * mirada son lecturas de Firestore que cuentan igual — una hora de
   * devocional con treinta dentro serían miles para nada.
   *
   * Si falla, no se inventa nada: se queda lo que se vio la última vez, y si
   * nunca se vio, la tarjeta sigue sin la franja «En vivo».
   *
   * Y al salir de una sala se mira enseguida: mientras se estaba dentro no se
   * miró, y lo último visto puede ser justo la sala que se acaba de terminar.
   * Cada mirada lleva su número para que una respuesta lenta no pise a una
   * más nueva (la del intervalo y la de volver a la app pueden cruzarse).
   */
  const conCuenta = estado === "fuera" || estado === "dentro";
  useEffect(() => {
    if (!conCuenta) return;
    let vivo = true;
    let turno = 0;
    let ultima = 0;
    let enSala = enQueSalaEstoy() != null;
    const mirar = async () => {
      if (document.visibilityState !== "visible" || enQueSalaEstoy() != null) return;
      const mio = ++turno;
      ultima = Date.now();
      try {
        const salas = await salasAbiertas();
        if (!vivo || mio !== turno) return;
        setEnVivo(elegirDevocional(salas));
      } catch {
        if (!vivo || mio !== turno) return;
        setEnVivo((antes) => (antes === undefined ? null : antes));
      }
      setMirado(Date.now());
    };
    const vigilar = () => {
      const ahoraEnSala = enQueSalaEstoy() != null;
      const acabaDeSalir = enSala && !ahoraEnSala;
      enSala = ahoraEnSala;
      if (acabaDeSalir || Date.now() - ultima >= MIRAR_CADA_MS) void mirar();
    };
    void mirar();
    const id = window.setInterval(vigilar, VIGILAR_CADA_MS);
    const alVolver = () => void mirar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [conCuenta]);

  if (estado === "mirando" || estado === "sin-cuenta") return null;

  return (
    <>
      <Tarjeta className="border-acento/40 bg-gradient-to-b from-acento/10 to-superficie">
        <div className="flex items-center justify-between gap-3">
          <Etiqueta>{NOMBRE_PLAN}</Etiqueta>
          <span className="rounded-full bg-logro/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-logro">
            {leido ? "✓ leído" : "¡En marcha!"}
          </span>
        </div>
        <p className="mt-1 text-sm text-tenue">
          Día {hoy} de {DIAS_DEL_PLAN}
        </p>
        {estado === "fuera" ? (
          <p className="mt-2 text-sm leading-relaxed">
            El devocional de cada día es para la comunidad, como el grupo. Únete abajo, en{" "}
            <strong>comunidad de voz</strong>, y aparecerá aquí.
          </p>
        ) : (
          <>
            {tema ? <p className="mt-2 text-lg font-semibold leading-snug">✨ {tema}</p> : null}
            {!hayDia ? (
              <p className="mt-2 text-sm leading-relaxed text-tenue">
                {modero
                  ? "El devocional de hoy todavía no está. Pégalo —el mismo Bloque 1 que mandas al grupo— y la sala lo reparte al momento."
                  : "El devocional de hoy todavía no está. Aparecerá aquí en cuanto se publique."}
              </p>
            ) : null}
            {comenta ? (
              <p className="mt-1 text-xs text-tenue">
                Comenta hoy: <span className="text-texto">{comenta}</span>
              </p>
            ) : null}
            {hayDia || modero ? (
              <div className="mt-3">
                <Boton variante="fuerte" ancho onClick={() => setAbierto(true)}>
                  {!hayDia ? "Pegar el devocional de hoy" : leido ? "Abrir el devocional" : "Iniciar lectura"}
                </Boton>
              </div>
            ) : null}
          </>
        )}

        <SalaDeVoz
          enVivo={enVivo}
          reunion={reunionDelDevocional(reuniones)}
          ahora={new Date(mirado)}
          // Abrir, sólo quien modera y donde se puede hablar: desde el
          // navegador quedaría una sala «en vivo» sin nadie que pudiera hablar
          // dentro (lo mismo que en `SalasAbiertas`).
          puedoAbrir={estado === "dentro" && modero && hayVoz()}
          moderoSinVoz={estado === "dentro" && modero && !hayVoz()}
          // Fuera de la comunidad no hace falta preguntar a `soyMiembro`: lo
          // dijeron las reglas, y el botón es justo la manera de entrar.
          miembro={estado === "fuera" ? false : miembro}
          fuera={estado === "fuera"}
          onEntrarEnSala={onEntrarEnSala}
        />
      </Tarjeta>

      {abierto ? (
        <Capa>
          <div className="fixed inset-0 z-40 overflow-y-auto bg-fondo">
            <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg px-4">
              <PantallaDevocional
                onCerrar={() => {
                  setAbierto(false);
                  setLeido(diaCompleto(hoy, null));
                  setVuelta((n) => n + 1);
                }}
              />
            </div>
          </div>
        </Capa>
      ) : null}
    </>
  );
}

/**
 * La franja de la sala de voz, dentro de la tarjeta del devocional.
 *
 * Tres casos, y sólo uno a la vez: está sonando (se entra), no suena y esta
 * persona puede abrirla (se abre la de cada día), o no suena y no puede (a qué
 * hora abre). Debajo, lo de la comunidad de voz de esta persona: si le sonará
 * cuando llamen, o el botón para apuntarse.
 */
function SalaDeVoz({
  enVivo,
  reunion,
  ahora,
  puedoAbrir,
  moderoSinVoz,
  miembro,
  fuera,
  onEntrarEnSala,
}: {
  enVivo: Sala | null | undefined;
  reunion: Reunion | undefined;
  ahora: Date;
  puedoAbrir: boolean;
  moderoSinVoz: boolean;
  miembro: boolean | null;
  fuera: boolean;
  onEntrarEnSala?: (canal: string, nombre?: string, fin?: string) => void;
}) {
  const nombreFijo = reunion?.nombre ?? NOMBRE_POR_DEFECTO;
  // La hora a la que acaba la reunión: la campana de la sala nace ahí, igual
  // que cuando se entra desde la reunión publicada más abajo.
  const fin = reunion ? finLocalDe(reunion, ahora) : undefined;
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");

  /**
   * Abrir la sala de cada día y entrar.
   *
   * Se abre AQUÍ y no dejándoselo a la pantalla de la sala, que sólo ofrece
   * reabrir la de otro día o la que pasó sus cuatro horas: la que se cerró
   * hoy la trata como terminada, y el portero contesta «La sala está
   * cerrada». Así, el día que Alex termina a las 6:00 y quiere volver a abrir
   * —o la cerró sin querer—, el botón que dice «Abrir» abre. Es lo mismo que
   * hace «Abrir un devocional» en `SalasAbiertas`: abrir y entrar de una vez.
   * Si ya está abierta y viva, `abrirSala` no la toca y sólo se entra.
   */
  const abrir = async () => {
    if (!onEntrarEnSala) return;
    setAbriendo(true);
    setError("");
    try {
      const finAhora = reunion ? finLocalDe(reunion) : undefined;
      await abrirSala(CANAL_DEL_DEVOCIONAL, nombreFijo, "devocional", campanaAl(finAhora));
      onEntrarEnSala(CANAL_DEL_DEVOCIONAL, nombreFijo, finAhora);
    } catch {
      // Sin decir «mira tu conexión»: también falla si quien la abrió sigue
      // apuntado dentro, y eso no se arregla con la red.
      setError("No se pudo abrir la sala de voz. Vuelve a probar en un momento.");
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <div className="mt-4 border-t border-acento/20 pt-3">
      <div className="flex items-center gap-2">
        <span aria-hidden>🎙</span>
        <Etiqueta>sala de voz</Etiqueta>
      </div>

      {enVivo === undefined ? null : enVivo ? (
        <div className="mt-2 rounded-xl border border-logro/50 bg-logro/5 p-3">
          <div className="flex items-center gap-2">
            {/* El mismo punto que late de «sonando ahora», más abajo. */}
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-logro opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-logro" />
            </span>
            <p className="min-w-0 break-words text-sm font-medium leading-snug">
              <span className="text-logro">En vivo:</span> {enVivo.nombre}
            </p>
          </div>
          <p className="mt-1 text-xs text-tenue">
            abierta desde las{" "}
            {new Date(enVivo.desde).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
          </p>
          {onEntrarEnSala ? (
            <div className="mt-2">
              <Boton
                variante="logro"
                ancho
                onClick={() =>
                  onEntrarEnSala(
                    enVivo.canal,
                    enVivo.nombre,
                    enVivo.canal === CANAL_DEL_DEVOCIONAL ? fin : undefined,
                  )
                }
              >
                Entrar a la sala de voz
              </Boton>
            </div>
          ) : null}
        </div>
      ) : puedoAbrir && onEntrarEnSala ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Se abre la sala de cada día; dentro, “Llamar a la comunidad” hace sonar a todos.
          </p>
          <div className="mt-2">
            <Boton ancho deshabilitado={abriendo} onClick={() => void abrir()}>
              {abriendo ? "Abriendo…" : "Abrir la sala de voz del devocional"}
            </Boton>
          </div>
          {error ? <p className="mt-2 text-xs leading-relaxed text-fallo">{error}</p> : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-tenue">{cuandoAbre(reunion, ahora)}</p>
          {moderoSinVoz ? (
            <p className="mt-1 text-xs leading-relaxed text-tenue">
              Para abrirla usa la app de Android: es donde se puede hablar.
            </p>
          ) : null}
        </>
      )}

      {/*
        Lo que decide si a esta persona le suena. Con la app cerrada, el
        devocional llega por el timbre, y el timbre sólo llama a los apuntados.
      */}
      {miembro === false ? (
        <>
          {fuera ? null : (
            <p className="mt-3 text-xs leading-relaxed text-tenue">
              Únete a la comunidad de voz y tu móvil sonará cuando llamen al devocional, aunque la app
              esté cerrada.
            </p>
          )}
          <div className="mt-2">
            <Boton ancho onClick={irAComunidadDeVoz}>
              Unirme a la comunidad de voz
            </Boton>
          </div>
        </>
      ) : miembro === true ? (
        <p className="mt-3 text-xs leading-relaxed text-tenue">
          Estás en la comunidad de voz: te sonará cuando llamen.
        </p>
      ) : null}
    </div>
  );
}
