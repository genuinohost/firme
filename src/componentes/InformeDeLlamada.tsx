import { useEffect, useState } from "react";
import { ESPERA_ACUSE_MS, filasDeLlamada, resumenDeLlamada, type Acuse, type FilaDeLlamada } from "@/logica/llamada";
import { escucharAcuses, type LlamadaHecha } from "@/logica/timbre";

/**
 * A quién le sonó la llamada, persona por persona, según van contestando los
 * móviles. Va debajo del botón «Llamar a la comunidad».
 *
 * Alex, 28-09-2026: «probando y no suena la llamada a mis amigos». El botón
 * decía «Llamando a 2. Les está sonando ahora mismo» sin saber si sonaba. Esto
 * dice «Sonó en 1 de 2» y, del otro, qué le pasa y qué tiene que tocar.
 */
export function InformeDeLlamada({ llamada }: { llamada: LlamadaHecha }) {
  const [acuses, setAcuses] = useState<Map<string, Acuse>>(() => new Map());
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    setAcuses(new Map());
    return escucharAcuses(llamada.llamada, (a) =>
      setAcuses((m) => {
        // Un segundo acuse de la misma persona viene de otro aparato suyo (el
        // tema no lleva vuelta). Manda el que SONÓ: si no, según cuál llegara
        // antes, la fila decía «frenó el timbre» de alguien cuya tableta sonó.
        const antes = m.get(a.para);
        if (antes && !(antes.estado.sono === false && a.estado.sono !== false)) return m;
        const n = new Map(m);
        n.set(a.para, a);
        return n;
      }),
    );
  }, [llamada.llamada]);

  // El reloj, sólo mientras hay algo que esperar: pasado el minuto, los que no
  // contestaron pasan a «no contestó» y ya no cambia nada más que un acuse.
  const esperando = ahora - llamada.en < ESPERA_ACUSE_MS + 2_000;
  useEffect(() => {
    if (!esperando) return;
    const t = window.setInterval(() => setAhora(Date.now()), 3_000);
    return () => window.clearInterval(t);
  }, [esperando]);

  if (!llamada.resultados) return null;
  const filas = filasDeLlamada(llamada.resultados, acuses, ahora - llamada.en, llamada.vuelta, llamada.tema);

  return (
    <div className="mt-3 border-t border-borde pt-3">
      <p className="text-sm font-medium">{resumenDeLlamada(filas)}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {filas.map((f) => (
          <li key={f.uid} className="flex gap-2 text-xs leading-relaxed">
            <span aria-hidden className={`mt-px w-4 shrink-0 text-center ${color(f.como)}`}>
              {icono(f.como)}
            </span>
            <div className="min-w-0">
              <p>
                <span className="font-medium text-texto">{f.nombre}</span>{" "}
                <span className="text-tenue">— {f.texto}.</span>
              </p>
              {f.pegas.length > 0 ? (
                <p className="mt-0.5 text-acento">Pero {f.pegas.join("; ")}.</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {llamada.vuelta || filas.length === 0 ? null : (
        <p className="mt-2 text-[11px] leading-relaxed text-tenue">
          La llamada salió y les suena igual; sólo que esta vez no llegará la confirmación de cada
          móvil. No hace falta volver a llamar. Si pasa siempre, avisa a quien lleva la app.
        </p>
      )}
    </div>
  );
}

function icono(como: FilaDeLlamada["como"]): string {
  switch (como) {
    case "sono":
      return "✓";
    case "frenado":
      return "!";
    case "esperando":
      return "…";
    case "app-vieja":
      return "↑";
    case "sin-confirmar":
      return "·";
    default:
      return "✕";
  }
}

function color(como: FilaDeLlamada["como"]): string {
  switch (como) {
    case "sono":
      return "text-logro";
    case "frenado":
    case "app-vieja":
      return "text-acento";
    case "esperando":
    case "sin-confirmar":
      return "text-tenue";
    default:
      return "text-fallo";
  }
}
