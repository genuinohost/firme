"""
Calcula los encuadres midiendo donde esta la CARA, no a ojo.

    python encuadrar.py <clip.mp4> [cuantos-fotogramas]

Los numeros del primer video —zoom 1,22 y centro 0,42— se sacaron mirando, y
valian para aquel metraje. En este Alex graba de cuerpo entero y de pie: los
mismos numeros dejan la cara diminuta. Por eso se miden.

**Por que la cara y no la silueta.** Se probo primero con movimiento: la
habitacion esta quieta y el no, asi que lo que cambia es el. Pero lo que mas
se mueve son los brazos, y salia el encuadre centrado en el pecho. Lo que
manda en un video vertical es donde estan los ojos.

Devuelve tres encuadres listos para pegar en el guion, con la regla de los
tercios aplicada: **los ojos al 38% del alto**, que es donde el ojo del que
mira los busca.
"""
import subprocess
import sys
import os
import json
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import cv2

clip = sys.argv[1]
cuantos = int(sys.argv[2]) if len(sys.argv) > 2 else 60

# Donde deben caer los ojos dentro del encuadre, de arriba abajo.
OJOS = 0.38
# Cuanto del alto del cuadro debe ocupar la cabeza en cada encuadre.
CABEZA = {"abierto": 0.085, "medio": 0.145, "cerca": 0.215}
# A partir de aqui la imagen se ve blanda: la fuente tiene 1080 px de ancho.
ZOOM_MAXIMO = 1.55

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "csv=p=0", clip],
    capture_output=True, text=True, check=True).stdout.strip())

carpeta = tempfile.mkdtemp(prefix="enc-")
paso = dur / (cuantos + 1)
for i in range(cuantos):
    subprocess.run([
        "ffmpeg", "-v", "error", "-ss", str(paso * (i + 1)), "-i", clip,
        "-frames:v", "1", "-vf", "scale=540:960", "-y",
        os.path.join(carpeta, f"{i:03d}.png"),
    ], check=True)

# YuNet: el detector por red neuronal que trae OpenCV 5 (los Haar de toda la
# vida ya no vienen). El modelo pesa 232 KB y va con el repositorio, en
# scripts/video/modelos/, para que esto funcione sin bajar nada.
AQUI = os.path.dirname(os.path.abspath(__file__))
detector = cv2.FaceDetectorYN.create(
    os.path.join(AQUI, "modelos", "yunet.onnx"), "", (540, 960),
    score_threshold=0.7)

caras = []
pista = []
for nombre in sorted(os.listdir(carpeta)):
    img = cv2.imread(os.path.join(carpeta, nombre))
    alto, ancho = img.shape[:2]
    detector.setInputSize((ancho, alto))
    _, hallazgos = detector.detect(img)
    if hallazgos is None or len(hallazgos) == 0:
        continue
    # La mas grande: si algo del fondo se cuela, sera mas pequeno que el.
    x, y, w, h = max(hallazgos, key=lambda c: c[2] * c[3])[:4]
    caras.append((x / ancho, y / alto, w / ancho, h / alto))
    # float() a todo: YuNet devuelve float32 de numpy y json no sabe escribirlo.
    pista.append({"t": round(float(paso * (int(nombre[:3]) + 1)), 2),
                  "cx": round(float((x + w / 2) / ancho), 4),
                  "cy": round(float((y + h / 2) / alto), 4),
                  "h": round(float(h / alto), 4)})

if not caras:
    print("No se encontro ninguna cara. Mirar el clip a mano.")
    sys.exit(1)

# La pista entera, muestra a muestra, para que el montaje encuadre CADA plano
# con la cara de ese momento. En Filipenses Alex entra caminando: esta en
# x=0,50 los primeros 17 segundos y en 0,64 el resto. Un centro unico para
# todo el video lo dejaria pegado al borde en el arranque.
ruta_pista = os.path.join(os.path.dirname(os.path.abspath(clip)), "cara.json")
with open(ruta_pista, "w", encoding="utf-8") as f:
    json.dump(pista, f, ensure_ascii=False, indent=1)

caras = np.array(caras)
# La mediana, no la media: una deteccion falsa no debe mover el encuadre.
cx = float(np.median(caras[:, 0] + caras[:, 2] / 2))
cy = float(np.median(caras[:, 1] + caras[:, 3] / 2))
ch = float(np.median(caras[:, 3]))

# El resumen tambien a un archivo, para que un proyecto lo lea sin pegarlo.
with open(os.path.join(os.path.dirname(os.path.abspath(clip)), "cara-resumen.json"), "w", encoding="utf-8") as f:
    json.dump({"cx": round(cx, 4), "cy": round(cy, 4), "cabeza": round(ch, 4)}, f)

print(f"clip de {dur:.1f}s · cara encontrada en {len(caras)} de {cuantos} fotogramas\n")
print(f"  la cabeza ocupa el {ch * 100:.1f}% del alto del cuadro")
print(f"  centro de la cara en x={cx:.3f}  y={cy:.3f}")
print(f"  se mueve ±{float(np.std(caras[:, 1] + caras[:, 3] / 2)) * 100:.1f}% en vertical\n")

print("  encuadre   zoom   centro    cabeza queda en")
print("  " + "-" * 46)
for nombre, objetivo in CABEZA.items():
    zoom = objetivo / ch
    recortado = False
    if zoom > ZOOM_MAXIMO:
        zoom, recortado = ZOOM_MAXIMO, True
    if zoom < 1.0:
        zoom = 1.0
    # Que fraccion del cuadro original se ve, y donde hay que centrarla para
    # que los ojos caigan en OJOS.
    visible = 1.0 / zoom
    centro = cy - (OJOS - 0.5) * visible
    centro = min(max(centro, visible / 2), 1 - visible / 2)
    aviso = "   (tope: se veria blando)" if recortado else ""
    print(f"  {nombre:9} {zoom:5.2f}  {centro:6.3f}    {ch * zoom * 100:4.1f}%{aviso}")

print(f"\n  x de la cara: {cx:.3f}  "
      f"({'centrado' if abs(cx - 0.5) < 0.04 else 'DESCENTRADO, hay que corregirlo'})")
