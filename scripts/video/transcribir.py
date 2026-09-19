"""
Transcribe los clips de vídeo, con marcas de tiempo.

Corre entero en esta máquina: la voz de Alex no sale a ningún servidor, que
para grabaciones suyas hablando de su fe es exactamente lo que corresponde.

    python transcribir.py <carpeta> [modelo]

Saca por pantalla, y también a un .txt junto a cada vídeo, las frases con el
segundo en que empiezan. Con eso se puede cortar sobre la palabra exacta.
"""
import sys
import os

# El antivirus de esta maquina intercepta HTTPS y firma con su propio
# certificado, asi que Python rechazaba la descarga del modelo con un
# CERTIFICATE_VERIFY_FAILED. `truststore` le dice a Python que confie en lo
# mismo que confia Windows, donde ese certificado si esta.
# La consola de Windows va en cp1252 y revienta al imprimir una flecha.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import truststore
truststore.inject_into_ssl()

from faster_whisper import WhisperModel

carpeta = sys.argv[1] if len(sys.argv) > 1 else "."
# `small` va rápido y en español se porta bien; `medium` afina más y tarda
# unas tres veces más. Sin tarjeta gráfica, `small` es el punto sensato.
tamano = sys.argv[2] if len(sys.argv) > 2 else "small"

print(f"\nCargando el modelo «{tamano}»… (la primera vez se descarga)\n", flush=True)

# int8 en lugar de float: en un procesador sin aceleración es varias veces más
# rápido y la diferencia de exactitud en voz limpia es imperceptible.
modelo = WhisperModel(tamano, device="cpu", compute_type="int8")

videos = sorted(a for a in os.listdir(carpeta) if a.lower().endswith(".mp4"))

for nombre in videos:
    ruta = os.path.join(carpeta, nombre)
    print("=" * 70, flush=True)
    print(nombre, flush=True)
    print("=" * 70, flush=True)

    segmentos, info = modelo.transcribe(
        ruta,
        language="es",
        # Corta los silencios antes de transcribir: sin esto, el modelo se
        # inventa frases en los tramos donde sólo hay aire acondicionado.
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    lineas = []
    for s in segmentos:
        linea = f"[{s.start:6.2f} -> {s.end:6.2f}]  {s.text.strip()}"
        print(linea, flush=True)
        lineas.append(linea)

    if not lineas:
        print("  (sin voz)", flush=True)

    with open(ruta.rsplit(".", 1)[0] + ".txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")

    print(flush=True)

print("Listo.\n", flush=True)
