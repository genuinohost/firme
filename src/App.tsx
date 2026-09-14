import { useCallback, useEffect, useMemo, useState } from "react";
import { cargar, guardar } from "@/datos/almacen";
import type { Ajustes, BloqueRutina, Datos, Motivo, Suceso, Tarea } from "@/datos/tipos";
import { aHora, claveFecha, desdeClave, minutoActual, sucesosDelDia } from "@/logica/dia";
import { proximoAviso, useAlarmas, useReloj } from "@/logica/alarmas";
import { esNativo, pedirPermisosNativos, reprogramar } from "@/logica/alarmasNativas";
import { proximaAlarma } from "@/logica/avisos";
import { rachaActual } from "@/logica/racha";
import { despertar, tintineo } from "@/logica/sonido";
import { elegirFrase } from "@/logica/elegirFrase";
import { PantallaHoy } from "@/componentes/PantallaHoy";
import { PantallaPorque } from "@/componentes/PantallaPorque";
import { PantallaRutina } from "@/componentes/PantallaRutina";
import { PantallaProgreso } from "@/componentes/PantallaProgreso";
import { PantallaAjustes } from "@/componentes/PantallaAjustes";
import { PantallaAlarma } from "@/componentes/PantallaAlarma";
import { DialogoTarea } from "@/componentes/DialogoTarea";
import { Cita } from "@/componentes/piezas";

type Pestaña = "hoy" | "porque" | "rutina" | "progreso" | "ajustes";

const PESTAÑAS: { id: Pestaña; nombre: string; icono: string }[] = [
  { id: "hoy", nombre: "Hoy", icono: "◎" },
  { id: "porque", nombre: "Porqué", icono: "✦" },
  { id: "rutina", nombre: "Rutina", icono: "≡" },
  { id: "progreso", nombre: "Progreso", icono: "▟" },
  { id: "ajustes", nombre: "Ajustes", icono: "⚙" },
];

