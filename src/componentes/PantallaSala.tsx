import { useEffect, useMemo, useRef, useState } from "react";
import type { Dentro, Lectura, Sala } from "@/logica/sala";
import {
  abrirSala,
  alCambiarLaRed,
  alCaducarElToken,
  callarme,
  cambiarDePapel,
  cerrarSala,
  sacarDeLaLista,
  darLaPalabra,
  entrarEnSala,
  expulsar,
  hayVoz,
  leerSala,
  mano,
  miMicro,
  moverLectura,
  ponerCampana,
  ponerLectura,
  ponerMicLibre,
  quitarLectura,
  soloEscucho,
  porElAltavoz,
  renovarToken,
  salirDeSala,
  silenciar,
  terminarParaTodos,
  verLlegadasYSalidas,
  verQuienEsta,
  verQuienHabla,
  verSala,
  SALA_DURA_MS,
  ahoraServidor,
  alTocarLaVentanita,
  cerrarVentanita,
  ponerFlotante,
} from "@/logica/sala";
import { puedoModerar } from "@/logica/muro";
import { abrirAjustesDeLaApp } from "@/logica/despertador";
import {
  PLAN,
  anteriorLector,
  comentaristaDe,
  diaDelPlan,
  escucharDia,
  escucharOrden,
  leerOrden,
  puestoVivo,
  siguienteLector,
  type Devocional,
  type Lector,
  type Orden,
} from "@/logica/devocionales";
import { PegarDevocional } from "./PegarDevocional";
import { EnSubgrupo, Subgrupos, marcarVuelta } from "./Subgrupos";
import { VerJuntos } from "./VerJuntos";
import { videoSonando } from "@/logica/verJuntos";
import { contarGustos, darGusto, verGustos, type Gusto } from "@/logica/gustos";
import { agregarOAceptar, escucharAmigos, type Amigo } from "@/logica/nube";
import { leerBloqueados } from "@/logica/muro";
import { TextoDevocional } from "./TextoDevocional";
import { parar, sonar, vibrar } from "@/logica/sonido";
import { cuantosMiembros, escucharMiembros, llamarALaComunidad, type LlamadaHecha } from "@/logica/timbre";
import { InformeDeLlamada } from "./InformeDeLlamada";
import { VERSICULO_SALA } from "@/datos/presencia";
import { Boton, Etiqueta, Tarjeta, Vacio } from "./piezas";

/**
 * La sala: el devocional de treinta y la llamada de dos.
 *
 * ── Las tres decisiones de esta pantalla ──────────────────────────────────
 *
 * **Se ve quién habla.** Es lo único que se le pide a Agora aparte del audio, y
 * es lo que convierte treinta nombres en una lista en treinta personas. Sin eso,
 * un devocional de treinta suena a radio sin locutor.
 *
 * **Se entra escuchando, y se dice.** No en letra pequeña: en grande, porque
 * alguien que cree tener el micrófono abierto y no lo tiene se pasa el devocional
 * hablándole a nadie. Y el permiso de verdad no lo da esta pantalla — lo da el
 * token— así que aquí sólo se refleja lo que ya es cierto.
 *
 * **La mano se levanta, no se interrumpe.** Es la diferencia entre comentar un
 * devocional y treinta personas hablando encima. El anfitrión ve las manos en
 * orden y da la palabra.
 */
