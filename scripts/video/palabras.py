"""
Saca las palabras de un clip con su segundo exacto, a un JSON.

Es lo que permite los subtítulos que se encienden solos, de dos en dos o de
tres en tres, al ritmo de como habla. Sin esto los rótulos son estáticos y el
vídeo se siente parado aunque tenga cortes.

    python palabras.py <clip.mp4> <salida.json> [modelo]
"""
import sys
import json

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import truststore

truststore.inject_into_ssl()

from faster_whisper import WhisperModel

clip = sys.argv[1]
salida = sys.argv[2]
tamano = sys.argv[3] if len(sys.argv) > 3 else "small"

modelo = WhisperModel(tamano, device="cpu", compute_type="int8")
segmentos, _ = modelo.transcribe(
    clip, language="es", word_timestamps=True, vad_filter=True
)

palabras = []
for s in segmentos:
    for w in s.words or []:
        palabras.append(
            {"t": round(w.start, 3), "fin": round(w.end, 3), "p": w.word.strip()}
        )

with open(salida, "w", encoding="utf-8") as f:
    json.dump(palabras, f, ensure_ascii=False, indent=1)

print(f"{len(palabras)} palabras -> {salida}")
for w in palabras[:6]:
    print(f"  {w['t']:6.2f}  {w['p']}")
