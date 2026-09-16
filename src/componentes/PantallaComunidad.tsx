import { useEffect, useState } from "react";
import {
  actualizar,
  estadoReunion,
  horaLocalDe,
  leerGuardada,
  type Comunidad,
  type Enlace,
  type Reunion,
} from "@/logica/comunidad";
import { Boton, Etiqueta, Vacio } from "./piezas";

/**
 * La comunidad: los grupos y las reuniones en vivo.
 *
 * Nadie persevera solo, y una racha en soledad se rompe antes. Esta pantalla
 * existe para que el que flojea tenga a dónde ir.
 */

const ICONOS: Record<string, string> = {
  whatsapp: "💬",
  telegram: "✈️",
  instagram: "📷",
  tiktok: "🎵",
  youtube: "▶️",
  facebook: "👥",
  web: "🌐",
};

/**
 * Los grupos se separan de las redes.
 *
 * No es lo mismo entrar a un grupo —donde te esperan y te echan de menos si
 * faltas— que seguir una cuenta. Alex: «hay que aprovechar muy bien ese
 * apartado». Aprovecharlo empieza por no mezclar las dos cosas.
 */
const SON_GRUPOS = ["whatsapp", "telegram"];

/**
 * Un enlace sin rellenar no se enseña.
 *
 * El archivo de la comunidad viene con huecos de ejemplo. Enseñar uno lleva a
 * una página rota, y un enlace roto en la pantalla de la comunidad hace más
 * daño que no tener pantalla: la primera impresión es que nadie cuida esto.
 */
function estaPuesto(url: string): boolean {
  return (
    typeof url === "string" &&
    url.startsWith("https://") &&
    !/PON_AQUI/i.test(url)
  );
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function PantallaComunidad() {
  const [comunidad, setComunidad] = useState<Comunidad>(() => leerGuardada());
  const [cargando, setCargando] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    void actualizar().then(setComunidad);
    // El reloj de las reuniones: basta con mirarlo cada medio minuto.
    const id = window.setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const refrescar = async () => {
    setCargando(true);
    setComunidad(await actualizar(true));
    setCargando(false);
  };

  const abrir = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  // En vivo primero, luego lo de hoy, y después el resto de la semana.
  const reuniones = [...comunidad.reuniones].sort((a, b) => {
    const orden = { enVivo: 0, hoy: 1, otroDia: 2 };
    const ea = estadoReunion(a, ahora);
    const eb = estadoReunion(b, ahora);
    if (orden[ea.estado] !== orden[eb.estado]) return orden[ea.estado] - orden[eb.estado];
    return ea.minutos - eb.minutos;
  });

  const enlaces = comunidad.enlaces.filter((e) => estaPuesto(e.url));
  const grupos = enlaces.filter((e) => SON_GRUPOS.includes(e.tipo));
  const redes = enlaces.filter((e) => !SON_GRUPOS.includes(e.tipo));
  const reunionesPuestas = reuniones.filter((r) => estaPuesto(r.url));

  const vacia = enlaces.length === 0 && reunionesPuestas.length === 0;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Comunidad</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          {comunidad.bienvenida ?? "Nadie persevera solo. Únete y anima a otro."}
        </p>
      </header>

      {vacia ? (
        <Vacio>
          {cargando
            ? "Buscando…"
            : "Todavía no hay grupos ni reuniones publicados. Vuelve a mirar en un rato."}
        </Vacio>
      ) : null}

      {/* Las reuniones en vivo mandan: si hay una ahora, se ve lo primero. */}
      {reunionesPuestas.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Etiqueta>reuniones en vivo</Etiqueta>
          {reunionesPuestas.map((r) => (
            <FilaReunion key={r.id} reunion={r} ahora={ahora} onEntrar={() => abrir(r.url)} />
          ))}
        </section>
      ) : null}

      {grupos.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Etiqueta>grupos donde te esperan</Etiqueta>
          {grupos.map((e) => (
            <FilaEnlace key={e.id} enlace={e} onAbrir={() => abrir(e.url)} />
          ))}
        </section>
      ) : null}

      {redes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Etiqueta>Genuino Love por ahí fuera</Etiqueta>
          {redes.map((e) => (
            <FilaEnlace key={e.id} enlace={e} onAbrir={() => abrir(e.url)} />
          ))}
        </section>
      ) : null}

      <div className="mt-2">
        <Boton variante="fantasma" ancho onClick={refrescar} deshabilitado={cargando}>
          {cargando ? "Buscando…" : "Buscar novedades"}
        </Boton>
      </div>

      <p className="text-center text-xs leading-relaxed text-tenue">
        Los grupos y las reuniones los lleva quien cuida esta comunidad. Al entrar
        sales de la app.
      </p>
    </div>
  );
}

function FilaReunion({
  reunion,
  ahora,
  onEntrar,
}: {
  reunion: Reunion;
  ahora: Date;
  onEntrar: () => void;
}) {
  const { estado, minutos } = estadoReunion(reunion, ahora);
  const enVivo = estado === "enVivo";

  const cuando = () => {
    if (enVivo) return `empezó hace ${minutos} min`;
    if (estado === "hoy") {
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      return h > 0 ? `hoy, dentro de ${h} h ${m} min` : `hoy, dentro de ${m} min`;
    }
    const dias =
      reunion.dias.length === 0
        ? "todos los días"
        : reunion.dias.map((d) => DIAS[d]).join(", ");
    return dias;
  };

  return (
    <div
      className={`rounded-xl border p-3.5 transition ${
        enVivo ? "border-logro bg-logro/10" : "border-borde bg-superficie"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {enVivo ? (
              <span className="latido size-2 shrink-0 rounded-full bg-logro" aria-hidden />
            ) : null}
            <p className="truncate text-[15px] font-medium">{reunion.nombre}</p>
          </div>
          {reunion.descripcion ? (
            <p className="mt-0.5 text-xs text-tenue">{reunion.descripcion}</p>
          ) : null}
          <p className="cifras mt-1 text-xs text-tenue">
            {horaLocalDe(reunion, ahora)} · {cuando()}
          </p>
        </div>
        <Boton variante={enVivo ? "logro" : "normal"} onClick={onEntrar}>
          {enVivo ? "Entrar" : "Enlace"}
        </Boton>
      </div>
    </div>
  );
}

function FilaEnlace({ enlace, onAbrir }: { enlace: Enlace; onAbrir: () => void }) {
  return (
    <button
      onClick={onAbrir}
      className="flex items-center gap-3 rounded-xl border border-borde bg-superficie px-3.5 py-3 text-left transition hover:border-acento"
    >
      <span className="text-xl" aria-hidden>
        {ICONOS[enlace.tipo] ?? ICONOS.web}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{enlace.nombre}</span>
        {enlace.descripcion ? (
          <span className="block truncate text-xs text-tenue">{enlace.descripcion}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-tenue">↗</span>
    </button>
  );
}
