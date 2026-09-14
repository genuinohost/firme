/**
 * La tarjeta que ve el grupo cuando se comparte un mensaje.
 *
 * Hasta ahora `index.html` no tenia ni una etiqueta Open Graph, asi que
 * WhatsApp no encontraba imagen y caia en el favicon: una «F» diminuta y
 * anonima. Debajo de un mensaje para los hermanos, eso no invita a nada y no
 * dice de quien es la app.
 *
 * Se dibuja en SVG y se convierte a PNG porque WhatsApp no lee SVG. Tipografia
 * grande y poco detalle: la vista previa se enseña pequeña.
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const ORO = "#c9a227";
const FONDO = "#0b0d10";

/** El nombre va suelto para poder cambiarlo sin rehacer el diseño. */
const NOMBRE = process.argv[2] ?? "Genuino";
const LEMA = process.argv[3] ?? "El despertador que sí te levanta a orar";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8c65a"/>
      <stop offset="1" stop-color="#a8831c"/>
    </linearGradient>
    <radialGradient id="brillo" cx="0.78" cy="0.28" r="0.62">
      <stop offset="0" stop-color="#c9a227" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#c9a227" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="${FONDO}"/>
  <rect width="1200" height="630" fill="url(#brillo)"/>

  <!-- El reloj: la promesa de la app en un solo dibujo, y a las 3:00. -->
  <g transform="translate(940 315)" opacity="0.92">
    <circle r="150" fill="none" stroke="${ORO}" stroke-opacity="0.22" stroke-width="3"/>
    <circle r="128" fill="none" stroke="${ORO}" stroke-opacity="0.45" stroke-width="6"/>
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      const r1 = i % 3 === 0 ? 96 : 106;
      return `<line x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * 116).toFixed(1)}" y2="${(-Math.cos(a) * 116).toFixed(1)}" stroke="${ORO}" stroke-opacity="${i % 3 === 0 ? 0.85 : 0.35}" stroke-width="${i % 3 === 0 ? 7 : 4}" stroke-linecap="round"/>`;
    }).join("\n    ")}
    <!--
      Las 3:00 en punto: la hora a la que Alex se levanta a orar, y la razón
      de que esta app exista.

      Las manecillas van en color plano a propósito. Un degradado se define
      sobre el rectángulo que envuelve la figura, y el de una línea recta no
      tiene ni ancho ni alto: el degradado queda indefinido y no se pinta nada.
    -->
    <line x1="0" y1="0" x2="0" y2="-62" stroke="#e8c65a" stroke-width="11" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="88" y2="0" stroke="#e8c65a" stroke-width="9" stroke-linecap="round"/>
    <circle r="11" fill="${ORO}"/>
  </g>

  <!-- La comunidad primero: la app es suya, no de una persona. -->
  <text x="96" y="168" font-family="Segoe UI, Arial, sans-serif" font-size="30"
        font-weight="600" letter-spacing="7" fill="${ORO}" fill-opacity="0.95">GENUINO LOVE</text>
  <line x1="96" y1="196" x2="396" y2="196" stroke="${ORO}" stroke-opacity="0.35" stroke-width="2"/>

  <text x="96" y="338" font-family="Georgia, Times New Roman, serif" font-size="140"
        font-weight="700" fill="url(#oro)">${NOMBRE}</text>

  <text x="96" y="412" font-family="Segoe UI, Arial, sans-serif" font-size="38"
        fill="#e9ecef" fill-opacity="0.92">${LEMA}</text>

  <text x="96" y="492" font-family="Georgia, Times New Roman, serif" font-size="29"
        font-style="italic" fill="#e9ecef" fill-opacity="0.55">«Estad firmes y constantes,</text>
  <text x="96" y="530" font-family="Georgia, Times New Roman, serif" font-size="29"
        font-style="italic" fill="#e9ecef" fill-opacity="0.55">creciendo en la obra del Señor.»</text>
  <text x="96" y="568" font-family="Segoe UI, Arial, sans-serif" font-size="24"
        letter-spacing="2" fill="${ORO}" fill-opacity="0.8">1 CORINTIOS 15:58</text>
</svg>`;

const destino = "public/compartir.png";
await sharp(Buffer.from(svg)).png().toFile(destino);
writeFileSync("public/compartir.svg", svg);
console.log(`Tarjeta escrita en ${destino} (1200x630), nombre: ${NOMBRE}`);
