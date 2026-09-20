"""
Mide si la musica tapa la voz, medio segundo a medio segundo.

    python medir-audio.py <voz.wav> <musica.wav>

Los dos archivos salen del montaje con **los mismos filtros que el video
final**, antes del `loudnorm`. Como el `loudnorm` aplica la misma ganancia a
los dos, el margen entre ellos no cambia: lo que se mide aqui es lo que se oye.

El margen es cuanto esta la voz por encima de la musica, en decibelios. Por
debajo de 8 dB la voz empieza a costar; por debajo de 4 dB se pierde.
"""
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import librosa

voz, sr = librosa.load(sys.argv[1], sr=None, mono=True)
mus, _ = librosa.load(sys.argv[2], sr=sr, mono=True)
n = min(len(voz), len(mus))
voz, mus = voz[:n], mus[:n]

# Ventana corta: con medio segundo, el final de una frase entra en la misma
# ventana que el silencio que la sigue, la voz baja 6 dB y parece que la musica
# la tapa cuando en realidad ya habia terminado de hablar.
PASO = int(sr * 0.25)

# Y el umbral es relativo a su propia voz, no un numero fijo: lo que interesa
# es si la musica tapa **lo que esta diciendo**, no las colas de las frases.
MARGEN_VOZ = 9.0


def db(x):
    r = float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))
    return 20 * np.log10(max(r, 1e-9))


# La mediana de los tramos que suenan, para saber cual es "su" nivel normal.
niveles = [db(voz[i:i + PASO]) for i in range(0, n - PASO, PASO)]
suena = [d for d in niveles if d > -45]
referencia = float(np.median(suena)) - MARGEN_VOZ if suena else -45.0
print(f"nivel normal de su voz: {float(np.median(suena)):.1f} dB · "
      f"se cuenta como voz por encima de {referencia:.1f} dB")
print()


print(f"{'seg':>6} {'voz':>7} {'musica':>7} {'margen':>7}")
print("-" * 32)

margenes = []
peor = (99.0, 0.0)
for i in range(0, n - PASO, PASO):
    t = i / sr
    dv, dm = db(voz[i:i + PASO]), db(mus[i:i + PASO])
    if dv < referencia:
        print(f"{t:6.1f} {dv:7.1f} {dm:7.1f}    sin voz")
        continue
    m = dv - dm
    margenes.append(m)
    if m < peor[0]:
        peor = (m, t)
    aviso = "  <-- AJUSTADO" if m < 8 else ("  <-- SE PIERDE" if m < 4 else "")
    print(f"{t:6.1f} {dv:7.1f} {dm:7.1f} {m:7.1f}{aviso}")

print("-" * 32)
if margenes:
    print(f"margen medio   {np.mean(margenes):6.1f} dB")
    print(f"margen minimo  {peor[0]:6.1f} dB  en el segundo {peor[1]:.1f}")
    malos = sum(1 for m in margenes if m < 8)
    print(f"tramos por debajo de 8 dB: {malos} de {len(margenes)}")

# El margen medio solo mide los tramos en que habla, o sea con la musica ya
# agachada: sale alto aunque la musica se oiga perfectamente entre frase y
# frase. Esta es la medida que faltaba — cuanto suena la musica cuando el
# callar la deja subir.
huecos = []
for i in range(0, n - PASO, PASO):
    if db(voz[i:i + PASO]) < referencia:
        huecos.append(db(mus[i:i + PASO]))
if huecos:
    entre = float(np.median(huecos))
    print()
    print(f"musica entre frases {entre:6.1f} dB  "
          f"({float(np.median(suena)) - entre:+.1f} respecto a su voz)")
    if float(np.median(suena)) - entre > 18:
        print("   la musica no se oye ni cuando calla")
    elif float(np.median(suena)) - entre < 2:
        print("   la musica sube demasiado en los huecos")
    else:
        print("   se oye, y no compite")
