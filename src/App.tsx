import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { PantallaSala } from "@/componentes/PantallaSala";
import { Intro, tocaSaludar } from "@/componentes/Intro";
import { PantallaFallo } from "@/componentes/PantallaFallo";
import { contarSolicitudes, miUid, publicarNota } from "@/logica/muro";
import { leerPerfil } from "@/logica/nube";
import { pasarLaApp } from "@/logica/pasarApp";
import { horaLocalDe, salaDeLaUrl, type Reunion } from "@/logica/comunidad";
import { respaldarSiToca } from "@/logica/respaldoNube";
import { atenderLlamada, llamadaPendiente, type LlamadaPendiente } from "@/logica/timbre";
import { DialogoTarea } from "@/componentes/DialogoTarea";
import { Cita, vars } from "@/componentes/piezas";
import { reducido, resorte } from "@/logica/resorte";

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

/**
 * Dónde está cada pantalla, de izquierda a derecha como en la barra; las de
 * dentro de «Más», un paso más allá. Sirve para saber DESDE qué lado tiene
 * que entrar la pantalla nueva: ir a la derecha entra desde la derecha,
 * volver entra desde la izquierda.
 */
function profundidad(p: Pestaña): number {
  const i = EN_LA_BARRA.indexOf(p);
  return i >= 0 ? i : EN_LA_BARRA.length;
}

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
  const [pestaña, setPestañaCruda] = useState<Pestaña>("hoy");
  /**
   * Hacia dónde entra la pantalla nueva: 1 si se fue a la derecha (o hacia
   * dentro, a una pantalla de «Más»), -1 si se volvió, 0 al arrancar. Lo lee
   * `.pantalla-entra` como `--dir`. Se guarda como estado y no se calcula al
   * pintar: el reloj repinta cada segundo y cambiar `--dir` a media animación
   * la haría saltar.
   */
  const [dir, setDir] = useState(0);
  const setPestaña = (p: Pestaña) => {
    // Tocar la pestaña ya puesta no es un cambio: si aquí se pusiera `--dir`
    // a 0, la pantalla que aún está entrando saltaría de lado (ver arriba).
    if (p === pestaña) return;
    setDir(Math.sign(profundidad(p) - profundidad(pestaña)));
    setPestañaCruda(p);
  };
  /** Sube cuando la intro empieza a irse: Hoy vuelve a entrar debajo de ella. */
  const [escena, setEscena] = useState(0);
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
   * La sala de voz en la que estamos, o null.
   *
   * Vive aquí arriba y no dentro de «Juntos» a propósito: una sala abierta tiene
   * que sobrevivir a que alguien cambie de pestaña a mirar su rutina. Si viviera
   * en la pantalla de la comunidad, salir de esa pestaña desmontaría el
   * componente y colgaría la llamada — con treinta personas dentro.
   */
  /**
   * Una llamada al devocional que dejó el servicio nativo.
   *
   * El móvil ya sonó —o está sonando— con la maquinaria de las alarmas. Aquí
   * sólo se enseña «Entrar» o «Ahora no». Se mira al arrancar y cada vez que la
   * app vuelve a primer plano, que es cuando alguien toca la pantalla de la
   * alarma para venir aquí.
   */
  const [llamada, setLlamada] = useState<LlamadaPendiente | null>(null);

  /**
   * El saludo de un segundo al arrancar. Sólo en frío —lo decide `Intro`— y
   * nunca encima de una alarma sonando o de una llamada: a las cinco de la
   * mañana, con el móvil repicando, lo último que hace falta es un logo.
   */
  const [saludando, setSaludando] = useState(() => tocaSaludar());

  const [sala, setSala] = useState<{
    canal: string;
    /** El de la reunión publicada, por si hay que abrirla. */
    nombre?: string;
    quien: { uid: string; nombre: string; usuario: string; foto?: string };
  } | null>(null);

  /**
   * La cerradura.
   *
   * Se decide **una sola vez al montar**, no en cada repintado: si dependiera
   * del reloj, la app se bloquearía sola mientras Alex escribe.
   */
  const [bloqueada, setBloqueada] = useState(() => tocaPedirlo());
  const [brindis, setBrindis] = useState<{ texto: string; fuente?: string } | null>(null);
  /** Los dos avisos flotantes se despiden antes de irse, en vez de desaparecer. */
  const [brindisSale, setBrindisSale] = useState(false);
  const [avisoSale, setAvisoSale] = useState(false);
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
   * «Menos movimiento», puesto en <html> para que el CSS lo vea.
   *
   * Dos fuentes y basta una: el ajuste del móvil («reducir movimiento») o el
   * interruptor de Ajustes. Va en un efecto de disposición para que esté
   * puesto ANTES del primer pintado: si no, a quien lo pidió le saldría la
   * intro entera un instante.
   */
  useLayoutEffect(() => {
    const consulta = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const aplicar = () => {
      const menos = datos.ajustes.menosMovimiento || (consulta?.matches ?? false);
      if (menos) document.documentElement.dataset.movimiento = "menos";
      else delete document.documentElement.dataset.movimiento;
    };
    aplicar();
    consulta?.addEventListener?.("change", aplicar);
    return () => consulta?.removeEventListener?.("change", aplicar);
  }, [datos.ajustes.menosMovimiento]);

  useEffect(() => {
    if (!esNativo()) return;
    const mirar = async () => {
      const l = await llamadaPendiente();
      if (!l) return;
      // Una llamada de hace más de diez minutos ya no es una llamada: se
      // olvida sin enseñarla, o alguien abriría la app a mediodía y vería
      // «te llaman» de las cuatro de la mañana.
      if (Date.now() - l.cuando > 10 * 60_000) {
        void atenderLlamada();
        return;
      }
      setLlamada(l);
    };
    void mirar();
    const alVolver = () => {
      if (document.visibilityState === "visible") void mirar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  /**
   * La copia en la nube, sola y en silencio.
   *
   * Alex, el 24-09-2026: «los datos básicos deberían estar en una nube, porque
   * no todo el mundo va a estar pendiente de exportar una copia». Eso es esto:
   * quien tiene cuenta no tiene que hacer nada, y quien no la tiene sigue con
   * la app entera y con su copia a mano en Ajustes.
   *
   * Qué sube y qué se queda aquí está en `@/logica/respaldoNube`, en un solo
   * sitio. **El diario no sube**, y la huella que se compara allí lo tiene en
   * cuenta: escribir tres párrafos por la noche no manda treinta copias.
   *
   * Veinte segundos de calma antes de subir. Cada cambio reinicia la cuenta, así
   * que quien está marcando bloques uno detrás de otro sube una sola vez al
   * acabar, no ocho veces.
   */
  useEffect(() => {
    const id = window.setTimeout(() => void respaldarSiToca(datos), 20_000);
    return () => clearTimeout(id);
  }, [datos]);

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

  /**
   * Si una alarma o una llamada llegan mientras saluda, el saludo se da por
   * hecho. `disparo` y `llamada` se fijan en un efecto, después del primer
   * pintado: la Intro se montaba, se desmontaba al instante sin llegar a
   * `onFin`, y al cerrar la alarma volvía a salir entera —y su `onSaliendo`
   * remontaba Hoy, cortando la celebración del bloque recién cumplido.
   */
  useEffect(() => {
    if (saludando && (disparo || llamada)) setSaludando(false);
  }, [saludando, disparo, llamada]);

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
    setAvisoSale(false);
    const irse = window.setTimeout(() => setAvisoSale(true), 5200 - 220);
    const id = window.setTimeout(() => {
      // La bandera se apaga aquí, no al llegar el siguiente aviso: ése llega
      // desde una promesa y el efecto corre después de pintar, así que el
      // cuadro nacía un fotograma con la clase de salida.
      setAvisoMuro("");
      setAvisoSale(false);
    }, 5200);
    return () => {
      clearTimeout(irse);
      clearTimeout(id);
    };
  }, [avisoMuro]);

  // Tocar un aviso lo retira: no tiene sentido que tape la lista cinco
  // segundos sin hacer nada. Al vaciarse, el efecto de arriba limpia sus dos
  // temporizadores.
  const retirarAvisoMuro = () => {
    setAvisoSale(true);
    window.setTimeout(() => setAvisoMuro(""), 220);
  };
  const retirarBrindis = () => {
    setBrindisSale(true);
    window.setTimeout(() => setBrindis(null), 220);
  };

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
    setBrindisSale(false);
    const irse = window.setTimeout(() => setBrindisSale(true), 5200 - 220);
    const id = window.setTimeout(() => {
      setBrindis(null);
      setBrindisSale(false);
    }, 5200);
    return () => {
      clearTimeout(irse);
      clearTimeout(id);
    };
  }, [brindis]);

  const seleccionada: Pestaña = EN_LA_BARRA.includes(pestaña) ? pestaña : "mas";

  /**
   * La marca de la barra: se desliza y, a mitad de camino, se ESTIRA —más
   * cuanto más lejos salta— y se recoge al llegar, con resorte.
   *
   * Con la Web Animations API y sin `fill`: al acabar manda el `transform` en
   * línea, que ya apunta a la pestaña nueva. En un efecto de disposición para
   * que el primer cuadro salga ya en marcha y no se vea la marca saltar al
   * destino y volver.
   */
  const marca = useRef<HTMLDivElement>(null);
  const indiceMarca = Math.max(0, PESTAÑAS.findIndex((p) => p.id === seleccionada));
  const indiceAnterior = useRef(indiceMarca);
  useLayoutEffect(() => {
    const de = indiceAnterior.current;
    indiceAnterior.current = indiceMarca;
    const el = marca.current;
    if (!el || typeof el.animate !== "function" || de === indiceMarca || reducido()) return;
    const salto = Math.abs(indiceMarca - de);
    const medio = (de + indiceMarca) / 2;
    const estiron = Math.min(2.4, 1 + salto * 0.55);
    const anim = el.animate(
      [
        { transform: `translateX(${de * 100}%) scaleX(1)` },
        {
          transform: `translateX(${medio * 100}%) scaleX(${estiron})`,
          offset: 0.375,
          easing: resorte("snap"),
        },
        { transform: `translateX(${indiceMarca * 100}%) scaleX(1)` },
      ],
      { duration: 480, easing: resorte("firme"), fill: "none" },
    );
    return () => anim.cancel();
  }, [indiceMarca]);

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

  /**
   * Entrar en una sala de voz.
   *
   * Hace falta el perfil, no sólo la cuenta: en la sala se ve el nombre y la
   * foto de cada uno, y una lista de treinta identificadores no es una reunión.
   * Quien no tiene perfil todavía se entera aquí, que es cuando le importa.
   */
  const entrarEnSala = async (canal: string, nombre?: string) => {
    try {
      const uid = await miUid();
      const perfil = uid ? await leerPerfil(uid) : null;
      if (!uid || !perfil) {
        setAvisoMuro("Para entrar en una sala hace falta tu cuenta y tu perfil.");
        return;
      }
      setSala({
        canal,
        nombre,
        quien: {
          uid,
          nombre: perfil.nombre,
          usuario: perfil.usuario,
          ...(perfil.foto ? { foto: perfil.foto } : {}),
        },
      });
    } catch {
      setAvisoMuro("No se pudo entrar en la sala.");
    }
  };

  /**
   * Poner una reunión publicada en la rutina, como un bloque con sala.
   *
   * Es la mitad «a hora fija» del timbre: a su hora suena con la maquinaria
   * de las alarmas —la que ya aguanta MIUI de madrugada— y la pantalla ofrece
   * entrar. La hora se convierte a la de este móvil una vez, al ponerla: la
   * rutina guarda horas locales, y un devocional a las 03:00 de Caracas es a
   * las 09:00 en Madrid.
   *
   * Si ya estaba, no se duplica: se avisa y ya.
   */
  const ponerReunionEnRutina = (reunion: Reunion) => {
    const canal = salaDeLaUrl(reunion.url);
    if (!canal) return;
    const id = `sala-${canal}`;
    if (datos.rutina.some((b) => b.id === id)) {
      setAvisoMuro("Ya está en tu rutina.");
      return;
    }
    const bloque: BloqueRutina = {
      id,
      nombre: reunion.nombre,
      hora: horaLocalDe(reunion),
      duracionMin: reunion.duracionMin || 60,
      dias: reunion.dias.length > 0 ? reunion.dias : [0, 1, 2, 3, 4, 5, 6],
      categoria: "fe",
      porque: reunion.descripcion ?? "Orar y leer la Palabra con los hermanos.",
      timbre: "diana",
      avisoPrevioMin: 5,
      activo: true,
      sala: canal,
    };
    setDatos((d) => ({ ...d, rutina: [...d.rutina, bloque] }));
    setAvisoMuro(`Puesta en tu rutina a las ${bloque.hora}. Te sonará como una alarma.`);
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
      <>
        <PantallaBloqueo
          onAbrir={() => {
            darPorAbierta();
            setBloqueada(false);
          }}
          pie="Si lo olvidas, se borra desinstalando la app — y con ella todo lo que has escrito. Elige uno que no se te vaya."
        />
        {/*
          El saludo va ENCIMA del código, no después: si sólo saliera al abrir
          la app entera, quien tiene código lo vería tras teclear el PIN, como
          un peaje, y Hoy entraría dos veces. Aquí saluda pegado al splash,
          que es donde tiene sentido, y el teclado queda debajo.
        */}
        {saludando && !llamada ? (
          <Intro
            onFin={() => setSaludando(false)}
            onSaliendo={() => setEscena((n) => n + 1)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      {/*
        Cada pantalla entra: al cambiar de pestaña, la nueva llega desde el
        lado hacia el que se fue (`--dir`), baja un poco y se posa. La clave
        lleva la pestaña —React desmonta la vieja y monta la nueva, y la
        entrada corre una vez por cambio— y la escena, que sube cuando la
        intro se va, para que Hoy entre debajo de ella y no esté ya quieto.
      */}
      <main
        key={`${pestaña}:${escena}`}
        className="zona-segura-arriba pantalla-entra flex-1 pb-24"
        style={vars({ "--dir": dir })}
      >
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

        {pestaña === "comunidad" ? (
          <PantallaComunidad
            onEntrarEnSala={(canal, nombre) => void entrarEnSala(canal, nombre)}
            onPonerEnRutina={ponerReunionEnRutina}
          />
        ) : null}

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
              // Mientras la app no esté en Google Play, se pasa a mano. Se manda
              // el archivo mismo —no un enlace—, para que la otra persona no
              // tenga que bajar treinta megas por su conexión.
              {
                id: "pasar",
                icono: "↗",
                // «Compartir» y no «pasar»: Alex la buscó por esa palabra el
                // 27-09-2026 y no la encontró. Se llama como la gente la busca.
                titulo: "Compartir la app",
                detalle: "Pásasela a alguien por WhatsApp, Bluetooth o Compartir cercano. Sin descargar nada.",
                onIr: () => {
                  void pasarLaApp().then((que) => {
                    if (que === "copiado") setAvisoMuro("Enlace copiado. Pégalo donde quieras.");
                    else if (que === "fallo") setAvisoMuro("No se pudo compartir.");
                  });
                },
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
              datos={datos}
              onReemplazar={(nuevos) => setDatos(nuevos)}
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
          className={`${brindisSale ? "brindis-sale" : "brindis-entra"} pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4`}
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {/* Fondo opaco a propósito: translúcido sobre la lista no se leía. */}
          <div
            role="status"
            onClick={retirarBrindis}
            className="pointer-events-auto max-w-md rounded-2xl border border-acento/40 bg-superficie-alta px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <Cita texto={brindis.texto} fuente={brindis.fuente} compartible={false} />
          </div>
        </div>
      ) : null}

      {/* Lo que pasó con el muro. Mismo sitio y misma altura que el brindis. */}
      {avisoMuro ? (
        <div
          className={`${avisoSale ? "brindis-sale" : "brindis-entra"} pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4`}
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <p
            role="status"
            onClick={retirarAvisoMuro}
            className="pointer-events-auto max-w-md rounded-2xl border border-borde bg-superficie-alta px-4 py-3 text-xs leading-relaxed shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            {avisoMuro}
          </p>
        </div>
      ) : null}

      {/* En las pantallas de dentro, «Más» queda marcada. */}
      <nav className="zona-segura-abajo fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-borde bg-fondo/95 backdrop-blur">
        {/*
          La marca dorada se DESLIZA de una pestaña a otra en vez de saltar,
          estirándose a mitad de camino (el efecto de arriba). Mide una pestaña
          de ancho y se mueve con transform, que es lo único que el móvil anima
          sin recalcular nada.
        */}
        <div
          ref={marca}
          className="marca-barra pointer-events-none absolute top-0 h-[3px] rounded-full bg-acento"
          style={{
            width: `${100 / PESTAÑAS.length}%`,
            transform: `translateX(${Math.max(0, PESTAÑAS.findIndex((p) => p.id === seleccionada)) * 100}%)`,
          }}
          aria-hidden
        />
        <div className="flex">
          {PESTAÑAS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPestaña(p.id);
                if (p.id === "hoy") setDesplazamiento(0);
              }}
              className={`toque flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2.5 text-[10px] ${
                seleccionada === p.id ? "text-acento" : "text-tenue"
              }`}
            >
              <span
                className={`icono-barra text-lg leading-none ${seleccionada === p.id ? "activo" : ""}`}
                aria-hidden
              >
                {p.icono}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
      </nav>

      {saludando && !disparo && !llamada ? (
        <Intro
          onFin={() => setSaludando(false)}
          onSaliendo={() => setEscena((n) => n + 1)}
        />
      ) : null}

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

      {/*
        La sala de voz, encima de todo y sobre fondo opaco.

        Tapa la app entera a proposito: mientras treinta hermanos estan leyendo
        un devocional, lo que importa es quien habla y el boton de la mano. Nadie
        entra en una sala para hojear su rutina, y una pantalla a medias con la
        llamada detras invita a tocar cosas y a colgar sin querer.

        Va DESPUES del aviso de alarma perdida en el HTML, asi que se pinta
        encima. Es lo correcto: si alguien esta en un devocional, el parte de una
        alarma de ayer puede esperar a que salga.
      */}
      {/*
        «Te llaman al devocional». Encima de todo, incluso de la sala: si ya
        estás dentro y llega otra llamada a la misma sala, se descarta sola
        abajo. El botón grande es entrar; el pequeño, no. A las tres de la
        mañana no hay tiempo para más opciones.
      */}
      {llamada && (!sala || sala.canal !== llamada.canal) ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-fondo p-6">
          <div className="w-full max-w-sm text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-tenue">
              te llaman al devocional
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">{llamada.nombre}</h2>
            <p className="mt-2 text-sm text-tenue">
              {llamada.sono ? "Está empezando ahora." : "Te llamaron hace un rato. Puede que siga."}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => {
                  const { canal, nombre } = llamada;
                  setLlamada(null);
                  void atenderLlamada();
                  void entrarEnSala(canal, nombre);
                }}
                className="toque boton-vivo rounded-2xl bg-logro px-6 py-5 text-lg font-semibold text-fondo"
              >
                Entrar
              </button>
              <button
                onClick={() => {
                  setLlamada(null);
                  void atenderLlamada();
                }}
                className="toque rounded-2xl border border-borde px-6 py-3 text-sm text-tenue"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sala ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-fondo">
          <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg p-4">
            <PantallaSala
              canal={sala.canal}
              nombreSiHayQueAbrirla={sala.nombre}
              quienSoy={sala.quien}
              onSalir={() => setSala(null)}
            />
          </div>
        </div>
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
          onEntrarEnSala={
            disparo.suceso.sala
              ? () => {
                  const canal = disparo.suceso.sala!;
                  const nombre = disparo.suceso.nombre;
                  void pararDespertador();
                  // Entrar es cumplirlo: es lo que el bloque pedía.
                  registrar(disparo.suceso, "cumplido", undefined, fechaHoy);
                  cerrar();
                  void entrarEnSala(canal, nombre);
                }
              : undefined
          }
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
