"""
Dibuja la tarjeta del versiculo como UNA imagen con fondo, para superponerla.

    python tarjeta.py <salida.png> <cita> <linea 1> [linea 2 ...]

Con `drawtext` cada linea llevaba su propia caja y salian tres rectangulos de
anchos distintos, escalonados: se veia hecho a trozos. Aqui es una sola caja
redondeada con las lineas centradas dentro, y el montaje la funde entera con
`overlay` + `fade` sobre el canal alfa.

Escribe por stdout el ancho y alto de la imagen, para centrarla.
"""
import sys
import json

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from PIL import Image, ImageDraw, ImageFont

salida, cita, *lineas = sys.argv[1:]

CURSIVA = ImageFont.truetype("C:/Windows/Fonts/georgiai.ttf", 56)
FUERTE = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 40)
ORO = (201, 162, 39, 255)
BLANCO = (233, 236, 239, 255)
FONDO = (11, 13, 16, 190)
BORDE = (201, 162, 39, 110)

MARGEN = 44
ENTRE = 14
SEP_CITA = 22

anchos = [CURSIVA.getlength(l) for l in lineas] + [FUERTE.getlength(cita)]
alto_linea = 66
ancho = int(max(anchos)) + MARGEN * 2
alto = MARGEN * 2 + alto_linea * len(lineas) + ENTRE * (len(lineas) - 1) + SEP_CITA + 48

img = Image.new("RGBA", (ancho, alto), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, ancho - 1, alto - 1], radius=26, fill=FONDO, outline=BORDE, width=2)

y = MARGEN
for l in lineas:
    w = CURSIVA.getlength(l)
    d.text(((ancho - w) / 2, y), l, font=CURSIVA, fill=ORO)
    y += alto_linea + ENTRE
y += SEP_CITA - ENTRE
w = FUERTE.getlength(cita)
d.text(((ancho - w) / 2, y), cita, font=FUERTE, fill=BLANCO)

img.save(salida)
print(json.dumps({"ancho": ancho, "alto": alto}))
