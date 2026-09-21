"""
Limpia la voz de un clip grabado en la calle, y lo demuestra con numeros.

    python limpiar-audio.py <entrada> <salida.wav> [opciones]

    --atenua=100     cuanto ruido quita DeepFilterNet, en dB (100 = todo)
    --presencia=2.5  refuerzo en 3 kHz, que es donde se entiende
    --sin-df         sin DeepFilterNet: solo ffmpeg (para comparar)
    --solo-medir     no escribe nada, solo mide la entrada

POR QUE HACE FALTA. El video «Debes ser fructifero» esta grabado en mitad de
una avenida de Caracas con el microfono del telefono. Medido el 20-09-2026:
la voz queda **5,5 dB por encima del trafico**, y el ruido vive en 20-300 Hz,
justo debajo de su voz. Eso no lo arregla subir el volumen: sube el coche
tambien.

QUE HERRAMIENTA, Y POR QUE ESA. Se probaron cuatro sobre el mismo clip:

    original            margen  5,5 dB
    ffmpeg afftdn       margen  5,6 dB   no hace practicamente nada
    RNNoise (4 modelos) margen 12,8 a 18,9 dB
    DeepFilterNet       margen 30,5 dB   <- esta

DeepFilterNet es una red entrenada para separar voz de ruido a 48 kHz, corre
en el procesador (66 segundos de audio en 16) y no manda nada a ningun
servidor, que para las grabaciones de Alex importa. El binario oficial esta
en `C:/Users/InvitadosPro/herramientas/deep-filter.exe`, bajado de la pagina
de versiones del proyecto (Rikorose/DeepFilterNet v0.5.6). No va dentro del
repositorio: pesa 27 MB y es un ejecutable.

DESPUES DE LIMPIAR, TODAVIA HAY TRABAJO. Quitar el ruido deja la voz limpia
pero apagada, porque el ruido tapaba y ademas «rellenaba». La cadena que va
detras es la de siempre y en este orden:

    1. paso alto a 80 Hz      lo que queda de motor, y el viento en el micro
    2. -2 dB en 250 Hz        el «caja» de grabar cerca de una pared o pecho
    3. +N dB en 3 kHz         donde se distinguen las consonantes
    4. deesser                para que ese +3 kHz no saque sibilancias
    5. compresor 3:1          que la frase entera se oiga igual de fuerte
    6. loudnorm -16 LUFS      el nivel con el que entra al montaje

La prueba de que no se rompio la voz NO es el oido: es volver a transcribir
con Whisper y comparar. Si la limpieza se come consonantes, el modelo empieza
a dudar y baja la confianza. Eso se mide; «suena mejor» no.
"""
import os
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import librosa

DEEP_FILTER = os.environ.get(
    "DEEP_FILTER", r"C:/Users/InvitadosPro/herramientas/deep-filter.exe")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
op = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
banderas = {a[2:] for a in sys.argv[1:] if a.startswith("--") and "=" not in a}
if not args:
    print(__doc__)
    sys.exit(1)
entrada = args[0]
salida = args[1] if len(args) > 1 else None
atenua = float(op.get("atenua", 100))
presencia = float(op.get("presencia", 2.5))

SR = 48000


def medir(ruta):
    y, _ = librosa.load(ruta, sr=SR, mono=True)
    h = 960
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=h)[0]
    db = 20 * np.log10(np.maximum(rms, 1e-8))
    esp = np.abs(librosa.stft(y, n_fft=4096)) ** 2
    f = librosa.fft_frequencies(sr=SR, n_fft=4096)
    banda = lambda lo, hi: 10 * np.log10(np.maximum(esp[(f >= lo) & (f < hi)].mean(), 1e-12))
    return {"fondo": np.percentile(db, 5), "voz": np.percentile(db, 75),
            "1-4k": banda(1000, 4000), "graves": banda(20, 200)}


def linea(nombre, m, base=None):
    extra = ""
    if base:
        extra = "   voz %+.1f dB" % (m["1-4k"] - base["1-4k"])
    print("  %-14s fondo %6.1f   voz %6.1f   margen %5.1f dB%s"
          % (nombre, m["fondo"], m["voz"], m["voz"] - m["fondo"], extra))


# La entrada, sea video o audio, pasa a wav de 48 kHz mono.
tmp = tempfile.mkdtemp(prefix="limpiar-")
crudo = os.path.join(tmp, "crudo.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", entrada, "-vn",
                "-c:a", "pcm_s16le", "-ar", str(SR), "-ac", "1", crudo], check=True)

print("\n%s" % os.path.basename(entrada))
antes = medir(crudo)
linea("original", antes)
if antes["voz"] - antes["fondo"] > 25:
    print("  (ya viene limpio: menos de 25 dB de margen es lo que pide limpieza)")
if "solo-medir" in banderas:
    sys.exit(0)

paso = crudo
if "sin-df" not in banderas:
    if not os.path.exists(DEEP_FILTER):
        print("\nNo esta %s\n  Bajalo de github.com/Rikorose/DeepFilterNet (releases, "
              "deep-filter-<version>-x86_64-pc-windows-msvc.exe)" % DEEP_FILTER)
        sys.exit(1)
    fuera = os.path.join(tmp, "df")
    os.makedirs(fuera, exist_ok=True)
    # `-D` compensa el retardo que mete la red. Sin eso el audio queda unos
    # milisegundos tarde y los rotulos, que se pegan a la palabra, se van con
    # el: se nota en la boca.
    subprocess.run([DEEP_FILTER, "-D", "-a", str(atenua), "-o", fuera, crudo],
                   check=True, capture_output=True)
    paso = os.path.join(fuera, os.path.basename(crudo))
    linea("DeepFilterNet", medir(paso), antes)

cadena = (
    "highpass=f=80,"
    "equalizer=f=250:t=q:w=1.2:g=-2,"
    f"equalizer=f=3000:t=q:w=1.5:g={presencia},"
    "deesser=i=0.4,"
    "acompressor=threshold=-18dB:ratio=3:attack=10:release=180,"
    "loudnorm=I=-16:TP=-1.5"
)
final = salida or os.path.join(tmp, "final.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", paso, "-af", cadena,
                "-c:a", "pcm_s16le", "-ar", str(SR), "-ac", "1", final], check=True)
despues = medir(final)
linea("y pulido", despues, antes)

print("\n  margen: %.1f dB  ->  %.1f dB   (%+.1f)"
      % (antes["voz"] - antes["fondo"], despues["voz"] - despues["fondo"],
         (despues["voz"] - despues["fondo"]) - (antes["voz"] - antes["fondo"])))
print("  graves (el trafico): %+.1f dB" % (despues["graves"] - antes["graves"]))
if salida:
    print("\n  %s\n" % salida)
    print("  Comprueba que no se rompio la voz: vuelve a transcribir con")
    print("  large-v3 y compara la confianza con la del original.\n")
