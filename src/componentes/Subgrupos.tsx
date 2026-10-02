import { useEffect, useMemo, useState } from "react";
import type { Dentro, Sala, Subgrupos as SubgruposDeSala } from "@/logica/sala";
import { abrirSubgrupos, cerrarSubgrupos } from "@/logica/sala";
import {
  LETRAS,
  avisosDelReparto,
  gruposPosibles,
  gruposSugeridos,
  repartir,
  type Letra,
} from "@/logica/subgrupos";
import { avisarVueltaYa, olvidarVueltaDelGrupo, programarVueltaDelGrupo } from "@/logica/avisoGrupo";
import { Boton, Etiqueta, Tarjeta } from "./piezas";

/**
 * Los subgrupos, vistos desde la sala principal.
 *
 * - **El anfitrión** los arma: al azar (parejos, de 2 a 5 grupos) o a mano,
 *   tocando la letra de cada uno; elige cuánto duran y los envía. Mientras
 *   duran, ve quién está en cada grupo, puede entrar a escuchar cualquiera y
 *   traer a todos de vuelta.
 * - **Los demás** ven a qué grupo van y con quién, y a los cinco segundos se
 *   van solos (o antes, con «Ir ahora»). Quien no tiene grupo se queda aquí.
 */
export function Subgrupos({
  canal,
  sala,
  gente,
  miUid,
  esAnfitrion,
  onIrA,
}: {
  canal: string;
  sala: Sala | null;
  gente: Dentro[];
  miUid: string;
  esAnfitrion: boolean;
  onIrA: (destino: { canal: string; nombre: string; padre?: string }) => void;
}) {
  const activos = sala?.subgrupos;
  if (activos && activos.grupos.length) {
    return esAnfitrion ? (
      <SubgruposEnMarcha canal={canal} activos={activos} gente={gente} miUid={miUid} onIrA={onIrA} />
    ) : (
      <MiSubgrupo canal={canal} activos={activos} gente={gente} miUid={miUid} onIrA={onIrA} />
    );
  }
  return esAnfitrion && sala?.tipo === "devocional" ? (
    <ArmarSubgrupos canal={canal} gente={gente} miUid={miUid} campana={sala.campana} />
  ) : null;
}

/**
 * Los grupos de los que esta persona ya volvió por su cuenta. Sin esto, quien
 * vuelve antes de tiempo a la sala principal era enviado otra vez a su grupo a
 * los cinco segundos. Vive mientras la app está abierta: la sala se vuelve a
 * montar al cambiar de canal y su estado se pierde.
 */
const yaVolvi = new Set<string>();

/** Apuntar que se volvió de un grupo (o que no se pudo entrar en él): no se reenvía solo. */
export function marcarVuelta(canal: string): void {
  yaVolvi.add(canal);
}

// ─────────────────────────────────────────────────────── armar (anfitrión)

const DURACIONES = [5, 10, 15, 20, 30] as const;

