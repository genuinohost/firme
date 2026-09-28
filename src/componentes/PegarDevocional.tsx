import { useMemo, useState } from "react";
import { fechaDelDia, guardarDia, leerDia, type Devocional } from "@/logica/devocionales";
import { puedoModerar } from "@/logica/muro";
import { partirDevocional } from "@/logica/partirDevocional";
import { AreaTexto, Boton, Etiqueta } from "./piezas";

/**
 * Pegar el devocional de un día, para quien modera.
 *
 * La revisión de la 6.24 lo vio: el archivo llegaba hasta el día 271 y la app
 * no podía escribir días, así que desde el 29 de septiembre la sala no tenía
 * nada que repartir. Ahora el día lo pone quien lleva el grupo, con lo mismo
 * que ya hace: genera el Bloque 1 con el prompt, lo manda al grupo a las 4:50
 * y lo pega aquí. La sala lo recibe al momento, aunque ya esté abierta.
 *
 * Se parte con el mismo código que sacó el archivo del año del chat, así que
 * un día pegado se lee igual que uno del archivo. Acepta el texto tal como sale
 * de WhatsApp (con sus negritas) y los cuatro bloques de DeepSeek pegados
 * juntos: se queda con el 1 y, si viene, toma el 3 como «lo que aprendí hoy».
 */

// Los mismos topes que las reglas (`diaRazonable`): mejor decirlo aquí que
// recibir un «no se pudo guardar» sin saber por qué.
const TOPE = { trozos: 200, tema: 300, capitulos: 40, aprendi: 20_000 };

