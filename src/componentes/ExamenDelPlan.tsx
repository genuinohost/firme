import { useState } from "react";
import type { Plan, RegistroPlan } from "@/datos/planes/tipos";
import { BotonDictar } from "./BotonDictar";
import { CasillaPublicar } from "./CasillaPublicar";
import { AreaTexto, Boton, Cita, Etiqueta, Tarjeta } from "./piezas";

/**
 * El repaso de la noche.
 *
 * Aquí se decide si el día se guardó o no, y por eso el tono importa más que en
 * ninguna otra pantalla. Quien abre esto a las diez de la noche ya sabe dónde
 * falló: no necesita que se lo recuerden con dureza, necesita poder decirlo,
 * cerrar el día y levantarse mañana sin arrastrarlo.
 *
 * Por eso al terminar no hay reprimenda: hay una palabra de aliento si cumplió,
 * y una de misericordia si no.
 */
export function ExamenDelPlan({
  plan,
  registro,
  onGuardar,
  onCerrar,
}: {
  plan: Plan;
  registro: RegistroPlan | null;
  onGuardar: (
    puntos: Record<string, boolean>,
    /** Lo que quiso escribir sobre el día. Va al diario. */
    nota?: string,
    /** Si además quiso sacarla al muro. */
    publica?: boolean,
  ) => void;
  onCerrar: () => void;
}) {
  const [respuestas, setRespuestas] = useState<Record<string, boolean | undefined>>(
    () => registro?.puntos ?? {},
  );
  const [verVersiculo, setVerVersiculo] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [publica, setPublica] = useState(false);

  const contestados = plan.puntos.filter((p) => respuestas[p.id] !== undefined).length;
  const todos = contestados === plan.puntos.length;
  const fallos = plan.puntos.filter((p) => respuestas[p.id] === false).length;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-fondo/95 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
        <div className="flex items-center justify-between pb-2">
          <Etiqueta>repaso del día</Etiqueta>
          <button onClick={onCerrar} className="px-2 py-1 text-tenue transition hover:text-texto">
            ✕
          </button>
        </div>

        <div className="mb-3">
          <h2 className="text-xl font-semibold">
            <span className="mr-2" aria-hidden>
              {plan.emoji}
            </span>
            {plan.nombre}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-tenue">
            Responde con sinceridad. Esto no es para juzgarte: es para que nada se
            quede escondido y mañana empieces limpio.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {plan.puntos.map((punto) => {
            const valor = respuestas[punto.id];
            return (
              <Tarjeta
                key={punto.id}
                className={
                  valor === true
                    ? "border-logro/40"
                    : valor === false
                      ? "border-fallo/40"
                      : ""
                }
              >
                <p className="text-[15px] leading-relaxed">{punto.texto}</p>

                {punto.versiculo ? (
                  <button
                    onClick={() =>
                      setVerVersiculo(verVersiculo === punto.id ? null : punto.id)
                    }
                    className="mt-1 text-xs text-tenue transition hover:text-acento"
                  >
                    {verVersiculo === punto.id ? "ocultar" : "ver el versículo"}
                  </button>
                ) : null}

                {verVersiculo === punto.id && punto.versiculo ? (
                  <div className="mt-2 rounded-xl bg-superficie-alta p-3">
                    <Cita texto={punto.versiculo} fuente={punto.cita} />
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <div className="flex-1">
                    <Boton
                      variante={valor === true ? "logro" : "normal"}
                      ancho
                      onClick={() => setRespuestas((r) => ({ ...r, [punto.id]: true }))}
                    >
                      Sí, lo guardé
                    </Boton>
                  </div>
                  <div className="flex-1">
                    <Boton
                      variante={valor === false ? "fallo" : "normal"}
                      ancho
                      onClick={() => setRespuestas((r) => ({ ...r, [punto.id]: false }))}
                    >
                      Hoy no
                    </Boton>
                  </div>
                </div>
              </Tarjeta>
            );
          })}
        </div>

        {/* Lo que se lleva al cerrar: aliento si cumplió, misericordia si no. */}
        {todos ? (
          <Tarjeta className="entrar mt-3 border-acento/40">
            {fallos === 0 ? (
              <>
                <Etiqueta>día guardado</Etiqueta>
                <p className="mt-1 text-[15px] leading-relaxed">
                  Lo sostuviste entero. Nadie lo vio y no hace falta que nadie lo vea.
                </p>
                <div className="mt-2">
                  <Cita
                    texto="Bien, buen siervo y fiel; sobre poco has sido fiel, sobre mucho te pondré."
                    fuente="Mateo 25:21"
                  />
                </div>
              </>
            ) : (
              <>
                <Etiqueta>mañana es nuevo</Etiqueta>
                <p className="mt-1 text-[15px] leading-relaxed">
                  Lo reconociste, y eso ya es más de lo que hace la mayoría. No arrastres
                  esto a mañana: déjalo aquí.
                </p>
                <div className="mt-2">
                  <Cita
                    texto="Si confesamos nuestros pecados, él es fiel y justo para que nos perdone nuestros pecados, y nos limpie de toda maldad."
                    fuente="1 Juan 1:9"
                  />
                </div>
              </>
            )}
          </Tarjeta>
        ) : null}

        {/*
          Escribir sobre el día, siempre a la vista.

          Antes esto solo aparecía cuando ya se habían contestado todos los
          puntos, con la idea de no distraer. El efecto real fue otro: Alex
          hizo repasos a medias y **nunca llegó a ver que existía**, y acabó
          pidiendo como nueva una función que llevaba dentro desde la 4.0. Una
          función que no se ve es una función que no está.
        */}
        <div className="mt-4">
          <Etiqueta>cómo fue el día</Etiqueta>
          <AreaTexto
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Cómo me fue hoy con esto..."
          />
          <div className="mt-2">
            <BotonDictar valor={nota} onTexto={setNota} etiqueta="Dictar" />
          </div>
          <p className="mt-1.5 text-xs text-tenue">
            Se guarda en tu diario, junto a si hoy venciste o caíste. No lo ve
            nadie más, salvo que la publiques aquí abajo.
          </p>
          <CasillaPublicar
            valor={publica}
            onCambiar={setPublica}
            hayTexto={nota.trim().length > 0}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Boton
            variante="fuerte"
            ancho
            deshabilitado={!todos}
            onClick={() => onGuardar(respuestas as Record<string, boolean>, nota, publica)}
          >
            {todos
              ? "Cerrar el día"
              : `Faltan ${plan.puntos.length - contestados} por responder`}
          </Boton>
          <Boton variante="fantasma" ancho onClick={onCerrar}>
            Ahora no
          </Boton>
        </div>
      </div>
    </div>
  );
}
