/**
 * Cuatro estilos de rótulo, sobre el mismo plano, para elegir viendo.
 *
 * Santiago Muñoz propone generar bocetos de estilos y ir descartando. La idea
 * es buena; aquí se hace un paso mejor: en vez de bocetos, se renderiza **el
 * plano real con el texto real** en cada estilo. Lo que Alex vea es
 * exactamente lo que va a quedar, no una aproximación.
 *
 * Los cuatro salen de la identidad de la app —fondo #0b0d10, dorado #c9a227,
 * Segoe UI y Georgia—, así que ninguno desentona con Genuino.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "C:/Users/InvitadosPro/OneDrive/Desktop/videos-genuino";
const LISTOS = join(BASE, ".trabajo", "listos");
const T = join(BASE, ".trabajo", "estilos");
mkdirSync(T, { recursive: true });

const ORO = "0xc9a227";
const FUERTE = "C\\:/Windows/Fonts/segoeuib.ttf";
const NORMAL = "C\\:/Windows/Fonts/segoeui.ttf";
const CITA = "C\\:/Windows/Fonts/georgiai.ttf";

const ff = (a) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: "inherit" });
const esc = (t) => t.replace(/:/g, "\\:").replace(/'/g, "\u2019");

const L1 = esc("Le dijiste a Dios");
const L2 = esc("que mañana te levantabas.");

const ESTILOS = [
  {
    n: "1-actual",
    nombre: "1 · EL ACTUAL",
    // Barra oscura abajo y texto blanco. Sobrio, se lee siempre.
    f: `drawbox=x=0:y=ih*0.56:w=iw:h=ih*0.44:color=0x000000@0.58:t=fill,` +
       `drawtext=fontfile='${FUERTE}':text='${L1}\n${L2}':fontcolor=white:fontsize=62:x=(w-text_w)/2:y=h*0.70:line_spacing=16`,
  },
  {
    n: "2-editorial",
    nombre: "2 · EDITORIAL",
    // Serif en cursiva y una regla dorada encima. Tono de devocional impreso.
    f: `drawbox=x=0:y=ih*0.60:w=iw:h=ih*0.40:color=0x0b0d10@0.72:t=fill,` +
       `drawbox=x=iw*0.30:y=ih*0.655:w=iw*0.40:h=3:color=${ORO}@0.9:t=fill,` +
       `drawtext=fontfile='${CITA}':text='${L1}\n${L2}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.70:line_spacing=22`,
  },
  {
    n: "3-tarjeta",
    nombre: "3 · TARJETA",
    // Una tarjeta como las de la app, con su filo dorado a la izquierda.
    //
    // Ojo con la x del texto: `drawtext` NO entiende `iw`/`ih` -solo `w`/`h`-
    // aunque `drawbox`, dos lineas mas arriba, si las entienda. El error que
    // da es "undefined constant", que no lleva a eso en absoluto.
    f: `drawbox=x=iw*0.07:y=ih*0.66:w=iw*0.86:h=ih*0.17:color=0x14181d@0.95:t=fill,` +
       `drawbox=x=iw*0.07:y=ih*0.66:w=8:h=ih*0.17:color=${ORO}:t=fill,` +
       `drawtext=fontfile='${NORMAL}':text='${L1}\n${L2}':fontcolor=0xe9ecef:fontsize=54:x=w*0.12:y=h*0.695:line_spacing=14`,
  },
  {
    n: "4-rotundo",
    nombre: "4 · ROTUNDO",
    // Sin fondo: letra grande con sombra dura. Lo que se lleva en redes.
    f: `drawtext=fontfile='${FUERTE}':text='${L1}':fontcolor=white:fontsize=84:x=(w-text_w)/2:y=h*0.66:shadowcolor=black@0.85:shadowx=4:shadowy=4,` +
       `drawtext=fontfile='${FUERTE}':text='${L2}':fontcolor=${ORO}:fontsize=84:x=(w-text_w)/2:y=h*0.735:shadowcolor=black@0.85:shadowx=4:shadowy=4`,
  },
];

const trozos = [];
for (const e of ESTILOS) {
  const salida = join(T, e.n + ".mp4");
  const etiqueta = `drawtext=fontfile='${FUERTE}':text='${esc(e.nombre)}':fontcolor=${ORO}:fontsize=44:x=(w-text_w)/2:y=h*0.07`;
  ff(["-ss", "0", "-t", "3.2", "-i", join(LISTOS, "01.2-viendo-tv.mp4"),
    "-f", "lavfi", "-t", "3.2", "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", `fps=30,scale=1080:1920,setsar=1,${e.f},${etiqueta}`,
    "-map", "0:v", "-map", "1:a", "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", salida]);
  trozos.push(salida);
  console.log(`  ok  ${e.nombre}`);
}

const lista = join(T, "lista.txt");
writeFileSync(lista, trozos.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));

const FINAL = join(BASE, "Genuino-estilos.mp4");
ff(["-f", "concat", "-safe", "0", "-i", lista,
  "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", FINAL]);

console.log(`\n${FINAL}\n`);
