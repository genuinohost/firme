import { useEffect, useState } from "react";
import {
  listarModeradores,
  nombrarModerador,
  quitarModerador,
  soyDueno,
  type Moderador,
} from "@/logica/moderadores";
import { miUid } from "@/logica/muro";
import { Boton, Entrada, Etiqueta, Tarjeta } from "./piezas";

/**
 * Quién puede llamar: la lista de moderadores, que sólo el dueño ve y toca.
 *
 * Para todos los demás esto no se pinta: no es que esté escondido, es que
 * las reglas del servidor no les darían la lista aunque lo estuviera.
 *
 * Se nombra por @usuario, que es como la gente se encuentra en la app. Quien
 * no tiene perfil no se puede nombrar, y se dice: primero que entre y se cree
 * uno en Más → Mi cuenta.
 */
export function QuienPuedeLlamar() {
  const [yo, setYo] = useState<string | null>(null);
  const [dueno, setDueno] = useState(false);
  const [lista, setLista] = useState<Moderador[]>([]);
  const [usuario, setUsuario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [uid, soy] = await Promise.all([miUid(), soyDueno()]);
      if (!vivo) return;
      setYo(uid);
      setDueno(soy);
      if (soy) setLista(await listarModeradores().catch(() => []));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!dueno) return null;

  const nombrar = async () => {
    setOcupado(true);
    setAviso("");
    try {
      const nuevo = await nombrarModerador(usuario);
      setLista((l) => [...l, nuevo]);
      setUsuario("");
      setAviso(`${nuevo.nombre} ya puede llamar y abrir el devocional.`);
    } catch (e) {
      setAviso(explicar(e));
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (m: Moderador) => {
    setOcupado(true);
    setAviso("");
    try {
      await quitarModerador(m.uid);
      setLista((l) => l.filter((x) => x.uid !== m.uid));
      setAviso(`${nombreDe(m, yo)} ya no puede llamar.`);
    } catch (e) {
      setAviso(explicar(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta>
      <Etiqueta>quién puede llamar</Etiqueta>
      <p className="mt-2 text-sm leading-relaxed">
        Quien esté aquí puede abrir el devocional, <strong>hacer sonar los móviles</strong> de
        la comunidad y retirar lo que otro escriba. Sólo tú nombras y quitas.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {lista.map((m) => (
          <li
            key={m.uid}
            className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm">{nombreDe(m, yo)}</p>
              <p className="truncate text-xs text-tenue">
                {m.usuario ? `@${m.usuario}` : ""}
                {m.dueno ? (m.usuario ? " · " : "") + "el dueño" : ""}
              </p>
            </div>
            {m.dueno ? null : (
              <button
                onClick={() => void quitar(m)}
                disabled={ocupado}
                className="toque shrink-0 rounded-lg border border-borde px-2.5 py-1.5 text-xs text-tenue hover:border-fallo hover:text-fallo disabled:opacity-40"
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void nombrar();
        }}
      >
        <Entrada
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="@usuario"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Usuario a nombrar"
        />
        <Boton tipo="submit" variante="fuerte" deshabilitado={ocupado || usuario.trim() === ""}>
          {ocupado ? "…" : "Nombrar"}
        </Boton>
      </form>

      {aviso ? <p className="mt-2 text-xs leading-relaxed text-acento">{aviso}</p> : null}
    </Tarjeta>
  );
}

function nombreDe(m: Moderador, yo: string | null): string {
  if (m.uid === yo) return "Tú";
  return m.nombre ?? m.correo ?? m.uid;
}

function explicar(e: unknown): string {
  const m = String((e as { message?: string; code?: string })?.message ?? e);
  const codigo = String((e as { code?: string })?.code ?? "");
  if (m === "usuario-invalido") return "Escribe el @usuario tal cual: letras, números, punto o guion bajo.";
  if (m === "no-existe") return "Nadie tiene ese usuario. Tiene que crear su perfil en Más → Mi cuenta y volver a decírtelo.";
  if (m === "eres-tu") return "Ese eres tú. Ya puedes llamar.";
  if (m === "ya-modera") return "Ya está en la lista.";
  if (m === "sin-cuenta") return "Hace falta entrar con tu cuenta.";
  if (codigo.includes("permission-denied") || m.includes("permission")) {
    return "El servidor no lo permitió. Sólo el dueño nombra y quita.";
  }
  return "No se pudo. Mira tu conexión y vuelve a probar.";
}
