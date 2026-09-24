import { useState } from "react";
import type { BloqueRutina } from "@/datos/tipos";
import { copiarAlReloj } from "@/logica/despertador";
import { Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * Las dos cosas que hay que decirle a alguien ANTES de su primera noche.
 *
 * <p><b>Por qué existe esta pantalla.</b> El 23 de septiembre de 2026 a Alex
 * dejaron de sonarle las alarmas. Tenía todos los permisos concedidos —alarmas
 * exactas, fuera del ahorro de energía, exento del cajón de reposo, inicio
 * automático activado— y aun así no sonó ninguna durante un día entero.
 *
 * <p>La causa no era un permiso: **cerraba la app deslizándola desde la
 * pantalla de recientes**. En Xiaomi, en Huawei y en Oppo eso no cierra la app,
 * la **fuerza a detenerse**, y Android deja de entregarle alarmas a una app
 * forzada a detenerse hasta que alguien la abre a mano. No hay permiso, ni
 * servicio, ni trabajo periódico que sobreviva a eso: cuando el sistema decide
 * que una app está detenida, está detenida.
 *
 * <p>Alex hizo la app y tardó en atar cabos. Un hermano que se quede dormido
 * dos veces no va a reportar nada: desinstala y se acabó. Por eso esto se dice
 * al principio y una sola vez, no cuando ya falló.
 *
 * <p>Y por eso se ofrece aquí mismo la copia al reloj del móvil, en vez de
 * dejarla enterrada en Ajustes: es la única red que no depende de nosotros.
 */
export function AvisoDespertadorSeguro({
  rutina,
  onCerrar,
}: {
  rutina: BloqueRutina[];
  onCerrar: () => void;
}) {
  const [copiando, setCopiando] = useState(false);
  const [aviso, setAviso] = useState("");

  // Sólo las de antes de las 7: son las que fallan, las que nadie puede
  // recuperar después, y las únicas por las que merece la pena aguantar que
  // suenen dos cosas a la vez. Copiar la rutina entera llenaría el reloj.
  const madrugada = rutina.filter((b) => {
    if (!b.activo || b.timbre === "ninguno") return false;
    return Number(b.hora.split(":")[0]) < 7;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-fondo/95 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
        <div className="pb-3">
          <Etiqueta>antes de tu primera noche</Etiqueta>
        </div>

        <h2 className="text-xl font-semibold">Una cosa que puede dejarte sin alarma</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Y no es culpa tuya ni de la app: es cómo funciona Android.
        </p>

        <Tarjeta className="mt-3 border-fallo/40">
          <Etiqueta>no cierres Genuino deslizándola</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Cuando quitas una app de la pantalla de recientes, el móvil no la
            «cierra»: la <strong>fuerza a detenerse</strong>. Y a una app detenida a
            la fuerza, Android <strong>deja de entregarle alarmas</strong> hasta que
            la vuelves a abrir con el dedo.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Le pasó al que hizo esta app: un día entero sin que sonara nada, con
            todos los permisos en verde.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            <strong>Ponle el candado:</strong> abre la pantalla de recientes, mantén
            pulsada la tarjeta de Genuino y toca el candado. Con eso, deslizarla ya
            no la mata.
          </p>
        </Tarjeta>

        {madrugada.length > 0 ? (
          <Tarjeta className="mt-3">
            <Etiqueta>y para las de madrugada, una red aparte</Etiqueta>
            <p className="mt-2 text-sm leading-relaxed">
              El reloj de tu móvil es del sistema, y ninguna capa del fabricante lo
              congela. Podemos copiar ahí tus alarmas de antes de las 7:
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {madrugada.map((b) => (
                <div key={b.id} className="flex items-baseline gap-3 text-sm">
                  <span className="cifras w-12 shrink-0 text-acento">{b.hora}</span>
                  <span className="min-w-0 flex-1 truncate">{b.nombre}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              <strong>Sonarán las dos</strong>, la nuestra y la del reloj. Es feo, y
              es a propósito: más vale un pitido de más que un silencio a las cinco.
            </p>
            <div className="mt-3">
              <Boton
                ancho
                deshabilitado={copiando}
                onClick={async () => {
                  setCopiando(true);
                  setAviso("");
                  const n = await copiarAlReloj(
                    madrugada.map((b) => ({ hora: b.hora, nombre: b.nombre, dias: b.dias })),
                  );
                  setCopiando(false);
                  setAviso(
                    n === 0
                      ? "No se pudo. Puedes ponerlas a mano en la app Reloj."
                      : `Copiadas ${n}. Míralas en la app Reloj de tu móvil.`,
                  );
                }}
              >
                {copiando ? "Copiando…" : "Copiar al reloj del móvil"}
              </Boton>
            </div>
            {aviso ? (
              <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-tenue">
              Puedes hacerlo más tarde desde Ajustes, y borrarlas del reloj cuando
              la nuestra lleve semanas sin fallarte.
            </p>
          </Tarjeta>
        ) : null}

        <div className="mt-4">
          <Boton variante="fuerte" ancho onClick={onCerrar}>
            Entendido
          </Boton>
        </div>
      </div>
    </div>
  );
}
