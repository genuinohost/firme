import { useEffect, useState } from "react";
import type { Ajustes, Motivo } from "@/datos/tipos";
import type { Disparo } from "@/logica/alarmas";
import { elegirFrase } from "@/logica/elegirFrase";
import { audioBloqueado, reanudar } from "@/logica/sonido";
import { Boton, Cita, Etiqueta, colorDe } from "./piezas";

/**
 * La alarma ocupa toda la pantalla a propósito: no se puede ignorar de reojo,
 * hay que decidir. Muestra el porqué del bloque y el motivo ancla, que es la
 * información que hace falta justo en ese momento.
 */
export function PantallaAlarma({
  disparo,
  ajustes,
  motivos,
  fecha,
  onCumplir,
  onPosponer,
  onSaltar,
  onCerrar,
}: {
  disparo: Disparo;
  ajustes: Ajustes;
  motivos: Motivo[];
  fecha: string;
  onCumplir: () => void;
  onPosponer: (minutos: number) => void;
  onSaltar: () => void;
  onCerrar: () => void;
}) {
  const { suceso, tipo } = disparo;
  const ancla = motivos.find((m) => m.ancla) ?? motivos[0];
  const frase = elegirFrase("empuje", ajustes, `${fecha}|${suceso.id}|alarma`, suceso.categoria);

  // Un contador desde que sonó: ver los segundos correr empuja a decidir.
  const [segundos, setSegundos] = useState(0);
  const [mudo, setMudo] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      setSegundos((s) => s + 1);
      setMudo(audioBloqueado());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const reloj = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-fondo"
      // Si el navegador aún no dejaba sonar, el primer toque arranca el timbre.
      onPointerDown={() => reanudar()}
    >
      <div
        className="h-1.5 w-full shrink-0"
        style={{ background: colorDe(suceso.categoria) }}
      />
      <div className="zona-segura-arriba zona-segura-abajo flex flex-1 flex-col justify-between gap-6 px-5 py-8">
        <div className="entrar">
          <Etiqueta>
            {disparo.esPrueba
              ? "prueba"
              : tipo === "previo"
                ? `faltan ${suceso.avisoPrevioMin} minutos`
                : "es la hora"}
          </Etiqueta>
          <h1 className="latido mt-2 text-4xl leading-[1.1] font-bold">{suceso.nombre}</h1>
          <p className="cifras mt-2 text-sm text-tenue">
            {suceso.hora} · {suceso.duracionMin} min · sonando {reloj}
          </p>
          {mudo ? (
            <p className="mt-2 text-sm text-acento">
              Toca la pantalla para que suene el timbre.
            </p>
          ) : null}

          {suceso.porque ? (
            <div className="mt-6">
              <Etiqueta>por qué lo pusiste</Etiqueta>
              <p className="mt-1.5 border-l-2 border-acento pl-3 text-lg leading-snug">
                {suceso.porque}
              </p>
            </div>
          ) : null}

          {ancla?.texto ? (
            <div className="mt-5 rounded-2xl border border-acento/25 bg-acento/[0.06] p-4">
              <Etiqueta>y por qué haces todo esto</Etiqueta>
              <p className="mt-1.5 leading-relaxed">{ancla.texto}</p>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl bg-superficie p-4">
            <Cita texto={frase.texto} fuente={frase.fuente} grande />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {disparo.esPrueba ? (
            <Boton variante="fuerte" ancho onClick={onCerrar}>
              Funciona. Cerrar
            </Boton>
          ) : tipo === "previo" ? (
            <>
              <Boton variante="fuerte" ancho onClick={onCerrar}>
                Entendido, me preparo
              </Boton>
              <Boton variante="normal" ancho onClick={() => onPosponer(ajustes.posponerMin)}>
                Recuérdamelo en {ajustes.posponerMin} min
              </Boton>
            </>
          ) : (
            <>
              <Boton variante="logro" ancho onClick={onCumplir}>
                Empiezo ahora
              </Boton>
              <Boton variante="normal" ancho onClick={() => onPosponer(ajustes.posponerMin)}>
                {ajustes.posponerMin} minutos más
              </Boton>
              <Boton variante="fallo" ancho onClick={onSaltar}>
                Hoy no puedo
              </Boton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
