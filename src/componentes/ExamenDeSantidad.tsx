import { useState } from "react";
import type { Plan, RegistroPlan } from "@/datos/planes/tipos";
import { Boton, Cita, Etiqueta, Tarjeta } from "./piezas";

/**
 * El repaso de la noche para los planes de santidad.
 *
 * Aquí no se pide un informe: se pregunta una sola cosa, como la preguntaría un
 * pastor. Y si hubo caída, lo que decide el día **no es la caída**, sino si se
 * llevó delante de Dios.
 *
 * Esa es la diferencia entre una app que enseña bien y una que enseña mal.
 * Tratar igual una caída confesada que una escondida haría de la racha un ídolo
 * y empujaría a mentir para no perderla. Lo que rompe la comunión no es
 * tropezar: es quedarse en el suelo.
 *
 * El día restaurado se apunta aparte, y esa cuenta se le enseña con cuidado:
 * no para acusar, sino para que vea el patrón y se guarde mejor.
 */

type Paso = "pregunta" | "donde" | "arrepentimiento" | "cierre";

export function ExamenDeSantidad({
  plan,
  registro,
  restauradosEsteMes,
  onGuardar,
  onCerrar,
}: {
  plan: Plan;
  registro: RegistroPlan | null;
  /** Cuántos días se salvaron por arrepentimiento en los últimos 30. */
  restauradosEsteMes: number;
  onGuardar: (r: {
    puntos: Record<string, boolean>;
    restaurado: boolean;
    caidas: string[];
    vencioSuDebilidad?: boolean;
  }) => void;
  onCerrar: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("pregunta");
  const [caidas, setCaidas] = useState<string[]>(registro?.caidas ?? []);
  const [arrepentido, setArrepentido] = useState<boolean | null>(null);

  const debilidades = plan.debilidades ?? [];
  const cayoEnSuDebilidad = caidas.some((id) => debilidades.includes(id));
  const vencioSuDebilidad = debilidades.length > 0 ? !cayoEnSuDebilidad : undefined;

  const guardar = (limpio: boolean) => {
    const puntos: Record<string, boolean> = {};
    for (const p of plan.puntos) puntos[p.id] = limpio ? true : !caidas.includes(p.id);
    onGuardar({
      puntos,
      restaurado: !limpio && arrepentido === true,
      caidas: limpio ? [] : caidas,
      vencioSuDebilidad,
    });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-fondo/95 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
        <div className="flex items-center justify-between pb-3">
          <Etiqueta>repaso del día</Etiqueta>
          <button onClick={onCerrar} className="px-2 py-1 text-tenue transition hover:text-texto">
            ✕
          </button>
        </div>

        <h2 className="text-xl font-semibold">
          <span className="mr-2" aria-hidden>
            {plan.emoji}
          </span>
          {plan.nombre}
        </h2>

        {/* Una sola pregunta, hecha de frente. */}
        {paso === "pregunta" ? (
          <div className="entrar mt-4">
            <p className="text-lg leading-snug">
              ¿Guardaste hoy tu santidad delante de Dios?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-tenue">
              Responde con sinceridad. Nadie más va a ver esto, y lo que digas aquí no
              cambia lo que Él ya sabe.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Boton variante="logro" ancho onClick={() => guardar(true)}>
                Sí, la guardé
              </Boton>
              <Boton variante="fallo" ancho onClick={() => setPaso("donde")}>
                Hoy caí
              </Boton>
            </div>

            {debilidades.length > 0 ? (
              <p className="mt-4 rounded-xl bg-superficie-alta px-3 py-2.5 text-xs leading-relaxed text-tenue">
                Tu batalla declarada:{" "}
                <b className="text-texto">
                  {plan.puntos
                    .filter((p) => debilidades.includes(p.id))
                    .map((p) => p.texto.toLowerCase())
                    .join(" · ")}
                </b>
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Señalar dónde. Opcional: sirve para el patrón, no para el castigo. */}
        {paso === "donde" ? (
          <div className="entrar mt-4">
            <p className="text-[15px] leading-relaxed">
              No estás solo en esto y no te descalifica. Si quieres, señala dónde fue —
              sirve para ver el patrón, no para juzgarte.
            </p>

            <div className="mt-3 flex flex-col gap-1.5">
              {plan.puntos.map((punto) => {
                const marcado = caidas.includes(punto.id);
                const esSuBatalla = debilidades.includes(punto.id);
                return (
                  <button
                    key={punto.id}
                    onClick={() =>
                      setCaidas((c) =>
                        marcado ? c.filter((x) => x !== punto.id) : [...c, punto.id],
                      )
                    }
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      marcado ? "border-fallo bg-fallo/10" : "border-borde"
                    }`}
                  >
                    <span className="shrink-0" aria-hidden>
                      {marcado ? "✕" : "○"}
                    </span>
                    <span className="min-w-0 flex-1">{punto.texto}</span>
                    {esSuBatalla ? (
                      <span className="shrink-0 text-xs text-acento" title="Tu batalla">
                        ★
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <Boton variante="fuerte" ancho onClick={() => setPaso("arrepentimiento")}>
                Seguir
              </Boton>
            </div>
          </div>
        ) : null}

        {/* La pregunta que decide el día. */}
        {paso === "arrepentimiento" ? (
          <div className="entrar mt-4">
            <p className="text-lg leading-snug">
              ¿Lo llevaste delante de Dios en oración de arrepentimiento?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-tenue">
              Esto es lo que decide el día. No la caída: lo que hiciste con ella.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Boton
                variante="fuerte"
                ancho
                onClick={() => {
                  setArrepentido(true);
                  setPaso("cierre");
                }}
              >
                Sí, me arrepentí de corazón
              </Boton>
              <Boton
                ancho
                onClick={() => {
                  setArrepentido(false);
                  setPaso("cierre");
                }}
              >
                Todavía no
              </Boton>
            </div>
          </div>
        ) : null}

        {/* El cierre. Aquí es donde el tono importa más que en toda la app. */}
        {paso === "cierre" ? (
          <div className="entrar mt-4">
            {arrepentido ? (
              <>
                <Tarjeta className="border-acento/40">
                  <Etiqueta>restaurado</Etiqueta>
                  <p className="mt-1 text-[15px] leading-relaxed">
                    Tu racha sigue en pie. No por lo que hiciste, sino por su
                    misericordia. Levántate y sigue.
                  </p>
                  <div className="mt-3">
                    <Cita
                      texto="Si confesamos nuestros pecados, él es fiel y justo para que nos perdone nuestros pecados, y nos limpie de toda maldad."
                      fuente="1 Juan 1:9"
                    />
                  </div>
                </Tarjeta>

                {/*
                  El aviso, solo cuando el patrón es claro. Dicho así —sin
                  acusar, señalando el hecho— para que sirva de espejo y no de
                  látigo.
                */}
                {restauradosEsteMes >= 4 ? (
                  <p className="mt-3 rounded-xl border border-acento/25 bg-acento/[0.06] px-3 py-3 text-sm leading-relaxed">
                    Llevas <b>{restauradosEsteMes + 1} días restaurados</b> este mes. Su
                    misericordia no se agota — pero volver tan seguido por lo mismo es
                    un aviso. Mira qué te está llevando ahí, y quita de en medio lo que
                    haga falta.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <Tarjeta>
                  <Etiqueta>la racha se rompe hoy</Etiqueta>
                  <p className="mt-1 text-[15px] leading-relaxed">
                    Pero la relación no. Lo que se rompe es una cuenta de días; lo otro
                    sigue intacto y te está esperando.
                  </p>
                  <div className="mt-3">
                    <Cita
                      texto="Cercano está Jehová á los quebrantados de corazón; y salvará á los contritos de espíritu."
                      fuente="Salmos 34:18"
                    />
                  </div>
                </Tarjeta>

                <p className="mt-3 text-sm leading-relaxed text-tenue">
                  Puedes hacerlo ahora mismo. No hacen falta palabras bonitas: dile lo
                  que hay, pide perdón, y pídele fuerza para mañana.
                </p>
                <div className="mt-3">
                  <Boton
                    variante="fuerte"
                    ancho
                    onClick={() => {
                      setArrepentido(true);
                      setPaso("cierre");
                    }}
                  >
                    Acabo de hacerlo
                  </Boton>
                </div>
              </>
            )}

            <div className="mt-4">
              <Boton variante={arrepentido ? "fuerte" : "normal"} ancho onClick={() => guardar(false)}>
                Cerrar el día
              </Boton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
