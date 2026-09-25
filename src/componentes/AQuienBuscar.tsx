import { useEffect, useState } from "react";
import type { Sugerencia } from "@/logica/aQuienBuscar";
import { aQuienBuscar, anotarQueSeBusco } from "@/logica/aQuienBuscar";
import { abrirEnlace } from "@/logica/enlaces";
import type { Amigo } from "@/logica/nube";
import { enlaceLlamada, enlaceWhatsapp, leerWhatsapp } from "@/logica/nube";
import { Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * Un nombre y un botón para llamarle.
 *
 * El criterio de a quién está en `@/logica/aQuienBuscar`, con el por qué de cada
 * señal. Aquí sólo se decide cómo se ve, y hay tres reglas:
 *
 * **Se baja por la lista hasta encontrar a quien se pueda llamar.** Un hermano
 * que no publicó su WhatsApp deja el nombre en pantalla y ningún botón: eso es
 * peor que no decir nada. Se prueba con los primeros y se enseña al primero que
 * tenga número.
 *
 * **Se retira al usarla.** En cuanto se llama o se escribe, la tarjeta
 * desaparece hasta mañana. Dejarla puesta con el botón ya pulsado es pedir lo
 * mismo dos veces.
 *
 * **«Hoy no» también cuenta.** Apartar a alguien anota que se le buscó. Si no,
 * vuelve mañana igual y la tarjeta se convierte en algo que se aprende a
 * ignorar — y entonces ya no sirve el día que de verdad haga falta.
 */

/**
 * Cuántos candidatos se miran antes de rendirse.
 *
 * Cada uno cuesta una lectura del número. Cinco cubre de sobra el caso real
 * —que uno o dos de los primeros no lo hayan publicado— sin convertir una
 * tarjeta en treinta lecturas.
 */
const CUANTOS_PROBAR = 5;

export function AQuienBuscar({
  amigos,
  onVerFicha,
}: {
  amigos: Amigo[];
  /** Para abrir su ficha desde el nombre. */
  onVerFicha: (uid: string) => void;
}) {
  const [elegido, setElegido] = useState<{
    quien: Sugerencia;
    whatsapp: string | null;
  } | null>(null);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    let vivo = true;
    setHecho(false);
    void (async () => {
      const lista = await aQuienBuscar(amigos).catch(() => []);
      if (!vivo || lista.length === 0) return;

      for (const quien of lista.slice(0, CUANTOS_PROBAR)) {
        const w = await leerWhatsapp(quien.uid).catch(() => null);
        if (!vivo) return;
        if (w && enlaceLlamada(w)) {
          setElegido({ quien, whatsapp: w });
          return;
        }
      }
      // Ninguno de los primeros tiene número. Se enseña al primero de todos con
      // su motivo y sin botones: saber a quién le hace falta una llamada vale
      // aunque el número haya que buscarlo por otro lado.
      if (vivo) setElegido({ quien: lista[0], whatsapp: null });
    })();
    return () => {
      vivo = false;
    };
    // Se recalcula cuando cambia la lista de hermanos, no en cada pintado.
  }, [amigos]);

  if (!elegido || hecho) return null;

  const { quien, whatsapp } = elegido;
  const llamada = whatsapp ? enlaceLlamada(whatsapp) : null;
  const escribir = whatsapp ? enlaceWhatsapp(whatsapp) : null;
  const primero = quien.nombre.split(" ")[0] || quien.nombre;

  const usar = async (url: string) => {
    anotarQueSeBusco(quien.uid);
    await abrirEnlace(url);
    setHecho(true);
  };

  return (
    <Tarjeta className="border-acento/40">
      <Etiqueta>a quién buscar hoy</Etiqueta>

      <button
        onClick={() => onVerFicha(quien.uid)}
        className="mt-2 block text-left"
      >
        <p className="text-lg leading-tight font-semibold">{quien.nombre}</p>
        <p className="cifras text-sm text-acento">@{quien.usuario}</p>
      </button>

      <p className="mt-2 text-sm leading-relaxed">{quien.motivo}</p>
      <p className="mt-1 text-sm leading-relaxed text-tenue">{quien.empuje}</p>

      {llamada ? (
        <div className="mt-3 flex flex-col gap-2">
          <Boton variante="fuerte" ancho onClick={() => void usar(llamada)}>
            Llamar a {primero}
          </Boton>
          {escribir ? (
            <Boton ancho onClick={() => void usar(escribir)}>
              Escribirle por WhatsApp
            </Boton>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-tenue">
          No ha publicado su WhatsApp, así que desde aquí no se le puede llamar.
          Toca su nombre para ver su ficha.
        </p>
      )}

      <button
        onClick={() => {
          anotarQueSeBusco(quien.uid);
          setHecho(true);
        }}
        className="mt-3 text-xs text-tenue transition hover:text-texto"
      >
        Hoy no
      </button>
    </Tarjeta>
  );
}
