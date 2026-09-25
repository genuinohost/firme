"""
Convierte la Reina-Valera 1909 en SQL a un JSON que se pueda consultar.

    python scripts/leer-rv1909.py <data.sql> <salida.json>

La 1909 es de dominio publico y es la que usa el banco de mensajes a
proposito: la 1960 tiene derechos de Sociedades Biblicas Unidas y no se
puede empaquetar en la app sin permiso.

La fuente es github.com/Desarrolladorweb17/biblia-reina-valera-1909-base-datos-sql,
que la declara 1909 en el nombre y en el README. Antes se probo con
aruljohn/Reina-Valera y NO vale: escribe «Aggeo», «Los Actos» y «Revelacion»,
que son grafias de la Reina Valera Antigua, una edicion anterior. Comparar el
banco contra aquella daba siete falsas alarmas.

Deja un JSON asi:  {"Génesis": {"1": {"1": "En el principio crió..."}}}
"""
import io
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

fuente = io.open(sys.argv[1], encoding="utf-8").read()

# Los libros: (numero, 'nombre', ...)
libros = {}
bloque = fuente[fuente.index("INSERT INTO books"):]
bloque = bloque[:bloque.index(";")]
for numero, nombre in re.findall(r"\((\d+),\s*'((?:[^']|'')*)'", bloque):
    libros[int(numero)] = nombre.replace("''", "'")

# Los versiculos: (libro, capitulo, versiculo, 'texto')
biblia = {}
cuantos = 0
for m in re.finditer(r"\((\d+),\s*(\d+),\s*(\d+),\s*'((?:[^']|'')*)'\)", fuente):
    libro, cap, ver, texto = int(m.group(1)), m.group(2), m.group(3), m.group(4)
    if libro not in libros:
        continue
    nombre = libros[libro]
    biblia.setdefault(nombre, {}).setdefault(cap, {})[ver] = texto.replace("''", "'")
    cuantos += 1

json.dump(biblia, io.open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
print("%d libros · %d versículos -> %s" % (len(biblia), cuantos, sys.argv[2]))
print("  " + " · ".join(list(biblia)[:8]) + " …")
