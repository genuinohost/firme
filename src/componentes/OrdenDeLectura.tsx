import { useEffect, useState } from "react";
import { comentaristaDe, guardarOrden, leerOrden, reanclar, type Lector, type Orden } from "@/logica/devocionales";
import { puedoModerar } from "@/logica/muro";
import { listarMiembros } from "@/logica/timbre";
import { Boton, Entrada, Etiqueta, Selector, Tarjeta } from "./piezas";

/**
 * El orden de lectura, para quien modera.
 *
 * Es el «ORDEN DE LECTURA BÍBLICA DE HOY» del grupo, que sale de aquí para la
 * sala: en ese orden se reparten los trozos del devocional, saltando a quien
 * no está o hoy sólo escucha. Y el comentario avanza un puesto por día.
 *
 * Lo que sólo se puede hacer a mano: **vincular** cada nombre con su cuenta de
 * la app. Hasta que no se vincula, esa persona no puede tener turno — la app
 * no tiene forma de saber que un nombre de la lista es tal cuenta.
 *
 * Editar la lista no mueve el comentario de hoy: cada cambio vuelve a anclar
 * el turno en quien comentaba (revisión de la 6.24: añadir a alguien al final
 * hacía comentar otra vez a quien comentó ayer).
 */
export function OrdenDeLectura() {
  const [modero, setModero] = useState(false);
  const [orden, setOrden] = useState<Orden | null>(null);
  const [miembros, setMiembros] = useState<{ uid: string; nombre: string; usuario: string }[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cambiado, setCambiado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [vinculando, setVinculando] = useState<string | null>(null);
  /** No se pudo leer el orden: NO es lo mismo que no exista. */
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (!(await puedoModerar())) return;
      if (!vivo) return;
      setModero(true);
      setFallo(false);
      // Un fallo de red al leer se trataba como «no hay orden»: salía la lista
      // vacía, y al añadir a alguien y guardar se borraban las 26 personas y
      // sus cuentas vinculadas. Ahora un fallo es un fallo, con «Reintentar».
      let o: Orden | null;
      try {
        o = await leerOrden();
      } catch {
        if (vivo) setFallo(true);
        return;
      }
      const m = await listarMiembros().catch(() => []);
      if (!vivo) return;
      // Los huecos (entradas malas del orden guardado) se limpian al cargar, y
      // se re-ancla hoy: si no, el ancla contaría puestos que al guardar ya no
      // están, y cambiaría en silencio quién comenta.
      const base = o ?? { lista: [], ancla: { fecha: hoyISO(), puesto: 0 } };
      const lista = base.lista.filter((e) => e.id);
      const limpio = lista.length === base.lista.length ? base : { lista, ancla: reanclar(base, lista, hoyISO()) };
      setOrden(limpio);
      if (limpio !== base) setCambiado(true);
      setMiembros(m);
    })();
    return () => {
      vivo = false;
    };
  }, [intento]);

  if (modero && fallo) {
    return (
      <Tarjeta>
        <Etiqueta>orden de lectura</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed text-fallo">No se pudo leer el orden de lectura. Mira tu conexión.</p>
        <div className="mt-3">
          <Boton onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>
        </div>
      </Tarjeta>
    );
  }
  if (!modero || !orden) return null;

  /** Cambiar la lista SIN mover el comentario de hoy. */
  const cambiarLista = (lista: Lector[]) => {
    setOrden({ lista, ancla: reanclar(orden, lista, hoyISO()) });
    setCambiado(true);
    setAviso("");
  };
  const cambiar = (o: Orden) => {
    setOrden(o);
    setCambiado(true);
    setAviso("");
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= orden.lista.length) return;
    const lista = [...orden.lista];
    [lista[i], lista[j]] = [lista[j], lista[i]];
    cambiarLista(lista);
  };
  const quitar = (i: number) => cambiarLista(orden.lista.filter((_, k) => k !== i));
  const vincular = (id: string, uid: string) => {
    cambiar({
      ...orden,
      lista: orden.lista.map((e) =>
        e.id === id ? { id: e.id, nombre: e.nombre, ...(uid ? { uid } : {}) } : uid && e.uid === uid ? { id: e.id, nombre: e.nombre } : e,
      ),
    });
    setVinculando(null);
  };
  const añadir = () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const id = `e${Date.now().toString(36)}`;
    cambiarLista([...orden.lista, { id, nombre }]);
    setNuevo("");
  };
  const guardar = async () => {
    try {
      await guardarOrden(orden);
      setCambiado(false);
      setAviso("Guardado. La sala usa ya este orden.");
    } catch {
      setAviso("No se pudo guardar. Mira tu conexión.");
    }
  };

  const hoy = hoyISO();
  const comenta = comentaristaDe(orden, hoy);
  const vinculados = orden.lista.filter((e) => e.uid).length;
  const cuenta = (e: Lector) => miembros.find((m) => m.uid === e.uid);

  return (
    <Tarjeta>
      <Etiqueta>orden de lectura</Etiqueta>
      <p className="mt-2 text-sm leading-relaxed">
        {orden.lista.length} personas · {vinculados} con su cuenta de la app.
        {comenta ? (
          <>
            {" "}
            Comenta hoy: <strong>{comenta.nombre}</strong>.
          </>
        ) : null}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-tenue">
        En la sala, los trozos se reparten en este orden entre quienes están dentro y tienen su cuenta vinculada.
      </p>

      {!abierto ? (
        <div className="mt-3">
          <Boton ancho onClick={() => setAbierto(true)}>
            Ver y editar la lista
          </Boton>
        </div>
      ) : (
        <>
          <ol className="mt-3 flex flex-col gap-1.5">
            {orden.lista.map((e, i) => {
              const c = cuenta(e);
              return (
                <li key={e.id} className="rounded-xl border border-borde bg-superficie/60 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="cifras w-6 shrink-0 text-right text-xs text-tenue">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {e.nombre}
                        {comenta?.id === e.id ? <span className="ml-1 text-acento">· comenta hoy</span> : null}
                      </p>
                      <p className={`truncate text-xs ${c ? "text-logro" : "text-tenue"}`}>
                        {c ? `@${c.usuario}` : e.uid ? "cuenta vinculada" : "sin cuenta vinculada"}
                      </p>
                    </div>
                    <button onClick={() => mover(i, -1)} className="toque rounded px-1.5 text-tenue" aria-label="Subir">
                      ↑
                    </button>
                    <button onClick={() => mover(i, 1)} className="toque rounded px-1.5 text-tenue" aria-label="Bajar">
                      ↓
                    </button>
                    <button
                      onClick={() => setVinculando(vinculando === e.id ? null : e.id)}
                      className="toque rounded px-1.5 text-xs text-acento"
                    >
                      {e.uid ? "cambiar" : "vincular"}
                    </button>
                    <button onClick={() => quitar(i)} className="toque rounded px-1.5 text-tenue hover:text-fallo" aria-label="Quitar">
                      ✕
                    </button>
                  </div>
                  {vinculando === e.id ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <Selector value={e.uid ?? ""} onChange={(ev) => vincular(e.id, ev.target.value)}>
                        <option value="">— sin cuenta —</option>
                        {miembros.map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.nombre} (@{m.usuario})
                          </option>
                        ))}
                      </Selector>
                      {!miembros.length ? (
                        <p className="text-xs text-tenue">Nadie se ha apuntado aún a la comunidad de voz.</p>
                      ) : null}
                      <Boton
                        onClick={() =>
                          cambiar({ ...orden, ancla: { fecha: hoy, puesto: i } })
                        }
                      >
                        Que comente hoy
                      </Boton>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              añadir();
            }}
          >
            <Entrada value={nuevo} onChange={(ev) => setNuevo(ev.target.value)} placeholder="Añadir a la lista" />
            <Boton tipo="submit" deshabilitado={!nuevo.trim()}>
              Añadir
            </Boton>
          </form>

          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <Boton variante="fuerte" ancho deshabilitado={!cambiado} onClick={() => void guardar()}>
                Guardar
              </Boton>
            </div>
            <Boton onClick={() => setAbierto(false)}>Cerrar</Boton>
          </div>
        </>
      )}
      {aviso ? <p className="mt-2 text-xs text-acento">{aviso}</p> : null}
    </Tarjeta>
  );
}

function hoyISO(): string {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}
