"""
Mide donde esta la cara en un video YA MONTADO, y lo escribe por la salida.

    python medir-cara.py <video.mp4> [cuantos-fotogramas]

`encuadrar.py` mide el clip de ORIGEN para decidir los encuadres. Esto es lo
contrario: mide el RESULTADO para comprobar que los encuadres salieron bien.
Son dos trabajos distintos y por eso son dos scripts.

La regla numero uno del skill —nunca tapar la cara, nunca cortarla— no la
comprobaba nadie. Se miraba a ojo en cuatro fotogramas y se daba por bueno.
Asi paso el primer montaje con tres encuadres calculados y ninguno aplicado.

Devuelve la caja entera de cada muestra, no solo el centro, porque para saber
si un rotulo pisa la cara hace falta saber donde acaba la barbilla:

    [{"t": 1.23, "x": 0.41, "y": 0.29, "w": 0.17, "h": 0.22}, ...]

Las muestras sin cara salen con "cara": false, que tambien es un dato: si se
pierde en un tramo entero, ese plano esta mal encuadrado.
"""
import json
import os
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import cv2

video = sys.argv[1]
cuantos = int(sys.argv[2]) if len(sys.argv) > 2 else 120

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "csv=p=0", video],
    capture_output=True, text=True, check=True).stdout.strip())

carpeta = tempfile.mkdtemp(prefix="cara-")
paso = dur / (cuantos + 1)

# Una sola pasada de ffmpeg, no una por fotograma: con 120 muestras, abrir el
# archivo 120 veces tarda minutos. `fps` saca las muestras repartidas solo.
subprocess.run([
    "ffmpeg", "-v", "error", "-i", video,
    "-vf", f"fps={1 / paso:.6f},scale=540:960",
    "-frames:v", str(cuantos), "-y",
    os.path.join(carpeta, "%04d.png"),
], check=True)

AQUI = os.path.dirname(os.path.abspath(__file__))
detector = cv2.FaceDetectorYN.create(
    os.path.join(AQUI, "modelos", "yunet.onnx"), "", (540, 960),
    score_threshold=0.7)

pista = []
for nombre in sorted(os.listdir(carpeta)):
    if not nombre.endswith(".png"):
        continue
    img = cv2.imread(os.path.join(carpeta, nombre))
    if img is None:
        continue
    alto, ancho = img.shape[:2]
    detector.setInputSize((ancho, alto))
    _, hallazgos = detector.detect(img)
    # El indice del png empieza en 1 y la primera muestra cae en paso/2.
    t = round((int(nombre[:4]) - 1) * paso + paso / 2, 2)
    if hallazgos is None or len(hallazgos) == 0:
        pista.append({"t": t, "cara": False})
        continue
    # La mas grande: si algo del fondo se cuela, sera mas pequeno que el.
    x, y, w, h = max(hallazgos, key=lambda c: c[2] * c[3])[:4]
    pista.append({
        "t": t, "cara": True,
        "x": round(float(x / ancho), 4), "y": round(float(y / alto), 4),
        "w": round(float(w / ancho), 4), "h": round(float(h / alto), 4),
    })

for nombre in os.listdir(carpeta):
    os.remove(os.path.join(carpeta, nombre))
os.rmdir(carpeta)

print(json.dumps(pista, ensure_ascii=False))