export function PantallaSala({
  canal,
  nombreSiHayQueAbrirla,
  finPrevisto,
  quienSoy,
  onSalir,
  onIrA,
  padre,
  ventanita = false,
}: {
  canal: string;
  /**
   * Cómo se llamaría la sala si todavía no existe.
   *
   * Viene de la reunión publicada en `comunidad.json`. Una reunión dice **a qué
   * hora** hay devocional; la sala es **el sitio**, y alguien tiene que abrirla.
   * Hasta que esto existió, tocar una reunión a su hora contestaba «esa sala no
   * existe», que es verdad y no sirve de nada: el anfitrión estaba delante,
   * queriendo empezar, y la app le mandaba a buscar otro botón.
   */
  nombreSiHayQueAbrirla?: string;
  /**
   * A qué hora local acaba la reunión («06:00»). Es la hora con la que nace
   * la campana cuando el anfitrión abre la sala; después la mueve él.
   */
  finPrevisto?: string;
  quienSoy: { uid: string; nombre: string; usuario: string; foto?: string };
  onSalir: () => void;
  /** Si la app está encogida en la ventanita flotante (lo sabe App, que no se desmonta). */
  ventanita?: boolean;
  /** Pasar a otra sala sin salir de la voz: a un subgrupo, o de vuelta al devocional. */
  onIrA?: (destino: { canal: string; nombre: string; padre?: string }) => void;
  /** Si se viene a un subgrupo: su devocional, adonde volver si algo falla. */
  padre?: string;
}) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [gente, setGente] = useState<Dentro[]>([]);
  const [estado, setEstado] = useState<
    "entrando" | "dentro" | "fuera" | "sin-abrir"
  >("entrando");
  /** Si esta persona puede abrir la sala que falta. */
  const [puedoAbrirla, setPuedoAbrirla] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");
  const [habla, setHabla] = useState(false);
  const [esAnfitrion, setEsAnfitrion] = useState(false);
  const [microAbierto, setMicroAbierto] = useState(true);
  const [altavoz, setAltavoz] = useState(true);
  /** Las cuentas de quien está sonando ahora mismo, y si soy yo. */
  const [sonando, setSonando] = useState<{ cuentas: Set<string>; yo: boolean }>({
    cuentas: new Set(),
    yo: false,
  });
  const [tocando, setTocando] = useState<string | null>(null);
  const [llamando, setLlamando] = useState(false);
  const [avisoLlamada, setAvisoLlamada] = useState("");
  /** La última llamada hecha desde aquí, para decir a quién le sonó (6.27). */
  const [llamadaHecha, setLlamadaHecha] = useState<LlamadaHecha | null>(null);
  /** La campana: la hora que edita el anfitrión, el aviso al sonar, y a qué instante ya sonamos. */
  const [horaCampana, setHoraCampana] = useState(finPrevisto ?? "");
  const [avisoCampana, setAvisoCampana] = useState("");
  const campanaSonada = useRef(0);
  /** «Terminar para todos» pide tocar dos veces. */
  const [confirmarFin, setConfirmarFin] = useState(false);
  /** Para saber que me sacaron o que la sala se cerró: hay que haber estado. */
  const estuveEnLaLista = useRef(false);
  const salaEstuvoAbierta = useRef(false);
  /** Quién habla ahora, con dos segundos de memoria para que el retrato no parpadee. */
  const [foco, setFoco] = useState<string[]>([]);
  /** Iba a hablar y el móvil no tiene permiso del micrófono: se dice, con botón. */
  const [sinMicrofono, setSinMicrofono] = useState(false);
  /** La lectura por turnos: el orden de la comunidad y el devocional del día. */
  // `undefined` es «todavía cargando»; `null`, «no existe». Confundirlos le
  // decía al anfitrión «falta el orden» mientras sólo estaba llegando.
  const [ordenLectura, setOrdenLectura] = useState<Orden | null | undefined>(undefined);
  const [devLectura, setDevLectura] = useState<Devocional | null | undefined>(undefined);
  /** El día viene de la copia del móvil, sin confirmar con el servidor. */
  const [devProvisional, setDevProvisional] = useState(false);
  /**
   * Sólo en el móvil del anfitrión: quién es de la comunidad (para no darle
   * turno a quien se salió y ya no ve el texto) y quién se cayó del canal de
   * voz aunque su ficha siga en la lista (cuenta → cuándo).
   */
  const [miembrosUids, setMiembrosUids] = useState<Set<string> | null>(null);
  /** Cuenta → la `entro` de su ficha cuando se cayó (o −1 si no tenía): vuelve cuando cambia. */
  const [caidos, setCaidos] = useState<Map<string, number>>(() => new Map());
  /** La hora de ESTE móvil en que se vio moverse la lectura: los relojes de los demás no cuentan. */
  const lecturaVistaEn = useRef<{ desde: number; local: number }>({ desde: 0, local: 0 });
  /** Para volver a armar el vigilante si su intento falló. */
  const [reintentoVigia, setReintentoVigia] = useState(0);
  /** Cuándo se oyó por última vez a cada cuenta: para el «¿sigue ahí?». */
  const oidoEn = useRef(new Map<string, number>());
  /** Si no se pudo leer el orden o el día: «red» se arregla sola, «permiso» no. */
  const [ordenFallo, setOrdenFallo] = useState<"" | "red" | "permiso">("");
  const [devFallo, setDevFallo] = useState<"" | "red" | "permiso">("");
  /** Para volver a escuchar el orden y el día a mano, con «Reintentar». */
  const [reintento, setReintento] = useState(0);
  /** «Terminé» o «Siguiente» en camino: el segundo toque no hace nada. */
  const [pasando, setPasando] = useState(false);
  /** Recién movida la lectura: los mandos del anfitrión esperan un instante. */
  const [calma, setCalma] = useState(false);
  /** Quien modera pegando el devocional del día desde la sala. */
  const [pegando, setPegando] = useState(false);
  /**
   * «Me gusta» y «Agregar» (6.26). Alex, 28-09-2026: «todos los miembros de
   * una comunidad deben ser animados, de alguna manera, a agregarse
   * mutuamente. Mientras alguien habla, debe estar la opción de darle me
   * gusta y de agregar, además de lo que ya agregaste: la racha».
   */
  const [gustos, setGustos] = useState<Gusto[]>([]);
  /** Mis amistades, en vivo: uid → en qué punto están. `null` mientras llegan. */
  const [amigos, setAmigos] = useState<Map<string, Amigo["estado"]> | null>(null);
  /** A quién bloqueé: ni se le ofrece agregar ni se anuncian sus «me gusta». */
  const [bloqueados, setBloqueados] = useState<Set<string>>(() => new Set());
  const avisoGustoHasta = useRef<number | null>(null);
  /** «Agregar a todos» ya tocado: la tarjeta se queda para decir cómo fue. */
  const [animoFijo, setAnimoFijo] = useState(false);
  const bloqueadosAhora = useRef<Set<string>>(new Set());
  /** Los corazones que suben ahora sobre un retrato. */
  const [corazones, setCorazones] = useState<{ id: string; a: string }[]>([]);
  /** «A X le gustó lo que dijiste»: un momento, y se va. */
  const [avisoGusto, setAvisoGusto] = useState("");
  /** Ver el texto del trozo que se lee (para seguirlo), plegado por defecto. */
  const [verTexto, setVerTexto] = useState(false);

  /**
   * El papel que teníamos la última vez.
   *
   * Hace falta para no pedir un token nuevo en cada repintado: sólo cuando el
   * anfitrión cambia `palabra` de verdad. Sin esto, cualquier cambio en la lista
   * —alguien que entra, una mano que se levanta— dispararía una llamada a la
   * Cloud Function por persona y por cambio.
   */
  const palabraAnterior = useRef<boolean | null>(null);

  /**
   * Entrar de verdad. Se usa al llegar y después de abrir la sala que faltaba.
   *
   * Devuelve si se pudo, para que quien la llama sepa si seguir.
   */
  const entrar = async (sigoAqui: () => boolean) => {
    try {
      const r = await entrarEnSala(canal, quienSoy);
      if (!sigoAqui()) {
        // Se salió de la pantalla mientras entrábamos. Hay que soltar el audio
        // o queda un micrófono abierto en una sala que nadie mira.
        await salirDeSala();
        return;
      }
      setHabla(r.habla);
      setEsAnfitrion(r.esAnfitrion);
      // El punto de partida de `palabraAnterior` lo pone la lista al llegar
      // (`yo.palabra`), no el token: con los micrófonos libres, en una llamada
      // o siendo anfitrión se habla SIN `palabra`, y compararlos pedía un
      // token de más a cada uno que entraba hablando — y le abría el micro.
      //
      // Quien no es el anfitrión entra con el micrófono cerrado aunque pueda
      // hablar (micrófonos libres): abrirlo es un gesto suyo, no un ruido al
      // llegar tarde a mitad de la lectura.
      // Tampoco el anfitrión que entra «a escuchar» un subgrupo: llega a un
      // grupo que ya está hablando.
      if (!r.esAnfitrion || r.tipo === "subgrupo") {
        setMicroAbierto(false);
        void miMicro(false);
      } else {
        // Y se fija también en el motor: el silencio de la visita a un grupo
        // se quedaba puesto al volver, con la pantalla diciendo «abierto».
        setMicroAbierto(r.habla);
        void miMicro(r.habla);
      }
      // Sin permiso del micrófono se entra igual, a escuchar. Si se iba a
      // hablar (anfitrión, micrófonos libres), se dice y se da el botón.
      setSinMicrofono(!r.microfono && (r.esAnfitrion || r.micLibre));
      setEstado("dentro");
    } catch (e) {
      if (!sigoAqui()) return;
      setError(comoSeDice(e));
      setEstado("fuera");
    }
  };

  // ── entrar, y salir al irse ────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    const sigoAqui = () => vivo;
    void (async () => {
      let laSala;
      try {
        laSala = await leerSala(canal);
      } catch (e) {
        if (!vivo) return;
        // Se distingue el permiso de la red, y no es un detalle. El 27-09-2026
        // Alex vio «mira tu conexión» con la conexión perfecta: lo que fallaba
        // eran unas reglas de Firestore sin desplegar. Un mensaje que manda a
        // mirar donde no está el fallo cuesta más que ninguno.
        const codigo = (e as { code?: string })?.code ?? "";
        setError(
          codigo.includes("permission-denied")
            ? "La app no tiene permiso para mirar esta sala. Avisa a quien lleva la app: es cosa del servidor, no tuya."
            : "No se pudo mirar la sala. Mira tu conexión.",
        );
        setEstado("fuera");
        return;
      }
      if (!vivo) return;
      setSala(laSala);

      // La sala no existe todavía. Si es una reunión programada y quien llega
      // puede abrirla, se le ofrece en vez de darle un error: es exactamente el
      // momento en que la quiere abrir.
      // La reunión de siempre (mismo canal cada día) cerrada —la de ayer— o
      // pasada de su vida: se ofrece reabrirla, como si no existiera. Antes el
      // portero decía «La sala está cerrada» y no había forma de abrirla.
      // Cerrada HOY es que terminó (se entra y el portero lo dice); cerrada
      // otro día, o vencida, es la de ayer.
      const diaDe = (t: number) => new Date(t).toDateString();
      const caducada =
        !!laSala &&
        laSala.tipo === "devocional" &&
        !!nombreSiHayQueAbrirla &&
        (Date.now() - laSala.desde >= SALA_DURA_MS ||
          (!laSala.abierta && diaDe(laSala.desde) !== diaDe(Date.now())));
      if (!laSala || caducada) {
        const puedo = await puedoModerar().catch(() => false);
        if (!vivo) return;
        setPuedoAbrirla(puedo && !!nombreSiHayQueAbrirla);
        setEstado("sin-abrir");
        return;
      }

      await entrar(sigoAqui);
    })();
    return () => {
      vivo = false;
      void salirDeSala();
    };
    // Sólo al entrar en esta sala. `quienSoy` no puede cambiar sin cambiar de
    // cuenta, y cambiar de cuenta desmonta la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal]);

  // ── quién está dentro ───────────────────────────────────────────────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let dejar: (() => void) | null = null;
    let vivo = true;
    void verQuienEsta(canal, (g) => vivo && setGente(g)).then((f) => {
      if (!vivo) f();
      else dejar = f;
    });
    return () => {
      vivo = false;
      dejar?.();
    };
  }, [canal, estado]);

  // ── la sala misma: si se cierra, si se sueltan los micrófonos ──────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let dejar: (() => void) | null = null;
    let vivo = true;
    void verSala(canal, (nueva) => vivo && setSala(nueva)).then((f) => {
      if (!vivo) f();
      else dejar = f;
    });
    return () => {
      vivo = false;
      dejar?.();
    };
  }, [canal, estado]);

  // ── quién habla ahora mismo ─────────────────────────────────────────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let quitar: (() => Promise<void>) | null = null;
    let vivo = true;
    void verQuienHabla((quienes) => {
      if (!vivo) return;
      // Por debajo de 15 sobre 255 es respirar, no hablar. Sin este corte el
      // indicador se enciende con el ruido de la habitación y deja de significar
      // nada.
      const fuertes = quienes.filter((q) => q.volumen > 15);
      setSonando({
        cuentas: new Set(fuertes.filter((q) => !q.yo && q.cuenta).map((q) => q.cuenta!)),
        yo: fuertes.some((q) => q.yo),
      });
    }).then((o) => {
      if (!vivo) void o.remove();
      else quitar = () => o.remove();
    });
    return () => {
      vivo = false;
      void quitar?.();
    };
  }, [estado]);

  // ── renovar el token antes de que corte la voz ──────────────────────────
  useEffect(() => {
    if (estado !== "dentro") return;
    let quitar: (() => Promise<void>) | null = null;
    let vivo = true;
    void alCaducarElToken(() => {
      void renovarToken(canal).catch(() => {
        // Si no se puede renovar, la voz se va a cortar y hay que decirlo: un
        // micrófono que deja de funcionar sin aviso es el peor fallo posible
        // aquí, y este proyecto ya lo ha pagado con las alarmas.
        if (vivo) setError("Se perdió el permiso de la sala. Vuelve a entrar.");
      });
    }).then((o) => {
      if (!vivo) void o.remove();
      else quitar = () => o.remove();
    });
    return () => {
      vivo = false;
      void quitar?.();
    };
  }, [canal, estado]);

  // ── si Agora nos suelta, decirlo y salir de verdad ─────────────────────
  //
  // Sin esto, si la red se caía veinte minutos o el token caducaba sin
  // renovarse, Agora se rendía y la pantalla seguía diciendo «estás
  // escuchando», con el aviso fijo de la sala en la barra y la ficha en la
  // lista de los demás.
  useEffect(() => {
    if (estado !== "dentro") return;
    let quitar: (() => Promise<void>) | null = null;
    let vivo = true;
    void alCambiarLaRed((red) => {
      if (!vivo) return;
      if (red === 4) setError("Reconectando…");
      else if (red === 3) setError((e) => (e === "Reconectando…" ? "" : e));
      else if (red === 5) {
        void salirDeSala();
        setError("Se perdió la conexión con la sala. Vuelve a entrar.");
        setEstado("fuera");
      }
    }).then((o) => {
      if (!vivo) void o.remove();
      else quitar = () => o.remove();
    });
    return () => {
      vivo = false;
      void quitar?.();
    };
  }, [estado]);

  // ── la palabra caduca: se renueva mientras se tiene ─────────────────────
  //
  // Quien habla sin ser el anfitrión recibe un privilegio de hablar de cinco
  // minutos (PALABRA_SEGUNDOS en el portero). Cada dos se pide otra vez el
  // papel: si sigue teniendo la palabra, sigue hablando; si se la quitaron y
  // el aviso se perdió, aquí se entera y se calla.
  useEffect(() => {
    if (estado !== "dentro" || !habla || esAnfitrion) return;
    const id = window.setInterval(() => {
      void cambiarDePapel(canal)
        .then((sigue) => {
          if (sigue) return;
          setHabla(false);
          setMicroAbierto(false);
        })
        .catch(() => {
          // Un fallo de red no calla a nadie: quedan tres minutos de margen y
          // se vuelve a intentar dentro de dos.
        });
    }, 120_000);
    return () => clearInterval(id);
  }, [estado, habla, esAnfitrion, canal]);

  // ── la campana: suena en cada móvil al llegar la hora ───────────────────
  //
  // Cada móvil la hace sonar por su cuenta: la sala dice el instante y todos
  // lo leen. No hay push ni servidor: quien está dentro tiene la app abierta.
  // Quien entra después de la hora no la oye —ya pasó— y a un mismo instante
  // no se suena dos veces aunque la sala se repinte.
  const campanaCuando = sala?.campana?.activa ? sala.campana.cuando : 0;
  useEffect(() => {
    if (estado !== "dentro" || !campanaCuando) return;
    if (campanaSonada.current === campanaCuando) return;
    const falta = campanaCuando - Date.now();
    // Un minuto de tolerancia: la hora la pone el reloj del anfitrión y cada
    // móvil la compara con el suyo. Con cinco segundos, un móvil adelantado
    // unos segundos no oía «Sonar ahora» nunca.
    if (falta < -60_000) return;
    const id = window.setTimeout(() => {
      campanaSonada.current = campanaCuando;
      // Suave y corta: dos segundos de campana a poco volumen, sin la
      // vibración larga de las alarmas.
      sonar("campana", 0.3);
      window.setTimeout(parar, 2200);
      vibrar([120, 80, 120]);
      setAvisoCampana("🔔 Se acabó el tiempo. Cierra tu comentario, por favor.");
      window.setTimeout(() => setAvisoCampana(""), 25_000);
    }, Math.max(0, falta));
    return () => clearTimeout(id);
  }, [campanaCuando, estado]);

  // La hora que edita el anfitrión sigue a la de la sala cuando llega de fuera.
  useEffect(() => {
    if (sala?.campana) setHoraCampana(horaDe(sala.campana.cuando));
  }, [sala?.campana]);

  // ── quién habla, con memoria ─────────────────────────────────────────────
  //
  // Alex, 28-09-2026: «cuando alguien hable en la lectura, debe verse la foto
  // que colocó de perfil». El nivel de voz sube y baja entre palabras; sin
  // dos segundos de memoria el retrato aparecería y desaparecería a cada
  // sílaba.
  useEffect(() => {
    const ahora = gente
      .filter((g) => (g.uid === quienSoy.uid ? sonando.yo : sonando.cuentas.has(g.uid)))
      .map((g) => g.uid);
    if (ahora.length > 0) {
      setFoco(ahora);
      return;
    }
    const id = window.setTimeout(() => setFoco([]), 2000);
    return () => clearTimeout(id);
  }, [sonando, gente, quienSoy.uid]);

  const yo = useMemo(() => gente.find((g) => g.uid === quienSoy.uid), [gente, quienSoy.uid]);

  // ── el anfitrión terminó, o me sacó ─────────────────────────────────────
  //
  // Hasta la 6.21, «Sacarlo de la sala» borraba la ficha pero el expulsado
  // seguía oyendo (y hablando) hasta que saliera él; y al cerrar la sala los
  // de dentro no se enteraban. Ahora, en cuanto la sala deja de estar abierta
  // o mi ficha desaparece de la lista, se suelta el audio y se sale.
  useEffect(() => {
    if (estado !== "dentro") return;
    if (sala?.abierta) {
      salaEstuvoAbierta.current = true;
      return;
    }
    if (!salaEstuvoAbierta.current) return;
    // Un subgrupo que se cierra es que vuelven todos: de vuelta al devocional
    // (lo hace la tarjeta del subgrupo). También el anfitrión, si estaba de visita.
    if (sala?.tipo === "subgrupo") return;
    if (esAnfitrion) return;
    void salirDeSala();
    setError("El anfitrión terminó el devocional. Gracias por venir.");
    setEstado("fuera");
  }, [sala?.abierta, estado, esAnfitrion]);

  useEffect(() => {
    if (estado !== "dentro") return;
    if (gente.some((g) => g.uid === quienSoy.uid)) {
      estuveEnLaLista.current = true;
      return;
    }
    if (!estuveEnLaLista.current) return;
    void salirDeSala();
    setError(
      sala && !sala.abierta
        ? "El anfitrión terminó el devocional. Gracias por venir."
        : "El anfitrión te sacó de la sala.",
    );
    setEstado("fuera");
  }, [gente, estado, quienSoy.uid, sala]);

  // ── la lectura por turnos ────────────────────────────────────────────────
  //
  // El orden y el devocional se ESCUCHAN, no se leen una vez: el día lo pega
  // quien modera a las 4:55 con la sala ya abierta, una cuenta se vincula con
  // la sala en marcha, y un fallo de red al entrar se arregla solo cuando
  // vuelve la red. Quien no es de la comunidad no puede leerlos: escucha y ya.
  const falloDe = (e: unknown): "red" | "permiso" =>
    String((e as { code?: string })?.code ?? "").includes("permission-denied") ? "permiso" : "red";

  useEffect(() => {
    if (estado !== "dentro" || sala?.tipo !== "devocional") return;
    return escucharOrden(
      (o) => {
        setOrdenLectura(o);
        setOrdenFallo("");
      },
      (e) => setOrdenFallo(falloDe(e)),
    );
  }, [estado, reintento, sala?.tipo]);

  const diaLectura =
    sala?.tipo !== "devocional" ? null : (sala?.lectura?.dia ?? (esAnfitrion ? diaDelPlan() : null));
  useEffect(() => {
    if (estado !== "dentro" || diaLectura == null) return;
    setDevLectura((d) => (d?.dia === diaLectura ? d : undefined));
    return escucharDia(
      diaLectura,
      (d, provisional) => {
        setDevLectura(d);
        setDevProvisional(!!provisional);
        setDevFallo("");
      },
      (e) => setDevFallo(falloDe(e)),
    );
  }, [estado, diaLectura, reintento]);

  /**
   * Quién puede leer ahora: tiene su cuenta vinculada en la lista, está en la
   * sala y hoy no dijo «sólo escucho». Es lo que en el grupo son el 🟢 y el 👂.
   */
  //
  // Tampoco quien tiene el micrófono cerrado por el anfitrión: vería «Te toca»
  // y no podría hablar. Y en el móvil del anfitrión, que es el que reasigna,
  // tampoco quien se cayó del canal (su ficha sigue ahí) ni quien ya no es de
  // la comunidad (no ve el texto).
  const puedeLeer = (l: Lector) =>
    !!l.uid &&
    gente.some((g) => g.uid === l.uid && !g.escucha && !g.silenciado) &&
    !(esAnfitrion && caidos.has(l.uid)) &&
    !(esAnfitrion && miembrosUids && !miembrosUids.has(l.uid) && l.uid !== sala?.anfitrion);

  // Quién es de la comunidad: lo sabe quien modera, y es el anfitrión. En vivo
  // (quien se une con la sala abierta entra en los turnos) y sólo con lo que
  // confirma el servidor; sin dato, no se filtra.
  useEffect(() => {
    if (estado !== "dentro" || !esAnfitrion) return;
    return escucharMiembros(setMiembrosUids, () => setMiembrosUids(null));
  }, [estado, esAnfitrion]);

  // La lista de ahora, para los avisos que llegan fuera del repintado.
  const genteAhora = useRef(gente);
  genteAhora.current = gente;
  // Quién se cayó del canal, por Agora: Firestore no se entera.
  useEffect(() => {
    if (estado !== "dentro" || !esAnfitrion) return;
    return verLlegadasYSalidas({
      alEntrar: (c) =>
        setCaidos((m) => {
          if (!m.has(c)) return m;
          const r = new Map(m);
          r.delete(c);
          return r;
        }),
      alSalir: (c) => setCaidos((m) => new Map(m).set(c, genteAhora.current.find((g) => g.uid === c)?.entro ?? -1)),
    });
  }, [estado, esAnfitrion]);
  // Y si volvió a entrar (su ficha es otra: otra `entro`), deja de estar caído.
  // Se compara la ficha con la que tenía al caerse, no relojes de dos móviles.
  useEffect(() => {
    setCaidos((m) => {
      let cambio = false;
      const r = new Map(m);
      for (const [c, entroAlCaer] of m) {
        const f = gente.find((g) => g.uid === c);
        if (f && f.entro !== entroAlCaer) {
          r.delete(c);
          cambio = true;
        }
      }
      return cambio ? r : m;
    });
  }, [gente]);
  // A quién se ha oído, y cuándo (con el reloj de este móvil). La voz propia
  // viene aparte: sin ella, al anfitrión que lee le saltaba «¿sigue ahí?».
  useEffect(() => {
    const ahora = Date.now();
    for (const c of sonando.cuentas) oidoEn.current.set(c, ahora);
    if (sonando.yo && quienSoy.uid) oidoEn.current.set(quienSoy.uid, ahora);
  }, [sonando]);
  useEffect(() => {
    const d = sala?.lectura?.desde ?? 0;
    if (d !== lecturaVistaEn.current.desde) lecturaVistaEn.current = { desde: d, local: Date.now() };
  }, [sala?.lectura?.desde]);

  // Si me toca leer, el texto se abre solo: es lo que voy a leer en voz alta.
  const meToca = sala?.lectura?.lectorUid === quienSoy.uid && !!quienSoy.uid;
  useEffect(() => {
    if (meToca) setVerTexto(true);
  }, [meToca, sala?.lectura?.trozo]);

  /**
   * Cuántos trozos tiene la lectura. Lo fija el anfitrión al empezarla, para
   * que todos sepan a la vez cuándo se acaba aunque a alguien no le haya
   * cargado el texto.
   */
  const totalDe = (l: Lectura) =>
    l.total ?? (devLectura && devLectura.dia === l.dia ? devLectura.trozos.length : 0);

  // Los mandos del anfitrión esperan un segundo y medio tras cada movimiento:
  // si el lector acaba de decir «Terminé», su «Siguiente» ya no salta un trozo
  // sin querer. (La transacción de `moverLectura` es la otra mitad.)
  useEffect(() => {
    if (!sala?.lectura) return;
    setCalma(true);
    const t = setTimeout(() => setCalma(false), 1500);
    return () => clearTimeout(t);
  }, [sala?.lectura?.desde]);

  /** Pasar el turno: el trozo siguiente, al siguiente de la lista que puede leer. */
  const pasarTurno = async () => {
    const l = sala?.lectura;
    if (!l || pasando) return;
    setPasando(true);
    try {
      // Sin el orden no se sabe quién sigue: se intenta leerlo en el momento, y
      // si no hay manera, se pasa el trozo sin lector y el anfitrión elige.
      const orden = ordenLectura ?? (await leerOrden().catch(() => null));
      const total = totalDe(l);
      const acaba = total > 0 && l.trozo + 1 >= total;
      const sig = acaba || !orden ? null : siguienteLector(orden.lista, puestoVivo(orden.lista, l), puedeLeer);
      const nueva = {
        ...l,
        trozo: l.trozo + 1,
        puesto: sig?.puesto ?? l.puesto,
        lector: sig?.lector.id ?? "",
        lectorUid: sig?.lector.uid ?? "",
        desde: Date.now(),
      };
      // Las reglas sólo dejan pasárselo a quien está dentro. Si el siguiente
      // acaba de salir y esta pantalla aún no lo sabe, se pasa sin lector y el
      // anfitrión lo reasigna en unos segundos: mejor que un «Terminé» que falla.
      const hecho = await moverLectura(canal, l, nueva).catch(async (e) => {
        if (!String((e as { code?: string })?.code ?? "").includes("permission-denied") || !nueva.lectorUid) throw e;
        return moverLectura(canal, l, { ...nueva, lector: "", lectorUid: "" });
      });
      if (hecho && !acaba && !orden) setError("Pasó el turno, pero sin el orden de lectura: el anfitrión elige quién sigue.");
      // Si no se hizo es que ya se había movido (otro toque, o el anfitrión):
      // no es un error y no se dice nada.
    } catch {
      setError("No se pudo pasar el turno. Mira tu conexión.");
    } finally {
      setPasando(false);
    }
  };

  /** Mover la lectura desde los mandos del anfitrión, con aviso si falla. */
  const moverDesdeAqui = (l: Lectura, cambios: Partial<Lectura>) => {
    void moverLectura(canal, l, { ...l, ...cambios, desde: Date.now() }).catch(() =>
      setError("No se pudo mover la lectura. Mira tu conexión."),
    );
  };

  // ── el lector de turno ya no está ────────────────────────────────────────
  //
  // Se fue, se le cayó la red, dijo «sólo escucho» o no hay nadie asignado:
  // la lectura se quedaba en «Lee X» hasta que el anfitrión se diera cuenta.
  // En el móvil del anfitrión —el único que puede reasignar— se pasa solo al
  // siguiente que está. Al que se fue se le dan 20 segundos, porque volver a
  // entrar tras un corte borra y crea la ficha y una ausencia corta es normal;
  // a quien dijo «sólo escucho» o a nadie, tres.
  const lecturaViva = sala?.lectura;
  const totalViva = lecturaViva ? totalDe(lecturaViva) : 0;
  const acabadaViva = !!lecturaViva && totalViva > 0 && lecturaViva.trozo >= totalViva;
  const fichaDelLector = lecturaViva?.lectorUid ? gente.find((g) => g.uid === lecturaViva.lectorUid) : undefined;
  const lectorFalta: "" | "nadie" | "fuera" | "caido" | "escucha" | "silenciado" | "nomiembro" =
    !lecturaViva || acabadaViva
      ? ""
      : !lecturaViva.lectorUid
        ? "nadie"
        : !fichaDelLector
          ? "fuera"
          : esAnfitrion && caidos.has(lecturaViva.lectorUid)
            ? "caido"
            : fichaDelLector.escucha
              ? "escucha"
              : fichaDelLector.silenciado
                ? "silenciado"
                : esAnfitrion &&
                    miembrosUids &&
                    !miembrosUids.has(lecturaViva.lectorUid) &&
                    lecturaViva.lectorUid !== sala?.anfitrion
                  ? "nomiembro"
                  : "";
  const hayQuienLea = !!ordenLectura?.lista.some(puedeLeer);
  const alDia = useRef({ lectura: lecturaViva, orden: ordenLectura, puedeLeer });
  alDia.current = { lectura: lecturaViva, orden: ordenLectura, puedeLeer };
  useEffect(() => {
    // Sólo dentro: con la sala «fuera» (se cayó la red) no se toca nada, y el
    // aviso de desconexión no se tapa con uno de turnos.
    // Y quieto con los subgrupos en marcha: los lectores están en sus grupos, no
    // se han ido, y a la vuelta la lectura sigue donde estaba.
    if (estado !== "dentro" || !esAnfitrion || !lectorFalta || !hayQuienLea || sala?.subgrupos) return;
    const t = setTimeout(
      () => {
        const { lectura: l, orden, puedeLeer: puede } = alDia.current;
        if (!l || !orden) return;
        const sig = siguienteLector(orden.lista, puestoVivo(orden.lista, l), (e) => puede(e) && e.uid !== l.lectorUid);
        if (!sig) return;
        void moverLectura(canal, l, {
          ...l,
          puesto: sig.puesto,
          lector: sig.lector.id,
          lectorUid: sig.lector.uid ?? "",
          desde: Date.now(),
        }).catch(() => {
          // Si falla (la red a las 5 de la mañana), se vuelve a armar, y se
          // dice: la tarjeta promete que pasa solo.
          setError("No se pudo pasar el turno solo. Vuelve a probar en unos segundos, o toca «Otro lee».");
          setReintentoVigia((n) => n + 1);
        });
      },
      // Si su ficha no está, 20 s: volver a entrar tras un corte la borra y la
      // crea, y una ausencia corta es normal. Si Agora ya dijo que se cayó
      // (lo dice unos 20 s después de perder la red), 5. Lo demás, 3.
      lectorFalta === "fuera" ? 20_000 : lectorFalta === "caido" ? 5_000 : 3_000,
    );
    return () => clearTimeout(t);
  }, [estado, esAnfitrion, lectorFalta, hayQuienLea, lecturaViva?.desde, canal, reintentoVigia, !!sala?.subgrupos]);

  // ── «me gusta» y amistades ───────────────────────────────────────────────
  //
  // Los «me gusta» de ESTA sesión de la sala (su `desde`: la reunión usa
  // siempre el mismo canal). Los que llegan nuevos hacen subir un corazón, y a
  // quien lo recibe se le dice. Un par se celebra una sola vez por sesión:
  // quitarlo y volver a darlo no llena la sala de corazones.
  const sesion = sala?.desde ?? 0;
  useEffect(() => {
    if (estado !== "dentro" || !sesion) return;
    let base: Set<string> | null = null;
    const celebrados = new Set<string>();
    const temporizadores: number[] = [];
    const deja = verGustos(canal, sesion, (lista) => {
      if (base) {
        for (const x of lista) {
          const id = `${x.de}_${x.a}`;
          if (base.has(id) || celebrados.has(id)) continue;
          celebrados.add(id);
          if (bloqueadosAhora.current.has(x.de)) continue;
          const clave = `${id}-${x.cuando}`;
          setCorazones((c) => [...c, { id: clave, a: x.a }]);
          temporizadores.push(window.setTimeout(() => setCorazones((c) => c.filter((y) => y.id !== clave)), 1500));
          if (x.a === quienSoy.uid) {
            const quien = genteAhora.current.find((g) => g.uid === x.de)?.nombre ?? "Alguien";
            setAvisoGusto(`❤️ A ${quien} le gustó lo que dijiste`);
            // Uno nuevo alarga el aviso; no lo corta el temporizador del anterior.
            if (avisoGustoHasta.current) window.clearTimeout(avisoGustoHasta.current);
            avisoGustoHasta.current = window.setTimeout(() => setAvisoGusto(""), 4000);
          }
        }
      } else {
        base = new Set(lista.map((x) => `${x.de}_${x.a}`));
      }
      setGustos(lista);
    });
    return () => {
      deja();
      temporizadores.forEach((t) => window.clearTimeout(t));
      if (avisoGustoHasta.current) window.clearTimeout(avisoGustoHasta.current);
    };
  }, [estado, canal, sesion]);

  // Mis amistades en vivo: una solicitud que llega con la sala abierta se ve
  // al momento («Aceptar»). Y los bloqueados, una vez.
  useEffect(() => {
    if (estado !== "dentro" || !quienSoy.uid) return;
    void leerBloqueados()
      .then(setBloqueados)
      .catch(() => {});
    return escucharAmigos(quienSoy.uid, setAmigos);
  }, [estado, quienSoy.uid]);
  bloqueadosAhora.current = bloqueados;

  const cuantosGustos = useMemo(() => contarGustos(gustos), [gustos]);
  const meGusta = (a: string) => gustos.some((x) => x.de === quienSoy.uid && x.a === a);
  const tocarGusto = (a: string) =>
    void darGusto(canal, sesion, quienSoy.uid, a, !meGusta(a)).catch(() =>
      setError("No se pudo dar el «me gusta». Mira tu conexión."),
    );
  /** Agregar (o aceptar, si me lo pidió). Devuelve si salió. */
  const agregar = async (g: Dentro): Promise<boolean> => {
    try {
      await agregarOAceptar(quienSoy, {
        uid: g.uid,
        nombre: g.nombre,
        usuario: g.usuario,
        ...(g.foto ? { foto: g.foto } : {}),
      });
      return true;
    } catch {
      return false;
    }
  };
  /** Con quién comparto la sala y aún no somos nada (ni solicitud), sin los bloqueados. */
  const porAgregar = amigos
    ? gente.filter((g) => g.uid !== quienSoy.uid && !amigos.has(g.uid) && !bloqueados.has(g.uid))
    : [];

  // ── el video suena: micrófonos cerrados ─────────────────────────────────
  //
  // Un micrófono abierto con el altavoz reenviaría el video a todos, con eco.
  // Mientras suena se cierra —el de cada uno, también si alguien lo abre o se
  // lo abre un cambio de papel—; para hablar, se pausa. Al acabar no se abre
  // solo: abrirlo es un gesto de cada uno.
  // Suena = en marcha y sin haber pasado del final: con la duración en la sala,
  // al acabar el video los micrófonos se liberan aunque el anfitrión no esté
  // mirando (antes la sala se quedaba en «play» y nadie podía hablar). Un
  // temporizador repinta justo cuando termina, que si no nada cambia.
  const [, setFinDelVideo] = useState(0);
  const videoSuena = sala?.tipo !== "llamada" && videoSonando(sala?.video, ahoraServidor());
  useEffect(() => {
    const v = sala?.video;
    if (!v || v.estado !== "play" || !v.dur) return;
    const ms = (v.dur - (v.pos + Math.max(0, ahoraServidor() - v.en) / 1000)) * 1000;
    if (ms <= 0) return;
    const t = window.setTimeout(() => setFinDelVideo((n) => n + 1), ms + 600);
    return () => window.clearTimeout(t);
  }, [sala?.video?.estado, sala?.video?.pos, sala?.video?.en, sala?.video?.dur]);
  useEffect(() => {
    if (estado !== "dentro" || !videoSuena || !microAbierto) return;
    setMicroAbierto(false);
    void miMicro(false);
  }, [estado, videoSuena, microAbierto]);

  // ── me silenciaron ───────────────────────────────────────────────────────
  useEffect(() => {
    if (estado !== "dentro" || !yo?.silenciado) return;
    setMicroAbierto(false);
    void miMicro(false);
  }, [yo?.silenciado, estado]);

  // ── el anfitrión me dio o me quitó la palabra ───────────────────────────
  useEffect(() => {
    if (estado !== "dentro" || !yo) return;
    if (palabraAnterior.current === null) {
      palabraAnterior.current = yo.palabra;
      return;
    }
    if (palabraAnterior.current === yo.palabra) return;
    palabraAnterior.current = yo.palabra;
    void (async () => {
      // Me quitaron la palabra (y los micrófonos no están libres): PRIMERO
      // callarse, sin esperar al portero. Si se esperara y la red fallara,
      // seguiría publicando con la pantalla diciéndome que tengo la palabra.
      if (!yo.palabra && !sala?.micLibre) {
        setHabla(false);
        setMicroAbierto(false);
        await callarme().catch(() => {});
      }
      try {
        // El papel va firmado en el token, así que cambiar de papel es pedir otro.
        const ahoraHabla = await cambiarDePapel(canal);
        setHabla(ahoraHabla);
        if (ahoraHabla && !yo.silenciado) {
          setMicroAbierto(true);
          await miMicro(true);
        }
      } catch (e) {
        setError(
          String((e as { message?: string })?.message ?? e).includes("sin-microfono")
            ? MENSAJE_SIN_MICROFONO
            : "No se pudo cambiar tu turno. Sal y vuelve a entrar.",
        );
        if (String((e as { message?: string })?.message ?? e).includes("sin-microfono")) {
          setSinMicrofono(true);
        }
      }
    })();
    // `sala.micLibre` se lee en el momento; no es lo que dispara esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yo?.palabra, canal, estado, yo]);

  /**
   * El anfitrión soltó o recogió los micrófonos.
   *
   * El permiso de hablar viaja firmado en el token, así que hay que pedir otro.
   * Y al recibirlo con los micrófonos libres, **el propio queda cerrado**: como
   * en WhatsApp, cada uno lo abre cuando le toca. Treinta micrófonos que se
   * abren solos a la vez no es una lectura, es un ruido. Distinto de cuando el
   * anfitrión le da la palabra a alguien en concreto, que sí se abre — ahí se la
   * dio para que hable ya.
   */
  const micLibreAnterior = useRef<boolean | null>(null);
  useEffect(() => {
    if (estado !== "dentro" || esAnfitrion || !sala) return;
    const libre = sala.micLibre === true;
    if (micLibreAnterior.current === null) {
      micLibreAnterior.current = libre;
      return;
    }
    if (micLibreAnterior.current === libre) return;
    micLibreAnterior.current = libre;
    void (async () => {
      // Recogieron los micrófonos y no tengo la palabra: callarse YA, antes
      // del portero (ver el efecto de la palabra).
      if (!libre && !yo?.palabra) {
        setHabla(false);
        setMicroAbierto(false);
        await callarme().catch(() => {});
      }
      try {
        const ahoraHabla = await cambiarDePapel(canal);
        setHabla(ahoraHabla);
        setMicroAbierto(false);
        if (ahoraHabla) await miMicro(false);
      } catch {
        setError("No se pudo cambiar tu turno. Sal y vuelve a entrar.");
      }
    })();
    // `yo.palabra` se lee en el momento; no es lo que dispara esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala?.micLibre, sala, canal, estado, esAnfitrion]);

  // ── los botones, para la sala y para la ventanita ─────────────────────

  /** Abrir o cerrar el micrófono propio, como el botón grande. */
  const cambiarMicro = () => {
    // Mientras suena el video no se abre (lo cerraría el efecto de abajo y
    // parecería roto, sobre todo desde la ventanita); cerrarlo sí se puede.
    if (!microAbierto && videoSuena) {
      setError("Suena el video: para hablar, que el anfitrión lo pause.");
      return;
    }
    if (yo?.silenciado) {
      setError("El anfitrión cerró tu micrófono. Levanta la mano si quieres hablar.");
      return;
    }
    const nuevo = !microAbierto;
    setMicroAbierto(nuevo);
    void miMicro(nuevo);
  };

  /** Salir, como el botón rojo. */
  const salirDeLaSala = () => {
    // Si el anfitrión sale y ya no queda nadie más, la sala se cierra sola:
    // una sala abierta y vacía aparece en «Juntos» como «sonando ahora» y
    // cada minuto que alguien pase dentro lo paga Alex. Con los grupos fuera
    // está solo, y es lo normal: no se cierra (a la vuelta encontrarían la
    // sala cerrada). Un grupo tampoco lo cierra su visita: lo cierran el
    // tiempo o «Traer a todos».
    if (
      esAnfitrion &&
      sala?.abierta &&
      !sala?.subgrupos &&
      sala?.tipo !== "subgrupo" &&
      gente.every((g) => g.uid === quienSoy.uid)
    ) {
      void cerrarSala(canal).catch(() => {});
    }
    onSalir();
  };

  // ── la ventanita flotante (6.27) ─────────────────────────────────────────
  //
  // Alex, 28-09-2026: «cuando una llamada esté activa, tengamos la opción de
  // poder salir de la aplicación, y que quede un recuadro flotante con la
  // posibilidad de abrir y cerrar el micrófono. Al estilo de Google Meet».
  // Mientras estás dentro, salir de la app la encoge a una ventanita con sus
  // botones (ver MainActivity). Aquí se le dice qué enseñar, y lo que se toca
  // en ella hace lo mismo que los botones de abajo.
  const microDeVerdad = habla && microAbierto && !yo?.silenciado;
  useEffect(() => {
    if (estado !== "dentro") return;
    void ponerFlotante({
      activo: true,
      habla,
      micro: microDeVerdad,
      mano: !!yo?.mano,
      // Con el video sonando, el micro de la ventanita sale apagado.
      silenciado: !!yo?.silenciado || videoSuena,
    });
  }, [estado, habla, microDeVerdad, yo?.mano, yo?.silenciado, videoSuena]);
  // Al salir de la sala (o de esta pantalla), fuera la ventanita.
  useEffect(() => () => void ponerFlotante({ activo: false }), []);
  // Los botones de la ventanita, con lo último de la sala: una referencia y
  // no el efecto de cada render, para no darse de alta y de baja sin parar.
  const tocarVentanita = useRef<(accion: "micro" | "mano" | "salir") => void>(() => {});
  tocarVentanita.current = (accion) => {
    if (accion === "micro" && habla) cambiarMicro();
    else if (accion === "mano") void mano(canal, !yo?.mano);
    else if (accion === "salir") salirDeLaSala();
  };
  useEffect(() => alTocarLaVentanita((accion) => tocarVentanita.current(accion)), []);
  // La reunión terminó con la app encogida: la ventanita se va sola a los
  // pocos segundos, como en Meet al acabar la llamada. Si sólo se cayó la red
  // o falló la entrada, se queda: al tocarla se ve qué hacer.
  // (El mismo «terminó» que la tarjeta de fuera, más abajo.)
  const terminoEnVentanita =
    ventanita &&
    estado === "fuera" &&
    (error.startsWith("El anfitrión terminó") ||
      (!(sala?.padre ?? padre) && (error.startsWith("El anfitrión") || error === "La sala está cerrada.")));
  useEffect(() => {
    if (!terminoEnVentanita) return;
    const t = window.setTimeout(() => void cerrarVentanita(), 4_000);
    return () => window.clearTimeout(t);
  }, [terminoEnVentanita]);

  // ── lo que se ve ────────────────────────────────────────────────────────

  if (!hayVoz()) {
    return (
      <Tarjeta>
        <Etiqueta>la sala de voz</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed">
          Las salas funcionan en la app de Android. En el navegador no se puede
          prometer que el audio entre en todos los aparatos, y una sala que falla
          a la hora del devocional es peor que no tenerla.
        </p>
        <div className="mt-3">
          <Boton ancho onClick={onSalir}>
            Volver
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  if (estado === "entrando") {
    // En la ventanita, en pequeño: pasar a un subgrupo con la app encogida
    // pintaba aquí la sala entera en unos pocos centímetros.
    if (ventanita) return <VentanitaAviso titulo={nombreSiHayQueAbrirla ?? "La sala"} texto="Entrando…" />;
    return <Vacio>Entrando en la sala…</Vacio>;
  }

  // ── la sala de una reunión que todavía nadie ha abierto ────────────────
  if (estado === "sin-abrir") {
    return (
      <Tarjeta className={puedoAbrirla ? "border-acento/50" : undefined}>
        <Etiqueta>{nombreSiHayQueAbrirla ?? "la sala"}</Etiqueta>
        {puedoAbrirla ? (
          <>
            <p className="mt-2 text-sm leading-relaxed">
              Esta reunión todavía no está abierta. Ábrela y los hermanos la verán
              en «Juntos» al momento.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-tenue">
              Entrarás tú hablando y los demás escuchando. Para que alguien
              comente, levanta la mano y tú le das la palabra.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Boton
                variante="fuerte"
                ancho
                deshabilitado={abriendo}
                onClick={async () => {
                  setAbriendo(true);
                  setError("");
                  try {
                    // La campana nace a la hora en que acaba la reunión, si se
                    // sabe y aún no pasó; el anfitrión la mueve o la apaga dentro.
                    await abrirSala(canal, nombreSiHayQueAbrirla!, "devocional", campanaPrevista(finPrevisto));
                    setSala(await leerSala(canal));
                    setEstado("entrando");
                    // Ya no se puede volver atrás desde aquí, así que el guardia
                    // es que la pantalla siga montada.
                    await entrar(() => true);
                  } catch {
                    setError("No se pudo abrir la sala. Mira tu conexión.");
                    setAbriendo(false);
                  }
                }}
              >
                {abriendo ? "Abriendo…" : "Abrir la reunión y entrar"}
              </Boton>
              <Boton ancho onClick={onSalir}>
                Ahora no
              </Boton>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed">
              Todavía no la han abierto. Vuelve cuando empiece — en cuanto el
              anfitrión la abra, aparece en «Juntos».
            </p>
            <div className="mt-3">
              <Boton ancho onClick={onSalir}>
                Volver
              </Boton>
            </div>
          </>
        )}
        {error ? (
          <p className="mt-2 text-sm leading-relaxed text-fallo">{error}</p>
        ) : null}
      </Tarjeta>
    );
  }

  if (estado === "fuera") {
    const alDevocional = sala?.padre ?? padre;
    // Viniendo de un subgrupo, sólo «terminó el devocional» es terminar: un
    // grupo cerrado, vencido, o que te sacaran de él, se arregla volviendo a
    // la sala principal. Sin grupo, «La sala está cerrada» al volver sí lo es.
    const termino =
      error.startsWith("El anfitrión terminó") ||
      (!alDevocional && (error.startsWith("El anfitrión") || error === "La sala está cerrada."));
    const seCayo = error.startsWith("Se perdió la conexión");
    // En la ventanita no se pueden tocar los botones: se dice qué pasó y, si
    // la reunión terminó, se cierra sola (efecto de arriba).
    if (ventanita) {
      return (
        <VentanitaAviso
          titulo={termino ? "La reunión terminó" : seCayo ? "Se perdió la conexión" : "Fuera de la sala"}
          texto="Toca para volver a Genuino"
        />
      );
    }
    return (
      <Tarjeta className={termino ? "border-acento/40" : "border-fallo/40"}>
        <Etiqueta>
          {termino
            ? "la reunión terminó"
            : seCayo
              ? "fuera de la sala"
              : alDevocional
                ? "fuera del grupo"
                : "no se pudo entrar"}
        </Etiqueta>
        <p className="mt-2 text-sm leading-relaxed">{error}</p>
        <div className="mt-3 flex flex-col gap-2">
          {error === MENSAJE_SIN_MICROFONO ? (
            <Boton ancho onClick={() => void abrirAjustesDeLaApp()}>
              Abrir los ajustes de Genuino
            </Boton>
          ) : null}
          {alDevocional && onIrA && !termino ? (
            // Si falla la entrada a un subgrupo, no se sale de todo: se vuelve
            // al devocional (y no se reenvía al grupo en bucle).
            <Boton
              variante="fuerte"
              ancho
              onClick={() => {
                marcarVuelta(canal);
                onIrA({ canal: alDevocional, nombre: "Devocional" });
              }}
            >
              Volver a la sala principal
            </Boton>
          ) : null}
          <Boton ancho onClick={onSalir}>
            {alDevocional && onIrA && !termino ? "Salir del devocional" : "Volver"}
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  // Todas las manos menos la del anfitrión: también la de quien tiene la
  // palabra o los micrófonos libres, que pide turno para comentar.
  const manos = gente.filter((g) => g.mano && g.uid !== sala?.anfitrion);
  const conLaPalabra = gente.filter((g) => g.palabra || g.uid === sala?.anfitrion);

  // ── el letrero de la lectura ───────────────────────────────────────────
  const lectura = sala?.lectura;
  const totalLectura = lectura ? totalDe(lectura) : 0;
  const trozoActual = lectura && devLectura?.dia === lectura.dia ? devLectura.trozos[lectura.trozo] : undefined;
  const lecturaAcabada = acabadaViva;
  const lectorActual = lectura && ordenLectura ? ordenLectura.lista.find((e) => e.id === lectura.lector) : undefined;
  /**
   * El nombre de quien lee: el de la lista, o si no hay lista (quien no es de
   * la comunidad no la puede leer), el de su ficha en la sala.
   */
  const nombreLector = lectorActual?.nombre ?? fichaDelLector?.nombre;
  const esUltimo = !!lectura && totalLectura > 0 && lectura.trozo + 1 >= totalLectura;
  const siguiente =
    lectura && ordenLectura && !lecturaAcabada && !esUltimo
      ? siguienteLector(ordenLectura.lista, puestoVivo(ordenLectura.lista, lectura), puedeLeer)
      : null;
  /** Al anfitrión: quien lee no se ha oído desde que le tocó, pasado un rato. */
  const vista = lecturaVistaEn.current;
  const sigueAhi =
    esAnfitrion &&
    lectura &&
    !lecturaAcabada &&
    lectura.lectorUid &&
    lectorFalta === "" &&
    vista.desde === lectura.desde &&
    Date.now() - vista.local > 45_000
      ? (oidoEn.current.get(lectura.lectorUid) ?? 0) < vista.local
      : false;
  /** Se corrigió el devocional con la lectura en marcha y ya no cuadra el número de turnos. */
  const totalNuevo =
    lectura && devLectura && devLectura.dia === lectura.dia && lectura.total && devLectura.trozos.length !== lectura.total
      ? devLectura.trozos.length
      : null;
  /** «Isaías 16:1-5», o, si el texto no ha cargado, el número del trozo. */
  const refActual = trozoActual?.ref ?? (lectura ? `trozo ${lectura.trozo + 1}` : "");
  const hoyISO = (() => {
    const f = new Date();
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  })();
  const comentaHoy = ordenLectura ? comentaristaDe(ordenLectura, hoyISO) : null;

  return (
    <div className="flex flex-col gap-4">
      {ventanita ? (
        <Ventanita
          nombre={sala?.nombre ?? "Sala"}
          hablan={gente.filter((g) => foco.includes(g.uid))}
          yoUid={quienSoy.uid}
          habla={habla}
          micro={microDeVerdad}
          mano={!!yo?.mano}
          cuantos={gente.length}
        />
      ) : null}
      {/* Dentro de un subgrupo: cuál, con quién, cuánto queda, y volver. */}
      {sala?.tipo === "subgrupo" && sala.padre ? (
        <EnSubgrupo
          sala={sala}
          gente={gente}
          onVolver={() => onIrA?.({ canal: sala.padre!, nombre: "Devocional" })}
        />
      ) : null}
      {/*
        «Ver juntos» con video (6.27): ANTES del letrero de la lectura, que es
        pegajoso y taparía el reproductor al bajar (YouTube no deja nada encima).
      */}
      {sala && sala.tipo !== "llamada" && sala.video ? (
        <VerJuntos canal={canal} sala={sala} esAnfitrion={esAnfitrion} />
      ) : null}
      {/*
        El letrero de la lectura por turnos, arriba y pegado mientras se baja.

        Alex, 28-09-2026: «debe salir un letrero sutil arriba para que la
        persona sepa que le toca, y también quién es el próximo en leer». Sutil:
        una línea, que no tape nada; el texto del trozo se despliega si se toca
        —y solo, a quien le toca, porque es lo que va a leer en voz alta.
      */}
      {lectura ? (
        <div
          className="sticky z-20 -mx-4 bg-fondo/95 px-4 pt-1 pb-2 backdrop-blur"
          // Debajo de la barra de estado: la sala se dibuja bajo ella.
          style={{ top: "env(safe-area-inset-top, 0px)" }}
          aria-live="polite"
        >
          {lecturaAcabada ? (
            <div className="rounded-xl border border-logro/40 bg-logro/10 px-3 py-2 text-sm">
              ✓ Terminó la lectura.
              {comentaHoy ? (
                <>
                  {" "}
                  Comenta hoy: <strong>{comentaHoy.uid === quienSoy.uid ? "tú" : comentaHoy.nombre}</strong>
                </>
              ) : null}
            </div>
          ) : (
            <div
              className={`rounded-xl border px-3 py-2 ${
                meToca ? "border-acento bg-acento/15" : "border-borde bg-superficie"
              }`}
            >
              <button
                onClick={() => setVerTexto(!verTexto)}
                className="flex w-full items-center gap-2 text-left"
                aria-expanded={verTexto}
              >
                <span className="min-w-0 flex-1">
                  {meToca ? (
                    <span className="block text-sm font-semibold text-acento">📖 Te toca leer · {refActual}</span>
                  ) : lectorFalta === "nadie" ? (
                    <span className="block truncate text-sm">Buscando quién lee · {refActual}</span>
                  ) : lectorFalta ? (
                    <span className="block truncate text-sm">
                      <strong>{nombreLector ?? "Quien leía"}</strong>{" "}
                      {lectorFalta === "escucha"
                        ? "sólo escucha"
                        : lectorFalta === "silenciado"
                          ? "tiene el micrófono cerrado"
                          : lectorFalta === "nomiembro"
                            ? "no está en la comunidad"
                            : "no está"}{" "}
                      · pasa a otro
                    </span>
                  ) : (
                    <span className="block truncate text-sm">
                      Lee <strong>{nombreLector ?? "—"}</strong> · {refActual}
                    </span>
                  )}
                  <span className="block truncate text-xs text-tenue">
                    {siguiente
                      ? `Siguiente: ${siguiente.lector.uid === quienSoy.uid ? "tú" : siguiente.lector.nombre}`
                      : esUltimo
                        ? "Es el último trozo"
                        : ""}
                    {totalLectura > 0 ? `${siguiente || esUltimo ? " · " : ""}${lectura.trozo + 1} de ${totalLectura}` : ""}
                  </span>
                </span>
                {trozoActual ? <span className="shrink-0 text-xs text-tenue">{verTexto ? "▴" : "▾"}</span> : null}
              </button>
              {verTexto && trozoActual ? (
                <div className="mt-2 max-h-[45vh] overflow-y-auto border-t border-borde pt-2">
                  <TextoDevocional trozo={trozoActual} />
                </div>
              ) : null}
              {meToca && yo?.silenciado ? (
                // Con el micrófono cerrado no puede leer, y «Terminé» saltaría
                // el trozo sin que nadie lo leyera: el anfitrión lo pasa a otro.
                <p className="mt-2 text-sm leading-relaxed text-tenue">
                  El anfitrión cerró tu micrófono: el turno pasa al siguiente.
                </p>
              ) : meToca ? (
                <div className="mt-2">
                  <Boton
                    variante="logro"
                    ancho
                    // Con la calma: si el turno vuelve a caerle a él, un segundo
                    // toque no se salta el trozo siguiente.
                    deshabilitado={pasando || calma}
                    onClick={() => void pasarTurno()}
                  >
                    {pasando ? "Pasando…" : "Terminé ✓"}
                  </Boton>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* «Ver juntos» sin video: la tarjeta para ponerlo (sólo el anfitrión). */}
      {sala && sala.tipo !== "llamada" && !sala.video ? (
        <VerJuntos canal={canal} sala={sala} esAnfitrion={esAnfitrion} />
      ) : null}

      <Tarjeta className="relative overflow-hidden">
        {/* La luz de la sala: un halo de oro que se enciende cuando alguien habla. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-40 w-[120%] -translate-x-1/2 transition-opacity duration-700"
          style={{
            background: "radial-gradient(closest-side, var(--luz-oro), transparent)",
            opacity: foco.length > 0 ? 1 : 0.45,
          }}
        />
        <span className="relative flex items-center gap-2">
          <span className="orbe-vivo" aria-hidden />
          <Etiqueta>
            {sala?.tipo === "llamada" ? "llamada" : sala?.tipo === "subgrupo" ? "subgrupo" : "devocional"} ·{" "}
            {gente.length}{" "}
            {gente.length === 1 ? "dentro" : "dentro"}
          </Etiqueta>
        </span>
        <h2 className="relative mt-1 text-xl font-semibold">{sala?.nombre ?? "Una sala"}</h2>
        {sala?.tipo === "devocional" ? (
          <p className="font-cita relative mt-2 text-[13px] leading-relaxed text-tenue italic">
            «{VERSICULO_SALA.texto}» <span className="not-italic">{VERSICULO_SALA.ref}</span>
          </p>
        ) : null}

        {/*
          El estado propio, en grande y sin ambigüedad.

          Alguien que cree tener el micrófono abierto y no lo tiene se pasa el
          devocional hablándole a nadie. Es el fallo más fácil de cometer aquí y
          el más humillante de descubrir, así que ocupa sitio.
        */}
        <p
          className={`mt-3 text-sm leading-relaxed ${habla ? "text-logro" : "text-tenue"}`}
        >
          {yo?.silenciado
            ? "El anfitrión cerró tu micrófono. Cuando te lo abra, podrás hablar."
            : sala?.tipo === "subgrupo" && habla
              ? microAbierto
                ? "Se te está oyendo en el grupo."
                : "Aquí hablan todos: abre tu micrófono cuando quieras."
            : habla
              ? microAbierto
                ? sonando.yo
                  ? "Tienes la palabra y se te está oyendo."
                  : "Tienes la palabra. Habla."
                : sala?.micLibre && !esAnfitrion
                  ? "Micrófonos libres: abre el tuyo cuando te toque leer. Para comentar, levanta la mano."
                  : "Tienes la palabra, pero tu micrófono está cerrado."
              : "Estás escuchando. Levanta la mano para comentar."}
        </p>

        {/*
          «Hoy sólo escucho» 👂: la lectura por turnos se lo salta. En el grupo
          es el 👂🏻 de la lista; aquí lo decide cada uno, con un toque.
        */}
        {!esAnfitrion && sala?.tipo === "devocional" && ordenLectura ? (
          <button
            onClick={() =>
              void soloEscucho(canal, !yo?.escucha).catch(() => setError("No se pudo cambiar. Mira tu conexión."))
            }
            // Con el turno en la mano no: primero se termina el trozo. Si no,
            // el trozo se quedaba sin nadie que lo leyera.
            disabled={meToca && !yo?.escucha}
            className={`toque mt-3 rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
              yo?.escucha ? "border-acento bg-acento/10 text-acento" : "border-borde text-tenue"
            }`}
            aria-pressed={!!yo?.escucha}
          >
            {yo?.escucha
              ? "👂 Hoy sólo escucho · toca para leer"
              : meToca
                ? "👂 Termina tu trozo y luego podrás sólo escuchar"
                : "👂 Hoy sólo escucho"}
          </button>
        ) : null}

        {!esAnfitrion && sala?.tipo === "devocional" && (ordenFallo === "permiso" || devFallo === "permiso") ? (
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Para leer por turnos y ver el texto hay que estar en la comunidad: Juntos → comunidad de voz → Unirme.
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm leading-relaxed text-fallo">{error}</p>
        ) : null}
        {/*
          Sin permiso del micrófono se escucha igual, pero para hablar hace
          falta. Android deja de preguntar tras dos negativas, así que se da el
          botón a los ajustes de la app, que es el único sitio donde se arregla.
        */}
        {sinMicrofono ? (
          <div className="mt-3 rounded-xl border border-acento/40 bg-acento/5 p-3">
            <p className="text-sm leading-relaxed">{MENSAJE_SIN_MICROFONO}</p>
            <div className="mt-2">
              <Boton ancho onClick={() => void abrirAjustesDeLaApp()}>
                Abrir los ajustes de Genuino
              </Boton>
            </div>
          </div>
        ) : null}
        {avisoCampana ? (
          <p className="aparece mt-3 rounded-xl border border-acento/50 bg-acento/10 px-3 py-2 text-sm text-acento">
            {avisoCampana}
          </p>
        ) : null}
      </Tarjeta>

      {/*
        Quien habla, en grande: su foto con el aro verde y su racha 🔥 abajo a
        la derecha. Alex, 28-09-2026: «que se vea CLARAMENTE, sin que tape la
        lectura de los demás mientras escuchan». Por eso es una franja encima
        de la lista y no una capa sobre la pantalla: hasta tres retratos, y si
        nadie habla no ocupa nada.
      */}
      {foco.length > 0 ? (
        <div className="flex items-start justify-center gap-5 py-1" aria-live="polite">
          {foco.slice(0, 3).map((uid) => {
            const g = gente.find((x) => x.uid === uid);
            if (!g) return null;
            return (
              <div key={uid} className="aparece flex w-24 flex-col items-center gap-1.5">
                <span className="relative">
                  <span className="flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-logro bg-superficie-alta text-2xl ring-4 ring-logro/30">
                    {g.foto ? (
                      <img
                        src={g.foto}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      g.nombre.trim().charAt(0).toUpperCase() || "·"
                    )}
                  </span>
                  {corazones
                    .filter((c) => c.a === g.uid)
                    .map((c) => (
                      <span key={c.id} className="corazon-sube text-2xl" aria-hidden>
                        ❤️
                      </span>
                    ))}
                  {typeof g.racha === "number" ? (
                    <span
                      className="absolute -right-2 -bottom-1 flex items-center rounded-full border border-acento/60 bg-fondo px-1.5 py-0.5 text-xs font-semibold text-acento shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                      aria-label={`${g.racha} días seguidos`}
                    >
                      🔥{g.racha}
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-center text-xs">
                  {g.uid === quienSoy.uid ? "Tú" : g.nombre}
                </span>
                {/* Mientras habla: «me gusta» y «agregar», a la vista (6.26). */}
                <AccionesDeHermano
                  g={g}
                  yo={quienSoy.uid}
                  gustos={cuantosGustos.get(g.uid) ?? 0}
                  meGusta={meGusta(g.uid)}
                  amistad={amigos?.get(g.uid)}
                  sinAgregar={!amigos || bloqueados.has(g.uid)}
                  onGusto={() => tocarGusto(g.uid)}
                  onAgregar={() => void agregar(g).then((ok) => !ok && setError(`No se pudo agregar a ${g.nombre}. Mira tu conexión.`))}
                  apilado
                />
              </div>
            );
          })}
        </div>
      ) : null}
      {avisoGusto ? (
        <p className="aparece text-center text-sm text-acento" aria-live="polite">
          {avisoGusto}
        </p>
      ) : null}

      {/*
        Los micrófonos, para el anfitrión: con permiso o libres.

        Alex, el 27-09-2026: «me gusta que el que quiera abrir el micrófono pida
        permiso. Pero cuando viene la lectura, todos deben poder abrir y cerrar
        el micrófono sin mi permiso porque sería muy tedioso. Esa opción debe
        estar a un lado y yo elijo cuándo se activa».

        Va aquí, a la vista, y no en un menú: se cambia varias veces en un mismo
        devocional — libres para leer por turnos, con permiso para comentar.
      */}
      {/*
        Llamar a la comunidad: que suenen los móviles de los apuntados.

        Es lo que Alex pidió como VITAL el 27-09-2026. Va arriba del todo de lo
        que puede hacer el anfitrión, porque es lo primero que hace al abrir:
        abre, llama, y espera a que entren. Lo decide el portero: si quien
        toca no modera, vuelve con su motivo escrito.
      */}
      {esAnfitrion && sala?.tipo === "devocional" ? (
        <Tarjeta className="border-acento/50">
          <Etiqueta>la comunidad</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Hace sonar el móvil de todos los que se apuntaron, aunque tengan la
            app cerrada.
          </p>
          <div className="mt-3">
            <Boton
              variante="fuerte"
              ancho
              deshabilitado={llamando}
              onClick={async () => {
                setLlamando(true);
                setAvisoLlamada("");
                try {
                  // Cuantos van a sonar, ANTES de llamar. El 27-09-2026 Alex llamo
                  // a un tema vacio —Google acepta un aviso aunque nadie este
                  // apuntado— y el boton le dijo «Llamando» a nadie. Decir el
                  // numero convierte un silencio en un dato; y si es cero, no
                  // hay a quien llamar y se dice eso.
                  const cuantos = await cuantosMiembros();
                  if (cuantos === 0) {
                    setAvisoLlamada(
                      "Nadie se ha apuntado todavía a la comunidad. Que entren en Juntos y toquen «Unirme»; entonces sí les sonará.",
                    );
                    setLlamando(false);
                    return;
                  }
                  const r = await llamarALaComunidad(canal, sala?.nombre ?? "Devocional");
                  // Con la lista de cada uno (6.27), el informe dice a quién le
                  // sonó. Sin ella —un portero viejo—, lo de antes, sin prometer
                  // que suena: «Llamando a 2» no sabe si sonó.
                  setLlamadaHecha(r.enviado && r.resultados ? r : null);
                  setAvisoLlamada(
                    r.enviado
                      ? r.resultados
                        ? ""
                        : "Llamada enviada a la comunidad."
                      : r.porque,
                  );
                } finally {
                  // Pase lo que pase, el botón vuelve: «Llamando…» para
                  // siempre obligaba a salir de la sala.
                  setLlamando(false);
                }
              }}
            >
              {llamando ? "Llamando…" : "Llamar a la comunidad"}
            </Boton>
          </div>
          {llamadaHecha ? <InformeDeLlamada llamada={llamadaHecha} /> : null}
          {avisoLlamada ? (
            <p className="mt-2 text-xs leading-relaxed text-acento">{avisoLlamada}</p>
          ) : null}
        </Tarjeta>
      ) : null}

      {esAnfitrion && sala?.tipo === "devocional" ? (
        <Tarjeta>
          <Etiqueta>micrófonos de los demás</Etiqueta>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Boton
              variante={sala?.micLibre ? "normal" : "fuerte"}
              ancho
              onClick={() => void ponerMicLibre(canal, false)}
            >
              Con permiso
            </Boton>
            <Boton
              variante={sala?.micLibre ? "logro" : "normal"}
              ancho
              onClick={() => void ponerMicLibre(canal, true)}
            >
              Libres
            </Boton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            {sala?.micLibre
              ? "Cualquiera puede abrir el suyo. Para la lectura por turnos."
              : "Levantan la mano y tú das la palabra. Para comentar sin pisarse."}
          </p>
        </Tarjeta>
      ) : null}

      {/* Los subgrupos: armarlos (anfitrión) o ir al tuyo (los demás). */}
      {sala?.tipo === "devocional" && onIrA ? (
        <Subgrupos
          canal={canal}
          sala={sala}
          gente={gente}
          miUid={quienSoy.uid}
          esAnfitrion={esAnfitrion}
          onIrA={onIrA}
        />
      ) : null}

      {/*
        La lectura por turnos, para el anfitrión. Se reparte el devocional del
        día, trozo a trozo, en el orden de la lista, entre quienes están dentro
        con su cuenta vinculada y no dijeron «sólo escucho». El que lee dice
        «Terminé» y pasa solo; aquí están el resto de los mandos.
      */}
      {esAnfitrion && sala?.tipo === "devocional" ? (
        <Tarjeta>
          <Etiqueta>lectura por turnos</Etiqueta>
          {!ordenLectura && ordenFallo ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-fallo">
                {ordenFallo === "permiso"
                  ? "Tu cuenta no puede leer el orden de lectura."
                  : "No se pudo leer el orden de lectura. Mira tu conexión."}
              </p>
              <div className="mt-2">
                <Boton onClick={() => setReintento((n) => n + 1)}>Reintentar</Boton>
              </div>
            </>
          ) : ordenLectura === undefined ? (
            <p className="mt-2 text-sm text-tenue">Cargando el orden de lectura…</p>
          ) : ordenLectura === null ? (
            <p className="mt-2 text-sm leading-relaxed text-tenue">
              Falta el orden de lectura. Se pone en Juntos → orden de lectura.
            </p>
          ) : !lectura && devLectura === undefined ? (
            devFallo ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-fallo">
                  {devFallo === "permiso"
                    ? "Tu cuenta no puede leer el devocional."
                    : "No se pudo leer el devocional de hoy. Mira tu conexión."}
                </p>
                <div className="mt-2 flex gap-2">
                  <Boton onClick={() => setReintento((n) => n + 1)}>Reintentar</Boton>
                  <Boton variante="fantasma" onClick={() => setPegando(true)}>
                    Pegarlo
                  </Boton>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-tenue">Cargando el devocional de hoy…</p>
            )
          ) : !lectura && devLectura === null ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-tenue">
                El devocional del día {diaLectura} todavía no está. Pégalo aquí —el mismo Bloque 1 que mandas al
                grupo— y la lectura se reparte al momento.
              </p>
              <div className="mt-3">
                <Boton variante="fuerte" ancho onClick={() => setPegando(true)}>
                  Pegar el devocional de hoy
                </Boton>
              </div>
            </>
          ) : !lectura && devLectura ? (
            <>
              <p className="mt-2 text-sm leading-relaxed">
                Día {devLectura.dia}: {devLectura.trozos.length} trozos para{" "}
                {ordenLectura.lista.filter(puedeLeer).length} lectores en la sala.
              </p>
              {!sala?.micLibre ? (
                <p className="mt-1 text-xs leading-relaxed text-tenue">
                  Los micrófonos están con permiso: suéltalos arriba para que cada uno abra el suyo al leer.
                </p>
              ) : null}
              {devProvisional ? (
                <p className="mt-1 text-xs leading-relaxed text-tenue">
                  Es la copia del móvil: esperando al servidor para empezar, por si el día se corrigió.
                </p>
              ) : null}
              <div className="mt-3">
                <Boton
                  variante="fuerte"
                  ancho
                  deshabilitado={!ordenLectura.lista.some(puedeLeer) || devProvisional}
                  onClick={() => {
                    const sig = siguienteLector(ordenLectura.lista, -1, puedeLeer);
                    void ponerLectura(canal, {
                      plan: PLAN,
                      dia: devLectura.dia,
                      trozo: 0,
                      total: devLectura.trozos.length,
                      puesto: sig?.puesto ?? -1,
                      lector: sig?.lector.id ?? "",
                      lectorUid: sig?.lector.uid ?? "",
                      desde: Date.now(),
                    }).catch(() => setError("No se pudo empezar la lectura."));
                  }}
                >
                  Empezar la lectura
                </Boton>
              </div>
              {!ordenLectura.lista.some(puedeLeer) ? (
                <p className="mt-2 text-xs leading-relaxed text-tenue">
                  Nadie de la lista está dentro con su cuenta vinculada. Vincúlalas en Juntos → orden de lectura.
                </p>
              ) : null}
              <button
                onClick={() => setPegando(true)}
                className="toque mt-2 text-xs text-tenue underline underline-offset-2"
              >
                Corregir el devocional de hoy
              </button>
            </>
          ) : lectura ? (
            <>
              <p className="mt-2 text-sm leading-relaxed">
                {lecturaAcabada
                  ? "La lectura terminó."
                  : `Trozo ${lectura.trozo + 1}${totalLectura ? ` de ${totalLectura}` : ""} · ${
                      lectorFalta === "nadie"
                        ? "nadie asignado: toca «Otro lee»"
                        : lectorFalta === "fuera"
                          ? `${nombreLector ?? "quien leía"} no está: pasa solo al siguiente en unos segundos`
                          : lectorFalta === "caido"
                            ? `${nombreLector ?? "quien leía"} se desconectó: pasa al siguiente`
                            : lectorFalta === "escucha"
                              ? `${nombreLector ?? "quien leía"} sólo escucha: pasa al siguiente`
                              : lectorFalta === "silenciado"
                                ? `${nombreLector ?? "quien leía"} tiene el micrófono cerrado: pasa al siguiente`
                                : lectorFalta === "nomiembro"
                                  ? `${nombreLector ?? "quien leía"} ya no está en la comunidad: pasa al siguiente`
                                  : `lee ${nombreLector ?? "nadie"}`
                    }.`}
              </p>
              {sigueAhi ? (
                <p className="mt-1 text-xs leading-relaxed text-acento">
                  ¿Sigue ahí {nombreLector ?? "quien lee"}? No se le oye desde que le tocó. Si no responde, «Otro lee».
                </p>
              ) : null}
              {!lecturaAcabada && !sala?.micLibre ? (
                <div className="mt-2 rounded-lg border border-borde px-3 py-2 text-xs leading-relaxed">
                  Los micrófonos están con permiso: quien lee no se oirá si no le das la palabra.
                  <div className="mt-2">
                    <Boton
                      onClick={() =>
                        void ponerMicLibre(canal, true).catch(() => setError("No se pudieron soltar los micrófonos."))
                      }
                    >
                      Soltar los micrófonos
                    </Boton>
                  </div>
                </div>
              ) : null}
              {totalNuevo != null ? (
                <div className="mt-2 rounded-lg border border-acento/40 px-3 py-2 text-xs leading-relaxed">
                  El devocional se corrigió: ahora tiene {totalNuevo} turnos y la lectura contaba {lectura.total}.
                  <div className="mt-2">
                    <Boton
                      onClick={() =>
                        moverDesdeAqui(lectura, { total: totalNuevo, trozo: Math.min(lectura.trozo, totalNuevo) })
                      }
                    >
                      Ajustar a {totalNuevo}
                    </Boton>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Boton
                  deshabilitado={lectura.trozo === 0 || calma}
                  onClick={() => {
                    // Vuelve a leer quien leyó el trozo de antes, si sigue; al
                    // volver desde el final, el que leyó el último.
                    const base = ordenLectura ? puestoVivo(ordenLectura.lista, lectura) : lectura.puesto;
                    const atras = ordenLectura
                      ? anteriorLector(ordenLectura.lista, lecturaAcabada ? base + 1 : base, puedeLeer)
                      : null;
                    moverDesdeAqui(lectura, {
                      trozo: Math.max(0, lectura.trozo - 1),
                      ...(atras
                        ? { puesto: atras.puesto, lector: atras.lector.id, lectorUid: atras.lector.uid ?? "" }
                        : {}),
                    });
                  }}
                >
                  ‹ Atrás
                </Boton>
                <Boton
                  deshabilitado={lecturaAcabada || calma}
                  onClick={() => {
                    // Otro lee este mismo trozo: el que tocaba no está, o no puede.
                    const sig = siguienteLector(
                      ordenLectura.lista,
                      puestoVivo(ordenLectura.lista, lectura),
                      (l) => puedeLeer(l) && l.id !== lectura.lector,
                    );
                    if (!sig) {
                      setError("No hay nadie más en la sala que pueda leer.");
                      return;
                    }
                    moverDesdeAqui(lectura, {
                      puesto: sig.puesto,
                      lector: sig.lector.id,
                      lectorUid: sig.lector.uid ?? "",
                    });
                  }}
                >
                  Otro lee
                </Boton>
                <Boton
                  variante="fuerte"
                  deshabilitado={lecturaAcabada || calma || pasando}
                  onClick={() => void pasarTurno()}
                >
                  Siguiente ›
                </Boton>
              </div>
              {lecturaAcabada && comentaHoy?.uid && gente.some((g) => g.uid === comentaHoy.uid) ? (
                <div className="mt-2">
                  <Boton
                    variante="logro"
                    ancho
                    onClick={() =>
                      void darLaPalabra(canal, comentaHoy.uid!, true).catch(() =>
                        setError("No se pudo darle la palabra. Mira tu conexión."),
                      )
                    }
                  >
                    Darle la palabra a {comentaHoy.nombre} para el comentario
                  </Boton>
                </div>
              ) : null}
              <div className="mt-2">
                <Boton
                  variante="fantasma"
                  ancho
                  onClick={() =>
                    void quitarLectura(canal).catch(() => setError("No se pudo quitar la lectura. Mira tu conexión."))
                  }
                >
                  Quitar la lectura
                </Boton>
              </div>
            </>
          ) : null}
        </Tarjeta>
      ) : null}

      {/*
        Pegar el devocional, encima de la sala pero DENTRO de ella (no en un
        portal): así queda por debajo de la pantalla de una alarma que suene
        mientras se pega.
      */}
      {pegando && diaLectura != null ? (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-fondo">
          <div className="zona-segura-arriba zona-segura-abajo mx-auto max-w-lg px-4 py-3">
            <PegarDevocional
              dia={diaLectura}
              existente={devLectura && devLectura.dia === diaLectura ? devLectura : null}
              onListo={(dev) => {
                if (dev.dia === diaLectura) {
                  setDevLectura(dev);
                  setDevProvisional(false);
                }
                setPegando(false);
              }}
              onCerrar={() => setPegando(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Las manos levantadas, arriba y en orden: es lo único que pide algo. */}
      {esAnfitrion && manos.length > 0 ? (
        <Tarjeta className="border-acento/50">
          <Etiqueta>quieren comentar · {manos.length}</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {manos
              .slice()
              .sort((a, b) => a.entro - b.entro)
              .map((g) => (
                <div key={g.uid} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{g.nombre}</span>
                  {/*
                    Si ya tiene la palabra, no hay nada que dar: sólo atender la
                    mano. `darLaPalabra(…, true)` escribe `mano: false` y, como la
                    palabra no cambia, no le pide un token nuevo.
                  */}
                  <Boton variante="fuerte" onClick={() => void darLaPalabra(canal, g.uid, true)}>
                    {g.palabra ? "Bajarle la mano" : "Darle la palabra"}
                  </Boton>
                </div>
              ))}
          </div>
        </Tarjeta>
      ) : null}

      {/*
        La campana del final, para el anfitrión. Alex, 28-09-2026: el devocional
        es de 5 a 6, los comentarios de 5:40 a 6:00, y «a las 6 debe sonar a
        todos en la llamada una campanita suave para alertar que el tiempo
        terminó. Yo debo tener el poder de apagarla y encenderla cuando quiera».
        La hora la elige él; «Sonar ahora» la hace sonar en todos al momento.
      */}
      {esAnfitrion && sala?.tipo === "devocional" ? (
        <Tarjeta>
          <Etiqueta>la campana</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            A esa hora suena suave en el móvil de todos: se acabó el tiempo, a cerrar el
            comentario.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={horaCampana}
              onChange={(e) => {
                setHoraCampana(e.target.value);
                if (sala?.campana?.activa && e.target.value) {
                  void ponerCampana(canal, { cuando: msDeHoy(e.target.value), activa: true });
                }
              }}
              className="rounded-xl border border-borde bg-superficie-alta px-3 py-2 text-sm"
              aria-label="Hora de la campana"
            />
            <Boton
              variante={sala?.campana?.activa ? "logro" : "normal"}
              onClick={() => {
                if (!horaCampana) {
                  setError("Pon primero la hora de la campana.");
                  return;
                }
                void ponerCampana(canal, {
                  cuando: msDeHoy(horaCampana),
                  activa: !sala?.campana?.activa,
                });
              }}
            >
              {sala?.campana?.activa ? "Encendida" : "Apagada"}
            </Boton>
            <Boton
              onClick={() => void ponerCampana(canal, { cuando: Date.now() + 1500, activa: true })}
            >
              Sonar ahora
            </Boton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            {sala?.campana?.activa
              ? sala.campana.cuando > Date.now()
                ? `Sonará a las ${horaDe(sala.campana.cuando)} en el móvil de todos los que estén dentro.`
                : `Sonó a las ${horaDe(sala.campana.cuando)}. Pon otra hora si hace falta.`
              : "Apagada: hoy no suena."}
          </p>
        </Tarjeta>
      ) : null}

      {/*
        Al terminar, para el anfitrión. Alex, 28-09-2026: «cuando finaliza el
        devocional hay hermanos que olvidan cerrar la llamada. Debí tener la
        opción de poder finalizar la llamada para todos». Cerrar la sala le
        corta la llamada a cada uno; silenciar a todos, para el cierre en
        oración. Terminar pide dos toques: no hay vuelta atrás.
      */}
      {esAnfitrion && sala?.tipo !== "subgrupo" ? (
        <Tarjeta className="border-fallo/30">
          <Etiqueta>al terminar</Etiqueta>
          <p className="mt-2 text-sm leading-relaxed">
            Terminar cierra la sala para todos: a cada uno se le corta la llamada, por si
            alguien olvidó salir.
          </p>
          <div className="mt-3 flex gap-2">
            <Boton
              ancho
              onClick={() => {
                gente
                  .filter((g) => g.uid !== quienSoy.uid && !g.silenciado)
                  .forEach((g) => void silenciar(canal, g.uid, true));
              }}
            >
              Cerrar todos los micros
            </Boton>
            <Boton
              variante="fallo"
              ancho
              onClick={async () => {
                if (!confirmarFin) {
                  setConfirmarFin(true);
                  window.setTimeout(() => setConfirmarFin(false), 6000);
                  return;
                }
                try {
                  await terminarParaTodos(canal);
                  onSalir();
                } catch {
                  setError("No se pudo cerrar la sala. Mira tu conexión.");
                }
              }}
            >
              {confirmarFin ? "¿Seguro? Toca otra vez" : "Terminar para todos"}
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Etiqueta>en la sala</Etiqueta>
        {/*
          El ánimo a agregarse: con quién compartes la sala y aún no son amigos.
          Un toque manda las solicitudes; cada uno acepta cuando quiera.
        */}
        {porAgregar.length > 0 || animoFijo ? (
          <AnimoAgregarse
            cuantos={porAgregar.length}
            onTodos={async () => {
              // Que la tarjeta siga montada para decir cómo fue: al salir bien,
              // `porAgregar` se vacía y se iba sin despedirse.
              setAnimoFijo(true);
              let fallos = 0;
              for (const g of porAgregar) if (!(await agregar(g))) fallos++;
              return fallos;
            }}
          />
        ) : null}
        <div className="mt-3 flex flex-col gap-1.5">
          {gente
            .slice()
            .sort((a, b) => a.entro - b.entro)
            .map((g) => {
              const suena = g.uid === quienSoy.uid ? sonando.yo : sonando.cuentas.has(g.uid);
              // Botón sólo cuando el anfitrión puede hacer algo con la fila;
              // para los demás, treinta botones que no hacen nada eran ruido
              // para el lector de pantalla y para el dedo.
              const tocable = esAnfitrion && g.uid !== quienSoy.uid;
              const Fila = tocable ? "button" : "div";
              return (
                <div key={g.uid}>
                  <Fila
                    onClick={tocable ? () => setTocando(tocando === g.uid ? null : g.uid) : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left"
                  >
                    {/*
                      El aro verde es el indicador de quien habla. Va en el
                      retrato y no en un icono aparte porque lo que se busca con
                      la vista es la cara, no una lista de estados.
                    */}
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full border bg-superficie-alta text-sm transition ${
                        suena ? "border-logro ring-2 ring-logro/60" : "border-borde text-tenue"
                      }`}
                    >
                      {g.foto ? (
                        <img
                          src={g.foto}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="size-full rounded-full object-cover"
                        />
                      ) : (
                        (g.nombre.trim().charAt(0).toUpperCase() || "·")
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {g.nombre}
                        {g.uid === quienSoy.uid ? " · tú" : ""}
                      </span>
                      <span className="block truncate text-xs text-tenue">
                        {g.uid === sala?.anfitrion
                          ? "anfitrión"
                          : g.silenciado
                            ? "micrófono cerrado por el anfitrión"
                            : g.palabra
                              ? g.mano
                                ? "tiene la palabra · pide comentar"
                                : "tiene la palabra"
                              : g.mano
                                ? "levantó la mano"
                                : sala?.micLibre
                                  ? "puede leer"
                                  : "escuchando"}
                      </span>
                    </span>
                    {/* Su racha 🔥 y sus faltas 😢 del devocional, para todos. */}
                    {typeof g.racha === "number" ? (
                      <span
                        className="shrink-0 text-xs"
                        aria-label={`${g.racha} días seguidos, ${g.faltas ?? 0} faltas`}
                      >
                        <span className="text-acento">🔥{g.racha}</span>
                        {g.faltas ? <span className="ml-1.5 text-tenue">😢{g.faltas}</span> : null}
                      </span>
                    ) : null}
                    {/* La mano vale también con la palabra puesta (Alex, 28-09). */}
                    {g.mano && g.uid !== sala?.anfitrion ? (
                      <span className="shrink-0 text-acento" aria-label="levantó la mano">
                        ✋
                      </span>
                    ) : null}
                  </Fila>
                  {/* En otra línea, bajo el nombre: en la misma, a 360 px el
                      nombre y el estado se quedaban en «Ma…» y «mic…». */}
                  <div className="-mt-1 mb-1 ml-12">
                    <AccionesDeHermano
                      g={g}
                      yo={quienSoy.uid}
                      gustos={cuantosGustos.get(g.uid) ?? 0}
                      meGusta={meGusta(g.uid)}
                      amistad={amigos?.get(g.uid)}
                      sinAgregar={!amigos || bloqueados.has(g.uid)}
                      onGusto={() => tocarGusto(g.uid)}
                      onAgregar={() =>
                        void agregar(g).then((ok) => !ok && setError(`No se pudo agregar a ${g.nombre}. Mira tu conexión.`))
                      }
                      compacto
                    />
                  </div>

                  {/* Lo que puede hacer el anfitrión, y sólo al tocar a alguien. */}
                  {tocando === g.uid ? (
                    <div className="mt-1 mb-2 ml-12 flex flex-col gap-2">
                      <Boton
                        ancho
                        onClick={() => {
                          void darLaPalabra(canal, g.uid, !g.palabra);
                          setTocando(null);
                        }}
                      >
                        {g.palabra ? "Quitarle la palabra" : "Darle la palabra"}
                      </Boton>
                      <Boton
                        ancho
                        onClick={() => {
                          void silenciar(canal, g.uid, !g.silenciado);
                          setTocando(null);
                        }}
                      >
                        {g.silenciado ? "Abrirle el micrófono" : "Cerrarle el micrófono"}
                      </Boton>
                      {/*
                        Dos formas de sacar, porque son dos cosas: quien se cayó
                        y quedó de fantasma (o se quedó dormido con la llamada
                        abierta) puede volver mañana; quien interrumpe, no.
                      */}
                      <Boton
                        ancho
                        onClick={() => {
                          void sacarDeLaLista(canal, g.uid);
                          setTocando(null);
                        }}
                      >
                        Sacarlo (puede volver)
                      </Boton>
                      <Boton
                        variante="fallo"
                        ancho
                        onClick={() => {
                          void expulsar(canal, g.uid);
                          setTocando(null);
                        }}
                      >
                        Sacarlo y que no vuelva
                      </Boton>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
        {conLaPalabra.length === 1 && gente.length > 3 && sala?.tipo === "devocional" ? (
          <p className="mt-3 text-xs leading-relaxed text-tenue">
            Sólo habla el anfitrión. Los demás escuchan hasta que él dé la palabra —
            treinta micrófonos abiertos no son un devocional.
          </p>
        ) : null}
      </Tarjeta>

      {/*
        Los botones, como en una llamada de WhatsApp: tres redondos, el del
        micrófono en medio, el de colgar en rojo. Alex, el 27-09-2026: «está
        bien que diga por escrito cuando está abierto o cerrado, pero más
        importante es que se vea gráficamente muy parecido al de WhatsApp. Así
        los que lo vean se van a familiarizar fácilmente». El texto se queda
        arriba, en la tarjeta; aquí manda el icono.

        En el medio va el micrófono si puedes hablar, y la mano si no: es el
        mismo sitio para «lo que puedes hacer ahora», y el pulgar lo aprende.

        Y si puedes hablar SIN ser el anfitrión —te dieron la palabra, o los
        micrófonos están libres para la lectura—, la mano sigue ahí, a un lado.
        Alex, el 28-09-2026: «la manito en las llamadas siempre debe estar
        disponible para pedir permiso para hablar». Con los micrófonos libres
        para leer por turnos, quien quiere COMENTAR pide turno con la mano, no
        abre el micro encima de la lectura. Al anfitrión no le hace falta: es
        él quien da la palabra.
      */}
      <div
        className={`flex items-start justify-center pt-2 ${
          habla && !esAnfitrion ? "gap-3" : "gap-6"
        }`}
      >
        <BotonRedondo
          etiqueta={altavoz ? "Altavoz" : "Auricular"}
          activo={altavoz}
          estrecho={habla && !esAnfitrion}
          onClick={() => {
            const nuevo = !altavoz;
            setAltavoz(nuevo);
            void porElAltavoz(nuevo);
          }}
        >
          <IconoAltavoz apagado={!altavoz} />
        </BotonRedondo>

        {habla ? (
          <BotonRedondo
            etiqueta={yo?.silenciado ? "Cerrado" : microAbierto ? "Silenciar" : "Abrir micro"}
            activo={microAbierto && !yo?.silenciado}
            grande
            estrecho={!esAnfitrion}
            onClick={cambiarMicro}
          >
            <IconoMicro tachado={!microAbierto || !!yo?.silenciado} />
          </BotonRedondo>
        ) : (
          <BotonRedondo
            etiqueta={yo?.mano ? "Bajar la mano" : "Pedir la palabra"}
            activo={!!yo?.mano}
            grande
            onClick={() => void mano(canal, !yo?.mano)}
          >
            <IconoMano />
          </BotonRedondo>
        )}

        {habla && !esAnfitrion && sala?.tipo !== "subgrupo" ? (
          <BotonRedondo
            etiqueta={yo?.mano ? "Bajar la mano" : "Pedir la palabra"}
            activo={!!yo?.mano}
            estrecho
            onClick={() => void mano(canal, !yo?.mano)}
          >
            <IconoMano />
          </BotonRedondo>
        ) : null}

        {/*
          Si el anfitrión sale y ya no queda nadie más, la sala se cierra sola:
          una sala abierta y vacía aparece en «Juntos» como «sonando ahora» y
          cada minuto que alguien pase dentro lo paga Alex. Si quedan hermanos
          no se cierra: puede seguir otro moderador, y para cortar a todos está
          «Terminar para todos».
        */}
        <BotonRedondo
          etiqueta="Salir"
          peligro
          estrecho={habla && !esAnfitrion}
          onClick={salirDeLaSala}
        >
          <IconoColgar />
        </BotonRedondo>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ la ventanita

/** Un aviso corto a toda la ventanita: entrando, o fuera de la sala. */
function VentanitaAviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-2 bg-fondo p-3 text-center">
      <p className="w-full truncate text-sm font-medium">{titulo}</p>
      <p className="text-xs text-tenue">{texto}</p>
    </div>
  );
}

/**
 * La sala en pequeño, para la ventanita flotante: la ventana es de unos
 * pocos centímetros y la página entera no se leería. Quién habla, con su
 * cara, y cómo está tu micrófono. Los botones los pone Android debajo.
 */
function Ventanita({
  nombre,
  hablan,
  yoUid,
  habla,
  micro,
  mano,
  cuantos,
}: {
  nombre: string;
  hablan: Dentro[];
  yoUid: string;
  habla: boolean;
  micro: boolean;
  mano: boolean;
  cuantos: number;
}) {
  const quien = hablan[0];
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-2 bg-fondo p-3 text-center">
      <p className="w-full truncate text-[10px] font-medium uppercase tracking-[0.12em] text-tenue">{nombre}</p>
      <span
        className={`flex size-16 items-center justify-center rounded-full border-2 bg-superficie-alta text-2xl ${
          quien ? "border-logro ring-4 ring-logro/40" : "border-borde text-tenue"
        }`}
      >
        {quien?.foto ? (
          <img src={quien.foto} alt="" referrerPolicy="no-referrer" className="size-full rounded-full object-cover" />
        ) : quien ? (
          quien.nombre.trim().charAt(0).toUpperCase() || "·"
        ) : (
          "🎧"
        )}
      </span>
      <p className="w-full truncate text-sm font-medium">
        {quien
          ? `${quien.uid === yoUid ? "Tú" : quien.nombre.split(" ")[0]}${hablan.length > 1 ? ` y ${hablan.length - 1} más` : ""}`
          : `${cuantos} dentro`}
      </p>
      <p className={`text-xs ${habla ? (micro ? "text-logro" : "text-fallo") : mano ? "text-acento" : "text-tenue"}`}>
        {habla ? (micro ? "Tu micro está abierto" : "Tu micro está cerrado") : mano ? "✋ Pediste la palabra" : "Escuchando"}
      </p>
    </div>
  );
}

// ------------------------------------------------------------ la campana

/** «06:00» de hoy, en milisegundos. */
function msDeHoy(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const f = new Date();
  f.setHours(h || 0, m || 0, 0, 0);
  return f.getTime();
}

/** Un instante como «06:00», en hora local. */
function horaDe(ms: number): string {
  const f = new Date(ms);
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/**
 * Con qué campana nace la sala: a la hora en que acaba la reunión, si se sabe
 * y todavía no pasó. Si ya pasó (se abre tarde), sin campana: el anfitrión la
 * pone si quiere.
 */
function campanaPrevista(fin?: string): Sala["campana"] {
  if (!fin) return undefined;
  const cuando = msDeHoy(fin);
  return cuando > Date.now() ? { cuando, activa: true } : undefined;
}

// ------------------------------------------------------------ los botones

/**
 * Un botón redondo con su etiqueta debajo, como los de una llamada.
 *
 * Los iconos van en SVG dentro del código y no como emojis: un emoji cambia de
 * dibujo según el móvil, y lo que se busca aquí es justo lo contrario — que el
 * micrófono se vea igual que en la app que ya conocen.
 */
function BotonRedondo({
  children,
  etiqueta,
  activo,
  grande,
  peligro,
  estrecho,
  onClick,
}: {
  children: React.ReactNode;
  etiqueta: string;
  activo?: boolean;
  grande?: boolean;
  peligro?: boolean;
  /** Con cuatro botones en fila caben en un móvil de 360 px sólo así. */
  estrecho?: boolean;
  onClick: () => void;
}) {
  const tamano = grande ? (estrecho ? "size-16" : "size-[72px]") : estrecho ? "size-[52px]" : "size-14";
  const color = peligro
    ? "bg-fallo text-sobre-color"
    : activo
      ? "bg-logro text-sobre-color"
      : "bg-superficie-alta text-texto border border-borde";
  return (
    <button
      onClick={onClick}
      className={`flex ${estrecho ? "w-16" : "w-20"} flex-col items-center gap-1.5`}
    >
      <span
        className={`flex ${tamano} items-center justify-center rounded-full transition active:scale-95 ${color}`}
      >
        {children}
      </span>
      <span className="text-center text-[11px] leading-tight text-tenue">{etiqueta}</span>
    </button>
  );
}

function IconoMicro({ tachado }: { tachado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      {tachado ? <path d="M4 4l16 16" strokeWidth={2.5} /> : null}
    </svg>
  );
}

function IconoAltavoz({ apagado }: { apagado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {apagado ? (
        <path d="M17 9l4 6M21 9l-4 6" />
      ) : (
        <>
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function IconoMano() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M17 13V9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3.6 14a1.6 1.6 0 0 1 2.6-1.8L8 14" />
    </svg>
  );
}

function IconoColgar() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
      <path d="M12 9c-2.6 0-5 .5-7.2 1.5a2 2 0 0 0-1.1 2.3l.6 2.2a1.5 1.5 0 0 0 1.9 1l2.6-.9a1.5 1.5 0 0 0 1-1.3l.1-1.6a12 12 0 0 1 4.2 0l.1 1.6a1.5 1.5 0 0 0 1 1.3l2.6.9a1.5 1.5 0 0 0 1.9-1l.6-2.2a2 2 0 0 0-1.1-2.3A17 17 0 0 0 12 9z" />
    </svg>
  );
}

/**
 * El motivo, dicho para una persona.
 *
 * Los que vienen de la Cloud Function ya están escritos así —«la sala está
 * cerrada»—, y los de aquí hay que traducirlos: `sin-microfono` no le dice nada
 * a nadie.
 */
/** Sin permiso del micrófono: se escucha igual, pero no se habla. */
const MENSAJE_SIN_MICROFONO =
  "Sin permiso del micrófono puedes escuchar, pero no hablar. Dáselo en los ajustes de Genuino → Permisos → Micrófono.";

function comoSeDice(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const codigo = String((e as { code?: string })?.code ?? "");
  if (m.includes("sin-microfono")) return MENSAJE_SIN_MICROFONO;
  if (codigo.includes("permission-denied") || m.includes("insufficient permissions")) {
    return "La app no tiene permiso para esta sala. Avisa a quien lleva la app: es cosa del servidor, no tuya.";
  }
  if (m.includes("solo-en-la-app")) return "Las salas funcionan en la app de Android.";
  if (m.includes("sin-cuenta")) return "Hace falta entrar con tu cuenta.";
  if (m.includes("no-se-pudo-entrar")) {
    return "No se pudo conectar con la sala. Mira tu conexión y vuelve a probar.";
  }
  // Lo que venga del portero ya está en español y dice el motivo de verdad.
  return m || "No se pudo entrar.";
}

/**
 * «Me gusta» y «Agregar» para una persona de la sala (6.26).
 *
 * El corazón cuenta los de todos y se enciende si es tuyo; se da o se quita.
 * «Agregar» manda la solicitud de amistad de siempre; si esa persona ya te la
 * mandó, «Aceptar»; si ya son amigos, 🤝. A uno mismo, sólo su cuenta.
 */
export function AccionesDeHermano({
  g,
  yo,
  gustos,
  meGusta,
  amistad,
  onGusto,
  onAgregar,
  compacto = false,
  apilado = false,
  sinAgregar = false,
}: {
  g: Dentro;
  yo: string;
  gustos: number;
  meGusta: boolean;
  amistad?: Amigo["estado"];
  onGusto: () => void;
  onAgregar: () => void;
  compacto?: boolean;
  /** En el retrato de quien habla: uno encima del otro, para caber en su columna. */
  apilado?: boolean;
  /** Sin botón de agregar: bloqueado, o todavía sin la lista de amistades. */
  sinAgregar?: boolean;
}) {
  const soyYo = g.uid === yo;
  const chico = compacto ? "h-8 px-2 text-xs" : "h-8 px-2.5 text-xs";
  return (
    <span
      className={`flex shrink-0 ${apilado ? "mt-0.5 flex-col items-center gap-1" : `items-center ${compacto ? "gap-1" : "gap-1.5"}`}`}
    >
      {soyYo ? (
        gustos > 0 ? (
          <span className={`flex items-center gap-1 ${chico} text-acento`} aria-label={`${gustos} me gusta`}>
            ❤️ {gustos}
          </span>
        ) : null
      ) : (
        <>
          <button
            onClick={onGusto}
            className={`toque flex items-center gap-1 rounded-full border ${chico} ${
              meGusta ? "border-acento/60 bg-acento/15 text-acento" : "border-borde text-tenue"
            }`}
            aria-pressed={meGusta}
            aria-label={meGusta ? `Quitar el me gusta a ${g.nombre}` : `Me gusta lo que dice ${g.nombre}`}
          >
            {meGusta ? "❤️" : "🤍"}
            {gustos > 0 ? <span className="cifras">{gustos}</span> : null}
          </button>
          {sinAgregar ? null : amistad === "aceptada" ? (
            <span className={`flex items-center ${chico} text-tenue`} aria-label={`${g.nombre} ya es tu amigo`}>
              🤝
            </span>
          ) : amistad === "enviada" ? (
            <span className={`flex items-center ${chico} text-tenue`} aria-label="Solicitud enviada">
              ✓
            </span>
          ) : (
            <button
              onClick={onAgregar}
              className={`toque flex items-center rounded-full border border-borde ${chico} ${
                amistad === "recibida" ? "border-logro/60 text-logro" : "text-tenue"
              }`}
              aria-label={amistad === "recibida" ? `Aceptar a ${g.nombre}` : `Agregar a ${g.nombre}`}
            >
              {amistad === "recibida" ? "Aceptar" : compacto ? "➕" : "➕ Agregar"}
            </button>
          )}
        </>
      )}
    </span>
  );
}

/**
 * El ánimo a agregarse, arriba de la lista de la sala. Se puede cerrar por
 * hoy: animar no es insistir.
 */
export function AnimoAgregarse({ cuantos, onTodos }: { cuantos: number; onTodos: () => Promise<number> }) {
  const hoy = new Date().toDateString();
  const [cerrado, setCerrado] = useState(() => {
    try {
      return localStorage.getItem("genuino.sala.animo") === hoy;
    } catch {
      return false;
    }
  });
  const [mandando, setMandando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [fallidos, setFallidos] = useState(0);
  const [alMandar, setAlMandar] = useState<number | null>(null);
  if (cerrado) return null;
  const n = alMandar ?? cuantos;
  return (
    <div className="mt-2 rounded-xl border border-acento/30 bg-acento/5 px-3 py-2 text-sm leading-relaxed">
      {hecho && !fallidos ? (
        <p>✓ Solicitudes enviadas. Cada uno te acepta cuando la vea.</p>
      ) : hecho ? (
        <p>
          No se pudo con {fallidos} {fallidos === 1 ? "de ellos" : "de ellos"}: mira tu conexión y vuelve a probar con
          el ➕ de cada uno.
        </p>
      ) : (
        <>
          <p>
            Compartes el devocional con {n}{" "}
            {n === 1 ? "hermano que aún no es tu amigo" : "hermanos que aún no son tus amigos"}. Agregarse es
            acompañarse también entre semana.
          </p>
          <div className="mt-2 flex gap-2">
            <Boton
              variante="fuerte"
              deshabilitado={mandando}
              onClick={async () => {
                setAlMandar(cuantos);
                setMandando(true);
                setFallidos(await onTodos());
                setMandando(false);
                setHecho(true);
              }}
            >
              {mandando ? "Mandando…" : n === 1 ? "Agregarlo" : "Agregar a todos"}
            </Boton>
            <Boton
              variante="fantasma"
              onClick={() => {
                try {
                  localStorage.setItem("genuino.sala.animo", hoy);
                } catch {
                  // Sin almacenamiento, se cierra sólo por ahora.
                }
                setCerrado(true);
              }}
            >
              Ahora no
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}
