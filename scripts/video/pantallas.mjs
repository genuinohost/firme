/**
 * Los planos de pantalla del vídeo, sacados de las capturas de la tienda.
 *
 * Alex no tiene que grabar el móvil: las capturas ya existen, están limpias y
 * se ven mejor que una grabación de pantalla. Se les da un empuje de zoom lento
 * para que no parezcan una foto fija.
 *
 * Salen en 1080x1920 sobre el fondo real de la app, para que encajen sin
 * costura con los planos grabados en vertical.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const FONDO = "0x0b0d10";
const ORIGEN = "C:/Users/InvitadosPro/developer/firme/docs/tienda/capturas/listas";
const DESTINO = "C:/Users/InvitadosPro/Desktop/videos-genuino/pantallas";

mkdirSync(DESTINO, { recursive: true });

// Cada plano: de qué captura sale, cuánto dura y cuánto empuja el zoom.
const PLANOS = [
  { nombre: "p15-alarma", fuente: "02-alarma-bloqueado.png", seg: 4.5, zoom: 1.10 },
  { nombre: "p23-porque", fuente: "01-hoy-con-racha.png", seg: 4.0, zoom: 1.14 },
  { nombre: "p31-planes", fuente: "04-plan-racha-y-batalla.png", seg: 4.0, zoom: 1.12 },
  { nombre: "p42-restaurado", fuente: "03-plan-santidad.png", seg: 5.0, zoom: 1.10 },
];

for (const p of PLANOS) {
  const salida = join(DESTINO, p.nombre + ".mp4");
  const cuadros = Math.round(p.seg * 30);
  // El paso del zoom se reparte entre todos los cuadros: así el empuje acaba
  // exactamente en el factor pedido, dure lo que dure el plano.
  const paso = ((p.zoom - 1) / cuadros).toFixed(6);

  const filtro = [
    // Se encaja DENTRO del lienzo, no se escala por el alto a secas.
    //
    // Escalar por el alto reventaba con la captura de la alarma, que es
    // apaisada: salía más ancha que el lienzo y ffmpeg se negaba a rellenar
    // un hueco negativo. Es la tercera vez que esa misma captura rompe algo.
    "scale=1350:2400:force_original_aspect_ratio=decrease",
    `pad=1350:2400:(ow-iw)/2:(oh-ih)/2:${FONDO}`,
    `zoompan=z='min(zoom+${paso},${p.zoom})':d=${cuadros}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`,
    // Una viñeta muy suave, para que el centro pese más que los bordes.
    "vignette=PI/6",
  ].join(",");

  execFileSync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-loop", "1",
      "-i", join(ORIGEN, p.fuente),
      "-t", String(p.seg),
      "-vf", filtro,
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      salida,
    ],
    { stdio: "inherit" },
  );

  const info = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height,nb_frames",
     "-of", "csv=p=0", salida],
    { encoding: "utf8" },
  ).trim();
  console.log(`  ok  ${p.nombre}.mp4  ${info}  (${p.seg}s)`);
}

console.log(`\nListos en ${DESTINO}\n`);
