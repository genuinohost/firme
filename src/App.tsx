import { useCallback, useEffect, useMemo, useState } from "react";
import { cargar, guardar } from "@/datos/almacen";
import type { Ajustes, BloqueRutina, Datos, Motivo, Suceso, Tarea } from "@/datos/tipos";
import { claveFecha, sucesosDelDia } from "@/logica/dia";
import { useAlarmas, useReloj } from "@/logica/alarmas";
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

  const sucesos = useMemo(() => sucesosDelDia(datos, fecha), [datos, fecha]);
  const sucesosHoy = useMemo(
    () => (esHoy ? sucesos : sucesosDelDia(datos, fechaHoy)),
    [datos, fechaHoy, esHoy, sucesos],
  );
  const racha = useMemo(() => rachaActual(datos, ahora), [datos, ahora]);

  const { disparo, cerrar, posponer } = useAlarmas(
    sucesosHoy,
    datos.ajustes,
    ahora,
    !nuevaTarea,
  );

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

        {pestaña === "progreso" ? <PantallaProgreso datos={datos} hoy={ahora} /> : null}

        {pestaña === "ajustes" ? (
          <PantallaAjustes
            datos={datos}
            onCambiarAjustes={cambiarAjustes}
            onReemplazar={(nuevos) => setDatos(nuevos)}
          />
        ) : null}
      </main>

      {/* Aviso flotante con la frase de ánimo tras marcar un bloque. */}
      {brindis ? (
        <div className="entrar pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-acento/30 bg-superficie-alta/95 px-4 py-3 shadow-lg backdrop-blur">
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
