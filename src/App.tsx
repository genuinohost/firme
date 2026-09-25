import { useCallback, useEffect, useMemo, useState } from "react";
import { cargar, guardar, idNuevo } from "@/datos/almacen";
import type { Ajustes, BloqueRutina, Datos, Motivo, Suceso, Tarea } from "@/datos/tipos";
import { aHora, claveFecha, desdeClave, minutoActual, sucesosDelDia } from "@/logica/dia";
import { proximoAviso, useAlarmas, useReloj } from "@/logica/alarmas";
import { esNativo, limpiarAvisosViejos, pedirPermisosNativos } from "@/logica/alarmasNativas";
import { apuntarQueSeSalio, darPorAbierta, tocaPedirlo } from "@/logica/cerradura";
import { CUENTAS_ABIERTAS } from "@/logica/nube";
import type { AlarmaPerdida } from "@/logica/despertador";
import {
  alarmasPerdidas,
  pararDespertador,
  programarDespertador,
} from "@/logica/despertador";
import { proximaAlarma } from "@/logica/avisos";
import { primerDiaRegistrado, rachaActual, totalCumplidos } from "@/logica/racha";
import { despertar, tintineo } from "@/logica/sonido";
import { elegirFrase } from "@/logica/elegirFrase";
import { PantallaHoy } from "@/componentes/PantallaHoy";
import { PantallaPorque } from "@/componentes/PantallaPorque";
import { PantallaRutina } from "@/componentes/PantallaRutina";
import { PantallaPlanes } from "@/componentes/PantallaPlanes";
import { ExamenDelPlan } from "@/componentes/ExamenDelPlan";
import { ExamenDeSantidad } from "@/componentes/ExamenDeSantidad";
import { DetallePlan } from "@/componentes/DetallePlan";
import { AvisoAlarmaPerdida } from "@/componentes/AvisoAlarmaPerdida";
import { AvisoDespertadorSeguro } from "@/componentes/AvisoDespertadorSeguro";
import { claveRegistro, diasRestaurados, estadoDelDia, registroDe } from "@/logica/planes";
import type { Plan, RegistroPlan } from "@/datos/planes/tipos";
import { PantallaProgreso } from "@/componentes/PantallaProgreso";
import { PantallaDiario } from "@/componentes/PantallaDiario";
import { PantallaMensaje } from "@/componentes/PantallaMensaje";
import { PantallaComunidad } from "@/componentes/PantallaComunidad";
import { AvisoActualizacion } from "@/componentes/AvisoActualizacion";
import { PantallaMas, ConVuelta } from "@/componentes/PantallaMas";
import { PantallaAjustes } from "@/componentes/PantallaAjustes";
import { PantallaAlarma } from "@/componentes/PantallaAlarma";
import { PantallaBloqueo } from "@/componentes/PantallaBloqueo";
import { PantallaCuenta } from "@/componentes/PantallaCuenta";
import { PantallaFallo } from "@/componentes/PantallaFallo";
import { contarSolicitudes, publicarNota } from "@/logica/muro";
import { DialogoTarea } from "@/componentes/DialogoTarea";
import { Cita } from "@/componentes/piezas";

type Pestaña =
  | "hoy"
  | "mensaje"
  | "comunidad"
  | "planes"
  | "rutina"
  | "mas"
  | "porque"
  | "progreso"
  | "diario"
  | "cuenta"
  | "fallo"
  | "ajustes";

/**
 * Las que se usan a diario van en la barra; el resto, dentro de «Más».
 *
 * El diario subió a la barra el 16-09. Alex sobre él: «quedó EXCELENTE, me
 * gusta mucho… un poco escondido». Estaba a dos toques dentro de «Más», y una
 * cosa que se escribe todos los días no puede vivir en el cajón de lo que se
 * abre de vez en cuando.
 */
const EN_LA_BARRA: Pestaña[] = ["hoy", "planes", "diario", "mensaje", "comunidad", "mas"];

const PESTAÑAS: { id: Pestaña; nombre: string; icono: string }[] = [
  { id: "hoy", nombre: "Hoy", icono: "◎" },
  { id: "planes", nombre: "Planes", icono: "≡" },
  { id: "diario", nombre: "Diario", icono: "✎" },
  { id: "mensaje", nombre: "Mensaje", icono: "✉" },
  { id: "comunidad", nombre: "Juntos", icono: "◈" },
  { id: "mas", nombre: "Más", icono: "⋯" },
];

