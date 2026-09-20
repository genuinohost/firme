"""
Busca B-roll de muy alta calidad, vertical y sin trampas, y deja una hoja de
candidatos con miniatura para que Alex apruebe ANTES de descargar nada.

    python broll.py "<tema en español>" [--ingles="<tema en inglés>"] [--cuantos=12]

Bancos que cumplen «uso comercial, sin crédito, archivo limpio» (investigado
el 20-09-2026): Pexels (primero: rechaza contenido de IA), Pixabay (segundo:
acepta IA, hay que descartar la etiqueta «ai generated») y Coverr (tercero).
Videvo/Freepik y Vecteezy exigen atribución; Mixkit prohíbe scripts. Las
claves van en variables de entorno, nunca en el código:

    PEXELS_KEY     https://www.pexels.com/api/   (instantánea con cuenta)
    PIXABAY_KEY    https://pixabay.com/api/docs/  (aparece al iniciar sesión)
    COVERR_KEY     https://coverr.co/developers   (al crear una app)

Reglas de oficio que aplica solas:
- vertical de verdad (ancho < alto) y al menos 1080×1920; se elige el archivo
  por ancho y alto, nunca por la etiqueta «quality» (miente en Pexels);
- duración de 8 s o más, aunque se usen 2 o 3: para no cortar en el arranque
  o el frenazo del movimiento de cámara;
- fuera lo que lleve «ai generated», «logo», «text», «editorial» en etiquetas;
- las Biblias de los bancos están en inglés, alemán o portugués: para planos
  de Biblia sólo valen los que no dejan leer el texto (manos sobre la página,
  desenfoque, lomo). Eso no lo sabe una API: lo decide Alex en la hoja.

Deja `broll-candidatos.json` y `broll-candidatos.png` (miniaturas numeradas)
en la carpeta actual. Descargar es otro paso, con los números que él diga.
"""
import sys
import os
import json
import subprocess
import tempfile
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opciones = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
if not args:
    print(__doc__)
    sys.exit(1)
tema = args[0]
tema_en = opciones.get("ingles", tema)
cuantos = int(opciones.get("cuantos", "12"))

MALAS = ("ai generated", "ai-generated", "logo", "text", "editorial", "watermark")