export default function App() {
  const [datos, setDatos] = useState<Datos>(cargar);
  const [pestaña, setPestaña] = useState<Pestaña>("hoy");
  const [desplazamiento, setDesplazamiento] = useState(0); // días respecto a hoy
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [brindis, setBrindis] = useState<{ texto: string; fuente?: string } | null>(null);

  const ahora = useReloj();

  useEffect(() => guardar(datos), [datos]);

  /**
   * En la app de Android las horas se le entregan al sistema, que es quien
   * despierta aunque la pantalla esté apagada. Se rehace la cola entera cada
   * vez que cambian los datos y cada vez que la app vuelve a primer plano.
   */
  useEffect(() => {
    if (!esNativo()) return;
    void pedirPermisosNativos().then(() => reprogramar(datos));
    const alVolver = () => {
      if (document.visibilityState === "visible") void reprogramar(datos);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [datos]);

  // El audio solo arranca tras un gesto del usuario; el primer toque lo habilita.
  useEffect(() => {
    const habilitar = () => despertar();
    window.addEventListener("pointerdown", habilitar, { once: true });
    window.addEventListener("keydown", habilitar, { once: true });
    return () => {
      window.removeEventListener("pointerdown", habilitar);
      window.removeEventListener("keydown", habilitar);
    };
  }, []);

  const fechaObjeto = useMemo(() => {
    const f = new Date(ahora);
    f.setDate(f.getDate() + desplazamiento);
    return f;
  }, [ahora, desplazamiento]);

  const fecha = claveFecha(fechaObjeto);
  const fechaHoy = claveFecha(ahora);
  const esHoy = fecha === fechaHoy;

  /**
   * El día de hoy como fecha estable: solo cambia al pasar de medianoche.
   *
   * `ahora` avanza cada segundo, y atarle la racha o el historial los rehacía
   * sesenta veces por minuto — cientos de recorridos del calendario que en el
   * móvil se notan en la batería.
   */
  const diaEstable = useMemo(() => desdeClave(fechaHoy), [fechaHoy]);

  const sucesos = useMemo(() => sucesosDelDia(datos, fecha), [datos, fecha]);
  const sucesosHoy = useMemo(
    () => (esHoy ? sucesos : sucesosDelDia(datos, fechaHoy)),
    [datos, fechaHoy, esHoy, sucesos],
  );
  const racha = useMemo(() => rachaActual(datos, diaEstable), [datos, diaEstable]);

  // Se recalcula al cambiar de minuto, no a cada segundo: el contador usa esta
  // fecha fija y le resta el reloj.
  const alarma = useMemo(
    () => proximaAlarma(datos, ahora),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, fechaHoy, minutoActual(ahora)],
  );

  const { disparo, cerrar, posponer, probar } = useAlarmas(
    sucesosHoy,
    datos.ajustes,
    ahora,
    !nuevaTarea,
  );

  // El siguiente aviso, ya redactado para la pantalla de comprobación.
  const proximo = useMemo(() => {
    const siguiente = proximoAviso(sucesosHoy, minutoActual(ahora));
    if (!siguiente) return null;
    const faltanMin = siguiente.minuto - minutoActual(ahora);
    const h = Math.floor(faltanMin / 60);
    const m = faltanMin % 60;
    return {
      nombre: siguiente.suceso.nombre,
      hora: aHora(siguiente.minuto),
      falta:
        faltanMin === 0
          ? "ahora mismo"
          : h > 0
            ? `dentro de ${h} h ${m} min`
            : `dentro de ${m} min`,
    };
  }, [sucesosHoy, ahora]);

  const registrar = useCallback(
    (suceso: Suceso, estado: "cumplido" | "saltado", excusa?: string, enFecha?: string) => {
      const clave = `${enFecha ?? fecha}|${suceso.id}`;
      setDatos((d) => ({
        ...d,
        registros: {
          ...d.registros,
          [clave]: { estado, momento: Date.now(), ...(excusa ? { excusa } : {}) },
        },
      }));
      const frase = elegirFrase(
        estado === "cumplido" ? "victoria" : "caida",
        datos.ajustes,
        `${clave}|${estado}`,
        suceso.categoria,
      );
      setBrindis({ texto: frase.texto, fuente: frase.fuente });
      if (estado === "cumplido") tintineo(datos.ajustes.volumen);
    },
    [fecha, datos.ajustes],
  );

  // El aviso de ánimo se retira solo.
  useEffect(() => {
    if (!brindis) return;
    const id = window.setTimeout(() => setBrindis(null), 5200);
    return () => clearTimeout(id);
  }, [brindis]);

  const cambiarAjustes = (ajustes: Ajustes) => setDatos((d) => ({ ...d, ajustes }));
  const cambiarRutina = (rutina: BloqueRutina[]) => setDatos((d) => ({ ...d, rutina }));
  const cambiarMotivos = (motivos: Motivo[]) => setDatos((d) => ({ ...d, motivos }));

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="zona-segura-arriba flex-1 pb-24">
        {pestaña === "hoy" ? (
          <PantallaHoy
            fecha={fecha}
            fechaObjeto={fechaObjeto}
            esHoy={esHoy}
            ahora={ahora}
            sucesos={sucesos}
            ajustes={datos.ajustes}
            motivos={datos.motivos}
            racha={racha}
            alarma={alarma}
            onCumplir={(s) => registrar(s, "cumplido")}
            onSaltar={(s, excusa) => registrar(s, "saltado", excusa)}
            onDeshacer={(s) =>
              setDatos((d) => {
                const registros = { ...d.registros };
                delete registros[`${fecha}|${s.id}`];
                return { ...d, registros };
              })
            }
            onCambiarDia={(n) => setDesplazamiento((v) => v + n)}
            onNuevaTarea={() => setNuevaTarea(true)}
            onVerPorque={() => setPestaña("porque")}
          />
        ) : null}

        {pestaña === "porque" ? (
          <PantallaPorque motivos={datos.motivos} onCambiar={cambiarMotivos} />
        ) : null}

        {pestaña === "rutina" ? (
          <PantallaRutina
            rutina={datos.rutina}
            volumen={datos.ajustes.volumen}
            onCambiar={cambiarRutina}
          />
        ) : null}

        {pestaña === "progreso" ? <PantallaProgreso datos={datos} hoy={diaEstable} /> : null}

        {pestaña === "ajustes" ? (
          <PantallaAjustes
            datos={datos}
            onCambiarAjustes={cambiarAjustes}
            onReemplazar={(nuevos) => setDatos(nuevos)}
            proximo={proximo}
            onProbar={probar}
          />
        ) : null}
      </main>

      {/* Aviso flotante con la frase de ánimo tras marcar un bloque. */}
      {brindis ? (
        <div className="entrar pointer-events-none fixed inset-x-0 bottom-[76px] z-30 flex justify-center px-4">
          {/* Fondo opaco a propósito: translúcido sobre la lista no se leía. */}
          <div className="pointer-events-auto max-w-md rounded-2xl border border-acento/40 bg-superficie-alta px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <Cita texto={brindis.texto} fuente={brindis.fuente} />
          </div>
        </div>
      ) : null}

      <nav className="zona-segura-abajo fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-borde bg-fondo/95 backdrop-blur">
        <div className="flex">
          {PESTAÑAS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPestaña(p.id);
                if (p.id === "hoy") setDesplazamiento(0);
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                pestaña === p.id ? "text-acento" : "text-tenue"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {p.icono}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
      </nav>

      {nuevaTarea ? (
        <DialogoTarea
          fecha={fecha}
          onGuardar={(tarea: Tarea) => {
            setDatos((d) => ({ ...d, tareas: [...d.tareas, tarea] }));
            setNuevaTarea(false);
          }}
          onCerrar={() => setNuevaTarea(false)}
        />
      ) : null}

      {disparo ? (
        <PantallaAlarma
          disparo={disparo}
          ajustes={datos.ajustes}
          motivos={datos.motivos}
          fecha={fechaHoy}
          onCumplir={() => {
            registrar(disparo.suceso, "cumplido", undefined, fechaHoy);
            cerrar();
          }}
          onSaltar={() => {
            registrar(disparo.suceso, "saltado", "Saltado desde la alarma", fechaHoy);
            cerrar();
          }}
          onPosponer={posponer}
          onCerrar={cerrar}
        />
      ) : null}
    </div>
  );
}
