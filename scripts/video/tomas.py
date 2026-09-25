"""
tomas.py — de las tomas sueltas al clip central, sin elegirlas a mano.

    python scripts/video/tomas.py <carpeta-del-proyecto> [modelo]

Para los vídeos que se graban POR TRAMOS (una hoja del teleprompter, una
toma), no de un tirón. El primero fue el de aliados, 24-09-2026: siete tramos
y la toma 8 en silencio para tapar cortes.

Lo que hace:

1. Transcribe cada vídeo de `<carpeta>/tomas/` con Whisper en local (la
   transcripción se guarda y no se repite si el archivo no cambió).
2. Reconoce qué tramo del guion (`guion.json`) dice cada toma. No hace falta
   nombrar los archivos ni grabarlos en orden: se compara lo dicho con el
   texto, palabra a palabra y con tolerancia, porque Alex **no lee**: mira de
   reojo y lo dice con sus palabras. Cada tramo admite varias versiones del
   texto (el guion ha tenido dos).
3. Si un tramo se grabó varias veces —o con un arranque en falso dentro de la
   misma toma—, se queda con la versión más completa; a igualdad, con la
   ÚLTIMA, que suele ser la buena.
4. Recorta cada tramo en límites de palabra, con aire antes y después, sin
   comerse la palabra vecina. Re-codifica (nunca `-c copy`, deja cuadros
   congelados) y funde 30 ms el audio en cada extremo.
5. Los une en `.trabajo/central.mp4` a 1080×1920, 30 fps y −16 LUFS, y deja
   las palabras YA en el tiempo del clip central (`palabras-grande.json`):
   no hay que volver a transcribir.

Deja también:
  .trabajo/tramos.json         dónde empieza y acaba cada tramo en el central
  .trabajo/tomas-informe.txt   qué toma se eligió y qué palabras faltaron

La toma sin voz (treinta segundos mirando al lente) se reconoce sola y queda
anotada en `tramos.json` como `relleno`.
"""
import sys
import os
import json
import re
import unicodedata
import subprocess
from difflib import SequenceMatcher

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CARPETA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
MODELO = sys.argv[2] if len(sys.argv) > 2 else "large-v3"
TOMAS = os.path.join(CARPETA, "tomas")
TRABAJO = os.path.join(CARPETA, ".trabajo")
CACHE = os.path.join(TRABAJO, "tomas")
os.makedirs(CACHE, exist_ok=True)

EXTENSIONES = (".mp4", ".mov", ".m4v", ".3gp", ".mkv")
UMBRAL = 0.45  # por debajo, la toma no dice ese tramo

with open(os.path.join(CARPETA, "guion.json"), encoding="utf-8") as f:
    GUION = json.load(f)
AIRE_ANTES = GUION.get("aire", {}).get("antes", 0.10)
AIRE_DESPUES = GUION.get("aire", {}).get("despues", 0.25)


# ── Comparar palabras ───────────────────────────────────────────────────────

NUMEROS = {
    "1": "uno", "2": "dos", "3": "tres", "4": "cuatro", "5": "cinco", "6": "seis",
    "7": "siete", "8": "ocho", "9": "nueve", "10": "diez", "20": "veinte",
    "25": "veinticinco", "30": "treinta", "40": "cuarenta", "50": "cincuenta",
    "100": "cien",
}


