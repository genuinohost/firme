"""
Comprueba las 365 citas del banco contra un texto biblico de referencia.

    python scripts/revisar-citas.py <carpeta con los libros en json>

POR QUE HACE FALTA. `revisar-banco.mjs` ya mira la estructura: duplicados,
longitudes, formato. Lo que nadie habia comprobado es si cada versiculo dice
de verdad lo que dice su cita. Alex es Capellan y su palabra esta de por
medio: una cita mal puesta en la app le cuesta a el, no al codigo.

QUE COMPRUEBA, Y QUE NO

  1. Que la referencia EXISTA: que el libro este, que el capitulo exista y
     que el versiculo no se salga del capitulo. Esto es objetivo y vale para
     cualquier edicion, porque la numeracion no cambia entre ellas.

  2. Que no haya citas repetidas.

  3. Que el texto del banco se PAREZCA al de esa referencia, contando cuantas
     palabras largas comparten. Esto NO dice que algo este mal: dice que hay
     que mirarlo.

EL AVISO IMPORTANTE. El texto de referencia que se baja mas facil
(aruljohn/Reina-Valera en GitHub) NO es la 1909: escribe «Aggeo», «Miqueas»
con acento raro, «Los Actos» y «Revelacion», que son grafias de la Reina
Valera Antigua, anterior. El banco usa la 1909. Por eso el punto 3 marca
cosas que no estan mal, solo escritas distinto, y por eso el veredicto de si
una cita esta bien o mal **lo da Alex, no este script**.

Lo que si caza sin discusion es el punto 1, y un texto atribuido a un libro
que no le corresponde: ahi el parecido se hunde a cero.
"""
import collections
import glob
import io
import json
import os
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CARPETA = sys.argv[1] if len(sys.argv) > 1 else "biblia"

# El banco usa nombres modernos; la referencia, los antiguos.
EQUIV = {
    "Mateo": "San Mateo", "Marcos": "San Márcos", "Lucas": "San Lúcas",
    "Juan": "San Juan", "1 Juan": "1 San Juan", "2 Juan": "2 San Juan",
    "3 Juan": "3 San Juan", "Judas": "San Júdas", "Hechos": "Los Actos",
    "Apocalipsis": "Revelación", "Eclesiastés": "Eclesiástes",
    "Miqueas": "Miquéas", "Oseas": "Oséas", "Esdras": "Ésdras", "Hageo": "Aggeo",
}

mensajes = []
for ruta in sorted(glob.glob("src/datos/mensajes/tanda*.ts"),
                   key=lambda r: int(re.search(r"tanda(\d+)", r).group(1))):
    texto = io.open(ruta, encoding="utf-8").read()
    for bloque in texto.split("\n  {")[1:]:
        cita = re.search(r'cita:\s*"([^"]+)"', bloque)
        vers = re.search(r'versiculo:\s*\n?\s*"(.*?)",\n', bloque, re.S)
        tema = re.search(r'tema:\s*"([^"]+)"', bloque)
        if cita and vers:
            mensajes.append({
                "archivo": os.path.basename(ruta),
                "tema": tema.group(1) if tema else "",
                "cita": cita.group(1),
                "texto": vers.group(1).replace('\\"', '"'),
            })

biblia = {}
for ruta in glob.glob(os.path.join(CARPETA, "*.json")):
    datos = json.load(io.open(ruta, encoding="utf-8"))
    biblia[os.path.basename(ruta)[:-5]] = {
        c["chapter"]: {v["verse"]: v["text"] for v in c["verses"]}
        for c in datos["chapters"]
    }


def palabras(t):
    """Las palabras largas, sin tildes ni mayusculas: lo que sobrevive a que
    dos ediciones escriban distinto."""
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return set(re.findall(r"[a-z]{4,}", t))


print("\nBanco: %d mensajes  ·  referencia: %d libros\n" % (len(mensajes), len(biblia)))

rotas, flojas = [], []
for m in mensajes:
    partes = re.match(r"^(.+?)\s+(\d+):(\d+)(?:[-,](\d+))?$", m["cita"])
    if not partes:
        rotas.append((m["cita"], "no tiene forma de cita"))
        continue
    libro, cap, v1, v2 = partes.group(1), int(partes.group(2)), int(partes.group(3)), partes.group(4)
    nombre = EQUIV.get(libro, libro)
    if nombre not in biblia:
        rotas.append((m["cita"], "no tengo el libro «%s» para comprobarlo" % libro))
        continue
    if cap not in biblia[nombre]:
        rotas.append((m["cita"], "el capítulo %d no existe (el libro tiene %d)"
                      % (cap, max(biblia[nombre]))))
        continue
    versos = biblia[nombre][cap]
    if v1 not in versos:
        rotas.append((m["cita"], "el versículo %d no existe (el capítulo tiene %d)"
                      % (v1, max(versos))))
        continue
    hasta = int(v2) if v2 else v1
    if hasta not in versos:
        rotas.append((m["cita"], "el versículo %d no existe (el capítulo tiene %d)"
                      % (hasta, max(versos))))
        continue
    ref = " ".join(versos[v] for v in range(v1, hasta + 1) if v in versos)
    a, b = palabras(m["texto"]), palabras(ref)
    parecido = len(a & b) / max(1, len(a))
    if parecido < 0.45:
        flojas.append((parecido, m, ref))

print("1 · REFERENCIAS QUE NO CUADRAN: %d" % len(rotas))
for cita, motivo in rotas:
    print("     %-20s %s" % (cita, motivo))
if not rotas:
    print("     ninguna: las 365 apuntan a un versículo que existe")

repes = [(c, n) for c, n in collections.Counter(m["cita"] for m in mensajes).items() if n > 1]
print("\n2 · CITAS USADAS MÁS DE UNA VEZ: %d" % len(repes))
for cita, n in sorted(repes, key=lambda x: -x[1]):
    print("     %-20s %d veces" % (cita, n))
if not repes:
    print("     ninguna")

print("\n3 · PARA QUE ALEX LOS MIRE (el texto no se parece a su referencia): %d de %d"
      % (len(flojas), len(mensajes)))
for parecido, m, ref in sorted(flojas, key=lambda x: x[0]):
    print("\n     %s   ·   %s   ·   parecido %.0f %%"
          % (m["cita"], m["archivo"], parecido * 100))
    print("       banco:      %s" % m["texto"])
    print("       referencia: %s" % ref)
print("\n     Recuerda: la referencia es una edición ANTERIOR a la 1909, así que")
print("     una parte de estos son la misma frase escrita de otra manera.")