export default function App() {
  const [datos, setDatos] = useState<Datos>(cargar);
  const [pestaña, setPestaña] = useState<Pestaña>("hoy");
  const [avisoMuro, setAvisoMuro] = useState("");
  /** Hermanos esperando que les contestes. Se pinta en «Más». */
  const [solicitudes, setSolicitudes] = useState(0);
  const [desplazamiento, setDesplazamiento] = useState(0); // días respecto a hoy
  /** null = cerrado · "nueva" = creando · un id = editando esa tarea. */
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null);
  /** Id del plan cuyo repaso está abierto. */
  const [examen, setExamen] = useState<string | null>(null);
  /** Id del plan cuya ficha está abierta. */
  const [planAbierto, setPlanAbierto] = useState<string | null>(null);
  const [bloqueAbierto, setBloqueAbierto] = useState<string | null>(null);

  /**
   * La cerradura.
   *
   * Se decide **una sola vez al montar**, no en cada repintado: si dependiera
   * del reloj, la app se bloquearía sola mientras Alex escribe.
   */
  const [bloqueada, setBloqueada] = useState(() => tocaPedirlo());
  const [brindis, setBrindis] = useState<{ texto: string; fuente?: string } | null>(null);
  /** Alarmas que tenían que haber sonado y no sonaron. Se dicen en voz alta. */
  const [perdidas, setPerdidas] = useState<AlarmaPerdida[]>([]);
  /**
   * El aviso de «no la cierres deslizándola», una sola vez y al principio.
   *
   * Se guarda en el propio móvil y no en los datos: es una advertencia de este
   * teléfono, no algo del usuario. Si se cambia de móvil, vuelve a salir, y
   * está bien que salga: el candado hay que ponerlo en cada uno.
   */
  const [vioElAviso, setVioElAviso] = useState(() => {
    const guardado = localStorage.getItem("genuino.avisoDespertador");
    if (guardado === "visto") return true;
    // Si lo cerró con algo sin conceder, se guardó la fecha en vez de «visto»
    // y vuelve a salir al día siguiente. No se insiste más de una vez al día:
    // una pantalla que sale en cada arranque se cierra sin leerla.
    const cuando = Number(guardado);
    return Number.isFinite(cuando) && cuando > 0 && Date.now() - cuando < 86_400_000;
  });

  const ahora = useReloj();

  useEffect(() => guardar(datos), [datos]);

  /**
   * En la app de Android las horas se le entregan al sistema, que es quien
   * despierta aunque la pantalla esté apagada. Se rehace la cola entera cada
   * vez que cambian los datos y cada vez que la app vuelve a primer plano.
   */
  useEffect(() => {
    if (!esNativo()) return;

    // Se pregunta por las perdidas ANTES de reprogramar, porque programar borra
    // la cola con la que se comparan. Una alarma que no sonó tiene que verse.
    const rehacer = async () => {
      const faltaron = await alarmasPerdidas();
      if (faltaron.length > 0) setPerdidas(faltaron);
      await programarDespertador(datos);
    };

    // El permiso es el mismo para todo; el despertador es quien programa.
    // Antes se tiran los avisos que dejó la época 3.x: seguían saltando a su
    // hora, mudos bajo No molestar, y lo que quedaba por la mañana era una
    // notificación sin ruido — indistinguible de una alarma que falló.
    void pedirPermisosNativos()
      .then(() => limpiarAvisosViejos())
      .then(rehacer);
    const alVolver = () => {
      if (document.visibilityState === "visible") void rehacer();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [datos]);

  /**
   * Volver a echar la llave tras un rato fuera.
   *
   * Sólo si estuvo fuera más del margen. Pedirlo cada vez que se mira un
   * mensaje y se vuelve acabaría con que Alex lo quita — y entonces no protege
   * nada, que es peor que no tenerlo.
   */
  useEffect(() => {
    const alCambiar = () => {
      if (document.visibilityState === "hidden") {
        apuntarQueSeSalio();
      } else if (tocaPedirlo()) {
        setBloqueada(true);
      }
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

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

  /**
   * Las cifras que se enseñan en el perfil. **Salen de este teléfono y no
   * viajan**: se ven en la ficha de uno y no las ve ningún amigo.
   */
  const cumplidos = useMemo(() => totalCumplidos(datos), [datos]);
  const diasEnPie = useMemo(() => {
    const desde = primerDiaRegistrado(datos);
    if (!desde) return 0;
    const [a, m, d] = desde.split("-").map(Number);
    const inicio = new Date(a, m - 1, d).getTime();
    return Math.max(1, Math.round((diaEstable.getTime() - inicio) / 86_400_000) + 1);
  }, [datos, diaEstable]);

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
    tareaAbierta === null,
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

  // Lo que pasó al intentar publicar una nota. Se retira solo, como el brindis.
  useEffect(() => {
    if (!avisoMuro) return;
    const id = window.setTimeout(() => setAvisoMuro(""), 5200);
    return () => clearTimeout(id);
  }, [avisoMuro]);

  // Quién está esperando respuesta. Se mira al arrancar y cada vez que se
  // vuelve al menú, que es justo antes de que pueda verse el aviso.
  useEffect(() => {
    if (pestaña !== "mas" && pestaña !== "hoy") return;
    let vivo = true;
    void contarSolicitudes().then((n) => vivo && setSolicitudes(n));
    return () => {
      vivo = false;
    };
  }, [pestaña]);

  // El aviso de ánimo se retira solo.
  useEffect(() => {
    if (!brindis) return;
    const id = window.setTimeout(() => setBrindis(null), 5200);
    return () => clearTimeout(id);
  }, [brindis]);

  const seleccionada: Pestaña = EN_LA_BARRA.includes(pestaña) ? pestaña : "mas";

  /**
   * Mandar al muro una nota recién escrita, desde el repaso o desde el plan.
   *
   * **Se marca como pública sólo si el servidor la aceptó.** La casilla del
   * repaso dice una intención, no un hecho: la conexión puede fallar, la
   * cuenta puede no existir todavía. Si se marcara al vuelo, alguien cerraría
   * la app convencido de haber dado testimonio de algo que no salió del
   * teléfono — y el fallo sería mudo, que es justo la clase de fallo que este
   * proyecto ya ha pagado demasiadas veces.
   *
   * Si no sale, la nota se queda igual en el diario y desde allí se puede
   * publicar con un toque.
   */
  const soltarAlMuro = (nota: { id: string; texto: string; momento: number }) => {
    void publicarNota(nota)
      .then(() => {
        setDatos((d) => ({
          ...d,
          notas: (d.notas ?? []).map((x) => (x.id === nota.id ? { ...x, publica: true } : x)),
        }));
        setAvisoMuro("Publicada. Cualquiera puede leerla.");
      })
      .catch((e) => {
        const motivo = e instanceof Error ? e.message : "";
        setAvisoMuro(
          motivo === "sin-cuenta"
            ? "Sin cuenta no se puede publicar. Está guardada en tu diario."
            : motivo === "sin-perfil"
              ? "Te falta el perfil. La nota está guardada en tu diario."
              : "No se pudo publicar. Está guardada en tu diario.",
        );
      });
  };

  const cambiarAjustes = (ajustes: Ajustes) => setDatos((d) => ({ ...d, ajustes }));
  const cambiarRutina = (rutina: BloqueRutina[]) => setDatos((d) => ({ ...d, rutina }));
  const cambiarMotivos = (motivos: Motivo[]) => setDatos((d) => ({ ...d, motivos }));

  /**
   * La cerradura tapa la app entera —ni la racha, ni el nombre del plan, ni la
   * primera línea del diario— **salvo cuando está sonando una alarma**.
   *
   * Eso no es una grieta, es lo contrario: a las tres de la madrugada, con la
   * alarma repicando, obligar a teclear cuatro números antes de poder decir
   * «cumplido» es lo que hace que alguien acabe quitando el código. Y en esa
   * pantalla no hay nada privado que leer: el bloque, su hora y una frase de
   * ánimo. Lo íntimo —el diario, los repasos— sigue detrás del código, porque
   * atender la alarma no abre la app: al cerrarla se vuelve aquí.
   */
  if (bloqueada && !disparo) {
    return (
      <PantallaBloqueo
        onAbrir={() => {
          darPorAbierta();
          setBloqueada(false);
        }}
        pie="Si lo olvidas, se borra desinstalando la app — y con ella todo lo que has escrito. Elige uno que no se te vaya."
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="zona-segura-arriba flex-1 pb-24">
        <AvisoActualizacion />

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
            onNuevaTarea={() => setTareaAbierta("nueva")}
            onEditarTarea={(s) => {
              // Cada fila a su sitio, y abriendo ya lo que se tocó. Sin esto,
              // tocar un bloque de la rutina no hacía nada y parecía que la app
              // estuviera rota. Ojo con el plan: marcarlo sin cambiar de
              // pestaña tampoco se ve, que era el segundo fallo.
              if (s.origen === "tarea") {
                setTareaAbierta(s.id);
              } else if (s.plan) {
                setPlanAbierto(s.plan);
                setPestaña("planes");
              } else {
                setBloqueAbierto(s.id);
                setPestaña("rutina");
              }
            }}
            onVerPorque={() => setPestaña("porque")}
          />
        ) : null}

        {pestaña === "mensaje" ? <PantallaMensaje /> : null}

        {pestaña === "comunidad" ? <PantallaComunidad /> : null}

        {pestaña === "mas" ? (
          <PantallaMas
            nombre={datos.ajustes.nombre}
            racha={racha}
            opciones={[
              // La cuenta sólo se enseña cuando de verdad se puede entrar.
              ...(CUENTAS_ABIERTAS
                ? [
                    {
                      id: "cuenta",
                      icono: "◍",
                      titulo: "Mi cuenta",
                      detalle:
                        solicitudes > 0
                          ? solicitudes === 1
                            ? "Un hermano te está esperando"
                            : `${solicitudes} hermanos te están esperando`
                          : "Tu perfil y los hermanos que caminan contigo",
                      aviso: solicitudes,
                      onIr: () => setPestaña("cuenta"),
                    },
                  ]
                : []),
              {
                id: "fallo",
                icono: "🐞",
                titulo: "Avisar de un fallo",
                detalle: "Si algo no funciona, cuéntalo con capturas",
                onIr: () => setPestaña("fallo"),
              },
              {
                id: "porque",
                icono: "✦",
                titulo: "Mi porqué",
                detalle: "Las razones por las que te esfuerzas",
                onIr: () => setPestaña("porque"),
              },
              {
                id: "progreso",
                icono: "▟",
                titulo: "Progreso",
                detalle: "Rachas, calendario y en qué estás fallando",
                onIr: () => setPestaña("progreso"),
              },
              {
                id: "ajustes",
                icono: "⚙",
                titulo: "Ajustes",
                detalle: "Alarmas, frases y tus datos",
                onIr: () => setPestaña("ajustes"),
              },
            ]}
          />
        ) : null}

        {pestaña === "porque" ? (
          <ConVuelta titulo="Mi porqué" onVolver={() => setPestaña("mas")}>
            <PantallaPorque motivos={datos.motivos} onCambiar={cambiarMotivos} />
          </ConVuelta>
        ) : null}

        {pestaña === "planes" && planAbierto ? (() => {
          const plan = (datos.planes ?? []).find((p) => p.id === planAbierto);
          if (!plan) return null;
          return (
            <DetallePlan
              plan={plan}
              datos={datos}
              ahora={ahora}
              onRepasar={() => setExamen(plan.id)}
              onAnotar={(texto, publica) => {
                const nota = {
                  id: idNuevo(),
                  fecha: fechaHoy,
                  texto,
                  momento: Date.now(),
                  plan: plan.id,
                };
                setDatos((d) => ({ ...d, notas: [nota, ...(d.notas ?? [])] }));
                if (publica) soltarAlMuro(nota);
              }}
              onCambiar={(nuevo) =>
                setDatos((d) => ({
                  ...d,
                  planes: (d.planes ?? []).map((p) => (p.id === nuevo.id ? nuevo : p)),
                }))
              }
              onEliminar={() => {
                setDatos((d) => ({
                  ...d,
                  planes: (d.planes ?? []).filter((p) => p.id !== plan.id),
                }));
                setPlanAbierto(null);
              }}
              onVolver={() => setPlanAbierto(null)}
            />
          );
        })() : null}

        {pestaña === "planes" && !planAbierto ? (
          <PantallaPlanes
            datos={datos}
            ahora={ahora}
            onCrear={(plan: Plan) =>
              setDatos((d) => ({ ...d, planes: [...(d.planes ?? []), plan] }))
            }
            onAbrir={(id) => setPlanAbierto(id)}
          />
        ) : null}

        {pestaña === "rutina" ? (
          <PantallaRutina
            rutina={datos.rutina}
            volumen={datos.ajustes.volumen}
            onCambiar={cambiarRutina}
            abrir={bloqueAbierto}
            onAbierto={() => setBloqueAbierto(null)}
          />
        ) : null}

        {pestaña === "fallo" ? (
          <ConVuelta titulo="Avisar de un fallo" onVolver={() => setPestaña("mas")}>
            <PantallaFallo datos={datos} />
          </ConVuelta>
        ) : null}

        {pestaña === "cuenta" ? (
          <ConVuelta titulo="Mi cuenta" onVolver={() => setPestaña("mas")}>
            <PantallaCuenta
              racha={racha}
              diasEnPie={diasEnPie}
              totalCumplidos={cumplidos}
            />
          </ConVuelta>
        ) : null}

        {/* El diario ya es pestaña propia: no necesita el rodeo por «Más». */}
        {pestaña === "diario" ? (
          <PantallaDiario
            datos={datos}
            ahora={ahora}
            onCambiar={(notas) => setDatos((d) => ({ ...d, notas }))}
          />
        ) : null}

        {pestaña === "progreso" ? (
          <ConVuelta titulo="Progreso" onVolver={() => setPestaña("mas")}>
            <PantallaProgreso datos={datos} hoy={diaEstable} />
          </ConVuelta>
        ) : null}

        {pestaña === "ajustes" ? (
          <ConVuelta titulo="Ajustes" onVolver={() => setPestaña("mas")}>
          <PantallaAjustes
            datos={datos}
            onCambiarAjustes={cambiarAjustes}
            onReemplazar={(nuevos) => setDatos(nuevos)}
            proximo={proximo}
            onProbar={probar}
          />
          </ConVuelta>
        ) : null}
      </main>

      {/*
        Aviso flotante con la frase de ánimo tras marcar un bloque.

        Se coloca por encima de la barra contando su zona segura, y en una capa
        superior a ella. Antes iba a 76 píxeles fijos y en la misma capa que la
        barra, que se pinta después en el HTML y por tanto ganaba. En un móvil
        con botones de navegación —o con gesto—, `env(safe-area-inset-bottom)`
        engorda la barra por encima de esos 76 píxeles y el aviso quedaba
        escondido detrás: en el navegador se veía bien y en el teléfono no
        salía nunca.
      */}
      {brindis ? (
        <div
          className="entrar pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {/* Fondo opaco a propósito: translúcido sobre la lista no se leía. */}
          <div className="pointer-events-auto max-w-md rounded-2xl border border-acento/40 bg-superficie-alta px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <Cita texto={brindis.texto} fuente={brindis.fuente} compartible={false} />
          </div>
        </div>
      ) : null}

      {/* Lo que pasó con el muro. Mismo sitio y misma altura que el brindis. */}
      {avisoMuro ? (
        <div
          className="entrar pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <p className="pointer-events-auto max-w-md rounded-2xl border border-borde bg-superficie-alta px-4 py-3 text-xs leading-relaxed shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            {avisoMuro}
          </p>
        </div>
      ) : null}

      {/* En las pantallas de dentro, «Más» queda marcada. */}
      <nav className="zona-segura-abajo fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-borde bg-fondo/95 backdrop-blur">
        <div className="flex">
          {PESTAÑAS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPestaña(p.id);
                if (p.id === "hoy") setDesplazamiento(0);
              }}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2.5 text-[10px] transition ${
seleccionada === p.id ? "text-acento" : "text-tenue"
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

      {tareaAbierta ? (
        <DialogoTarea
          fecha={fecha}
          tarea={datos.tareas.find((t) => t.id === tareaAbierta)}
          onGuardar={(tarea: Tarea) => {
            setDatos((d) => ({
              ...d,
              tareas: d.tareas.some((t) => t.id === tarea.id)
                ? d.tareas.map((t) => (t.id === tarea.id ? tarea : t))
                : [...d.tareas, tarea],
            }));
            setTareaAbierta(null);
          }}
          onBorrar={() => {
            setDatos((d) => {
              // Se va la tarea y también lo que se hubiera anotado de ella.
              const registros = { ...d.registros };
              for (const clave of Object.keys(registros)) {
                if (clave.endsWith(`|${tareaAbierta}`)) delete registros[clave];
              }
              return { ...d, tareas: d.tareas.filter((t) => t.id !== tareaAbierta), registros };
            });
            setTareaAbierta(null);
          }}
          onCerrar={() => setTareaAbierta(null)}
        />
      ) : null}

      {/* El repaso de la noche, encima de lo que haya. */}
      {examen ? (() => {
        const plan = (datos.planes ?? []).find((p) => p.id === examen);
        if (!plan) return null;
        /**
         * Guarda el repaso y, si escribió algo, lo manda al diario.
         *
         * La nota va con el plan y con cómo acabó el día. Eso es lo que hace
         * que releerla dentro de un año valga: no solo está lo que sintió,
         * está si aquel día venció o cayó.
         */
        const anotar = (registro: RegistroPlan, nota?: string, publica?: boolean) => {
          const texto = nota?.trim();
          const id = idNuevo();
          const momento = Date.now();
          setDatos((d) => ({
            ...d,
            planesRegistros: {
              ...d.planesRegistros,
              [claveRegistro(fechaHoy, plan.id)]: registro,
            },
            ...(texto
              ? {
                  notas: [
                    {
                      id,
                      fecha: fechaHoy,
                      texto,
                      momento,
                      plan: plan.id,
                      estado: estadoDelDia(plan, fechaHoy, { ...d, planesRegistros: {
                        ...d.planesRegistros,
                        [claveRegistro(fechaHoy, plan.id)]: registro,
                      } }, true) as "ganado" | "restaurado" | "fallado",
                    },
                    ...(d.notas ?? []),
                  ],
                }
              : {}),
          }));
          // Se manda **después** de guardar el repaso: lo que sostiene la
          // racha se apunta primero, y publicar es lo accesorio.
          if (texto && publica) soltarAlMuro({ id, texto, momento });
          setExamen(null);
        };

        // La santidad se repasa de otra manera: una sola pregunta, y lo que
        // decide el día no es la caída sino qué se hizo con ella.
        if (plan.modoExamen === "unSoloCheck") {
          return (
            <ExamenDeSantidad
              plan={plan}
              registro={registroDe(datos, fechaHoy, plan.id)}
              restauradosEsteMes={diasRestaurados(plan, datos, 30, ahora)}
              onGuardar={(r, nota, publica) =>
                anotar({ ...r, repasado: Date.now() }, nota, publica)
              }
              onCerrar={() => setExamen(null)}
            />
          );
        }

        return (
          <ExamenDelPlan
            plan={plan}
            registro={registroDe(datos, fechaHoy, plan.id)}
            onGuardar={(puntos, nota, publica) =>
              anotar({ puntos, repasado: Date.now() }, nota, publica)
            }
            onCerrar={() => setExamen(null)}
          />
        );
      })() : null}

      {/*
        Una alarma que no sonó no puede quedarse callada también por la mañana.
        Si el sistema se comió alguna, se dice, y se ofrece el ajuste que casi
        siempre es la causa.
      */}
      {/*
        Va ANTES del aviso de alarma perdida a proposito: si alguien abre la app
        y tiene las dos cosas, lo primero que tiene que leer es como evitar que
        vuelva a pasar, no el parte de lo que ya paso.

        Y solo cuando hay rutina: en una app recien instalada y vacia, esto no
        significa nada y se olvida antes de que haga falta.
      */}
      {esNativo() && !vioElAviso && datos.rutina.some((b) => b.activo) ? (
        <AvisoDespertadorSeguro
          rutina={datos.rutina}
          onCerrar={(faltabaAlgo) => {
            localStorage.setItem(
              "genuino.avisoDespertador",
              faltabaAlgo ? String(Date.now()) : "visto",
            );
            setVioElAviso(true);
          }}
        />
      ) : null}

      {perdidas.length > 0 ? (
        <AvisoAlarmaPerdida perdidas={perdidas} onCerrar={() => setPerdidas([])} />
      ) : null}

      {disparo ? (
        <PantallaAlarma
          disparo={disparo}
          ajustes={datos.ajustes}
          motivos={datos.motivos}
          fecha={fechaHoy}
          onCumplir={() => {
            void pararDespertador();
            registrar(disparo.suceso, "cumplido", undefined, fechaHoy);
            cerrar();
          }}
          onSaltar={() => {
            void pararDespertador();
            registrar(disparo.suceso, "saltado", "Saltado desde la alarma", fechaHoy);
            cerrar();
          }}
          onPosponer={(minutos) => {
            void pararDespertador();
            posponer(minutos);
          }}
          onCerrar={() => {
            void pararDespertador();
            cerrar();
          }}
        />
      ) : null}
    </div>
  );
}
