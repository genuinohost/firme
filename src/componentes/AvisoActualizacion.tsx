import { useEffect, useState } from "react";
import { abrirEnlace } from "@/logica/enlaces";
import { copiar } from "@/logica/compartir";
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
  /**
   * En qué punto va la descarga, desde fuera de la app.
   *
   * La app **no instala sola** a propósito: hacerlo exige
   * `REQUEST_INSTALL_PACKAGES`, que Google Play rechaza salvo en gestores de
   * archivos y navegadores. Así que descarga el navegador, y el instalador
   * queda esperando en la bandeja de notificaciones — donde nadie lo busca si
   * no se lo dicen. Alex ya se quedó una vez con un «no veo el instalador».
   */
  const [paso, setPaso] = useState<"quieto" | "abierto" | "fallo">("quieto");

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
            onClick={async () => setPaso((await abrirEnlace(version.enlace)) ? "abierto" : "fallo")}
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

      {paso === "abierto" ? (
        <div className="mt-3 rounded-xl border border-acento/40 bg-acento/5 p-3">
          <p className="text-sm leading-relaxed">
            Se está descargando en tu navegador. Cuando termine,{" "}
            <strong>baja la barra de notificaciones y toca el archivo</strong> —
            o búscalo en <strong>Descargas</strong>, se llama{" "}
            <span className="cifras">Genuino-{version.nombre}.apk</span>.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            La primera vez, Android te pedirá permiso para instalar desde el
            navegador. Es normal: dáselo y vuelve a tocar el archivo.
          </p>
        </div>
      ) : null}

      {paso === "fallo" ? (
        <div className="mt-3 rounded-xl border border-fallo/40 bg-fallo/10 p-3">
          <p className="text-sm leading-relaxed">
            No se pudo abrir el navegador. Copia esta dirección y ábrela a mano:
          </p>
          <p className="mt-2 break-all text-xs text-tenue">{version.enlace}</p>
          <div className="mt-2">
            <Boton ancho onClick={() => void copiar(version.enlace)}>
              Copiar el enlace
            </Boton>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-tenue">
        Se instala encima sin perder tus datos. Abre la app después, que es cuando
        vuelve a programar las alarmas.
      </p>
    </div>
  );
}