def normal(palabra):
    """Minúsculas, sin tildes ni signos; los números, en letra.

    Whisper escribe «20%» donde Alex dice «veinte por ciento», y el guion lo
    tiene en letra. Las dos cosas se reducen a «veinte» (el «%» se tira): así
    casan sin que un signo cuente como palabra fallada.
    """
    p = unicodedata.normalize("NFD", palabra.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    p = re.sub(r"[^a-z0-9ñ]", "", p)
    return NUMEROS.get(p, p)


def palabras_de(texto):
    # «por ciento» se quita en el guion por lo mismo que el «%» en lo dicho.
    junto = " ".join(normal(w) for w in texto.split())
    junto = re.sub(r"\bpor ciento\b", "", junto)
    return junto.split()


def mejor_ventana(objetivo, dichas):
    """La ventana de `dichas` que mejor dice `objetivo`.

    Devuelve (parecido, primera, ultima, emparejadas) con los índices de la
    primera y la última palabra DICHA que casan con el guion: los bordes
    salen de lo que casa, no de la ventana, para no arrastrar el «eh» de
    antes ni el comentario de después.
    """
    n = len(objetivo)
    if not dichas or not n:
        return (0.0, -1, -1, set())
    arranques = {0}
    cabeza = set(objetivo[:3])
    for i, w in enumerate(dichas):
        if w in cabeza:
            arranques.add(i)
    mejor = (0.0, -1, -1, set())
    for i in sorted(arranques):
        for largo in range(max(1, int(n * 0.6)), int(n * 1.5) + 2):
            ventana = dichas[i:i + largo]
            if not ventana:
                break
            sm = SequenceMatcher(None, objetivo, ventana, autojunk=False)
            r = sm.ratio()
            # `>=` y arranques en orden: a igualdad gana el más tardío, que es
            # el que sigue a un arranque en falso.
            if r >= mejor[0] and r > 0:
                bloques = [b for b in sm.get_matching_blocks() if b.size]
                if not bloques:
                    continue
                emparejadas = set()
                for b in bloques:
                    emparejadas.update(range(b.a, b.a + b.size))
                primera = i + bloques[0].b
                ultima = i + bloques[-1].b + bloques[-1].size - 1
                mejor = (r, primera, ultima, emparejadas)
            if i + largo >= len(dichas):
                break
    return mejor


# ── Transcribir (con caché) ─────────────────────────────────────────────────

def duracion(ruta):
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(salida)


_modelo = None


def transcribir(ruta):
    global _modelo
    st = os.stat(ruta)
    firma = f"{st.st_size}-{int(st.st_mtime)}-{MODELO}"
    cache = os.path.join(CACHE, os.path.basename(ruta) + ".json")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            guardado = json.load(f)
        if guardado.get("firma") == firma:
            return guardado["palabras"]
    # Una toma sin pista de audio hace saltar al decodificador de Whisper con
    # un IndexError que no lo menciona. Sin audio no hay palabras: es relleno.
    pistas = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
         "-of", "csv=p=0", ruta], capture_output=True, text=True).stdout.strip()
    if not pistas:
        with open(cache, "w", encoding="utf-8") as f:
            json.dump({"firma": firma, "palabras": []}, f)
        return []
    if _modelo is None:
        import truststore
        truststore.inject_into_ssl()
        os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
        from faster_whisper import WhisperModel
        print(f"  cargando Whisper {MODELO}…")
        _modelo = WhisperModel(MODELO, device="cpu", compute_type="int8")
    segmentos, _ = _modelo.transcribe(ruta, language="es", word_timestamps=True, vad_filter=True)
    palabras = []
    for s in segmentos:
        for w in s.words or []:
            if w.word.strip():
                palabras.append({"t": round(w.start, 3), "fin": round(w.end, 3), "p": w.word.strip()})
    with open(cache, "w", encoding="utf-8") as f:
        json.dump({"firma": firma, "palabras": palabras}, f, ensure_ascii=False, indent=1)
    return palabras


# ── 1 · Leer todas las tomas ────────────────────────────────────────────────

if not os.path.isdir(TOMAS):
    print(f"No existe {TOMAS}. Deja ahí los vídeos tal como salen del teléfono.")
    sys.exit(1)
archivos = sorted(
    (a for a in os.listdir(TOMAS) if a.lower().endswith(EXTENSIONES)),
    # Orden de grabación: primero la fecha del archivo, después el nombre
    # (los teléfonos numeran en orden).
    key=lambda a: (os.path.getmtime(os.path.join(TOMAS, a)), a))
if not archivos:
    print(f"No hay vídeos en {TOMAS}.")
    sys.exit(1)

