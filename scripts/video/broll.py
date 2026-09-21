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
import re

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


ARCHIVO_CLAVES = os.path.join(os.path.expanduser("~"), "claves-broll.txt")


def clave(nombre):
    """La clave, del entorno o de un archivo FUERA del repositorio.

    Pegarlas en el chat las deja escritas en la conversacion para siempre, y
    ponerlas en el codigo las subiria a GitHub. Asi que viven en un archivo de
    su carpeta personal, con una linea por clave:

        PEXELS_KEY=...
        PIXABAY_KEY=...

    `C:/Users/InvitadosPro/claves-broll.txt`. No esta dentro del proyecto, asi
    que ningun `git add` puede llevarselo por delante.
    """
    valor = os.environ.get(nombre)
    if valor:
        return valor
    try:
        with open(ARCHIVO_CLAVES, encoding="utf-8") as f:
            for linea in f:
                if linea.strip().startswith(nombre + "="):
                    return linea.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return None


def pedir(url, cabeceras=None):
    # El User-Agent va SIEMPRE, tambien cuando hay cabeceras propias. Al pasar
    # la clave de Pexels se sustituian las cabeceras enteras y se quedaba sin
    # el; Cloudflare respondia «403 error code: 1010», que parece una clave
    # invalida y no lo es. Se perdio un rato buscando letras mal leidas en una
    # captura cuando la clave estaba bien desde el principio.
    todas = {"User-Agent": "genuino-broll/1"}
    todas.update(cabeceras or {})
    req = urllib.request.Request(url, headers=todas)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def pexels(q):
    llave = clave("PEXELS_KEY")
    if not llave:
        return []
    url = ("https://api.pexels.com/videos/search?" +
           urllib.parse.urlencode({"query": q, "orientation": "portrait", "size": "large",
                                   "locale": "es-ES", "per_page": 40}))
    datos = pedir(url, {"Authorization": llave})
    out = []
    for v in datos.get("videos", []):
        if v.get("duration", 0) < 8:
            continue
        # «Mas alto que ancho» no basta: un 2160x2165 lo cumple y es un
        # cuadrado. Para que llene una pantalla de movil sin barras hace falta
        # al menos 3:2; por debajo hay que recortar tanto que se pierde la
        # composicion del plano.
        archivos = [f for f in v.get("video_files", [])
                    if f.get("width") and f.get("height")
                    and f["height"] >= 1.5 * f["width"] and f["height"] >= 1920]
        if not archivos:
            continue
        mejor = max(archivos, key=lambda f: f["height"])
        out.append({"banco": "Pexels", "id": v["id"], "dur": v["duration"],
                    "ancho": mejor["width"], "alto": mejor["height"], "fps": mejor.get("fps"),
                    "url": mejor["link"], "miniatura": v.get("image"), "pagina": v.get("url"),
                    "etiquetas": ""})
    return out


def pixabay(q):
    llave = clave("PIXABAY_KEY")
    if not llave:
        return []
    url = ("https://pixabay.com/api/videos/?" +
           urllib.parse.urlencode({"key": llave, "q": q, "lang": "es", "min_height": 1920,
                                   "safesearch": "true", "per_page": 50}))
    datos = pedir(url)
    out = []
    for v in datos.get("hits", []):
        etiquetas = v.get("tags", "").lower()
        if any(m in etiquetas for m in MALAS) or v.get("duration", 0) < 8:
            continue
        grande = v.get("videos", {}).get("large") or v.get("videos", {}).get("medium")
        if not grande or grande["height"] < 1.5 * grande["width"] or grande["height"] < 1920:
            continue
        out.append({"banco": "Pixabay", "id": v["id"], "dur": v["duration"],
                    "ancho": grande["width"], "alto": grande["height"], "fps": None,
                    "url": grande["url"], "miniatura": grande.get("thumbnail"),
                    "pagina": v.get("pageURL"), "etiquetas": etiquetas})
    return out


def coverr(q):
    llave = clave("COVERR_KEY")
    if not llave:
        return []
    url = ("https://api.coverr.co/videos?" +
           urllib.parse.urlencode({"query": q, "page_size": 40, "urls": "true", "sort": "popular"}))
    datos = pedir(url, {"Authorization": f"Bearer {llave}"})
    out = []
    for v in datos.get("hits", datos.get("videos", [])):
        w, h = v.get("max_width", 0), v.get("max_height", 0)
        if not w or h < 1.5 * w or h < 1920 or v.get("duration", 0) < 8:
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