def pedir(url, cabeceras=None):
    req = urllib.request.Request(url, headers=cabeceras or {"User-Agent": "genuino-broll/1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def pexels(q):
    clave = os.environ.get("PEXELS_KEY")
    if not clave:
        return []
    url = ("https://api.pexels.com/videos/search?" +
           urllib.parse.urlencode({"query": q, "orientation": "portrait", "size": "large",
                                   "locale": "es-ES", "per_page": 40}))
    datos = pedir(url, {"Authorization": clave})
    out = []
    for v in datos.get("videos", []):
        if v.get("duration", 0) < 8:
            continue
        archivos = [f for f in v.get("video_files", [])
                    if f.get("width") and f.get("height") and f["width"] < f["height"]
                    and f["height"] >= 1920]
        if not archivos:
            continue
        mejor = max(archivos, key=lambda f: f["height"])
        out.append({"banco": "Pexels", "id": v["id"], "dur": v["duration"],
                    "ancho": mejor["width"], "alto": mejor["height"], "fps": mejor.get("fps"),
                    "url": mejor["link"], "miniatura": v.get("image"), "pagina": v.get("url"),
                    "etiquetas": ""})
    return out


def pixabay(q):
    clave = os.environ.get("PIXABAY_KEY")
    if not clave:
        return []
    url = ("https://pixabay.com/api/videos/?" +
           urllib.parse.urlencode({"key": clave, "q": q, "lang": "es", "min_height": 1920,
                                   "safesearch": "true", "per_page": 50}))
    datos = pedir(url)
    out = []
    for v in datos.get("hits", []):
        etiquetas = v.get("tags", "").lower()
        if any(m in etiquetas for m in MALAS) or v.get("duration", 0) < 8:
            continue
        grande = v.get("videos", {}).get("large") or v.get("videos", {}).get("medium")
        if not grande or grande["width"] >= grande["height"] or grande["height"] < 1920:
            continue
        out.append({"banco": "Pixabay", "id": v["id"], "dur": v["duration"],
                    "ancho": grande["width"], "alto": grande["height"], "fps": None,
                    "url": grande["url"], "miniatura": grande.get("thumbnail"),
                    "pagina": v.get("pageURL"), "etiquetas": etiquetas})
    return out


def coverr(q):
    clave = os.environ.get("COVERR_KEY")
    if not clave:
        return []
    url = ("https://api.coverr.co/videos?" +
           urllib.parse.urlencode({"query": q, "page_size": 40, "urls": "true", "sort": "popular"}))
    datos = pedir(url, {"Authorization": f"Bearer {clave}"})
    out = []
    for v in datos.get("hits", datos.get("videos", [])):
        w, h = v.get("max_width", 0), v.get("max_height", 0)
        if not w or w >= h or h < 1920 or v.get("duration", 0) < 8:
            continue
        etiquetas = " ".join(v.get("tags", [])).lower()
        if any(m in etiquetas for m in MALAS):
            continue
        urls = v.get("urls", {})
        out.append({"banco": "Coverr", "id": v.get("id"), "dur": v.get("duration"),
                    "ancho": w, "alto": h, "fps": None, "url": urls.get("mp4"),
                    "miniatura": v.get("thumbnail") or v.get("poster"),
                    "pagina": v.get("url"), "etiquetas": etiquetas})
    return out


candidatos = []
for buscar in (pexels, pixabay, coverr):
    try:
        c = buscar(tema_en if buscar is pexels else tema)
        candidatos += c
        print(f"  {buscar.__name__:8} {len(c):3} candidatos")
    except Exception as e:  # una API caída no tumba la búsqueda
        print(f"  {buscar.__name__:8} error: {e}")

if not candidatos:
    print("\nSin candidatos. ¿Están las claves en PEXELS_KEY / PIXABAY_KEY / COVERR_KEY?")
    sys.exit(1)

candidatos = candidatos[:cuantos]
json.dump(candidatos, open("broll-candidatos.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# La hoja de miniaturas, numeradas, para que Alex elija.
carpeta = tempfile.mkdtemp(prefix="broll-")
rutas = []
for i, c in enumerate(candidatos):
    p = os.path.join(carpeta, f"{i:02d}.jpg")
    try:
        urllib.request.urlretrieve(c["miniatura"], p)
        rutas.append(p)
    except Exception:
        continue
if rutas:
    entradas = []
    for p in rutas:
        entradas += ["-i", p]
    n = len(rutas)
    cols = min(6, n)
    filas = (n + cols - 1) // cols
    cadena = "".join(
        f"[{i}:v]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,"
        f"drawtext=fontfile='C\\:/Windows/Fonts/ariblk.ttf':text='{i + 1}':fontcolor=white:fontsize=40"
        f":x=10:y=10:box=1:boxcolor=black@0.6:boxborderw=8[t{i}];" for i in range(n))
    cadena += "".join(f"[t{i}]" for i in range(n)) + f"xstack=inputs={n}:layout=" + "|".join(
        f"{(i % cols) * 180}_{(i // cols) * 320}" for i in range(n)) + ":fill=black"
    subprocess.run(["ffmpeg", "-v", "error", *entradas, "-filter_complex", cadena,
                    "-frames:v", "1", "-y", "broll-candidatos.png"], check=True)

print(f"\n{len(candidatos)} candidatos → broll-candidatos.json y broll-candidatos.png")
for i, c in enumerate(candidatos):
    print(f"  {i + 1:2}. {c['banco']:8} {c['ancho']}x{c['alto']}  {c['dur']:3.0f} s  {c['pagina']}")
