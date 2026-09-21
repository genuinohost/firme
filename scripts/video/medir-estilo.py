"""
Mide un video de referencia: cuanto dura cada plano, como de cerca esta la
cara, donde van los rotulos y como suena.

    python medir-estilo.py <video> [--hasta=43.4] [--muestras=130]

El skill dice desde el 20-09-2026 que para copiar un estilo hay que medirlo
antes, porque «estilo de X» sin numeros es una opinion. No habia herramienta:
se media a mano, distinto cada vez. Esto es esa herramienta.

`--hasta` recorta el final: los videos bajados de TikTok traen cuatro segundos
de coletilla de la plataforma que no son del montaje y estropean las medias.

LO QUE NO VE UN DETECTOR DE ESCENAS. Un hablando-a-camara re-encuadrado
—mismo fondo, misma persona, otro tamano— no cambia de «escena»: `scdet`
encontro 1 corte en 43 segundos donde hay mas de cuarenta. Por eso aqui los
cortes se buscan por diferencia entre fotogramas seguidos, que es lo que
cambia de golpe al saltar de un encuadre a otro.
"""
import json
import os
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import cv2

video = sys.argv[1]
hasta = None
muestras = 130
for a in sys.argv[2:]:
    if a.startswith("--hasta="):
        hasta = float(a.split("=")[1])
    if a.startswith("--muestras="):
        muestras = int(a.split("=")[1])

ficha = json.loads(subprocess.run(
    ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", video],
    capture_output=True, text=True, check=True).stdout)
v = next(s for s in ficha["streams"] if s["codec_type"] == "video")
ancho, alto = int(v["width"]), int(v["height"])
num, den = v["r_frame_rate"].split("/")
fps = float(num) / float(den)
dur = float(ficha["format"]["duration"])
if hasta:
    dur = min(dur, hasta)

print("\n%s" % os.path.basename(video))
print("  %dx%d · %.3f fps · %.1f s%s\n" % (ancho, alto, fps, dur, "  (recortado)" if hasta else ""))

# --------------------------------------------------- 1 · los cortes
carpeta = tempfile.mkdtemp(prefix="estilo-")
subprocess.run([
    "ffmpeg", "-v", "error", "-i", video, "-t", "%.3f" % dur,
    "-vf", "fps=25,scale=96:-2,format=gray", "-y",
    os.path.join(carpeta, "%05d.png"),
], check=True)
nombres = sorted(n for n in os.listdir(carpeta) if n.endswith(".png"))
grises = [cv2.imread(os.path.join(carpeta, n), cv2.IMREAD_GRAYSCALE).astype(np.float32)
          for n in nombres]
difs = np.array([np.mean(np.abs(b - a)) / 255 for a, b in zip(grises, grises[1:])])

# Cada fotograma se compara con SU vecindario (medio segundo a cada lado): un
# corte de verdad es varias veces lo que se movia ahi mismo un momento antes.
# Un umbral global fallaria en los dos sentidos, porque quien habla con las
# manos mueve mucho el cuadro en unos tramos y nada en otros.
#
# Esto encuentra los cambios de PLANO (entra un inserto, un titular, otra
# imagen). Los re-encuadres de la misma toma NO los ve —misma cara, mismo
# fondo, otro tamano— y hay estilos hechos enteros de eso. Se miden aparte,
# por la cara, mas abajo.
ventana = 12
local = np.array([
    float(np.median(difs[max(0, i - ventana):i + ventana + 1])) or 1e-6
    for i in range(len(difs))
])
indices = [i for i, d in enumerate(difs) if d > max(3.0 * local[i], 0.012)]
# Dos fotogramas seguidos por encima son el mismo corte, no dos.
cortes = []
for i in indices:
    if not cortes or i - cortes[-1] > 3:
        cortes.append(i)
tiempos = [round((i + 1) / 25.0, 2) for i in cortes]
largos = np.diff([0.0] + tiempos + [dur])

print("1 · Cortes")
print("  cortes                     %d · uno cada %.2f s · %.0f por minuto"
      % (len(tiempos), dur / max(1, len(tiempos) + 1), len(tiempos) * 60 / dur))
print("  plano: mediana             %.2f s  ·  mas corto %.2f  ·  mas largo %.2f"
      % (np.median(largos), largos.min(), largos.max()))
g = min(7.0, dur)
tramo = lambda a, b: sum(1 for t in tiempos if a <= t < b)
print("  gancho (0-%.0f s)               %d cortes · %.0f por minuto"
      % (g, tramo(0, g), tramo(0, g) * 60 / g))
