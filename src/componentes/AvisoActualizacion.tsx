import { useEffect, useState } from "react";
import {
  descartar,
  hayVersionNueva,
  nombreInstalado,
  type VersionPublicada,
} from "@/logica/actualizacion";
import { Boton, Etiqueta } from "./piezas";

/**
 * El aviso de que hay una versión nueva.
 *
 * Sale una vez, arriba del todo, y se puede apartar. Solo insiste cuando la
 * versión viene marcada como importante — para eso está esa marca: para un
 * arreglo que no puede esperar, como una alarma que deja de sonar.
 */
export function AvisoActualizacion() {
  const [version, setVersion] = useState<VersionPublicada | null>(null);

  useEffect(() => {
    void hayVersionNueva().then(setVersion);
  }, []);

  if (!version) return null;

  return (
    <div className="entrar mx-4 mt-3 rounded-2xl border border-acento/40 bg-acento/[0.07] p-4">
      <Etiqueta>hay una versión nueva</Etiqueta>
      <p className="mt-1 text-[15px] font-semibold">
        Genuino {version.nombre}
        <span className="ml-2 text-xs font-normal text-tenue">
          tienes la {nombreInstalado()}
        </span>
      </p>

      {version.novedades.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {version.novedades.slice(0, 4).map((n, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-acento" aria-hidden>
                ·
              </span>
              <span className="min-w-0">{n}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <Boton
            variante="fuerte"
            ancho
            onClick={() => window.open(version.enlace, "_blank", "noopener,noreferrer")}
          >
            Descargar
          </Boton>
        </div>
        {!version.importante ? (
          <Boton
            onClick={() => {
              descartar(version.codigo);
              setVersion(null);
            }}
          >
            Ahora no
          </Boton>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Se instala encima sin perder tus datos. Abre la app después, que es cuando
        vuelve a programar las alarmas.
      </p>
    </div>
  );
}