function ArmarSubgrupos({
  canal,
  gente,
  miUid,
  campana,
}: {
  canal: string;
  gente: Dentro[];
  miUid: string;
  campana?: Sala["campana"];
}) {
  const [abierto, setAbierto] = useState(false);
  const [incluirme, setIncluirme] = useState(false);
  /** uid → letra; quien no está aquí se queda en la sala principal. */
  const [asignado, setAsignado] = useState<Record<string, Letra>>({});
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [minutos, setMinutos] = useState<number>(10);
  /** Lo que se escribe en «minutos a medida»: se ajusta a 1-60 al salir del campo. */
  const [aMedida, setAMedida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");

  const personas = useMemo(
    () => gente.filter((g) => incluirme || g.uid !== miUid),
    [gente, incluirme, miUid],
  );
  const posibles = gruposPosibles(personas.length);
  const sugeridos = gruposSugeridos(personas.length);
  const k = cuantos != null && posibles.includes(cuantos) ? cuantos : (sugeridos ?? 2);
  const letras = LETRAS.slice(0, k);

  // Si alguien se fue, o bajan los grupos, su letra ya no vale.
  const vigente = useMemo(() => {
    const r: Record<string, Letra> = {};
    for (const p of personas) {
      const l = asignado[p.uid];
      if (l && letras.includes(l)) r[p.uid] = l;
    }
    return r;
  }, [asignado, personas, letras]);
  const tamaños = letras.map((l) => Object.values(vigente).filter((x) => x === l).length);
  const avisos = Object.keys(vigente).length ? avisosDelReparto(tamaños) : [];

  const alAzar = () => {
    const grupos = repartir(
      personas.map((p) => p.uid),
      k,
    );
    const r: Record<string, Letra> = {};
    grupos.forEach((uids, i) => uids.forEach((u) => (r[u] = LETRAS[i])));
    setAsignado(r);
    setAviso("");
  };

  /** Tocar la letra de alguien: se la pone; tocar la que ya tiene, se la quita. */
  const poner = (uid: string, l: Letra) =>
    setAsignado((a) => {
      const r = { ...a };
      if (r[uid] === l) delete r[uid];
      else r[uid] = l;
      return r;
    });

  const enviar = async () => {
    const grupos = letras
      .map((l) => ({ letra: l, miembros: Object.keys(vigente).filter((u) => vigente[u] === l) }))
      .filter((g) => g.miembros.length > 0);
    if (grupos.length < 2) {
      setAviso("Pon gente en al menos 2 grupos.");
      return;
    }
    setEnviando(true);
    setAviso("");
    try {
      await abrirSubgrupos(
        canal,
        grupos,
        minutos,
        Object.fromEntries(personas.map((p) => [p.uid, p.nombre])),
        // La campana de las 6 suena también en los grupos.
        campana,
      );
      setAbierto(false);
      setAsignado({});
    } catch (e) {
      setAviso(
        String((e as Error)?.message) === "sin-conexion"
          ? "Sin conexión: los grupos se abrirán solos cuando vuelva la red."
          : "No se pudieron abrir los grupos. Mira tu conexión.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <Tarjeta>
        <Etiqueta>subgrupos</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed text-tenue">
          Parte la sala en grupos pequeños para una actividad: de 2 a 5 grupos, de 2 a 5 personas. Cada grupo
          habla en su propio canal y todos vuelven aquí al acabar.
        </p>
        {gente.length >= 4 && personas.length < 4 ? (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirme} onChange={(e) => setIncluirme(e.target.checked)} />
            Incluirme en un grupo (sin ti son menos de 4)
          </label>
        ) : null}
        <div className="mt-3">
          <Boton ancho deshabilitado={personas.length < 4} onClick={() => setAbierto(true)}>
            {personas.length < 4 ? "Hacen falta al menos 4 personas" : "Armar subgrupos"}
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <div className="flex items-center justify-between gap-2">
        <Etiqueta>subgrupos · {personas.length} personas</Etiqueta>
        <button onClick={() => setAbierto(false)} className="toque text-xs text-tenue">
          Cerrar
        </button>
      </div>

      <p className="mt-2 text-xs text-tenue">¿Cuántos grupos?</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {posibles.map((n) => (
          <button
            key={n}
            onClick={() => setCuantos(n)}
            className={`toque rounded-full border px-3 py-1 text-sm ${
              n === k ? "border-acento bg-acento/15 text-acento" : "border-borde text-tenue"
            }`}
            aria-pressed={n === k}
          >
            {n}
          </button>
        ))}
      </div>
      {sugeridos ? (
        <p className="mt-1 text-xs text-tenue">
          Con {personas.length} personas, lo parejo son {sugeridos} grupos.
        </p>
      ) : null}
      {personas.length > 25 ? (
        <p className="mt-1 text-xs text-tenue">
          Con más de 25 personas, cinco grupos no bastan para que ninguno pase de 5.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <Boton variante="fuerte" ancho onClick={alAzar}>
            🎲 Al azar
          </Boton>
        </div>
        <Boton onClick={() => setAsignado({})}>Vaciar</Boton>
      </div>
      <p className="mt-1 text-xs text-tenue">O a mano: toca la letra de cada uno.</p>

      <ul className="mt-2 flex flex-col gap-1.5">
        {personas.map((p) => (
          <li key={p.uid} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.uid === miUid ? "Tú" : p.nombre}
            </span>
            <span className="flex gap-1">
              {letras.map((l) => (
                <button
                  key={l}
                  onClick={() => poner(p.uid, l)}
                  className={`toque size-8 rounded-lg border text-sm font-semibold ${
                    vigente[p.uid] === l ? "border-acento bg-acento text-sobre-acento" : "border-borde text-tenue"
                  }`}
                  aria-pressed={vigente[p.uid] === l}
                  aria-label={`${p.nombre} al grupo ${l}`}
                >
                  {l}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={incluirme} onChange={(e) => setIncluirme(e.target.checked)} />
        Incluirme en un grupo
      </label>

      <p className="mt-3 text-xs text-tenue">¿Cuánto tiempo?</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {DURACIONES.map((m) => (
          <button
            key={m}
            onClick={() => {
              setMinutos(m);
              setAMedida("");
            }}
            className={`toque rounded-full border px-3 py-1 text-sm ${
              m === minutos ? "border-acento bg-acento/15 text-acento" : "border-borde text-tenue"
            }`}
            aria-pressed={m === minutos}
          >
            {m} min
          </button>
        ))}
        {/* Alex, 28-09-2026: «debo tener la capacidad de configurar cuánto
            tiempo duran los subgrupos». Además de las de siempre, la que quiera. */}
        <label
          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
            !DURACIONES.includes(minutos as (typeof DURACIONES)[number])
              ? "border-acento bg-acento/15 text-acento"
              : "border-borde text-tenue"
          }`}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={aMedida}
            placeholder="…"
            // Se deja escribir libre (borrar, «25»…) y se ajusta a 1-60 al
            // salir del campo: ajustar a cada tecla convertía «25» en 60.
            onChange={(e) => {
              setAMedida(e.target.value);
              const n = Math.round(Number(e.target.value));
              if (e.target.value && Number.isFinite(n) && n >= 1 && n <= 60) setMinutos(n);
            }}
            onBlur={() => {
              const n = Math.round(Number(aMedida));
              if (!aMedida || !Number.isFinite(n)) return setAMedida("");
              const v = Math.min(60, Math.max(1, n));
              setMinutos(v);
              setAMedida(String(v));
            }}
            className="w-10 bg-transparent text-center outline-none"
            aria-label="Minutos a medida"
          />
          min
        </label>
      </div>
      <p className="mt-1 text-xs text-tenue">Al acabar el tiempo, todos vuelven solos a la sala principal.</p>

      <p className="mt-3 text-sm">
        {letras.map((l, i) => `${l}: ${tamaños[i]}`).join(" · ")}
        {personas.length - Object.keys(vigente).length > 0
          ? ` · se quedan aquí: ${personas.length - Object.keys(vigente).length}`
          : ""}
      </p>
      {avisos.map((a) => (
        <p key={a} className="mt-1 text-xs text-fallo">
          {a}
        </p>
      ))}

      <div className="mt-3">
        <Boton
          variante="logro"
          ancho
          deshabilitado={enviando || tamaños.filter((t) => t > 0).length < 2}
          onClick={() => void enviar()}
        >
          {enviando ? "Enviando…" : `Enviar a los grupos · ${minutos} min`}
        </Boton>
      </div>
      {aviso ? <p className="mt-2 text-sm text-fallo">{aviso}</p> : null}
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────── en marcha (anfitrión)

function SubgruposEnMarcha({
  canal,
  activos,
  gente,
  miUid,
  onIrA,
}: {
  canal: string;
  activos: SubgruposDeSala;
  gente: Dentro[];
  miUid: string;
  onIrA: (destino: { canal: string; nombre: string; padre?: string }) => void;
}) {
  const quedan = useQuedan(activos.hasta);
  const [cerrando, setCerrando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [reintento, setReintento] = useState(0);
  const nombreDe = useNombres(gente, activos);
  /** Si el anfitrión se incluyó en un grupo: a él no lo manda nadie, va él. */
  const suyo = activos.grupos.find((g) => g.miembros.includes(miUid));

  const traer = async () => {
    setCerrando(true);
    setAviso("");
    try {
      await cerrarSubgrupos(canal, activos);
    } catch (e) {
      setAviso(
        String((e as Error)?.message) === "sin-conexion"
          ? "Sin conexión: se traerán cuando vuelva la red."
          : "No se pudo cerrar. Mira tu conexión.",
      );
    } finally {
      setCerrando(false);
    }
  };

  // Al acabar el tiempo, el móvil del anfitrión los cierra: los demás vuelven
  // solos igualmente, pero así los canales no quedan abiertos. Si falla, se
  // reintenta a los 20 s.
  useEffect(() => {
    if (!activos.hasta || quedan !== 0) return;
    let vivo = true;
    void cerrarSubgrupos(canal, activos).catch(() => {
      if (vivo) window.setTimeout(() => vivo && setReintento((n) => n + 1), 20_000);
    });
    return () => {
      vivo = false;
    };
  }, [quedan === 0, reintento]);

  return (
    <Tarjeta className="border-acento/40">
      <Etiqueta>subgrupos en marcha{activos.hasta ? ` · quedan ${formatoMinutos(quedan)}` : ""}</Etiqueta>
      {suyo ? (
        <div className="mt-2">
          <Boton
            variante="fuerte"
            ancho
            onClick={() => onIrA({ canal: suyo.canal, nombre: `Grupo ${suyo.letra}`, padre: canal })}
          >
            Ir a mi grupo ({suyo.letra})
          </Boton>
        </div>
      ) : null}
      <ul className="mt-2 flex flex-col gap-2">
        {activos.grupos.map((g) => (
          <li key={g.canal} className="rounded-xl border border-borde px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-sm">
                <strong>Grupo {g.letra}</strong>
                <span className="text-tenue"> · {g.miembros.map(nombreDe).join(", ")}</span>
              </p>
              <Boton onClick={() => onIrA({ canal: g.canal, nombre: `Grupo ${g.letra}`, padre: canal })}>
                Entrar
              </Boton>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Boton variante="fuerte" ancho deshabilitado={cerrando} onClick={() => void traer()}>
          {cerrando ? "Reuniéndolos…" : "Reunir a todos en la sala principal"}
        </Boton>
      </div>
      {aviso ? <p className="mt-2 text-sm text-fallo">{aviso}</p> : null}
    </Tarjeta>
  );
}

// ──────────────────────────────────────────────── mi grupo (participante)

function MiSubgrupo({
  canal,
  activos,
  gente,
  miUid,
  onIrA,
}: {
  canal: string;
  activos: SubgruposDeSala;
  gente: Dentro[];
  miUid: string;
  onIrA: (destino: { canal: string; nombre: string; padre?: string }) => void;
}) {
  const mio = activos.grupos.find((g) => g.miembros.includes(miUid));
  const volvio = !!mio && yaVolvi.has(mio.canal);
  const [cuenta, setCuenta] = useState(5);
  const nombreDe = useNombres(gente, activos);
  const quedan = useQuedan(activos.hasta);
  const vencido = !!activos.hasta && quedan === 0;
  const visible = useVisible();

  // Cinco segundos para leer con quién va, y se va solo: a las 5 de la
  // mañana nadie tiene que acertar un botón. Pero con la pantalla encendida:
  // cambiar de canal con el móvil bloqueado obliga a Android a arrancar el
  // servicio de voz desde segundo plano, y no lo deja. Espera a que mire.
  useEffect(() => {
    if (!mio || vencido || !visible || volvio) return;
    if (cuenta <= 0) {
      onIrA({ canal: mio.canal, nombre: `Grupo ${mio.letra}`, padre: canal });
      return;
    }
    const t = setTimeout(() => setCuenta((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cuenta, mio?.canal, vencido, visible, volvio]);

  if (!mio || vencido) {
    return (
      <Tarjeta>
        <Etiqueta>subgrupos</Etiqueta>
        <p className="mt-2 text-sm leading-relaxed text-tenue">
          {vencido
            ? "Los grupos ya terminaron: están volviendo a la sala."
            : `La sala está en subgrupos. Tú te quedas aquí${activos.hasta ? `: vuelven en ${formatoMinutos(quedan)}` : ""}.`}
        </p>
      </Tarjeta>
    );
  }
  const otros = mio.miembros.filter((u) => u !== miUid).map(nombreDe);
  return (
    <Tarjeta className="border-acento bg-acento/10">
      <Etiqueta>tu subgrupo</Etiqueta>
      <p className="mt-2 text-lg font-semibold">Grupo {mio.letra}</p>
      <p className="mt-1 text-sm leading-relaxed">
        {otros.length ? `Con ${otros.join(", ")}.` : "Tú solo, por ahora."}
      </p>
      <div className="mt-3">
        <Boton variante="fuerte" ancho onClick={() => onIrA({ canal: mio.canal, nombre: `Grupo ${mio.letra}`, padre: canal })}>
          {volvio ? "Volver a tu grupo" : `Ir ahora · ${cuenta}`}
        </Boton>
      </div>
    </Tarjeta>
  );
}

// ─────────────────────────────────────────── dentro de un subgrupo (todos)

/**
 * Arriba de la sala de un subgrupo: cuál es, con quién, cuánto queda y el
 * botón para volver. A la hora, o si el anfitrión trae a todos de vuelta
 * (cierra el grupo), se vuelve solo a la sala principal.
 */
export function EnSubgrupo({
  sala,
  gente,
  onVolver,
}: {
  sala: Sala;
  gente: Dentro[];
  onVolver: () => void;
}) {
  const quedan = useQuedan(sala.hasta ?? 0);
  const seAcabo = !!sala.hasta && quedan === 0;
  const visible = useVisible();
  const volver = () => {
    yaVolvi.add(sala.canal);
    onVolver();
  };
  // Con el móvil bloqueado no se cambia de canal: a la hora de fin, un aviso
  // de Android (programado ya, suena aunque la app duerma); se olvida al irse.
  useEffect(() => {
    if (sala.hasta) void programarVueltaDelGrupo(sala.hasta, sala.nombre);
    return () => void olvidarVueltaDelGrupo();
  }, [sala.canal, sala.hasta]);
  // Y si el anfitrión los reúne antes, con el móvil bloqueado, se avisa ya.
  useEffect(() => {
    if (!sala.abierta && !visible) void avisarVueltaYa("El anfitrión reunió a todos");
  }, [sala.abierta, visible]);
  // Con la pantalla encendida, por lo mismo que al ir: con el móvil bloqueado
  // se queda oyendo aquí y vuelve en cuanto lo mire.
  useEffect(() => {
    if ((seAcabo || !sala.abierta) && visible) volver();
  }, [seAcabo, sala.abierta, visible]);
  const faltan = (sala.miembros ?? []).filter((u) => !gente.some((g) => g.uid === u)).length;
  return (
    <Tarjeta className="border-acento bg-acento/10">
      <Etiqueta>subgrupo{sala.hasta ? ` · vuelven en ${formatoMinutos(quedan)}` : ""}</Etiqueta>
      <p className="mt-1 text-lg font-semibold">{sala.nombre}</p>
      <p className="mt-1 text-sm leading-relaxed">
        {gente.map((g) => g.nombre).join(", ") || "Llegando…"}
        {faltan > 0 ? <span className="text-tenue"> · faltan {faltan}</span> : null}
      </p>
      <p className="mt-1 text-xs text-tenue">Aquí hablan todos: abre tu micrófono cuando quieras.</p>
      <div className="mt-3">
        <Boton ancho onClick={volver}>
          Volver a la sala principal
        </Boton>
      </div>
    </Tarjeta>
  );
}

// ─────────────────────────────────────────────────────────────── piezas

/** Si la app está a la vista (pantalla encendida y la app delante). */
function useVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const mirar = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", mirar);
    return () => document.removeEventListener("visibilitychange", mirar);
  }, []);
  return visible;
}

/** Los segundos que quedan hasta `hasta` (0 si ya pasó, o si no hay límite). */
export function useQuedan(hasta: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!hasta) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasta]);
  return hasta ? Math.max(0, Math.round((hasta - ahora) / 1000)) : 0;
}

export function formatoMinutos(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * El nombre de alguien por su cuenta. Quien ya se fue a su grupo no está en la
 * lista de esta sala, así que los nombres se guardan también en los subgrupos.
 */
function useNombres(gente: Dentro[], activos: SubgruposDeSala) {
  return (uid: string) =>
    gente.find((g) => g.uid === uid)?.nombre ?? activos.nombres?.[uid] ?? "alguien";
}