export function PegarDevocional({
  dia,
  existente,
  onListo,
  onCerrar,
}: {
  /** El día en que se va a guardar. */
  dia: number;
  /** Lo que ya hay guardado para ese día, si hay algo: se avisa y se conserva «lo que aprendí». */
  existente: Devocional | null;
  onListo: (dev: Devocional) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  // Al corregir un día, «lo que aprendí hoy» ya guardado no se pierde.
  const [aprendi, setAprendi] = useState(existente?.aprendi ?? "");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const partido = useMemo(() => partirDevocional(texto), [texto]);
  const pasajes = partido.trozos.filter((t) => t.tipo === "pasaje").length;
  const puntos = partido.trozos.filter((t) => t.tipo === "reflexion").length;
  // El Bloque 3 pegado detrás del 1: si el cuadro está vacío, se usa.
  const aprendiFinal = (aprendi.trim() || partido.aprendi || "").trim();
  // El prompt lo dice en mayúsculas: «SIEMPRE confirmar que el número de día
  // coincide». Pegar el de ayer en hoy es el error más fácil de cometer a las 4:55.
  const otroDia = partido.dia != null && partido.dia !== dia ? partido.dia : null;

  const problemas: string[] = [];
  if (partido.cabeceras > 1) problemas.push(`El texto trae ${partido.cabeceras} días. Pega sólo el de hoy.`);
  if (partido.trozos.length > TOPE.trozos) problemas.push(`Son ${partido.trozos.length} turnos: pasa de ${TOPE.trozos}.`);
  if (partido.tema.length > TOPE.tema) problemas.push("El tema es demasiado largo: ¿falta la línea «EL TEMA: …»?");
  if (partido.capitulos.length > TOPE.capitulos) problemas.push("Demasiados capítulos para un día.");
  if (aprendiFinal.length > TOPE.aprendi) problemas.push("«Lo que aprendí hoy» es demasiado largo.");

  const guardar = async (enDia: number) => {
    setGuardando(true);
    setAviso("");
    try {
      // Si se guarda en otro día, se mira qué hay allí: se avisa, y su «lo que
      // aprendí» no se pisa con el de este.
      let suyo = aprendiFinal;
      if (enDia !== dia) {
        const alli = await leerDia(enDia, { fresco: true }).catch(() => null);
        if (alli && !window.confirm(`El día ${enDia} ya está en el archivo. ¿Sustituirlo por este texto?`)) {
          return;
        }
        suyo = partido.aprendi?.trim() || alli?.aprendi || "";
      }
      const f = fechaDelDia(enDia);
      const dev: Devocional = {
        dia: enDia,
        fecha: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`,
        tema: partido.tema,
        capitulos: partido.capitulos,
        trozos: partido.trozos,
        ...(suyo ? { aprendi: suyo } : {}),
      };
      await guardarDia(dev);
      onListo(dev);
    } catch (e) {
      const codigo = String((e as { code?: string })?.code ?? "");
      // Un rechazo de las reglas puede ser por la cuenta o por la forma; se
      // pregunta cuál antes de decir nada.
      const modero = codigo.includes("permission-denied") ? await puedoModerar().catch(() => true) : true;
      setAviso(
        !codigo.includes("permission-denied")
          ? "No se pudo guardar. Mira tu conexión y vuelve a probar."
          : !modero
            ? "Tu cuenta no puede subir devocionales: eso lo hace quien modera la comunidad."
            : "El servidor no aceptó el texto. Revisa que sea sólo el Bloque 1 de un día.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button onClick={onCerrar} className="toque rounded-lg px-2 py-1 text-xl text-tenue" aria-label="Cerrar">
          ‹
        </button>
        <Etiqueta>pegar el devocional · día {dia}</Etiqueta>
      </div>
      <p className="text-sm leading-relaxed text-tenue">
        Pega el Bloque 1, el mismo que mandas al grupo: desde «LEYENDO TODA LA BIBLIA EN UN AÑO: DÍA {dia} DE 365»
        hasta «¡COMPARTE ESTE MENSAJE!». Se parte solo en los trozos que se leen por turnos. Si pegas los cuatro
        bloques juntos, se queda con el 1 y toma el 3 como «lo que aprendí hoy».
      </p>
      <AreaTexto
        rows={9}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`🚶‍♂️ LEYENDO TODA LA BIBLIA EN UN AÑO: DÍA ${dia} DE 365 🚶‍♂️`}
        aria-label="El devocional del día"
      />
      <AreaTexto
        rows={3}
        value={aprendi}
        onChange={(e) => setAprendi(e.target.value)}
        placeholder={
          partido.aprendi
            ? "«Lo que aprendí hoy» venía en el texto pegado: se guarda ése."
            : "«Lo que aprendí hoy» (el Bloque 3), si quieres. Se puede añadir después."
        }
        aria-label="Lo que aprendí hoy"
      />

      {texto.trim() ? (
        partido.trozos.length === 0 ? (
          <p className="text-sm text-fallo">No reconozco un devocional en este texto. ¿Es el Bloque 1?</p>
        ) : (
          <div className="rounded-xl border border-borde bg-superficie/60 px-3 py-2 text-sm leading-relaxed">
            {partido.tema ? (
              <p className="font-semibold">✨ {partido.tema}</p>
            ) : (
              <p className="text-fallo">Sin tema: falta la línea «EL TEMA: …».</p>
            )}
            <p className="mt-1 text-xs text-tenue">{partido.capitulos.join(" · ") || "sin capítulos"}</p>
            <p className="mt-1 text-xs">
              {pasajes} trozos de la Biblia · {puntos} puntos de reflexión · {partido.trozos.length} turnos en total
              {partido.aprendi && !aprendi.trim() ? " · con «lo que aprendí hoy»" : ""}
            </p>
            {pasajes === 0 ? (
              <p className="mt-1 text-xs text-fallo">
                No encuentro los pasajes («Isaías 16:1-5:» y debajo los versículos). Se guardaría sólo la reflexión.
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {problemas.map((p) => (
        <p key={p} className="text-sm text-fallo">
          {p}
        </p>
      ))}

      {otroDia ? (
        <div className="rounded-xl border border-fallo/40 bg-fallo/10 px-3 py-2 text-sm leading-relaxed">
          Ojo: el texto dice <strong>DÍA {otroDia}</strong>, y estás en el día {dia}. Revisa que pegaste el de hoy.
          <div className="mt-2">
            <Boton
              ancho
              deshabilitado={guardando || problemas.length > 0 || partido.trozos.length === 0}
              onClick={() => void guardar(otroDia)}
            >
              Guardarlo como día {otroDia}
            </Boton>
          </div>
        </div>
      ) : null}

      {existente && !otroDia && partido.trozos.length > 0 ? (
        <p className="text-xs text-tenue">El día {dia} ya está en el archivo: al guardar se sustituye por este.</p>
      ) : null}

      <Boton
        variante="fuerte"
        ancho
        deshabilitado={guardando || partido.trozos.length === 0 || !!otroDia || problemas.length > 0}
        onClick={() => void guardar(dia)}
      >
        {guardando ? "Guardando…" : `Guardar el día ${dia}`}
      </Boton>
      {aviso ? <p className="text-sm text-fallo">{aviso}</p> : null}
    </div>
  );
}
