/**
 * «Ver juntos»: que se entienda cualquier enlace de YouTube y que cada móvil
 * sepa dónde tiene que ir el video.
 *
 *   npm run revisar-verjuntos
 */
import { dondeVa, idDeYouTube, seAparta } from "../src/componentes/VerJuntos";

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

console.log(fallos === 0 ? `\n${pasadas} comprobaciones, sin problemas.\n` : `\n${fallos} de ${fallos + pasadas} FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
