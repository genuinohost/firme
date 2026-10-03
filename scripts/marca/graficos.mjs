/**
 * Las imágenes de marca de Genuino Cristal: la tarjeta que se ve al compartir
 * un enlace, el gráfico destacado de Google Play y el icono de Play.
 *
 *   node scripts/marca/graficos.mjs
 *
 * Sustituye a tarjeta-compartir.mjs, graficos-tienda.mjs e iconos.mjs, que
 * dibujaban la G y el reloj de la identidad anterior. La página se dibuja con
 * las letras de la marca (Syne y Outfit, de node_modules) y se fotografía con
 * Chrome sin pantalla: sharp no sabe cargar fuentes, y con letras de reemplazo
 * saldría otra marca.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((r) => existsSync(r));
if (!CHROME) {
  console.error("Hace falta Chrome o Edge instalado.");
  process.exit(1);
}

const plantilla = pathToFileURL(resolve("scripts/marca/plantillas/compartir.html")).href;

function foto(destino, ancho, alto, consulta = "") {
  const url = `${plantilla}?w=${ancho}&h=${alto}${consulta}`;
  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--force-device-scale-factor=1",
    "--virtual-time-budget=4000",
    `--window-size=${ancho},${alto}`,
    `--screenshot=${resolve(destino)}`,
    url,
  ]);
  console.log(`  ${destino}  ${ancho}×${alto}`);
}

mkdirSync("docs/tienda", { recursive: true });
console.log("Imágenes de marca:");
foto("public/compartir.png", 1200, 630);
// Play recorta por los lados en algunas pantallas: sin el versículo, que se perdería.
foto("docs/tienda/destacado-1024x500.png", 1024, 500, "&sinver=1&lema=" + encodeURIComponent("Alarmas que te levantan. Devocional diario. Comunidad que ora contigo."));

// El icono de Play: 512×512 a sangre (Play le pone su máscara), sin transparencia.
const g = 512 * 0.58;
const off = (512 - g) / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#E9F0FA"/><stop offset="1" stop-color="#F6E7C9"/></linearGradient><linearGradient id="v" gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="96" y2="96"><stop offset="0" stop-color="#E9C878"/><stop offset="0.5" stop-color="#C08E2E"/><stop offset="1" stop-color="#5E8FD6"/></linearGradient></defs><rect width="512" height="512" fill="url(#f)"/><g transform="translate(${off} ${off}) scale(${g / 100})"><path d="M66 9.9 L50 4 L18 16 L4 50 L18 84 L50 96 L82 84 L96 50 L94 45" fill="none" stroke="url(#v)" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 52 H80" stroke="url(#v)" stroke-width="9" stroke-linecap="round"/></g></svg>`;
await sharp(Buffer.from(svg)).flatten({ background: "#FBFAF7" }).png().toFile("docs/tienda/icono-play-512.png");
console.log("  docs/tienda/icono-play-512.png  512×512");
