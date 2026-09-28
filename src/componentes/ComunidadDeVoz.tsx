import { useEffect, useState } from "react";
import type { EstadoDespertador } from "@/logica/despertador";
import {
  abrirAjustesDeLaApp,
  abrirInicioAutomatico,
  estadoDespertador,
  hayInicioAutomatico,
  pedirExencionBateria,
  pedirPantallaCompleta,
} from "@/logica/despertador";
import { miUid, puedoModerar } from "@/logica/muro";
import { leerPerfil } from "@/logica/nube";
import {
  cuantosMiembros,
  hayTimbre,
  salirmeDeLaComunidad,
  soyMiembro,
  unirmeALaComunidad,
} from "@/logica/timbre";
import { Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * La comunidad de voz: entrar, salir, y saber que al entrar te va a sonar.
 *
 * ── Lo que se promete, dicho antes de apuntarse ───────────────────────────
 *
 * Que el móvil **suene** cuando el anfitrión llame, aunque la app esté
 * cerrada. Es lo que alguien acepta al unirse, y por eso está escrito encima
 * del botón y no en un aviso después: nadie debería enterarse de que su
 * teléfono suena a las tres de la mañana porque sonó.
 *
 * Y que salirse es un toque, sin preguntas. Una comunidad de la que cuesta
 * salir no es voluntaria.
 *
 * ── Sólo en la app ────────────────────────────────────────────────────────
 *
 * En la web no hay timbre, así que no se ofrece apuntarse: apuntar a alguien a
 * algo que no le puede sonar es mentirle. Se dice, y se manda a la app.
 */
export function ComunidadDeVoz() {
  const [estado, setEstado] = useState<"mirando" | "sin-cuenta" | "fuera" | "dentro">("mirando");
  const [quien, setQuien] = useState<{ nombre: string; usuario: string } | null>(null);
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  /**
   * Lo que le falta a ESTE móvil para que la llamada se vea, no sólo suene.
   *
   * Joseito, 27-09-2026, el primer timbre de verdad: «me estaba sonando el
   * teléfono, pero en ningún lado me aparecía nada visible. Tuve que buscar a
   * mano entre las notificaciones qué era lo que sonaba». El sonido llegó; la
   * pantalla no. En su Xiaomi faltaban los permisos de MIUI para que una app
   * en segundo plano pueda poner una ventana encima.
   *
   * Se mira al apuntarse —que es cuando alguien acaba de aceptar que le
   * suene— y se enseña sólo lo que falta, cada cosa con su botón. Igual que
   * hizo la pantalla del despertador después de que Joseito se quejara de los
   * siete pasos del candado.
   */
  const [despertador, setDespertador] = useState<EstadoDespertador | null>(null);
  const [inicioAuto, setInicioAuto] = useState<{ hay: boolean; fabricante: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const uid = await miUid();
      if (!vivo) return;
      if (!uid) {
        setEstado("sin-cuenta");
        return;
      }
      const [perfil, dentro, modero] = await Promise.all([
        leerPerfil(uid).catch(() => null),
        soyMiembro(),
        puedoModerar(),
      ]);
      if (!vivo) return;
      if (perfil) setQuien({ nombre: perfil.nombre, usuario: perfil.usuario });
      setEstado(dentro ? "dentro" : "fuera");
      if (dentro && hayTimbre()) void mirarElMovil();
      // Contar sólo lo puede quien modera; para los demás no es un dato que
      // necesiten, y las reglas no lo darían de todas formas.
      if (modero) setCuantos(await cuantosMiembros());
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const mirarElMovil = async () => {
    const [e, ia] = await Promise.all([
      estadoDespertador().catch(() => null),
      hayInicioAutomatico().catch(() => ({ hay: false, fabricante: "" })),
    ]);
    setDespertador(e);
    setInicioAuto(ia);
  };

  if (estado === "mirando" || estado === "sin-cuenta") return null;

  const cambiar = async () => {
    setOcupado(true);
    setAviso("");
    try {
      if (estado === "dentro") {
        await salirmeDeLaComunidad();
        setEstado("fuera");
        setAviso("Ya no te sonará. Puedes volver cuando quieras.");
      } else {
        if (!quien) {
          setAviso("Primero completa tu perfil en Mi cuenta.");
          return;
        }
        await unirmeALaComunidad(quien);
        setEstado("dentro");
        setAviso("Dentro. Cuando el anfitrión llame, te sonará.");
        if (hayTimbre()) void mirarElMovil();
      }
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? e);
      setAviso(
        m.startsWith("sin-avisos-de-google")
          ? "Tu móvil no pudo apuntarse a los avisos de Google. Suele ser Google Play Services desactualizado o sin permiso de avisos para Genuino. Actualiza Play Services en Play Store y vuelve a probar."
          : "No se pudo guardar. Mira tu conexión y vuelve a probar.",
      );
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta className={estado === "dentro" ? "border-logro/40" : undefined}>
      <Etiqueta>
        comunidad de voz{cuantos != null ? ` · ${cuantos}` : ""}
      </Etiqueta>

      {!hayTimbre() ? (
        <p className="mt-2 text-sm leading-relaxed">
          Apuntarse a la comunidad es desde la app de Android: es el móvil el que
          tiene que poder sonar.
        </p>
      ) : estado === "dentro" ? (
        <>
          <p className="mt-2 text-sm leading-relaxed">
            Estás dentro. Cuando el anfitrión abra el devocional y llame,{" "}
            <strong>tu móvil sonará</strong> aunque la app esté cerrada, y podrás
            entrar con un toque.
          </p>
          <div className="mt-3">
            <Boton ancho deshabilitado={ocupado} onClick={() => void cambiar()}>
              {ocupado ? "Un momento…" : "Salirme de la comunidad"}
            </Boton>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed">
            Si te unes, <strong>tu móvil sonará</strong> cada vez que el anfitrión
            llame al devocional — como una alarma, aunque la app esté cerrada.
            Entras a escuchar; para hablar, levantas la mano.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-tenue">
            Es voluntario y salirse es un toque. Sólo quien lleva la comunidad ve
            quién está apuntado; en la sala, los demás ven tu nombre, tu foto y tu racha.
          </p>
          <div className="mt-3">
            <Boton variante="fuerte" ancho deshabilitado={ocupado} onClick={() => void cambiar()}>
              {ocupado ? "Un momento…" : "Unirme, que me suene"}
            </Boton>
          </div>
        </>
      )}

      {aviso ? <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p> : null}

      {estado === "dentro" && despertador ? (
        <ParaQueSeVea despertador={despertador} inicioAuto={inicioAuto} />
      ) : null}
    </Tarjeta>
  );
}

/**
 * Lo que le falta a este móvil para que la llamada SE VEA, cada cosa con su
 * botón. Si no falta nada, no se pinta nada: una lista de cosas ya hechas es
 * ruido.
 */
function ParaQueSeVea({
  despertador,
  inicioAuto,
}: {
  despertador: EstadoDespertador;
  inicioAuto: { hay: boolean; fabricante: string } | null;
}) {
  const fabricante = (inicioAuto?.fabricante ?? despertador.fabricante ?? "").toLowerCase();
  const esXiaomi = /xiaomi|redmi|poco/.test(fabricante);

  const faltan: { que: string; porque: string; boton: string; hacer: () => void }[] = [];

  if (!despertador.puedePantallaCompleta) {
    faltan.push({
      que: "Dejar que encienda la pantalla",
      porque: "Sin esto la llamada suena pero no sale en la pantalla: queda como una notificación más y hay que buscarla.",
      boton: "Permitir pantalla completa",
      hacer: () => void pedirPantallaCompleta(),
    });
  }
  if (!despertador.exentaDeBateria) {
    faltan.push({
      que: "Sacar Genuino del ahorro de batería",
      porque: "Con la app congelada por el ahorro, el aviso de la llamada puede no llegar nunca.",
      boton: "Sacarla del ahorro de batería",
      hacer: () => void pedirExencionBateria(),
    });
  }
  if (inicioAuto?.hay) {
    faltan.push({
      que: "Inicio automático",
      porque: "Sin esto, con la app cerrada el móvil no la deja despertarse cuando llega la llamada.",
      boton: "Abrir inicio automático",
      hacer: () => void abrirInicioAutomatico(),
    });
  }
  if (esXiaomi) {
    // MIUI tiene dos permisos propios que no existen en el Android normal y sin
    // los cuales una app en segundo plano NO puede poner nada en pantalla. No
    // hay forma de pedirlos con un dialogo: hay que ir a los ajustes de la app.
    faltan.push({
      que: "Dos permisos de Xiaomi",
      porque:
        "En Ajustes de la app → «Otros permisos»: activa «Mostrar ventanas emergentes en segundo plano» y «Mostrar en pantalla de bloqueo». Sin esos dos, en Xiaomi la llamada no se ve aunque suene.",
      boton: "Abrir los ajustes de Genuino",
      hacer: () => void abrirAjustesDeLaApp(),
    });
  }

  if (faltan.length === 0) return null;

  return (
    <div className="mt-4 border-t border-borde pt-3">
      <Etiqueta>para que la llamada se vea, no sólo suene</Etiqueta>
      {faltan.map((f) => (
        <div key={f.que} className="mt-3">
          <p className="text-sm font-medium">{f.que}</p>
          <p className="mt-1 text-xs leading-relaxed text-tenue">{f.porque}</p>
          <div className="mt-2">
            <Boton ancho onClick={f.hacer}>
              {f.boton}
            </Boton>
          </div>
        </div>
      ))}
    </div>
  );
}
