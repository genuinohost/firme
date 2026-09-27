import { useEffect, useState } from "react";
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
      // Contar sólo lo puede quien modera; para los demás no es un dato que
      // necesiten, y las reglas no lo darían de todas formas.
      if (modero) setCuantos(await cuantosMiembros());
    })();
    return () => {
      vivo = false;
    };
  }, []);

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
      }
    } catch {
      setAviso("No se pudo. Mira tu conexión y vuelve a probar.");
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
            Es voluntario y salirse es un toque. Nadie más ve que estás.
          </p>
          <div className="mt-3">
            <Boton variante="fuerte" ancho deshabilitado={ocupado} onClick={() => void cambiar()}>
              {ocupado ? "Un momento…" : "Unirme, que me suene"}
            </Boton>
          </div>
        </>
      )}

      {aviso ? <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p> : null}
    </Tarjeta>
  );
}