def wikimedia(q):
    """Wikimedia Commons: SIN clave, y es la unica fuente de ACONTECIMIENTOS.

    Los bancos de stock tienen amaneceres y manos orando; no tienen el
    terremoto del 24 de junio. Commons si: equipos de rescate, tomas de
    agencias liberadas, material de organismos publicos. Para un video que
    habla de una noticia, eso vale mas que cualquier plano bonito.

    Tres diferencias con los bancos, y hay que respetarlas:

    1. Casi todo viene HORIZONTAL. Hay que reencuadrarlo (recorte al centro
       de la accion, o fondo desenfocado) y por eso no se le aplica la regla
       de vertical.
    2. Casi todo pide CREDITO en pantalla (CC BY, CC BY-SA). Que es lo mismo
       que ya hacemos con los «recibos»: la fuente escrita en el plano.
    3. La calidad es desigual. Aqui la hoja de miniaturas no es un lujo: es
       imprescindible mirar antes de bajar nada.
    """
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json"
           "&generator=search&gsrnamespace=6&gsrlimit=20"
           "&gsrsearch=" + urllib.parse.quote("filetype:video " + q) +
           "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=320")
    datos = pedir(url)
    paginas = (datos.get("query") or {}).get("pages") or {}
    out = []
    for pagina in paginas.values():
        ii = (pagina.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        licencia = (meta.get("LicenseShortName") or {}).get("value", "?")
        autor = (meta.get("Artist") or {}).get("value", "")
        # Se va lo que no deja usarlo o no se puede acreditar en un rotulo.
        if "NC" in licencia or "ND" in licencia:
            continue
        alto = ii.get("height") or 0
        if alto < 480:
            continue
        # Commons guarda programas enteros: la busqueda de «rescue team»
        # devolvia cuatro episodios de dibujos animados de 40 minutos antes
        # que el rescate real de Hatay. Un plano de B-roll no dura cuatro
        # minutos; lo que pasa de ahi es otra cosa.
        if (ii.get("duration") or 0) > 240:
            continue
        out.append({"banco": "Wikimedia", "id": pagina.get("pageid"),
                    "dur": ii.get("duration") or 0,
                    "ancho": ii.get("width"), "alto": alto, "fps": None,
                    "url": ii.get("url"), "miniatura": ii.get("thumburl"),
                    "pagina": ii.get("descriptionurl"),
                    "licencia": licencia,
                    "autor": re.sub("<[^>]+>", "", autor)[:60],
                    "horizontal": (ii.get("width") or 0) >= alto,
                    "etiquetas": ""})
    return out


candidatos = []
for buscar in (pexels, pixabay, coverr, wikimedia):
    try:
        c = buscar(tema_en if buscar in (pexels, wikimedia) else tema)
        candidatos += c
        print(f"  {buscar.__name__:8} {len(c):3} candidatos")
    except Exception as e:  # una API caída no tumba la búsqueda
        print(f"  {buscar.__name__:8} error: {e}")

if not candidatos:
    print("\nSin candidatos ni siquiera en Wikimedia, que no necesita clave. Prueba otras palabras. Para los bancos buenos hacen falta PEXELS_KEY y PIXABAY_KEY.")
    sys.exit(1)

# Se barajan los bancos en vez de cortar por orden de llegada. Pexels
# devuelve 37 y Pixabay 12, y pidiendo doce salían los doce de Pexels: el
# segundo banco no aparecía nunca aunque tuviera el plano bueno.
por_banco = {}
for c in candidatos:
    por_banco.setdefault(c["banco"], []).append(c)
mezclados = []
while len(mezclados) < cuantos and any(por_banco.values()):
    for banco in list(por_banco):
        if por_banco[banco] and len(mezclados) < cuantos:
            mezclados.append(por_banco[banco].pop(0))
candidatos = mezclados
json.dump(candidatos, open("broll-candidatos.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# La hoja de miniaturas, numeradas, para que Alex elija.
carpeta = tempfile.mkdtemp(prefix="broll-")
rutas = []
for i, c in enumerate(candidatos):
    p = os.path.join(carpeta, f"{i:02d}.jpg")
    try:
        # Y aqui tambien el User-Agent: `urlretrieve` no lo manda, y sin el la
        # miniatura vuelve con 403. La hoja salia vacia y la busqueda parecia
        # haber funcionado.
        peticion = urllib.request.Request(c["miniatura"], headers={"User-Agent": "genuino-broll/1"})
        with urllib.request.urlopen(peticion, timeout=30) as r, open(p, "wb") as f:
            f.write(r.read())
        rutas.append(p)
    except Exception as e:
        print(f"  (sin miniatura el {i + 1}: {e})")
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
    aviso = ""
    if c.get("horizontal"):
        aviso += "  HORIZONTAL: hay que reencuadrarlo"
    if c.get("licencia") and c["licencia"] != "Public domain":
        aviso += "  ·  " + c["licencia"] + ": crédito en pantalla"
    print(f"  {i + 1:2}. {c['banco']:9} {c['ancho']}x{c['alto']}  {c['dur']:3.0f} s  {c['pagina']}{aviso}")
