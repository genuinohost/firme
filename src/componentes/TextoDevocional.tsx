import type { Trozo } from "@/logica/devocionales";

/**
 * Un trozo del devocional, listo para leerse en voz alta.
 *
 * Los pasajes llevan el número de cada versículo pequeño y dorado delante,
 * como en YouVersion, y el texto en la letra de las citas: se lee de
 * madrugada, en el móvil, a veces con la vista cansada. El resto (reflexión,
 * preguntas, oración) va como párrafos, respetando los saltos que puso Alex.
 */
export function TextoDevocional({ trozo, grande }: { trozo: Trozo; grande?: boolean }) {
  const tamaño = grande ? "text-[19px] leading-[1.7]" : "text-[16px] leading-relaxed";
  if (trozo.tipo === "pasaje") {
    const lineas = trozo.texto.split("\n").filter((l) => l.trim());
    return (
      <div className={`font-cita ${tamaño}`}>
        {lineas.map((l, i) => {
          const m = /^\s*(\d{1,3})\s+(.*)$/.exec(l);
          return m ? (
            <p key={i} className="mb-1.5">
              <sup className="mr-1 align-super font-sans text-[0.62em] font-semibold text-acento">{m[1]}</sup>
              {m[2]}
            </p>
          ) : (
            <p key={i} className="mb-1.5">
              {l}
            </p>
          );
        })}
      </div>
    );
  }
  return <p className={`whitespace-pre-line ${tamaño}`}>{trozo.texto.replace(/^\s*\d{1,2}[.)]\s*/, "")}</p>;
}
