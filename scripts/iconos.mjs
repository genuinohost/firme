/**
 * El icono, en todos los tamaños que piden Android, la web y Play Store.
 *
 * Se dibuja una sola vez en SVG y de ahí salen todos los PNG. Antes estaban
 * sueltos y cambiar el icono obligaba a rehacerlos a mano uno por uno, que es
 * como se acaba con un icono distinto en cada sitio.
 *
 *   node scripts/iconos.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const FONDO = "#0b0d10";

/**
 * La G, dibujada como un trazo y no como una letra tipográfica.
 *
 * Es un arco de circunferencia al que le falta un trozo por la derecha, y de
 * ahí sale el pie y la barra hacia dentro. Se dibuja así, y no con una fuente,
 * porque el icono tiene que verse igual en cualquier máquina que lo compile:
 * una fuente que no esté instalada se sustituye por otra sin avisar.
 *
 * El trazo va con degradado de oro. Ojo: un degradado se define sobre el
 * rectángulo que envuelve la figura, así que sólo funciona en formas que
 * tengan ancho y alto — en una línea recta queda indefinido y no pinta nada.
 */
function letra({ r = 128, grosor = 54, cx = 256, cy = 256 }) {
  const punto = (grados) => {
    const a = (grados * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [x1, y1] = punto(35); // arriba a la derecha: donde abre el arco
  const [x2, y2] = punto(-35); // abajo a la derecha: donde cierra
  const barra = cx + 28; // hasta dónde llega la barra hacia dentro

  return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)}
            A ${r} ${r} 0 1 0 ${x2.toFixed(1)} ${y2.toFixed(1)}
            L ${x2.toFixed(1)} ${cy}
            L ${barra} ${cy}"
          fill="none" stroke="url(#oro)" stroke-width="${grosor}"
          stroke-linecap="round" stroke-linejoin="round"/>`;
}

const degradado = `<linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e0b93a"/>
      <stop offset="1" stop-color="#a8831c"/>
    </linearGradient>`;

/** El de siempre: esquinas redondeadas y su filete. */
const icono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${degradado}</defs>
  <rect width="512" height="512" rx="112" fill="${FONDO}"/>
  <rect x="14" y="14" width="484" height="484" rx="100" fill="none"
        stroke="#c9a227" stroke-opacity="0.22" stroke-width="6"/>
  ${letra({ r: 124, grosor: 54 })}
</svg>`;

/**
 * El enmascarable. Android lo recorta con la forma que quiera el fabricante
 * —círculo, cuadrado, gota— así que todo lo que importe tiene que caber en el
 * 66 % central. Por eso va sin filete y sin esquinas.
 */
const mascara = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${degradado}</defs>
  <rect width="512" height="512" fill="${FONDO}"/>
  ${letra({ r: 128, grosor: 54 })}
</svg>`;

/** El de la barra de estado: silueta blanca y plana, sin fondo. Lo exige Android. */
const barraEstado = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="oro"><stop offset="0" stop-color="#ffffff"/></linearGradient></defs>
  ${letra({ r: 150, grosor: 64 })}
</svg>`;

writeFileSync("public/icono.svg", icono);
writeFileSync("public/icono-mascara.svg", mascara);

const tareas = [
  ["public/icono-512.png", icono, 512],
  ["public/icono-192.png", icono, 192],
  ["public/icono-180.png", icono, 180],
  ["public/icono-mascara.png", mascara, 512],
  // Play Store pide exactamente 512x512 y sin transparencia.
  ["docs/tienda/icono-play-512.png", icono, 512],
];

// Los del lanzador de Android, en las cinco densidades.
const DENSIDADES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [nombre, lado] of Object.entries(DENSIDADES)) {
  const base = `android/app/src/main/res/mipmap-${nombre}`;
  tareas.push([`${base}/ic_launcher.png`, icono, lado]);
  tareas.push([`${base}/ic_launcher_round.png`, icono, lado]);
  // El primer plano del icono adaptativo lleva margen: Android recorta.
  tareas.push([`${base}/ic_launcher_foreground.png`, mascara, Math.round(lado * 1.5)]);
}

// El de la barra de estado, que es el que sale cuando suena la alarma.
const BARRA = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
for (const [nombre, lado] of Object.entries(BARRA)) {
  tareas.push([
    `android/app/src/main/res/drawable-${nombre}/ic_stat_firme.png`,
    barraEstado,
    lado,
  ]);
}

mkdirSync("docs/tienda", { recursive: true });
for (const [destino, svg, lado] of tareas) {
  await sharp(Buffer.from(svg)).resize(lado, lado).png().toFile(destino);
}
console.log(`${tareas.length} iconos escritos.`);
