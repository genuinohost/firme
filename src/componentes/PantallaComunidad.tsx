import { useEffect, useState } from "react";
import {
  actualizar,
  estadoReunion,
  horaLocalDe,
  leerGuardada,
  salaDeLaUrl,
  type Comunidad,
  type Enlace,
  type Reunion,
} from "@/logica/comunidad";
import { abrirEnlace } from "@/logica/enlaces";
import { copiar } from "@/logica/compartir";
import { Muro } from "./Muro";
import { SalasAbiertas } from "./SalasAbiertas";
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
  if (typeof url !== "string" || /PON_AQUI/i.test(url)) return false;
  // `genuino://sala/...` tambien cuenta: es una sala de voz de la propia app, no
  // un enlace roto. Lo reconoce `salaDeLaUrl`.
  return url.startsWith("https://") || salaDeLaUrl(url) != null;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function PantallaComunidad({
  onEntrarEnSala,
}: {
  /**
   * Una reunion que es una sala de Genuino no se abre en el navegador: se entra.
   * Si no se pasa —en la web, donde no hay voz— se abre como un enlace normal y
   * la propia pantalla de la sala explica que esto es de la app.
   */
  onEntrarEnSala?: (canal: string) => void;
}) {
  const [comunidad, setComunidad] = useState<Comunidad>(() => leerGuardada());
  const [cargando, setCargando] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const [sinAbrir, setSinAbrir] = useState("");

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

  /**
   * Abrir un grupo o una red.
   *
   * Si no se pudo —no hay WhatsApp instalado, por ejemplo— se dice y se enseña
   * el enlace para copiarlo. Antes esto era un `window.open` que dentro de la
   * app no hacía nada en absoluto: se tocaba un grupo y no pasaba nada.
   */
  const abrir = async (url: string) => {
    const canal = salaDeLaUrl(url);
    if (canal && onEntrarEnSala) {
      onEntrarEnSala(canal);
      return;
    }
    if (!(await abrirEnlace(url))) setSinAbrir(url);
  };

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

  /**
   * Si en esta pantalla no hay absolutamente nada.
   *
   * Cuenta también lo que trae `SalasAbiertas`, que se entera aparte: un
   * devocional abierto —o el botón de abrirlo— es contenido, y decir «aquí no
   * hay nada» encima de una sala sonando es lo contrario de informar.
   */
  const [haySalas, setHaySalas] = useState(false);
  const vacia = enlaces.length === 0 && reunionesPuestas.length === 0 && !haySalas;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Comunidad</h1>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          {comunidad.bienvenida ?? "Nadie persevera solo. Únete y anima a otro."}
        </p>
      </header>

      {/*
        El muro va arriba del todo, y no al final con los enlaces.

        Los grupos y las reuniones dependen de que alguien los rellene; el muro
        lo llena la propia gente que usa la app. Ponerlo abajo sería enterrar lo
        único que siempre tiene algo debajo de lo que casi nunca lo tiene.
      */}
      <Muro />

      {/*
        Lo que esta sonando AHORA va antes que los horarios.

        Una reunion publicada dice que va a haber un devocional; esto dice que
        hay uno abierto. El dia que empiece veinte minutos tarde —que es lo que
        pasa siempre— esto es lo unico que lo refleja.
      */}
      {onEntrarEnSala ? (
        <SalasAbiertas onEntrar={onEntrarEnSala} onHayAlgo={setHaySalas} />
      ) : null}

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

      {/*
        Si no se pudo abrir —no tiene WhatsApp instalado, o el enlace es de una
        app que no está— se enseña la dirección para copiarla. Un enlace que se
        toca y no hace nada deja a alguien pensando que la app está rota; uno
        que dice qué pasó y le da el texto, no.
      */}
      {sinAbrir ? (
        <div className="rounded-xl border border-acento/40 bg-acento/5 p-3">
          <p className="text-sm leading-relaxed">
            No se pudo abrir. Copia la dirección y pégala en tu navegador:
          </p>
          <p className="mt-2 break-all text-xs text-tenue">{sinAbrir}</p>
          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <Boton
                ancho
                onClick={async () => {
                  await copiar(sinAbrir);
                  setSinAbrir("");
                }}
              >
                Copiar el enlace
              </Boton>
            </div>
            <Boton onClick={() => setSinAbrir("")}>Cerrar</Boton>
          </div>
        </div>
      ) : null}

      <div className="mt-2">
        <Boton variante="fantasma" ancho onClick={refrescar} deshabilitado={cargando}>
          {cargando ? "Buscando…" : "Buscar novedades"}
        </Boton>
      </div>

      {/*
        Esta frase decia «al entrar sales de la app», y con las salas de voz dejo
        de ser verdad: un devocional de Genuino pasa dentro. Decir que se sale
        cuando no se sale hace que alguien no toque el boton por miedo a perder
        la pantalla.
      */}
      <p className="text-center text-xs leading-relaxed text-tenue">
        Los grupos y las reuniones los lleva quien cuida esta comunidad. Los grupos
        se abren fuera; los devocionales de Genuino, aquí dentro.
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
