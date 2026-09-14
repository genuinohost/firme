import type { AlarmaPerdida } from "@/logica/despertador";
import { pedirExencionBateria } from "@/logica/despertador";
import { Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * Cuando una alarma no sonó.
 *
 * Hasta la 3.4 un fallo de madrugada no dejaba rastro: la app no sabía que no
 * había sonado, así que quien se quedaba dormido no tenía forma de distinguir
 * «falló la app» de «no me enteré». Eso es inaceptable en un despertador del
 * que dependen compromisos con Dios.
 *
 * Ahora cada disparo real queda anotado y se compara con lo que estaba puesto.
 * Si falta alguna, se dice aquí, de frente, y se ofrece el ajuste que en la
 * práctica es la causa casi siempre: el ahorro de batería congelando la app.
 */
export function AvisoAlarmaPerdida({
  perdidas,
  onCerrar,
}: {
  perdidas: AlarmaPerdida[];
  onCerrar: () => void;
}) {
  const hora = (f: Date) =>
    `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;

  const dia = (f: Date) => {
    const hoy = new Date();
    const mismoDia =
      f.getDate() === hoy.getDate() &&
      f.getMonth() === hoy.getMonth() &&
      f.getFullYear() === hoy.getFullYear();
    if (mismoDia) return "hoy";
    const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    return nombres[f.getDay()];
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-fondo/95 backdrop-blur-sm">
      <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
        <div className="flex items-center justify-between pb-3">
          <Etiqueta>hay que decirlo</Etiqueta>
          <button
            onClick={onCerrar}
            className="px-2 py-1 text-tenue transition hover:text-texto"
          >
            ✕
          </button>
        </div>

        <h2 className="text-xl font-semibold text-fallo">
          {perdidas.length === 1 ? "Una alarma no sonó" : `${perdidas.length} alarmas no sonaron`}
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          El sistema no llegó a dispararlas. No fue un despiste tuyo, y no vamos a
          pasarlo por alto.
        </p>

        <Tarjeta className="mt-3 border-fallo/40">
          <div className="flex flex-col gap-1.5">
            {perdidas.slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-baseline gap-3 text-sm">
                <span className="cifras w-12 shrink-0 text-fallo">{hora(p.cuando)}</span>
                <span className="min-w-0 flex-1">{p.titulo}</span>
                <span className="shrink-0 text-xs text-tenue">{dia(p.cuando)}</span>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta className="mt-3">
          <Etiqueta>lo que casi siempre lo causa</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            El ahorro de batería congela la app y el sistema se traga sus alarmas.
            Sacar a Firme de esa lista lo arregla, y no gasta batería de forma
            apreciable: el despertador no hace nada hasta que llega la hora.
          </p>
          <div className="mt-3">
            <Boton variante="fuerte" ancho onClick={() => void pedirExencionBateria()}>
              Sacar Firme del ahorro de batería
            </Boton>
          </div>
        </Tarjeta>

        <div className="mt-4">
          <Boton ancho onClick={onCerrar}>
            Entendido
          </Boton>
        </div>
      </div>
    </div>
  );
}
