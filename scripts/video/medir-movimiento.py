"""
Mide si el zoom avanza parejo o da saltos.

    python medir-movimiento.py <video.mp4> <desde> <hasta>

`zoompan` calcula el recorte en pixeles enteros. Cuando el paso por cuadro es
mas pequeno que un pixel, unos cuadros se mueven y otros no: el zoom avanza a
tirones aunque en el papel sea una rampa perfecta. Eso no se ve en un
fotograma suelto — hay que comparar cuadros seguidos.

Se mide la diferencia media entre cada cuadro y el siguiente. Con movimiento
parejo la serie es plana; con tirones alterna picos y ceros.
"""
import subprocess
import sys
import tempfile
import os

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
from PIL import Image

video, desde, hasta = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
carpeta = tempfile.mkdtemp(prefix="mov-")

subprocess.run([
    "ffmpeg", "-v", "error", "-ss", str(desde), "-i", video,
    "-t", str(hasta - desde), "-vf", "scale=360:640", "-y",
    os.path.join(carpeta, "%03d.png"),
], check=True)

nombres = sorted(os.listdir(carpeta))
cuadros = [np.asarray(Image.open(os.path.join(carpeta, n)).convert("L"),
                      dtype=np.float32) for n in nombres]

difs = [float(np.mean(np.abs(cuadros[i + 1] - cuadros[i])))
        for i in range(len(cuadros) - 1)]

print(f"{len(cuadros)} cuadros entre {desde}s y {hasta}s\n")
maximo = max(difs) or 1.0
for i, d in enumerate(difs):
    barra = "█" * int(d / maximo * 44)
    print(f"{i:3}  {d:6.3f}  {barra}")

media = float(np.mean(difs))
quietos = sum(1 for d in difs if d < media * 0.25)
print(f"\ndiferencia media   {media:.3f}")
print(f"desviacion         {float(np.std(difs)):.3f}  "
      f"({float(np.std(difs)) / media * 100:.0f}% de la media)")
print(f"cuadros casi quietos: {quietos} de {len(difs)}")
if quietos > len(difs) * 0.2:
    print("\n⚠️  Hay cuadros que no se mueven: el zoom va a tirones.")
