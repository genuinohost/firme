import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import {
  DIAS_DEL_PLAN,
  NOMBRE_PLAN,
  comentaristaDe,
  diaDelPlan,
  diasCompletos,
  fechaCorta,
  fechaDelDia,
  leerDia,
  leerOrden,
  leidasDe,
  marcarDiaCompleto,
  marcarLeida,
  seccionesDe,
  type Devocional,
  type Orden,
} from "@/logica/devocionales";
import { celebrarDia } from "@/logica/celebrar";
import { puedoModerar } from "@/logica/muro";
import { PegarDevocional } from "./PegarDevocional";
import { Boton, CheckDibujado, Etiqueta } from "./piezas";
import { TextoDevocional } from "./TextoDevocional";

/**
 * El devocional del día, como en YouVersion.
 *
 * Alex, 28-09-2026: «la interfaz en la aplicación debe ser similar a la de
 * YouVersion en el tema del orden, los días arriba y cómo se desplaza entre
 * devocionales». Es el plan que ya usa el grupo, así que nadie tiene que
 * aprender nada:
 *
 *   - arriba, la tira de días con su fecha, el de hoy marcado y ✓ en los leídos;
 *   - «Día 271 de 365 · ¡EN MARCHA!»;
 *   - las secciones del día —Devocional y cada capítulo— con su círculo;
 *   - «Iniciar lectura», que las recorre en orden, y abajo ‹ Sección › para
 *     pasar de una a otra (o deslizando con el dedo).
 *
 * Lo leído se recuerda en este móvil. El texto lo trae la comunidad
 * (`logica/devocionales`): quien no está apuntado no lo puede leer, igual que
 * no está en el grupo de WhatsApp.
 */
