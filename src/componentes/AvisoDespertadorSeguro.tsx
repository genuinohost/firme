import { useEffect, useState } from "react";
import type { BloqueRutina } from "@/datos/tipos";
import type { EstadoDespertador } from "@/logica/despertador";
import {
  abrirAjustesDeLaApp,
  copiarAlReloj,
  estadoDespertador,
  pedirAccesoNoMolestar,
  pedirExencionBateria,
  pedirPantallaCompleta,
  pedirPermisoExactas,
} from "@/logica/despertador";
import { Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * Lo que le falta a ESTE móvil para que la alarma suene. Una vez, al empezar.
 *
 * ── La primera versión de esta pantalla estaba mal, y lo dijo un probador ──
 *
 * El 24-09-2026 se publicó explicando **el candado de la multitarea**, porque
 * era lo que le había fallado a Alex: cerraba la app deslizándola y Android
 * dejaba de entregarle alarmas.
 *
 * Dos horas después, Joseito mandó esto desde la propia app:
 *
 * > «Me costó mucho comprender que hay que abrir la multitarea del dispositivo
 * > para luego mantener pulsada la app y luego tocar el candado. ¿Es MUY
 * > NECESARIO todos estos pasos? Sinceramente creo que basta con quitar la
 * > restricción de la batería y permitir el segundo plano.»
 *
 * **Tenía razón.** Su parte lo confirmaba: le fallaba sólo la alarma de las
 * 04:50, tres días seguidos, y todas las de 05:45 en adelante sonaban clavadas
 * al segundo. Eso es el ahorro de batería congelando la app de madrugada — y
 * él tenía «Fuera del ahorro de batería: NO». El candado no era su problema.
 *
 * La pantalla le explicaba siete pasos manuales para algo que no le afectaba,
 * y **no le ofrecía el botón que se lo habría arreglado de un toque**, aunque
 * la app lo tiene desde la 4.2.
 *
 * ── Lo que hace ahora ─────────────────────────────────────────────────────
 *
 * Pregunta al sistema qué falta **en este teléfono concreto** y enseña sólo
 * eso, cada cosa con su botón. El candado baja a segundo plano: es real, pero
 * sólo le importa a quien cierra las apps deslizándolas, y eso no se puede
 * saber desde aquí — así que se dice en una línea y sin siete pasos.
 *
 * El orden no es estético: es por cuántas alarmas mata cada cosa.
 */
export function AvisoDespertadorSeguro({
  rutina,
  onCerrar,
}: {
  rutina: BloqueRutina[];
  /**
   * Se le dice si quedaba algo por conceder al cerrar.
   *
   * Quien cierra esto con el ahorro de batería aún puesto va a quedarse sin la
   * alarma de las cinco, y no puede ser que no vuelva a verlo nunca. Joseito
   * cerró la versión anterior y estuvo tres días sin que le sonara.
   */
  onCerrar: (faltabaAlgo: boolean) => void;
}) {
  const [estado, setEstado] = useState<EstadoDespertador | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    void estadoDespertador().then((e) => vivo && setEstado(e));
    return () => {
      vivo = false;
    };
  }, []);

  // Sólo las de antes de las 7: son las que fallan, las que nadie puede
  // recuperar después, y las únicas por las que merece la pena aguantar que
  // suenen dos cosas a la vez.
  const madrugada = rutina.filter((b) => {
    if (!b.activo || b.timbre === "ninguno") return false;
    return Number(b.hora.split(":")[0]) < 7;
  });

  /**
   * Lo que falta, de mayor a menor daño.
   *
   * El primero es el ahorro de batería a propósito: es el que mata las alarmas
   * de madrugada, que son las que nadie puede recuperar después.
   */
  const faltan: { que: string; porque: string; boton: string; hacer: () => void }[] = [];
  if (estado) {
    if (!estado.exentaDeBateria) {
      faltan.push({
        que: "Sacar Genuino del ahorro de batería",
        porque:
          "Es lo que más alarmas mata. El móvil congela la app de madrugada y el " +
          "sistema se traga sus alarmas: suenan las de la mañana y no la de las cinco.",
        boton: "Sacarla del ahorro de batería",
        hacer: () => void pedirExencionBateria(),
      });
    }
    if (!estado.puedeExactas) {
      faltan.push({
        que: "Permitir alarmas a la hora exacta",
        porque:
          "Sin esto Android puede retrasarlas lo que le parezca, y un despertador " +
          "que suena cuando quiere no es un despertador.",
        boton: "Permitir alarmas exactas",
        hacer: () => void pedirPermisoExactas(),
      });
    }
    if (!estado.puedePantallaCompleta) {
      faltan.push({
        que: "Dejar que encienda la pantalla",
        porque:
          "Sin esto la alarma suena pero no enciende el móvil: queda una " +
          "notificación en la bandeja y hay que darse cuenta.",
        boton: "Permitir pantalla completa",
        hacer: () => void pedirPantallaCompleta(),
      });
    }
    if (!estado.accesoNoMolestar) {
      faltan.push({
        que: "Dar acceso a No molestar",
        porque:
          "Sin esto, si una noche dejas el móvil en No molestar, la alarma se " +
          "queda muda y no hay nada que la salve.",
        boton: "Dar acceso a No molestar",
        hacer: () => void pedirAccesoNoMolestar(),
      });
    }
    if (estado.restringidaEnSegundoPlano) {
      faltan.push({
        que: "Quitar la restricción de segundo plano",
        porque:
          "Está marcada «restringir actividad en segundo plano». Con eso puesta, " +
          "el sistema no despierta a la app para nada.",
        boton: "Abrir los ajustes de la app",
        hacer: () => void abrirAjustesDeLaApp(),
      });
    }
  }

  const volumenBajo =
    estado != null &&
    estado.volumenAlarmaMaximo > 0 &&
    estado.volumenAlarma / estado.volumenAlarmaMaximo < 0.6;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-fondo/95 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
        <div className="pb-3">
          <Etiqueta>para que la alarma suene siempre</Etiqueta>
        </div>

        {estado == null ? (
          <p className="text-sm text-tenue">Mirando qué le falta a tu móvil…</p>
        ) : faltan.length > 0 ? (
          <>
            <h2 className="text-xl font-semibold text-fallo">
              {faltan.length === 1
                ? "Falta un permiso"
                : `Faltan ${faltan.length} permisos`}
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Sin ellos, tu móvil puede tragarse las alarmas sin avisar. Cada uno se
              arregla con un toque.
            </p>
            {faltan.map((f) => (
              <Tarjeta key={f.que} className="mt-3 border-fallo/40">
                <Etiqueta>{f.que}</Etiqueta>
                <p className="mt-2 text-sm leading-relaxed">{f.porque}</p>
                <div className="mt-3">
                  <Boton variante="fuerte" ancho onClick={f.hacer}>
                    {f.boton}
                  </Boton>
                </div>
              </Tarjeta>
            ))}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Tu móvil está bien puesto</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Los permisos que hacen falta están todos concedidos. Quedan dos cosas
              que no son permisos y conviene que sepas.
            </p>
          </>
        )}

        {volumenBajo ? (
          <Tarjeta className="mt-3">
            <Etiqueta>y el volumen</Etiqueta>
            <p className="mt-2 text-sm leading-relaxed">
              El volumen de alarma de tu móvil está en{" "}
              <strong>
                {estado?.volumenAlarma} de {estado?.volumenAlarmaMaximo}
              </strong>
              . A las cinco de la mañana eso puede no despertarte. Súbelo desde los
              botones del lado, con una alarma sonando.
            </p>
          </Tarjeta>
        ) : null}

        {/*
          El candado, en segundo lugar y en pocas palabras.

          Es real —a Alex le costo un dia entero de silencio— pero solo le pasa a
          quien cierra las apps deslizandolas, y eso no hay forma de saberlo desde
          aqui. Ponerlo de titular, con sus siete pasos, fue el error de la
          version anterior de esta pantalla.
        */}
        <Tarjeta className="mt-3">
          <Etiqueta>si cierras las apps deslizándolas</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Quitar una app de la pantalla de recientes no la cierra:{" "}
            <strong>la fuerza a detenerse</strong>, y Android deja de entregarle
            alarmas hasta que la vuelves a abrir.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Si es lo que sueles hacer, déjala fija: en la pantalla de recientes,
            mantén pulsada la tarjeta de Genuino y toca el candado. Si no cierras
            apps así, no tienes que hacer nada.
          </p>
        </Tarjeta>

        {madrugada.length > 0 ? (
          <Tarjeta className="mt-3">
            <Etiqueta>la red que no depende de nosotros</Etiqueta>
            <p className="mt-2 text-sm leading-relaxed">
              El reloj de tu móvil es del sistema y no lo congela ninguna capa del
              fabricante. Podemos copiar ahí tus{" "}
              {madrugada.length === 1 ? "alarma" : `${madrugada.length} alarmas`} de
              antes de las 7, como red por si la nuestra falla.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {madrugada.map((b) => (
                <div key={b.id} className="flex items-baseline gap-3 text-sm">
                  <span className="cifras w-12 shrink-0 text-acento">{b.hora}</span>
                  <span className="min-w-0 flex-1 truncate">{b.nombre}</span>
                </div>
              ))}
            </div>
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
              Sonarán las dos. Es feo, y es a propósito: más vale un pitido de más
              que un silencio a las cinco.
            </p>
          </Tarjeta>
        ) : null}

        <div className="mt-4">
          <Boton variante="fuerte" ancho onClick={() => onCerrar(faltan.length > 0)}>
            {faltan.length > 0 ? "Lo haré ahora" : "Entendido"}
          </Boton>
        </div>
        <p className="mt-2 text-center text-xs text-tenue">
          Todo esto vuelve a estar en Ajustes cuando lo necesites.
        </p>
      </div>
    </div>
  );
}