print(f"\n{len(archivos)} tomas en {TOMAS}\n")
tomas = []
for orden, a in enumerate(archivos):
    ruta = os.path.join(TOMAS, a)
    print(f"· {a}")
    pal = transcribir(ruta)
    dur = duracion(ruta)
    tomas.append({"archivo": a, "ruta": ruta, "orden": orden, "dur": dur,
                  "palabras": pal, "normales": [normal(w["p"]) for w in pal]})
    print(f"    {dur:5.1f} s · {len(pal)} palabras: {' '.join(w['p'] for w in pal)[:90]}")

# Quitar las vacías de las listas normalizadas conservando el índice original.
for tm in tomas:
    N = tm["normales"]
    for i in range(len(N) - 1):
        if N[i] == "por" and N[i + 1] == "ciento":
            N[i] = N[i + 1] = ""
    tm["indices"] = [i for i, n in enumerate(tm["normales"]) if n]
    tm["dichas"] = [tm["normales"][i] for i in tm["indices"]]


# ── 2 · Qué tramo dice cada toma, y cuál se queda ───────────────────────────

elegidas = []
faltan = []
for tramo in GUION["tramos"]:
    candidatas = []
    for tm in tomas:
        for version, texto in enumerate(tramo["textos"]):
            objetivo = palabras_de(texto)
            r, a, b, emp = mejor_ventana(objetivo, tm["dichas"])
            if r < UMBRAL or a < 0:
                continue
            candidatas.append({
                "toma": tm, "parecido": r, "version": version,
                "primera": tm["indices"][a], "ultima": tm["indices"][b],
                "posicion": a,
                "faltaron": [w for k, w in enumerate(objetivo) if k not in emp],
                "cobertura": len(emp) / len(objetivo),
            })
    if not candidatas:
        faltan.append(tramo)
        continue
    tope = max(c["parecido"] for c in candidatas)
    # Casi empatadas (a 0,05): la última grabada, y dentro de ella la más tardía.
    buenas = [c for c in candidatas if c["parecido"] >= tope - 0.05]
    elegida = max(buenas, key=lambda c: (c["toma"]["orden"], c["posicion"]))
    elegida["tramo"] = tramo
    elegida["descartadas"] = len({c["toma"]["archivo"] for c in candidatas} - {elegida["toma"]["archivo"]})
    elegidas.append(elegida)

if faltan:
    print("\n❌ Estos tramos no están en ninguna toma:")
    for t in faltan:
        print(f"   {t['n']} · {t['nombre']}: «{t['textos'][0][:70]}…»")
    print("   Graba esos tramos y vuelve a ejecutar esto: lo ya transcrito no se repite.")
    sys.exit(1)

# El relleno: la toma larga sin apenas voz.
relleno = next((tm for tm in tomas if len(tm["palabras"]) < 4 and tm["dur"] >= 6), None)


# ── 3 · Recortar y unir ─────────────────────────────────────────────────────

print("\nRecortando…")
cortes = []
for k, e in enumerate(elegidas):
    tm = e["toma"]
    W = tm["palabras"]
    i, j = e["primera"], e["ultima"]
    desde = W[i]["t"] - AIRE_ANTES
    hasta = W[j]["fin"] + AIRE_DESPUES
    # Sin comerse la palabra de al lado (un arranque en falso, un comentario).
    if i > 0:
        desde = max(desde, W[i - 1]["fin"] + 0.02)
    if j + 1 < len(W):
        hasta = min(hasta, W[j + 1]["t"] - 0.02)
    desde, hasta = max(0.0, desde), min(tm["dur"], hasta)
    salida = os.path.join(CACHE, f"tramo-{e['tramo']['n']}.mp4")
    d = hasta - desde
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{desde:.3f}", "-i", tm["ruta"], "-t", f"{d:.3f}",
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
               "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:0x0b0d10,fps=30,setsar=1",
        "-af", f"aresample=48000,afade=t=in:st=0:d=0.03,afade=t=out:st={d - 0.03:.3f}:d=0.03",
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
        "-c:a", "pcm_s16le", "-ac", "2", salida.replace(".mp4", ".mov"),
    ], check=True)
    cortes.append({"e": e, "archivo": salida.replace(".mp4", ".mov"), "desde": desde, "hasta": hasta})

