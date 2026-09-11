import { useState } from "react";
import type { Motivo } from "@/datos/tipos";
import { idNuevo } from "@/datos/almacen";
import { AreaTexto, Boton, Etiqueta, Tarjeta, Vacio } from "./piezas";

/**
 * La pantalla del porqué. No es una lista de tareas: son las razones por las
 * que merece la pena el esfuerzo, escritas por él, en sus palabras. Una de
 * ellas es el ancla y aparece en cada alarma.
 */
export function PantallaPorque({
  motivos,
  onCambiar,
}: {
  motivos: Motivo[];
  onCambiar: (motivos: Motivo[]) => void;
}) {
  const [nuevo, setNuevo] = useState("");

  const añadir = () => {
    const texto = nuevo.trim();
    if (!texto) return;
    onCambiar([...motivos, { id: idNuevo(), texto, ancla: motivos.length === 0 }]);
    setNuevo("");
  };

  const editar = (id: string, texto: string) =>
    onCambiar(motivos.map((m) => (m.id === id ? { ...m, texto } : m)));

  const anclar = (id: string) =>
    onCambiar(motivos.map((m) => ({ ...m, ancla: m.id === id })));

  const borrar = (id: string) => {
    const resto = motivos.filter((m) => m.id !== id);
    // Si se borra el ancla, el primero que quede toma el relevo.
    if (resto.length > 0 && !resto.some((m) => m.ancla)) resto[0].ancla = true;
    onCambiar(resto);
  };

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Mi porqué</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Cuando no queden ganas, lo único que sirve es acordarse de esto. Escríbelo
          concreto: nombres, imágenes, cosas que puedas ver.
        </p>
      </header>

      {motivos.length === 0 ? <Vacio>Todavía no has escrito ninguna razón.</Vacio> : null}

      {motivos.map((m) => (
        <Tarjeta
          key={m.id}
          className={m.ancla ? "border-acento/40 bg-acento/[0.05]" : ""}
        >
          <div className="flex items-center justify-between gap-2">
            <Etiqueta>{m.ancla ? "razón principal" : "razón"}</Etiqueta>
            <div className="flex gap-1">
              {!m.ancla ? (
                <button
                  onClick={() => anclar(m.id)}
                  className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
                >
                  hacer principal
                </button>
              ) : null}
              <button
                onClick={() => borrar(m.id)}
                className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-fallo"
              >
                borrar
              </button>
            </div>
          </div>
          <AreaTexto
            rows={3}
            value={m.texto}
            onChange={(e) => editar(m.id, e.target.value)}
            className="mt-2 w-full"
            placeholder="¿Por qué te esfuerzas?"
          />
        </Tarjeta>
      ))}

      <Tarjeta className="border-dashed">
        <Etiqueta>añadir otra razón</Etiqueta>
        <AreaTexto
          rows={2}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          className="mt-2 w-full"
          placeholder="Para que mis hijos vean a un padre que cumple lo que dice…"
        />
        <div className="mt-3">
          <Boton variante="fuerte" ancho onClick={añadir} deshabilitado={!nuevo.trim()}>
            Añadir
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}
