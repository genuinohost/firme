/**
 * «Ver juntos»: que se entienda cualquier enlace de YouTube y que cada móvil
 * sepa dónde tiene que ir el video.
 *
 *   npm run revisar-verjuntos
 */
import {
  CARGANDO,
  EN_MARCHA,
  EN_PAUSA,
  TERMINADO,
  decidir,
  dondeVa,
  idDeYouTube,
  medirLatencia,
  seAparta,
  terminoPorTiempo,
  videoSonando,
  type Situacion,
} from "../src/logica/verJuntos";

let fallos = 0;
let pasadas = 0;
function debe(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) pasadas++;
  else fallos++;
  console.log(`${ok ? "  ok  " : "FALLA "} ${nombre}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}

const ID = "dQw4w9WgXcQ";
debe("youtube.com/watch?v=", idDeYouTube(`https://www.youtube.com/watch?v=${ID}&t=42s`), ID);
debe("youtu.be corto", idDeYouTube(`https://youtu.be/${ID}?si=abc`), ID);
debe("el del móvil (m.youtube.com)", idDeYouTube(`https://m.youtube.com/watch?v=${ID}`), ID);
debe("shorts", idDeYouTube(`https://youtube.com/shorts/${ID}`), ID);
debe("en directo (live)", idDeYouTube(`https://www.youtube.com/live/${ID}?feature=share`), ID);
debe("embed", idDeYouTube(`https://www.youtube.com/embed/${ID}`), ID);
debe("sin https", idDeYouTube(`youtu.be/${ID}`), ID);
debe("el identificador suelto", idDeYouTube(ID), ID);
debe("con espacios alrededor (al pegar)", idDeYouTube(`  https://youtu.be/${ID}  `), ID);
debe("otra web, no", idDeYouTube("https://vimeo.com/123456"), null);
debe("un texto cualquiera, no", idDeYouTube("hola hermanos"), null);
debe("una lista sin video, no", idDeYouTube("https://www.youtube.com/playlist?list=PL123"), null);

const t0 = 1_000_000;
debe("en pausa, va donde se paró", dondeVa({ id: ID, estado: "pausa", pos: 30, en: t0 }, t0 + 60_000), 30);
debe("en marcha, avanza con el reloj", dondeVa({ id: ID, estado: "play", pos: 30, en: t0 }, t0 + 12_500), 42.5);
debe("un reloj adelantado no lo manda hacia atrás", dondeVa({ id: ID, estado: "play", pos: 30, en: t0 }, t0 - 5_000), 30);

// ── Lo que publica el anfitrión: sólo lo que se aparta de la sala ─────────
const enMarcha = { id: ID, estado: "play" as const, pos: 30, en: t0 };
const enPausa = { id: ID, estado: "pausa" as const, pos: 30, en: t0 };
debe("sonando donde dice la sala: es el eco, no se publica", seAparta(1, 40.5, enMarcha, t0 + 10_000), null);
debe("pausa con la sala en marcha: se publica la pausa", seAparta(2, 40, enMarcha, t0 + 10_000), "pausa");
debe("play con la sala en pausa: se publica el play", seAparta(1, 30.2, enPausa, t0 + 10_000), "play");
debe("un salto con la barra: se publica", seAparta(1, 95, enMarcha, t0 + 10_000), "play");
debe("en pausa donde dice la sala: nada", seAparta(2, 30.5, enPausa, t0), null);
debe("el final del video: se publica como pausa", seAparta(0, 212, enMarcha, t0 + 10_000), "pausa");
debe("cargando: nada (no es una orden)", seAparta(3, 12, enMarcha, t0 + 10_000), null);

// ── Lo que decide cada móvil (segunda revisión del reproductor) ───────────
const base = (cambios: Partial<Situacion>): Situacion => ({
  estado: EN_MARCHA,
  va: 40,
  dur: 300,
  visible: true,
  sala: enMarcha,
  ahora: t0 + 10_000,
  ahoraLocal: 5_000_000,
  saltoDesde: null,
  latencia: 1.5,
  saltosRecientes: 0,
  ...cambios,
});
debe("a la par: nada", decidir(base({})).tipo, "nada");
debe("fuera de la vista y sonando: se pausa aquí (por no verse)", decidir(base({ visible: false })), { tipo: "pausar", porOculto: true });
debe("fuera de la vista y en pausa: nada", decidir(base({ visible: false, estado: EN_PAUSA })).tipo, "nada");
debe(
  "sala en pausa y el video TERMINADO lejos: salta y pausa (seekTo sobre un terminado lo pondría a sonar)",
  decidir(base({ sala: enPausa, estado: TERMINADO, va: 300 })),
  { tipo: "saltar", a: 30, luego: "pausar" },
);
debe("sala en pausa y sonando cerca: sólo pausar", decidir(base({ sala: enPausa, va: 31 })), { tipo: "pausar", porOculto: false });
{
  const corto = { id: ID, estado: "play" as const, pos: 0, en: t0, dur: 60 };
  debe("terminó por tiempo: a los 61 s de un video de 60", terminoPorTiempo(corto, t0 + 61_000), true);
  debe("y entonces ya no «suena» (los micrófonos se liberan)", videoSonando(corto, t0 + 61_000), false);
  debe("a los 30 s sí suena", videoSonando(corto, t0 + 30_000), true);
  debe("dondeVa no pasa del final", dondeVa(corto, t0 + 90_000), 60);
  debe(
    "terminada la sala, quien sigue sonando muy por detrás se para (no vuelve a empezar)",
    decidir(base({ sala: corto, ahora: t0 + 70_000, va: 50, dur: 60 })),
    { tipo: "pausar", porOculto: false },
  );
  debe("y si ya estaba terminado, nada", decidir(base({ sala: corto, ahora: t0 + 70_000, estado: TERMINADO, va: 60, dur: 60 })).tipo, "nada");
  debe(
    "quien iba por delante llega al final antes: espera, no vuelve a empezar",
    decidir(base({ sala: corto, ahora: t0 + 57_500, estado: TERMINADO, va: 60, dur: 60 })).tipo,
    "nada",
  );
}
debe(
  "el anfitrión al volver, 2 s por detrás y parado: salta compensando, no un simple play (que arrastraría a la sala)",
  decidir(base({ estado: EN_PAUSA, va: 38, estricto: true })).tipo,
  "saltar",
);
debe("quien sigue, 2 s por detrás y parado: basta con play", decidir(base({ estado: EN_PAUSA, va: 38 })).tipo, "play");
{
  const corto = { id: ID, estado: "play" as const, pos: 0, en: t0, dur: 60 };
  debe(
    "al final, quien va 1,5 s por detrás termina sus últimos segundos (no se le corta)",
    decidir(base({ sala: corto, ahora: t0 + 60_000, va: 58.5, dur: 60 })).tipo,
    "nada",
  );
  const pausaFinal = { id: ID, estado: "pausa" as const, pos: 60, en: t0, dur: 60 };
  debe("también si el anfitrión ya publicó la pausa del final", decidir(base({ sala: pausaFinal, va: 58.5, dur: 60 })).tipo, "nada");
}
debe("un salto que aún carga: paciencia", decidir(base({ estado: CARGANDO, va: 10, saltoDesde: 5_000_000 - 3_000 })).tipo, "nada");
debe("con mala red (3 saltos en un minuto) se toleran 6 s antes de saltar otra vez", decidir(base({ va: 35, saltosRecientes: 3 })).tipo, "nada");
debe("con buena red, 5 s de diferencia sí es saltar", decidir(base({ va: 35 })).tipo, "saltar");
debe("un salto reciente mide su latencia", medirLatencia(1_000, 3_500), 2.5);
debe("uno viejo (se quedó a medias por una pausa) no mide nada", medirLatencia(1_000, 70_000), null);
debe("la latencia tiene techo", medirLatencia(1_000, 16_000), 12);

// Red lenta: un salto tarda L segundos en arrancar. Antes, con L > 8 s saltaba
// sin fin y con L ≥ 13 s no sonaba nunca. Simulación: quien entra tarde a un
// video en marcha, comprobando cada 4 s, durante dos minutos.
function simular(L: number): { saltos: number; desfaseFinal: number; sonando: number } {
  const sala = { id: ID, estado: "play" as const, pos: 0, en: 0, dur: 3600 };
  let estado = EN_PAUSA;
  let va = 0;
  let cargaHasta = 0;
  let saltoDesde: number | null = null;
  let latencia = 1.5;
  let saltos = 0;
  let sonando = 0;
  const hechos: number[] = [];
  for (let t = 30_000; t <= 150_000; t += 1_000) {
    if (estado === CARGANDO && t >= cargaHasta) {
      estado = EN_MARCHA;
      const m = medirLatencia(saltoDesde, t);
      if (m != null) latencia = m;
      saltoDesde = null;
    } else if (estado === EN_MARCHA) {
      va += 1;
      sonando += 1;
    }
    if (t % 4_000 !== 0) continue;
    const recientes = hechos.filter((h) => t - h < 60_000).length;
    const a = decidir({ estado, va, dur: 3600, visible: true, sala, ahora: t, ahoraLocal: t, saltoDesde, latencia, saltosRecientes: recientes });
    if (a.tipo === "saltar") {
      va = a.a;
      estado = CARGANDO;
      cargaHasta = t + L * 1000;
      saltoDesde = t;
      saltos++;
      hechos.push(t);
    } else if (a.tipo === "play") {
      estado = CARGANDO;
      cargaHasta = t + 500;
    }
  }
  return { saltos, desfaseFinal: Math.abs(va - 150), sonando };
}
for (const L of [2, 6, 9, 12]) {
  const r = simular(L);
  debe(
    `red con saltos de ${L} s: converge (≤ 3 saltos, a menos de 6 s, sonando casi todo el rato)`,
    r.saltos <= 3 && r.desfaseFinal <= 6 && r.sonando >= 80,
    true,
  );
  if (!(r.saltos <= 3 && r.desfaseFinal <= 6 && r.sonando >= 80)) console.log("       ", JSON.stringify(r));
}

console.log(fallos === 0 ? `\n${pasadas} comprobaciones, sin problemas.\n` : `\n${fallos} de ${fallos + pasadas} FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
