"""
El color de Alex: balance automatico + un punto de luz + un punto de frio.

    python color.py <clip.mp4> [--frio=0|1|2] [cuantos-fotogramas]

El 20-09-2026 vio cinco correcciones del mismo fotograma y eligio el balance
automatico de ffmpeg (`colorcorrect=analyze=median`): pared neutra, piel
natural, un punto frio. Y dijo la regla general: «siempre me gustan los tonos
frios que tienden a un poco azulado». Nunca calido: su salon ya lo es, y la
correccion antigua (curvas + colorbalance calentando altas luces) lo dejaba
amarillo.

**La receta**, en este orden:
1. `colorcorrect=analyze=median` — balance de blancos por la mediana de la
   imagen: quita el amarillo de la luz LED.
2. `colorbalance` — el punto de frio (sombras y medios hacia azul, rojo
   fuera). --frio=0 no lo aplica; 1 suave (lo normal); 2 marcado.
3. `eq` — un poco de gamma y brillo para «clara», saturacion casi intacta.

Ademas mide cuanto de calido venia el clip (ganancia de azul que haria falta
para neutralizar la pared), para dejarlo anotado; y deja
`color-antes-despues.png` junto al clip.

Imprime la linea `color: "..."` lista para `proyecto.mjs`.
"""
import subprocess
import sys
import os
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opciones = [a for a in sys.argv[1:] if a.startswith("--")]
clip = args[0]
cuantos = int(args[1]) if len(args) > 1 else 10
frio = 1
for o in opciones:
    if o.startswith("--frio="):
        frio = int(o.split("=", 1)[1])

FRIO = {
    0: "",
    1: "colorbalance=bs=0.03:bm=0.02:bh=0.02:rs=-0.02,",
    2: "colorbalance=bs=0.06:bm=0.04:bh=0.04:rs=-0.04:rm=-0.02,",
}

filtro = (f"colorcorrect=analyze=median,{FRIO[frio]}"
          f"eq=gamma=1.04:brightness=0.015:saturation=1.03")

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip],
    capture_output=True, text=True, check=True).stdout.strip())

# Cuanto de calido venia: ganancia de azul que dejaria gris lo mas claro.
carpeta = tempfile.mkdtemp(prefix="color-")
paso = dur / (cuantos + 1)
azules = []
for i in range(cuantos):
    ruta = os.path.join(carpeta, f"{i:02d}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(paso * (i + 1)), "-i", clip,
                    "-frames:v", "1", "-vf", "scale=270:480", "-y", ruta], check=True)
    img = np.asarray(Image.open(ruta).convert("RGB"), dtype=np.float64).reshape(-1, 3)
    lum = img.mean(axis=1)
    lo, hi = np.percentile(lum, 90), np.percentile(lum, 99.5)
    claros = img[(lum >= lo) & (lum <= hi)]
    if len(claros) >= 50:
        b = claros.mean(axis=0)
        azules.append(b.mean() / b[2])
calidez = float(np.median(azules)) if azules else 1.0

print(f"clip de {dur:.1f}s · frío {frio}")
print(f"  venía cálido: haría falta ×{calidez:.2f} de azul para dejar gris la pared")
print(f"\n  color: \"{filtro}\",\n")

salida = os.path.join(os.path.dirname(os.path.abspath(clip)), "color-antes-despues.png")
subprocess.run(["ffmpeg", "-v", "error", "-ss", str(dur / 2), "-i", clip, "-frames:v", "1",
                "-filter_complex",
                f"[0:v]split=2[a][b];[b]{filtro}[c];[a][c]hstack=inputs=2,scale=1080:-2",
                "-y", salida], check=True)
print(f"  antes/después: {salida}")
