import { useMemo, useState } from "react";
import { idNuevo } from "@/datos/almacen";
import type { Datos, Nota } from "@/datos/tipos";
import { claveFecha } from "@/logica/dia";
import {
  comoFue,
  compartirNota,
  diarioComoTexto,
  exportarTexto,
  nombreDeArchivo,
} from "@/logica/exportar";
import { AreaTexto, Boton, Etiqueta, Tarjeta, Vacio } from "./piezas";

/**
 * El diario.
 *
 * Un espacio libre y privado. Sin formato impuesto, sin preguntas, sin campos
 * que rellenar: lo que uno quiera escribir, el día que quiera escribirlo.
 *
 * Las notas que nacen del repaso de la noche llegan aquí con su plan y con cómo
 * acabó aquel día. Esa es la diferencia con un cuaderno cualquiera: al releer
 * seis meses después no solo está lo que escribiste, sino si aquel día venciste
 * o caíste. Ahí es donde se ve el camino recorrido.
 */
export function PantallaDiario({
  datos,
  ahora,
  onCambiar,
}: {
  datos: Datos;
  ahora: Date;
  onCambiar: (notas: Nota[]) => void;
}) {
  const notas = useMemo(() => datos.notas ?? [], [datos.notas]);
  const [escribiendo, setEscribiendo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [aviso, setAviso] = useState("");

  /** Un aviso corto: lo que pasó al sacar el texto del teléfono. */
  const avisar = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(""), 3500);
  };

  const hoy = claveFecha(ahora);

  const guardar = () => {
    const texto = escribiendo.trim();
    if (!texto) return;
    onCambiar([
      { id: idNuevo(), fecha: hoy, texto, momento: Date.now() },
      ...notas,
    ]);
    setEscribiendo("");
  };

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const orden = [...notas].sort((a, b) => b.momento - a.momento);
    return q ? orden.filter((n) => n.texto.toLowerCase().includes(q)) : orden;
  }, [notas, busqueda]);

  // Se agrupan por día para que al bajar se lea como un diario y no como una
  // lista de apuntes sueltos.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Nota[]>();
    for (const n of visibles) {
      const lista = mapa.get(n.fecha) ?? [];
      lista.push(n);
      mapa.set(n.fecha, lista);
    }
    return [...mapa.entries()];
  }, [visibles]);

  const nombrePlan = (id?: string) =>
    (datos.planes ?? []).find((p) => p.id === id)?.nombre ?? "un plan";

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Mi diario</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Tuyo y de nadie más. No sale de este teléfono, y aquí no hay nada que
          hacer bien: escribe lo que sea, cuando sea.
        </p>
      </header>

      <Tarjeta>
        <AreaTexto
          rows={4}
          value={escribiendo}
          onChange={(e) => setEscribiendo(e.target.value)}
          placeholder="Hoy me costó, pero..."
        />
        <div className="mt-2">
          <Boton
            variante="fuerte"
            ancho
            deshabilitado={!escribiendo.trim()}
            onClick={guardar}
          >
            Guardar
          </Boton>
        </div>
      </Tarjeta>

      {notas.length > 4 ? (
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en lo que has escrito"
          className="w-full rounded-xl border border-borde bg-superficie px-3 py-2.5 text-sm outline-none focus:border-acento"
        />
      ) : null}

      {/*
        Sacar el diario del teléfono.

        Alex: «la app debe tener opción para poder guardar, compartir o
        descargar las notas». Detrás hay un miedo razonable — que años de
        diario se queden atrapados en una app, a merced de un móvil perdido.
        No se manda nada a ningún sitio: se escribe un archivo y el menú del
        sistema decide dónde acaba. Nosotros no vemos una línea.
      */}
      {notas.length > 0 ? (
        <Boton
          ancho
          onClick={async () => {
            const texto = diarioComoTexto(datos);
            avisar(comoFue(await exportarTexto(texto, nombreDeArchivo(ahora), "Mi diario")));
          }}
        >
          ↓ Guardar o compartir todo el diario
        </Boton>
      ) : null}

      {notas.length === 0 ? (
        <Vacio>
          Todavía no has escrito nada. Empieza por hoy: qué te costó, qué te
          sostuvo, qué le pediste a Dios.
        </Vacio>
      ) : null}

      {notas.length > 0 && visibles.length === 0 ? (
        <Vacio>Nada con esa palabra.</Vacio>
      ) : null}

      {porDia.map(([fecha, delDia]) => (
        <div key={fecha}>
          <Etiqueta>{comoSeLee(fecha, hoy)}</Etiqueta>
          <div className="mt-2 flex flex-col gap-2">
            {delDia.map((n) => (
              <Tarjeta key={n.id} className={n.estado ? "border-borde" : ""}>
                {n.plan ? (
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`text-xs ${colorEstado(n.estado)}`}>
                      {iconoEstado(n.estado)}
                    </span>
                    <span className="text-xs text-tenue">
                      {nombrePlan(n.plan)} · {textoEstado(n.estado)}
                    </span>
                  </div>
                ) : null}

                {editando === n.id ? (
                  <>
                    <AreaTexto
                      rows={4}
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <div className="flex-1">
                        <Boton
                          variante="fuerte"
                          ancho
                          onClick={() => {
                            const texto = borrador.trim();
                            onCambiar(
                              texto
                                ? notas.map((x) => (x.id === n.id ? { ...x, texto } : x))
                                : notas.filter((x) => x.id !== n.id),
                            );
                            setEditando(null);
                          }}
                        >
                          {borrador.trim() ? "Guardar" : "Borrar"}
                        </Boton>
                      </div>
                      <Boton onClick={() => setEditando(null)}>Dejarlo</Boton>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditando(n.id);
                        setBorrador(n.texto);
                      }}
                      className="w-full text-left text-sm leading-relaxed whitespace-pre-wrap"
                    >
                      {n.texto}
                    </button>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={async () => avisar(comoFue(await compartirNota(n, datos)))}
                        className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
                        aria-label="Compartir esta nota"
                      >
                        compartir
                      </button>
                    </div>
                  </>
                )}
              </Tarjeta>
            ))}
          </div>
        </div>
      ))}

      {/*
        El aviso va por encima de la barra contando su zona segura. En un móvil
        con gestos, `env(safe-area-inset-bottom)` engorda la barra por encima
        de los 76 píxeles de siempre y el aviso se esconde detrás: en el
        navegador se ve bien y en el teléfono no.
      */}
      {aviso ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 mx-auto flex max-w-lg justify-center px-4">
          <p className="rounded-full border border-borde bg-superficie px-4 py-2 text-xs shadow-lg">
            {aviso}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const iconoEstado = (e?: Nota["estado"]) =>
  e === "ganado" ? "✓" : e === "restaurado" ? "↺" : e === "fallado" ? "✕" : "·";

const colorEstado = (e?: Nota["estado"]) =>
  e === "ganado" ? "text-logro" : e === "restaurado" ? "text-acento" : "text-fallo";

const textoEstado = (e?: Nota["estado"]) =>
  e === "ganado"
    ? "lo guardaste"
    : e === "restaurado"
      ? "restaurado"
      : e === "fallado"
        ? "ese día caíste"
        : "";

/** «Hoy», «ayer» o la fecha escrita, que es como se recuerdan los días. */
function comoSeLee(fecha: string, hoy: string): string {
  if (fecha === hoy) return "hoy";
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  const [ah, mh, dh] = hoy.split("-").map(Number);
  const diferencia = Math.round(
    (new Date(ah, mh - 1, dh).getTime() - f.getTime()) / 86_400_000,
  );
  if (diferencia === 1) return "ayer";

  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const base = `${dias[f.getDay()]} ${d} de ${meses[m - 1]}`;
  return a === ah ? base : `${base} de ${a}`;
}
