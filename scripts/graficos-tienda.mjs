/**
 * El gráfico destacado de Google Play: 1024×500, y es obligatorio.
 *
 * Es lo primero que se ve al abrir la ficha, encima de todo. Play lo recorta
 * por los lados en algunas pantallas, así que lo que importa va en el centro y
 * los bordes se dejan respirar.
 *
 *   node scripts/graficos-tienda.mjs
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const ORO = "#c9a227";
const FONDO = "#0b0d10";

/** El reloj marcando las tres: la hora que da sentido a toda la aplicación. */
function reloj(escala = 1) {
  const marcas = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const largo = i % 3 === 0 ? 96 : 106;
    const x1 = (Math.sin(a) * largo).toFixed(1);
    const y1 = (-Math.cos(a) * largo).toFixed(1);
    const x2 = (Math.sin(a) * 116).toFixed(1);
    const y2 = (-Math.cos(a) * 116).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ORO}" stroke-opacity="${
      i % 3 === 0 ? 0.85 : 0.35
    }" stroke-width="${i % 3 === 0 ? 7 : 4}" stroke-linecap="round"/>`;
  }).join("");

  return `<g transform="scale(${escala})" opacity="0.92">
    <circle r="150" fill="none" stroke="${ORO}" stroke-opacity="0.22" stroke-width="3"/>
    <circle r="128" fill="none" stroke="${ORO}" stroke-opacity="0.45" stroke-width="6"/>
    ${marcas}
    <line x1="0" y1="0" x2="0" y2="-62" stroke="#e8c65a" stroke-width="11" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="88" y2="0" stroke="#e8c65a" stroke-width="9" stroke-linecap="round"/>
    <circle r="11" fill="${ORO}"/>
  </g>`;
}

const destacado = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8c65a"/>
      <stop offset="1" stop-color="#a8831c"/>
    </linearGradient>
    <radialGradient id="brillo" cx="0.80" cy="0.30" r="0.62">
      <stop offset="0" stop-color="#c9a227" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#c9a227" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1024" height="500" fill="${FONDO}"/>
  <rect width="1024" height="500" fill="url(#brillo)"/>

  <g transform="translate(815 250)">${reloj(0.92)}</g>

  <text x="86" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="25"
        font-weight="600" letter-spacing="6" fill="${ORO}" fill-opacity="0.95">GENUINO LOVE</text>
  <line x1="86" y1="174" x2="330" y2="174" stroke="${ORO}" stroke-opacity="0.35" stroke-width="2"/>

  <text x="86" y="292" font-family="Georgia, Times New Roman, serif" font-size="118"
        font-weight="700" fill="url(#oro)">Genuino</text>

  <text x="86" y="352" font-family="Segoe UI, Arial, sans-serif" font-size="34"
        fill="#e9ecef" fill-opacity="0.92">Disciplina cristiana</text>

  <text x="86" y="410" font-family="Segoe UI, Arial, sans-serif" font-size="25"
        fill="#e9ecef" fill-opacity="0.55">El despertador que sí te levanta a orar</text>
</svg>`;

mkdirSync("docs/tienda", { recursive: true });
await sharp(Buffer.from(destacado)).png().toFile("docs/tienda/destacado-1024x500.png");
console.log("docs/tienda/destacado-1024x500.png");
