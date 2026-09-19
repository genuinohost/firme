/**
 * Deja todos los clips listos para montar: mismo tamaño, mismos cuadros por
 * segundo, mismo audio.
 *
 * Los originales vienen a 1920x1080 con una marca de rotación de -90 grados.
 * Muchos programas la ignoran y sacan el vídeo tumbado; aquí se aplica de
 * verdad y se deja el archivo ya en vertical, para que el montaje no dependa
 * de que nadie lea esa marca.
 *
 * El audio se nivela a -16 LUFS, que es lo que piden las redes. Sin esto, el
 * clip grabado de pie suena el doble de fuerte que el de la mesa y el montaje
 * parece hecho a trozos, que es exactamente lo que es.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "C:/Users/InvitadosPro/OneDrive/Desktop/videos-genuino";
const DESTINO = join(BASE, ".trabajo", "listos");
mkdirSync(DESTINO, { recursive: true });

const clips = readdirSync(BASE)
  .filter((a) => a.toLowerCase().endsWith(".mp4"))
  .sort();

console.log(`\n${clips.length} clips\n`);

for (const clip of clips) {
  // Un nombre corto y sin espacios ni acentos, que ffmpeg agradece.
  const nombre = clip
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "")
    .replace(/-18-09-2026|-19-09-2026/, "")
    .replace(/\.mp4$/i, "")
    .toLowerCase();
  const salida = join(DESTINO, nombre + ".mp4");

  execFileSync(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", join(BASE, clip),
      // `transpose` no hace falta: ffmpeg ya aplica la rotación al decodificar.
      // Lo que sí hace falta es encajar en 1080x1920 sin deformar.
      "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease," +
             "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:0x0b0d10,fps=30",
      "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      salida,
    ],
    { stdio: "inherit" },
  );

  const info = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height:format=duration",
     "-of", "default=nw=1:nk=1", salida],
    { encoding: "utf8" },
  ).trim().split("\n");

  console.log(`  ok  ${nombre}.mp4  ${info[0]}x${info[1]}  ${Number(info[2]).toFixed(1)}s`);
}

console.log(`\nListos en ${DESTINO}\n`);
