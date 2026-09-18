import { useCallback, useEffect, useState } from "react";
import {
  bloquear,
  denunciarNota,
  despublicarNota,
  leerBloqueados,
  leerMuro,
  miUid,
  type NotaPublica,
} from "@/logica/muro";
import { Boton, Etiqueta, Tarjeta, Vacio } from "./piezas";

/**
 * El muro: lo que los hermanos han decidido publicar.
 *
 * Alex: «lo público lo puede ver todo el mundo, amigos o no». Así que esto se
 * lee sin cuenta: quien abre la app por primera vez ve gente peleando la misma
 * batalla antes de haber entrado en ningún sitio, que es justo cuando más
 * falta hace verlo.
 *
 * ── Denunciar y bloquear no son adornos ───────────────────────────────────
 *
 * Google Play no deja publicar una app donde unos usuarios leen lo que
 * escriben otros si no se puede denunciar lo que está mal y bloquear a quien
 * lo escribe. Y aunque no lo exigiera: un muro cristiano abierto donde no se
 * pueda retirar nada es un sitio donde el primero que pase escribe lo que
 * quiera delante de gente que vino a buscar ánimo.
 *
 * Bloquear es inmediato y no se le notifica a nadie. Denunciar no borra nada
 * al instante —eso lo decide una persona— y se dice así, sin prometer de más.
 */
export function Muro() {
  const [notas, setNotas] = useState<NotaPublica[] | null>(null);
  const [bloqueados, setBloqueados] = useState<Set<string>>(new Set());
  const [yo, setYo] = useState<string | null>(null);
  const [fallo, setFallo] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    setFallo("");
    try {
      // En paralelo: la lista de bloqueados no debe retrasar el muro, y el muro
      // no debe pintarse antes de saber a quién no enseñar.
      const [lista, míos, quien] = await Promise.all([leerMuro(), leerBloqueados(), miUid()]);
      setBloqueados(míos);
      setYo(quien);
      setNotas(lista);
    } catch {
      // Sin conexión, o Firestore diciendo que no. Se dice, no se esconde: una
      // pantalla vacía sin explicación se lee como «aquí no escribe nadie».
      setNotas([]);
      setFallo("No se pudo abrir el muro. Mira tu conexión y vuelve a probar.");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const decir = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(""), 4000);
  };

  const visibles = (notas ?? []).filter((n) => !bloqueados.has(n.uid));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <Etiqueta>lo que escriben los hermanos</Etiqueta>
        <button
          onClick={() => void cargar()}
          className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
        >
          actualizar
        </button>
      </div>

      {notas === null ? <Vacio>Un momento…</Vacio> : null}

      {fallo ? <p className="text-xs leading-relaxed text-fallo">{fallo}</p> : null}

      {notas !== null && visibles.length === 0 && !fallo ? (
        <Vacio>
          Todavía no hay nada publicado. Puedes ser el primero: escribe en tu
          diario y toca «publicar».
        </Vacio>
      ) : null}

      {visibles.map((n) => (
        <Tarjeta key={n.id}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">{n.nombre}</p>
            <p className="cifras shrink-0 text-xs text-tenue">{cuando(n.momento)}</p>
          </div>
          <p className="cifras truncate text-xs text-acento">@{n.usuario}</p>

          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{n.texto}</p>

          <div className="mt-2 flex justify-end">
            {n.uid === yo ? (
              <button
                onClick={async () => {
                  try {
                    await despublicarNota(n.id);
                    setNotas((v) => (v ?? []).filter((x) => x.id !== n.id));
                    decir("Retirada del muro.");
                  } catch {
                    decir("No se pudo retirar. Prueba otra vez.");
                  }
                }}
                className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
              >
                retirar la mía
              </button>
            ) : (
              <button
                onClick={() => setMenu(menu === n.id ? null : n.id)}
                className="rounded-lg px-2 py-1 text-xs text-tenue transition hover:text-acento"
                aria-label="Opciones de esta nota"
              >
                ⋯
              </button>
            )}
          </div>

          {menu === n.id && n.uid !== yo ? (
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-borde p-3">
              <p className="text-xs leading-relaxed text-tenue">
                Si esto no debería estar aquí, dilo. Lo mira una persona y lo
                retira si hace falta.
              </p>
              <Boton
                ancho
                onClick={async () => {
                  setMenu(null);
                  try {
                    await denunciarNota(n.id, "Denunciada desde el muro");
                    decir("Gracias. Queda avisado.");
                  } catch (e) {
                    decir(
                      e instanceof Error && e.message === "sin-cuenta"
                        ? "Para denunciar hace falta entrar en tu cuenta."
                        : "No se pudo avisar. Prueba luego.",
                    );
                  }
                }}
              >
                Denunciar esta nota
              </Boton>
              <Boton
                ancho
                onClick={async () => {
                  setMenu(null);
                  try {
                    await bloquear(n.uid);
                    setBloqueados((v) => new Set(v).add(n.uid));
                    decir("Bloqueado. No verás nada más suyo, y no se le avisa.");
                  } catch (e) {
                    decir(
                      e instanceof Error && e.message === "sin-cuenta"
                        ? "Para bloquear hace falta entrar en tu cuenta."
                        : "No se pudo bloquear. Prueba luego.",
                    );
                  }
                }}
              >
                No ver nada de {n.nombre}
              </Boton>
            </div>
          ) : null}
        </Tarjeta>
      ))}

      {aviso ? (
        <p className="rounded-xl border border-borde px-3 py-2 text-xs leading-relaxed">{aviso}</p>
      ) : null}
    </div>
  );
}

/** Hace cuánto, en palabras cortas. Una fecha exacta aquí no aporta nada. */
function cuando(momento: number): string {
  const minutos = Math.max(0, Math.round((Date.now() - momento) / 60_000));
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return new Date(momento).toLocaleDateString("es", { day: "numeric", month: "short" });
}
