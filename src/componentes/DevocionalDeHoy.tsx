import { useEffect, useState } from "react";
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
import { CAMBIO_DE_COMUNIDAD } from "./ComunidadDeVoz";
import { Boton, Capa, Etiqueta, Tarjeta } from "./piezas";
import { PantallaDevocional } from "./PantallaDevocional";

/**
 * La puerta al devocional de hoy, arriba del todo en «Juntos».
 *
 * Alex, 28-09-2026: la sala de devocionales, todos los días de 5 a 6, es
 * «junto a las alarmas, LO MÁS IMPORTANTE de la aplicación». Así que va lo
 * primero: el día, el tema, a quién le toca comentar y un botón.
 *
 * Sin cuenta no se pinta. Con cuenta pero fuera de la comunidad, dice cómo
 * entrar: el texto es para la comunidad, como el grupo.
 */
export function DevocionalDeHoy() {
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

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (!(await miUid())) {
        if (vivo) setEstado("sin-cuenta");
        return;
      }
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