lista = os.path.join(CACHE, "lista.txt")
with open(lista, "w", encoding="utf-8") as f:
    for c in cortes:
        f.write(f"file '{c['archivo'].replace(os.sep, '/')}'\n")

central = os.path.join(TRABAJO, "central.mp4")
subprocess.run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", lista,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", central,
], check=True)

if relleno:
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", relleno["ruta"],
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,"
               "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:0x0b0d10,fps=30,setsar=1",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        os.path.join(TRABAJO, "relleno.mp4"),
    ], check=True)


# ── 4 · Las palabras y los tramos, en el tiempo del central ─────────────────
#
# Con la duración REAL de cada recorte (ffprobe), no con la pedida: cada uno
# se redondea al cuadro y, sumados, siete redondeos ya mueven un rótulo.

palabras = []
tramos = []
t0 = 0.0
for c in cortes:
    e = c["e"]
    W = e["toma"]["palabras"]
    real = duracion(c["archivo"])
    for w in W[e["primera"]:e["ultima"] + 1]:
        palabras.append({"t": round(t0 + w["t"] - c["desde"], 3),
                         "fin": round(t0 + w["fin"] - c["desde"], 3), "p": w["p"]})
    tramos.append({
        "n": e["tramo"]["n"], "nombre": e["tramo"]["nombre"],
        "desde": round(t0, 3), "hasta": round(t0 + real, 3),
        "voz_desde": round(t0 + W[e["primera"]]["t"] - c["desde"], 3),
        "voz_hasta": round(t0 + W[e["ultima"]]["fin"] - c["desde"], 3),
        "toma": e["toma"]["archivo"], "en_toma": [round(c["desde"], 3), round(c["hasta"], 3)],
        "version": e["version"], "parecido": round(e["parecido"], 3),
        "cobertura": round(e["cobertura"], 3), "faltaron": e["faltaron"],
    })
    t0 += real

total = duracion(central)
with open(os.path.join(TRABAJO, "palabras-grande.json"), "w", encoding="utf-8") as f:
    json.dump(palabras, f, ensure_ascii=False, indent=1)
with open(os.path.join(TRABAJO, "tramos.json"), "w", encoding="utf-8") as f:
    json.dump({"duracion": round(total, 3), "tramos": tramos,
               "relleno": "relleno.mp4" if relleno else None,
               "relleno_dur": round(relleno["dur"], 2) if relleno else 0},
              f, ensure_ascii=False, indent=1)


# ── 5 · El informe ──────────────────────────────────────────────────────────

lineas = [f"Central: {total:.1f} s · {len(tramos)} tramos · {len(tomas)} tomas leídas", ""]
for t, e in zip(tramos, elegidas):
    marca = "✅" if t["cobertura"] >= 0.85 else "⚠️"
    ver = "PDF" if t["version"] == 0 else "texto corto"
    lineas.append(f"{marca} {t['n']} · {t['nombre']:<12} {t['hasta'] - t['desde']:4.1f} s  "
                  f"de «{t['toma']}» ({t['en_toma'][0]:.1f}–{t['en_toma'][1]:.1f} s) · "
                  f"versión {ver} · {t['cobertura'] * 100:.0f} % del texto"
                  + (f" · {e['descartadas']} toma(s) descartada(s)" if e["descartadas"] else ""))
    if t["faltaron"]:
        lineas.append(f"       no se oyó: {' '.join(t['faltaron'])}")
lineas.append("")
lineas.append(f"Relleno (toma sin voz): {relleno['archivo']} · {relleno['dur']:.1f} s" if relleno
              else "Relleno: no hay toma sin voz (la 8). No es obligatoria.")
usadas = {t["toma"] for t in tramos} | ({relleno["archivo"]} if relleno else set())
sobran = [tm["archivo"] for tm in tomas if tm["archivo"] not in usadas]
if sobran:
    lineas.append(f"Tomas no usadas: {', '.join(sobran)}")
informe = "\n".join(lineas)
with open(os.path.join(TRABAJO, "tomas-informe.txt"), "w", encoding="utf-8") as f:
    f.write(informe + "\n")
print("\n" + informe + f"\n\n→ {central}\n")