print("  cuerpo                     %d cortes · %.0f por minuto"
      % (tramo(g, dur - 7), tramo(g, dur - 7) * 60 / max(1.0, dur - 7 - g)))
print("  cierre (ultimos 7 s)       %d cortes" % tramo(dur - 7, dur))
print("  a que segundo              %s%s"
      % (" ".join("%g" % t for t in tiempos[:40]), " ..." if len(tiempos) > 40 else ""))

# --------------------------------------------------- 1 bis · los re-encuadres
# Un salto de encuadre cambia el tamano y el sitio de la cara DE GOLPE; la
# persona, entre dos fotogramas seguidos a 25 por segundo, no puede. Ese es
# todo el truco. Los umbrales (2 % del cuadro de sitio, 6 % de tamano) se
# calibraron mirando tiras de fotogramas cada 0,2 s del video de Jordi
# Segues, donde el detector de escenas encontraba 1 corte y hay decenas.
AQUI = os.path.dirname(os.path.abspath(__file__))
detector = cv2.FaceDetectorYN.create(
    os.path.join(AQUI, "modelos", "yunet.onnx"), "", (320, 568), score_threshold=0.6)

rapido = tempfile.mkdtemp(prefix="estilo-r-")
subprocess.run([
    "ffmpeg", "-v", "error", "-i", video, "-t", "%.3f" % dur,
    "-vf", "fps=25,scale=320:-2", "-y", os.path.join(rapido, "%05d.png"),
], check=True)
pista = []
for nombre in sorted(os.listdir(rapido)):
    img = cv2.imread(os.path.join(rapido, nombre))
    if img is None:
        pista.append(None)
        continue
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, hallazgos = detector.detect(img)
    if hallazgos is None or not len(hallazgos):
        pista.append(None)
        continue
    x, y, fw, fh = max(hallazgos, key=lambda a: a[2] * a[3])[:4]
    pista.append((float((x + fw / 2) / w), float((y + fh / 2) / h), float(fh / h)))
for n in os.listdir(rapido):
    os.remove(os.path.join(rapido, n))
os.rmdir(rapido)

reencuadres = []
for i in range(1, len(pista)):
    a, b = pista[i - 1], pista[i]
    if not a or not b:
        continue
    salto = max(abs(b[0] - a[0]) / 0.02, abs(b[1] - a[1]) / 0.02,
                abs(b[2] - a[2]) / a[2] / 0.06)
    t = i / 25.0
    if salto > 1.5 and (not reencuadres or t - reencuadres[-1] > 0.2):
        reencuadres.append(round(t, 2))

print("\n1 bis · Re-encuadres de la misma toma")
if pista and sum(1 for p in pista if p) > len(pista) * 0.5:
    print("  saltos de encuadre          %d · uno cada %.2f s · %.0f por minuto"
          % (len(reencuadres), dur / max(1, len(reencuadres) + 1),
             len(reencuadres) * 60 / dur))
    juntos = sorted(set(reencuadres + tiempos))
    print("  con los cortes, en total    %d · uno cada %.2f s"
          % (len(juntos), dur / max(1, len(juntos) + 1)))
    print("  a que segundo               %s%s"
          % (" ".join("%g" % t for t in reencuadres[:40]),
             " ..." if len(reencuadres) > 40 else ""))
else:
    print("  no hay cara suficiente para medirlo")

# --------------------------------------------------- 2 · la cara y los rotulos
paso = dur / (muestras + 1)
color = tempfile.mkdtemp(prefix="estilo-c-")
subprocess.run([
    "ffmpeg", "-v", "error", "-i", video, "-t", "%.3f" % dur,
    "-vf", "fps=%.6f,scale=540:-2" % (1.0 / paso), "-frames:v", str(muestras), "-y",
    os.path.join(color, "%04d.png"),
], check=True)

detector = cv2.FaceDetectorYN.create(
    os.path.join(AQUI, "modelos", "yunet.onnx"), "", (540, 960), score_threshold=0.7)

altos_cara, cys, cxs, frentes = [], [], [], []
filas_texto = None
con_rotulo = 0
n_frames = 0
for nombre in sorted(os.listdir(color)):
    img = cv2.imread(os.path.join(color, nombre))
    if img is None:
        continue
    n_frames += 1
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, hallazgos = detector.detect(img)
    if hallazgos is not None and len(hallazgos):
        x, y, fw, fh = max(hallazgos, key=lambda c: c[2] * c[3])[:4]
        altos_cara.append(float(fh / h))
        cys.append(float((y + fh / 2) / h))
        cxs.append(float((x + fw / 2) / w))
        frentes.append(float(y / h))
    # Donde hay rotulo: pixeles casi blancos en el 80% central de cada fila.
    gris = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    centro = gris[:, int(w * 0.1):int(w * 0.9)]
    fila = (centro > 225).sum(axis=1) / float(centro.shape[1])
    if fila.max() > 0.12:
        con_rotulo += 1
    filas_texto = fila if filas_texto is None else filas_texto + fila