export function PantallaDevocional({ onCerrar }: { onCerrar: () => void }) {
  const hoy = diaDelPlan();
  const [dia, setDia] = useState(hoy);
  const [dev, setDev] = useState<Devocional | null | "cargando" | "sin-permiso" | "sin-red">("cargando");
  const [orden, setOrden] = useState<Orden | null>(null);
  /** El índice de la sección que se está leyendo, o null en la portada del día. */
  const [leyendo, setLeyendo] = useState<number | null>(null);
  const [leidas, setLeidas] = useState<Set<string>>(() => leidasDe(hoy));
  /** Para repintar los ✓ de la tira al terminar un día. */
  const [version, setVersion] = useState(0);
  const tira = useRef<HTMLDivElement>(null);
  /** Quien modera puede pegar o corregir el día (el Bloque 1 del prompt). */
  const [modero, setModero] = useState(false);
  const [pegando, setPegando] = useState(false);
  /** La tira que ya se centró: la primera vez va de golpe, las demás deslizando. */
  const centrada = useRef<HTMLDivElement | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void leerOrden()
      .then(setOrden)
      .catch(() => setOrden(null));
    void puedoModerar()
      .then(setModero)
      .catch(() => setModero(false));
  }, []);

  useEffect(() => {
    let vivo = true;
    setDev("cargando");
    setLeidas(leidasDe(dia));
    void leerDia(dia)
      .then((d) => vivo && setDev(d))
      .catch((e) => {
        if (!vivo) return;
        const codigo = String((e as { code?: string })?.code ?? "");
        setDev(codigo.includes("permission-denied") ? "sin-permiso" : "sin-red");
      });
    return () => {
      vivo = false;
    };
  }, [dia]);

  // La tira se centra en el día elegido, como la de YouVersion. Se vuelve a
  // montar al salir del lector y al terminar un día: esas veces se coloca de
  // golpe, sin pasearse por todo enero delante de quien mira.
  useEffect(() => {
    const t = tira.current;
    const el = t?.querySelector<HTMLElement>(`[data-dia="${dia}"]`);
    if (!t || !el) return;
    const primera = centrada.current !== t;
    centrada.current = t;
    t.scrollTo({ left: el.offsetLeft - (t.clientWidth - el.offsetWidth) / 2, behavior: primera ? "auto" : "smooth" });
  }, [dia, leyendo, version, pegando]);

  // Cada sección, y la portada al volver, empiezan arriba. La pantalla va
  // dentro de una capa con su propio desplazamiento, no el de la ventana.
  useEffect(() => {
    let el = raiz.current?.parentElement ?? null;
    while (el && el !== document.body) {
      const y = getComputedStyle(el).overflowY;
      if (y === "auto" || y === "scroll") break;
      el = el.parentElement;
    }
    if (el && el !== document.body) el.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }, [leyendo, pegando]);

  const secciones = useMemo(() => (dev && typeof dev === "object" ? seccionesDe(dev) : []), [dev]);
  const fechaISO = (n: number) => {
    const f = fechaDelDia(n);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  };
  // Hoy, con la fecha de verdad (en bisiesto, el 29 de febrero comparte día
  // del plan con el 28 y la sala usa la fecha real).
  const hoyISO = (() => {
    const f = new Date();
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  })();
  const comenta = orden ? comentaristaDe(orden, dia === hoy ? hoyISO : fechaISO(dia)) : null;
  /** Los días leídos enteros, leídos del móvil una vez por pintada y no 365. */
  const hechos = useMemo(() => diasCompletos(), [version, leidas]);

  const marcar = (id: string) => {
    marcarLeida(dia, id);
    const nuevas = leidasDe(dia);
    setLeidas(nuevas);
    if (secciones.length && secciones.every((s) => nuevas.has(s.id))) {
      marcarDiaCompleto(dia);
      setVersion((v) => v + 1);
    }
  };

  // ── deslizar: entre días en la portada, entre secciones al leer ──────────
  const toque = useRef<{ x: number; y: number } | null>(null);
  const alEmpezar = (e: TouchEvent) => {
    toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const alSoltar = (e: TouchEvent) => {
    const t = toque.current;
    toque.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const adelante = dx < 0;
    if (leyendo == null) {
      setDia((d) => Math.min(DIAS_DEL_PLAN, Math.max(1, d + (adelante ? 1 : -1))));
    } else if (adelante) {
      avanzar();
    } else if (leyendo > 0) {
      setLeyendo(leyendo - 1);
    }
  };

  const avanzar = () => {
    if (leyendo == null) return;
    const s = secciones[leyendo];
    if (s) marcar(s.id);
    if (leyendo + 1 < secciones.length) {
      setLeyendo(leyendo + 1);
    } else {
      // El último: se vuelve a la portada, con las motas de oro del día completo.
      setLeyendo(null);
      celebrarDia();
    }
  };

  // ── pegando el devocional del día ───────────────────────────────────────
  if (pegando) {
    return (
      <div ref={raiz} className="py-2">
        <PegarDevocional
          dia={dia}
          existente={dev && typeof dev === "object" ? dev : null}
          onListo={(nuevo) => {
            if (nuevo.dia === dia) setDev(nuevo);
            else setDia(nuevo.dia);
            setPegando(false);
          }}
          onCerrar={() => setPegando(false)}
        />
      </div>
    );
  }

  // ── leyendo una sección ─────────────────────────────────────────────────
  if (leyendo != null && secciones[leyendo]) {
    const s = secciones[leyendo];
    return (
      <div ref={raiz} className="flex min-h-full flex-col" onTouchStart={alEmpezar} onTouchEnd={alSoltar}>
        <div
          className="sticky z-10 flex items-center gap-2 border-b border-borde bg-fondo/95 py-2 backdrop-blur"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <button
            onClick={() => setLeyendo(null)}
            className="toque rounded-lg px-2 py-1 text-xl text-tenue"
            aria-label="Volver al día"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-[0.14em] text-tenue">
              Día {dia} de {DIAS_DEL_PLAN}
            </p>
            <p className="truncate text-sm font-semibold">{s.titulo}</p>
          </div>
        </div>

        <div key={s.id} className="pantalla-entra flex-1 py-5">
          {s.id === "devocional" && typeof dev === "object" && dev?.tema ? (
            <p className="mb-5 text-center text-lg font-semibold text-acento">✨ {dev.tema} ✨</p>
          ) : null}
          <div className="flex flex-col gap-6">
            {s.trozos.map((t, i) => (
              <section key={i}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-tenue">{t.ref}</p>
                <TextoDevocional trozo={t} grande />
              </section>
            ))}
          </div>
        </div>

        {/* Abajo, como en YouVersion: ‹ sección › */}
        <div className="zona-segura-abajo sticky bottom-0 flex items-center gap-2 border-t border-borde bg-fondo/95 py-3 backdrop-blur">
          <button
            onClick={() => leyendo > 0 && setLeyendo(leyendo - 1)}
            disabled={leyendo === 0}
            className="toque flex size-11 items-center justify-center rounded-full border border-borde text-lg disabled:opacity-30"
            aria-label="Sección anterior"
          >
            ‹
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm">
            {s.titulo} · {leyendo + 1} de {secciones.length}
          </p>
          <button
            onClick={avanzar}
            className="toque flex h-11 items-center justify-center gap-1 rounded-full bg-acento px-4 text-sm font-semibold text-sobre-acento"
            aria-label={leyendo + 1 < secciones.length ? "Sección siguiente" : "Terminar el día"}
          >
            {leyendo + 1 < secciones.length ? "›" : "Terminar ✓"}
          </button>
        </div>
      </div>
    );
  }

  // ── la portada del día ──────────────────────────────────────────────────
  const siguienteSinLeer = secciones.findIndex((s) => !leidas.has(s.id));
  return (
    <div ref={raiz} className="flex flex-col gap-4 pb-6" onTouchStart={alEmpezar} onTouchEnd={alSoltar}>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onCerrar} className="toque rounded-lg px-2 py-1 text-xl text-tenue" aria-label="Cerrar">
          ‹
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{NOMBRE_PLAN}</p>
      </div>

      {/* La portada del plan, en la paleta de la app. */}
      <div className="aparece rounded-2xl border border-acento/30 bg-gradient-to-b from-acento/15 to-superficie px-5 py-6 text-center">
        <p className="text-2xl font-bold uppercase tracking-wide text-acento">{NOMBRE_PLAN}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-tenue">
          Una jornada a través de la Biblia en 365 días
        </p>
      </div>

      {/* La tira de días: número, fecha y ✓. Se desliza con el dedo. */}
      <div ref={tira} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" key={version}>
        {Array.from({ length: DIAS_DEL_PLAN }, (_, i) => i + 1).map((n) => {
          const elegido = n === dia;
          const hecho = hechos.has(n);
          return (
            <button
              key={n}
              data-dia={n}
              onClick={() => setDia(n)}
              className={`toque relative flex w-16 shrink-0 snap-center flex-col items-center rounded-xl border py-2 ${
                elegido ? "border-acento bg-acento/10" : "border-borde bg-superficie"
              }`}
              aria-label={`Día ${n}, ${fechaCorta(n)}${hecho ? ", leído" : ""}`}
              aria-current={elegido ? "date" : undefined}
            >
              <span className={`cifras text-lg font-semibold ${elegido ? "text-acento" : ""}`}>{n}</span>
              <span className={`text-[10px] ${n === hoy ? "font-semibold text-acento" : "text-tenue"}`}>
                {n === hoy ? "hoy" : fechaCorta(n)}
              </span>
              {hecho ? (
                <span className="absolute -top-1.5 -right-1 flex size-4 items-center justify-center rounded-full bg-logro text-sobre-color">
                  <CheckDibujado className="size-2.5" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Etiqueta>
          Día {dia} de {DIAS_DEL_PLAN}
        </Etiqueta>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            dia === hoy
              ? "bg-logro/15 text-logro"
              : dia < hoy
                ? "bg-superficie-alta text-tenue"
                : "bg-acento/10 text-acento"
          }`}
        >
          {dia === hoy ? "¡En marcha!" : dia < hoy ? "Ya pasó" : "Próximamente"}
        </span>
      </div>

      {dev === "cargando" ? (
        <p className="py-6 text-center text-sm text-tenue">Cargando el día…</p>
      ) : dev === "sin-permiso" ? (
        <p className="rounded-xl border border-borde px-4 py-5 text-sm leading-relaxed">
          El devocional es para la comunidad, como el grupo. Únete en <strong>Juntos → Comunidad de voz</strong> y
          podrás leerlo cada día.
        </p>
      ) : dev === "sin-red" ? (
        <p className="rounded-xl border border-borde px-4 py-5 text-sm leading-relaxed">
          No se pudo traer el día. Mira tu conexión: los días que ya abriste se quedan guardados en el móvil.
        </p>
      ) : dev == null ? (
        <div className="rounded-xl border border-dashed border-borde px-4 py-5 text-center text-sm text-tenue">
          <p>{dia > hoy ? "Este día todavía no está publicado." : "Este día no está en el archivo."}</p>
          {modero ? (
            <div className="mt-3">
              <Boton variante="fuerte" ancho onClick={() => setPegando(true)}>
                Pegar el devocional del día {dia}
              </Boton>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {dev.tema ? <p className="text-center text-lg font-semibold leading-snug">✨ {dev.tema} ✨</p> : null}
          {comenta ? (
            <p className="text-center text-xs text-tenue">
              {dia === hoy ? "Comenta hoy" : dia < hoy ? "Comentó" : "Comentará"}:{" "}
              <span className="text-texto">{comenta.nombre}</span>
            </p>
          ) : null}

          {/* Las secciones, con su círculo, como en YouVersion. */}
          <ul className="escalonado flex flex-col divide-y divide-borde rounded-2xl border border-borde bg-superficie">
            {secciones.map((s, i) => {
              const hecha = leidas.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setLeyendo(i)}
                    className="toque flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        hecha ? "border-logro bg-logro text-sobre-color" : "border-borde"
                      }`}
                      aria-hidden
                    >
                      {hecha ? <CheckDibujado className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{s.titulo}</span>
                    <span className="text-tenue" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Boton variante="fuerte" ancho onClick={() => setLeyendo(Math.max(0, siguienteSinLeer))}>
            {siguienteSinLeer < 0 ? "Volver a leer" : siguienteSinLeer === 0 ? "Iniciar lectura" : "Seguir leyendo"}
          </Boton>
          {modero ? (
            <button
              onClick={() => setPegando(true)}
              className="toque self-center text-xs text-tenue underline underline-offset-2"
            >
              Corregir este día
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
