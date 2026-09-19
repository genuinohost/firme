"""
Analiza una pista de música: tempo, golpes y curva de energía.

Sirve para dos cosas, y las dos cambian mucho el resultado:

1. **Cortar sobre el golpe.** Un corte que cae medio segundo antes o después
   del pulso se siente flojo aunque nadie sepa decir por qué. Cayendo encima,
   el vídeo parece montado por alguien que sabe.

2. **Elegir la pista con datos.** Un vídeo que abre con una pregunta incómoda
   y cierra llamando a descargar necesita una pista que **empiece baja y suba**.
   Eso se ve en la curva de energía, no hace falta adivinarlo.

    python musica.py <carpeta-o-archivo> [segundos-del-video]
"""
import sys
import os

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import librosa

ruta = sys.argv[1]
duracion_video = float(sys.argv[2]) if len(sys.argv) > 2 else 55.0

archivos = (
    [os.path.join(ruta, a) for a in sorted(os.listdir(ruta)) if a.lower().endswith((".mp3", ".wav", ".m4a"))]
    if os.path.isdir(ruta)
    else [ruta]
)

for archivo in archivos:
    y, sr = librosa.load(archivo, sr=22050, mono=True)
    tempo, golpes = librosa.beat.beat_track(y=y, sr=sr, units="time")
    tempo = float(np.atleast_1d(tempo)[0])

    # La energía en tramos de cinco segundos, normalizada. Es lo que dice si la
    # pista crece o se queda plana.
    rms = librosa.feature.rms(y=y)[0]
    tiempos = librosa.times_like(rms, sr=sr)
    tramos = []
    for inicio in range(0, int(duracion_video), 5):
        sel = (tiempos >= inicio) & (tiempos < inicio + 5)
        tramos.append(float(rms[sel].mean()) if sel.any() else 0.0)
    pico = max(tramos) or 1.0
    tramos = [t / pico for t in tramos]

    # Cuánto sube de la primera cuarta parte a la última: el "arco".
    n = max(1, len(tramos) // 4)
    arco = (sum(tramos[-n:]) / n) - (sum(tramos[:n]) / n)

    print(f"\n{'=' * 64}")
    print(os.path.basename(archivo))
    print(f"{'=' * 64}")
    print(f"  tempo     {tempo:.0f} golpes por minuto")
    print(f"  golpes    {len(golpes)} en toda la pista")
    print(f"  arco      {arco:+.2f}   (positivo = crece hacia el final)")
    print("  energía   " + "".join("▁▂▃▄▅▆▇█"[min(7, int(t * 7.99))] for t in tramos))
    print(f"            0s{' ' * (len(tramos) - 4)}{int(duracion_video)}s")

    # Los golpes de los primeros segundos, que son los que se usan para cortar.
    utiles = [g for g in golpes if g < duracion_video]
    print(f"  primeros  {', '.join(f'{g:.2f}' for g in utiles[:12])}")

    # Y se guardan todos, para que el montaje los lea.
    salida = archivo.rsplit(".", 1)[0] + "-golpes.txt"
    with open(salida, "w", encoding="utf-8") as f:
        f.write("\n".join(f"{g:.3f}" for g in golpes) + "\n")

print()