print("\n2 · La cara")
if altos_cara:
    print("  se encuentra en            %d de %d muestras" % (len(altos_cara), n_frames))
    print("  la cara ocupa de alto      %.0f %%  (de %.0f a %.0f %%)"
          % (np.median(altos_cara) * 100, min(altos_cara) * 100, max(altos_cara) * 100))
    print("  centro de la cara          y=%.2f  x=%.2f" % (np.median(cys), np.median(cxs)))
    print("  se mueve                   y ±%.1f %%  ·  x ±%.1f %%"
          % (np.std(cys) * 100, np.std(cxs) * 100))
    print("  la frente queda en         y=%.2f   (minimo %.2f; 0 = cortada)"
          % (np.median(frentes), min(frentes)))
else:
    print("  no se encontro ninguna cara")

print("\n3 · Los rotulos")
med = filas_texto / max(1, n_frames)
# La banda del rotulo es la MAS fuerte, no la primera fila que pasa de cero:
# la marca de agua de la plataforma y el logo del microfono tambien son letras
# blancas, y contandolas salia una banda del 32 % del cuadro que no existe.
if med.max() > 0.02:
    pico = int(np.argmax(med))
    corte_banda = med[pico] * 0.5
    arr = pico
    while arr > 0 and med[arr - 1] > corte_banda:
        arr -= 1
    aba = pico
    while aba < len(med) - 1 and med[aba + 1] > corte_banda:
        aba += 1
    filas = [arr, aba]
    print("  banda con texto            de y=%.2f a y=%.2f  (alto %.0f %% del cuadro)"
          % (arr / float(len(med)), aba / float(len(med)),
             (aba - arr) * 100.0 / len(med)))
    print("  linea del rotulo           y=%.2f (el centro de la banda)"
          % ((arr + aba) / 2.0 / len(med)))
    print("  fotogramas con rotulo      %d de %d  (%.0f %%)"
          % (con_rotulo, n_frames, con_rotulo * 100.0 / max(1, n_frames)))
else:
    print("  no se detecto banda de texto clara")

for c in (carpeta, color):
    for n in os.listdir(c):
        os.remove(os.path.join(c, n))
    os.rmdir(c)

# --------------------------------------------------- 4 · el sonido
def ff(af, antes=()):
    # `antes` son opciones de ENTRADA, delante de `-i`. Puesto detras, el
    # segundo `-t` pisa al primero y se mide un trozo que no es el pedido:
    # el suelo de una pausa salia en -19,9 dB (habria musica) cuando medido
    # bien son -40,9 (no la hay).
    return subprocess.run(
        ["ffmpeg", "-hide_banner", *antes, "-i", video, "-t", "%.3f" % dur,
         "-af", af, "-f", "null", "NUL" if os.name == "nt" else "/dev/null"],
        capture_output=True, text=True).stderr

print("\n4 · El sonido")
loud = ff("loudnorm=print_format=summary")
for clave in ("Input Integrated", "Input True Peak", "Input LRA"):
    for linea in loud.splitlines():
        if clave in linea:
            print("  " + linea.strip().replace("Input ", ""))
sil = ff("silencedetect=n=-30dB:d=0.25")
pausas = [float(l.split("silence_duration:")[1]) for l in sil.splitlines() if "silence_duration" in l]
if pausas:
    print("  pausas de mas de 0,25 s    %d · suman %.1f s · la mayor %.2f s"
          % (len(pausas), sum(pausas), max(pausas)))
    inicio = float([l for l in sil.splitlines() if "silence_start" in l][0].split("silence_start:")[1])
    fondo = ff("volumedetect", ("-ss", "%.2f" % (inicio + 0.05), "-t", "0.3"))
    medio = [l for l in fondo.splitlines() if "mean_volume" in l]
    if medio:
        nivel = float(medio[0].split("mean_volume:")[1].replace("dB", "").strip())
        print("  fondo en la pausa          %.1f dB   (%s)"
              % (nivel, "hay musica debajo" if nivel > -34 else "NO hay musica: solo voz"))
else:
    print("  pausas de mas de 0,25 s    ninguna: habla seguido")
print()
