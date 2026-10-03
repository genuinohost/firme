/**
 * Genera todos los iconos de Genuino Cristal desde la gema (6.29, 2-10-2026).
 *
 *   node scripts/marca/generar-iconos.mjs
 *
 * La G tallada en ocho caras, abierta arriba a la derecha como las puertas que
 * «no serán cerradas» (Ap 21:25), con el trazo del oro al cielo. Manual de marca:
 * https://claude.ai/artifact/LJMhzTFqg6qzyJ6xuBQJVn
 *
 * Escribe: public/icono*.svg|png, y en Android los mipmap del lanzador, el
 * fondo del icono adaptable, la pantalla de arranque y el icono de las
 * notificaciones (blanco, como pide Android).
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PERLA = "#FBFAF7";
const degradado = (id) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="96" y2="96"><stop offset="0" stop-color="#E9C878"/><stop offset="0.5" stop-color="#C08E2E"/><stop offset="1" stop-color="#5E8FD6"/></linearGradient>`;
const fondoNacar = `<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#E9F0FA"/><stop offset="1" stop-color="#F6E7C9"/></linearGradient>`;

/** La gema en un cuadro de 100, con el trazo que se pida. */
const gema = (trazo, grosor = 8) =>
  `<path d="M66 9.9 L50 4 L18 16 L4 50 L18 84 L50 96 L82 84 L96 50 L94 45" fill="none" stroke="${trazo}" stroke-width="${grosor}" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 52 H80" stroke="${trazo}" stroke-width="${grosor}" stroke-linecap="round"/>`;

/** Gema centrada en un lienzo cuadrado de `lado`, ocupando `parte` del lado. */
function svgGema({ lado, parte, fondo, redondeo = 0, trazo = "url(#v)", grosor = 8 }) {
  const g = lado * parte;
  const off = (lado - g) / 2;
  const capaFondo =
    fondo === "nacar"
      ? `<rect width="${lado}" height="${lado}" rx="${redondeo}" fill="url(#f)"/>`
      : fondo
        ? `<rect width="${lado}" height="${lado}" rx="${redondeo}" fill="${fondo}"/>`
        : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}"><defs>${degradado("v")}${fondoNacar}</defs>${capaFondo}<g transform="translate(${off} ${off}) scale(${g / 100})">${gema(trazo, grosor)}</g></svg>`;
}

const png = (svg, ruta, w, h = w) => sharp(Buffer.from(svg)).resize(w, h).png().toFile(ruta);

// ── La web ──────────────────────────────────────────────────────────────────
const icono = svgGema({ lado: 512, parte: 0.58, fondo: "nacar", redondeo: 112, grosor: 9 });
writeFileSync("public/icono.svg", icono);
const mascara = svgGema({ lado: 512, parte: 0.46, fondo: "nacar", grosor: 9 });
writeFileSync("public/icono-mascara.svg", mascara);
await png(icono, "public/icono-512.png", 512);
await png(icono, "public/icono-192.png", 192);
await png(svgGema({ lado: 180, parte: 0.58, fondo: "nacar", grosor: 9 }), "public/icono-180.png", 180);
await png(mascara, "public/icono-mascara.png", 512);

// ── Android: el lanzador ───────────────────────────────────────────────────
const res = "android/app/src/main/res";
const densidades = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densidades)) {
  const lado = Math.round(48 * k);
  await png(svgGema({ lado, parte: 0.58, fondo: "nacar", redondeo: lado * 0.22, grosor: 9 }), join(res, `mipmap-${d}`, "ic_launcher.png"), lado);
  await png(svgGema({ lado, parte: 0.56, fondo: "nacar", redondeo: lado / 2, grosor: 9 }), join(res, `mipmap-${d}`, "ic_launcher_round.png"), lado);
  // Adaptable: 108 dp, con la gema dentro de la zona segura (66 dp del centro).
  const fg = Math.round(108 * k);
  await png(svgGema({ lado: fg, parte: 0.42, grosor: 9 }), join(res, `mipmap-${d}`, "ic_launcher_foreground.png"), fg);
  // Notificaciones: silueta blanca sobre transparente, 24 dp.
  const st = Math.round(24 * k);
  await png(svgGema({ lado: st, parte: 0.84, trazo: "#FFFFFF", grosor: 11 }), join(res, `drawable-${d}`, "ic_stat_firme.png"), st);
}
writeFileSync(
  join(res, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PERLA}</color>\n</resources>\n`,
);

// ── Android: la pantalla de arranque (nácar con la gema en el centro) ─────
for (const carpeta of readdirSync(res).filter((c) => c === "drawable" || /^drawable-(port|land)-/.test(c))) {
  const ruta = join(res, carpeta, "splash.png");
  let meta;
  try {
    meta = await sharp(ruta).metadata();
  } catch {
    continue;
  }
  const { width: w, height: h } = meta;
  const g = Math.round(Math.min(w, h) * 0.26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${degradado("v")}<linearGradient id="n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#EEF3FA"/><stop offset="1" stop-color="#F6E7C9"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#n)"/><g transform="translate(${(w - g) / 2} ${(h - g) / 2}) scale(${g / 100})">${gema("url(#v)", 8)}</g></svg>`;
  await png(svg, ruta, w, h);
}
console.log("Iconos de Genuino Cristal generados.");
