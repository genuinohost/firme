"""
El color de Alex: balance de blancos MEDIDO, un punto de frio, un punto de luz.

    python color.py <clip.mp4> [--frio=0|1|2] [cuantos-fotogramas]

Lo que eligio Alex el 20-09-2026 viendo cinco correcciones del mismo
fotograma fue el balance automatico de ffmpeg (`colorcorrect=analyze=median`):
pared neutra, piel natural, un punto frio. Y la regla general: «siempre me
gustan los tonos frios que tienden a un poco azulado».

Pero `analyze=median` se recalcula EN CADA FOTOGRAMA con la mediana de toda
la imagen (investigado el mismo dia en el codigo fuente del filtro): si la
cara domina el cuadro la vuelve gris, y puede parpadear entre planos. Medido
en el clip del «Trabajo»: estable (±0,016 en la pared), pero depende del
contenido. Aqui se hace lo mismo con NUMEROS FIJOS: se mide una vez lo mas
claro y neutro del clip (la pared) y se aplica el mismo balance a todo. Mismo
aspecto, ningun parpadeo, y vale igual para el B-roll.

**La receta**, en este orden (el orden importa, es el de un colorista):
1. Balance: `colorcorrect=rl:rh:bl:bh` con los valores medidos en YUV. No toca
   la luma. (Formula del filtro: nu = u + y*(bh-bl) + bl; nv = v + y*(rh-rl) + rl.)
2. El punto de frio que eligio: `colorbalance` (sin `pl`, ver la nota de abajo).
   --frio=0 nada; 1 suave (por defecto); 2 marcado.
3. Luz: `curves` con una subida suave de medios. NO `eq=brightness`: es un
   desplazamiento aditivo que saca los blancos de rango (Y>235, superblancos
   ilegales); `curves` mantiene 0/0 y 1/1 y protege negros y blancos.
4. Saturacion apenas (`vibrance` ligero): una vez quitado el amarillo la piel
   ya tiene su color.

Deja `color-antes-despues.png` junto al clip e imprime `color: "..."` para
`proyecto.mjs`.

NOTA DEL 21-09-2026 — POR QUE YA NO SE USA `pl=1`

`colorbalance` tiene una opcion `pl` (preserve lightness) que parecia lo
correcto: cambias el color sin tocar el brillo. En los cinco videos montados
hasta hoy iba puesta.

Lo que hace de verdad con un pixel ya saturado o ya claro es **aplastarlo a
un tono plano**. En «Debes ser fructifero» se veia en dos sitios:

  - el letrero verde de la avenida se llenaba de manchas grises;
  - y mucho peor, **la frente y el pomulo de Alex salian con parches
    blancos**, como si estuviera despellejado.

Lo encontro el, mirando: «se ve de muy mala calidad en el letrero verde».
Ningun numero lo habria dicho: la sonoridad, el contraste y la saturacion
media estaban perfectos.

El mismo `colorbalance` SIN `pl` da el mismo frio y no rompe nada.
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
cuantos = int(args[1]) if len(args) > 1 else 12
frio = 1
for o in opciones:
    if o.startswith("--frio="):
        frio = int(o.split("=", 1)[1])

FRIO = {
    0: "",
    1: "colorbalance=bs=0.03:bm=0.02:bh=0.02:rs=-0.02,",
    2: "colorbalance=bs=0.06:bm=0.04:bh=0.04:rs=-0.04:rm=-0.02,",
}
LUZ = "curves=all='0/0 0.25/0.27 0.5/0.54 0.75/0.78 1/1',vibrance=intensity=0.04"

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip],
    capture_output=True, text=True, check=True).stdout.strip())

# Medir lo mas claro y neutro de cada fotograma: entre el percentil 90 y el
# 99,5 de luminancia (la pared, la mesa, una camisa clara), sin lo quemado.
carpeta = tempfile.mkdtemp(prefix="color-")
paso = dur / (cuantos + 1)
medidas = []
for i in range(cuantos):
    ruta = os.path.join(carpeta, f"{i:02d}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(paso * (i + 1)), "-i", clip,
                    "-frames:v", "1", "-vf", "scale=270:480", "-y", ruta], check=True)
    img = np.asarray(Image.open(ruta).convert("RGB"), dtype=np.float64).reshape(-1, 3) / 255
    lum = img.mean(axis=1)
    lo, hi = np.percentile(lum, 90), np.percentile(lum, 99.5)
    claros = img[(lum >= lo) & (lum <= hi)]
    if len(claros) < 50:
        continue
    R, G, B = claros.mean(axis=0)
    Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
    U = (B - Y) / 1.8556
    V = (R - Y) / 1.5748
    medidas.append((U, V))

if not medidas:
    print("No se pudo medir. Mirar el clip a mano.")
    sys.exit(1)

U, V = np.median(np.array(medidas), axis=0)
# La pared esta en las luces: ahi va la correccion entera (rh/bh). En las
# sombras solo una parte: con el valor entero, la camisa negra de Alex se
# llenaba de manchas azules (visto en el fotograma, 20-09-2026). El filtro
# interpola entre lows y highs segun la luma, asi que los medios quedan
# corregidos y los negros casi intactos.
bh = float(-U)
rh = float(-V)
bl = 0.35 * bh
rl = 0.35 * rh
balance = f"colorcorrect=rl={rl:.3f}:rh={rh:.3f}:bl={bl:.3f}:bh={bh:.3f}"
filtro = f"{balance},{FRIO[frio]}{LUZ}"

print(f"clip de {dur:.1f}s · medido en {len(medidas)} fotogramas · frío {frio}")
print(f"  lo neutro medía U={U:+.3f} V={V:+.3f}  (U<0 y V>0 = cálido, amarillo-naranja)")
print(f"  balance fijo: {balance}")
print(f"\n  color: \"{filtro}\",\n")
# Tambien a un archivo, para que un proyecto lo lea sin pegarlo a mano.
import json
with open(os.path.join(os.path.dirname(os.path.abspath(clip)), "color.json"), "w", encoding="utf-8") as f:
    json.dump({"filtro": filtro, "U": float(U), "V": float(V), "frio": frio}, f, ensure_ascii=False)

salida = os.path.join(os.path.dirname(os.path.abspath(clip)), "color-antes-despues.png")
subprocess.run(["ffmpeg", "-v", "error", "-ss", str(dur / 2), "-i", clip, "-frames:v", "1",
                "-filter_complex",
                f"[0:v]split=2[a][b];[b]{filtro}[c];[a][c]hstack=inputs=2,scale=1080:-2",
                "-y", salida], check=True)
print(f"  antes/después: {salida}")
