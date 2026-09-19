---
name: video
description: Montar un vídeo vertical para redes con metraje que grabó Alex — transcribe su voz en local con Whisper, corta sobre la palabra exacta, mete planos de la app y rotula con la identidad de Genuino. Usar cuando haya grabado clips y quiera una pieza para WhatsApp, Instagram o TikTok.
---

# Montar un vídeo de Genuino

Todo corre en la máquina de Alex: **su voz no sale a ningún servidor**. Para
grabaciones suyas hablando de su fe, eso no es un detalle técnico.

Los scripts están en `scripts/video/`. Se ejecutan desde la raíz del proyecto.

## Lo que hace falta, y ya está instalado

| Pieza | Para qué |
|---|---|
| ffmpeg | cortar, rotular, montar |
| Python 3.12 | correr Whisper — en `~/AppData/Local/Programs/Python/Python312/python.exe` |
| faster-whisper | transcribir en local |
| truststore | que Python confíe en los certificados de Windows |

Si algún día falta Python:
`winget install --id Python.Python.3.12 --source winget --scope user`

## Dónde deja los clips

En `OneDrive\Desktop\videos-genuino`. **Su escritorio real está dentro de
OneDrive**, no en `C:\Users\InvitadosPro\Desktop` — esa carpeta existe y no es
la que ve.

Los numera por orden del guion: `01.1`, `01.2`, `2.1`… Los `.1` y `.2` son
tomas distintas de lo mismo.

## El orden

### 1. Dejar todos los clips iguales

```bash
node scripts/video/preparar.mjs
```

Pasa todo a 1080×1920 vertical, 30 fps, y nivela el audio a **−16 LUFS**. Sin
nivelar, el clip grabado de pie suena el doble que el de la mesa y el montaje
se oye a parches.

Los originales vienen a 1920×1080 con una marca de rotación de −90°; ffmpeg la
aplica al decodificar, así que no hay que girarlos a mano.

### 2. Transcribir — el paso que lo cambia todo

```bash
PYTHONIOENCODING=utf-8 python scripts/video/transcribir.py <carpeta> small
```

Saca cada frase **con el segundo en que empieza**. Sin esto no se puede cortar
sobre la palabra: los planos de la app acaban amontonados al final porque no se
sabe cuándo habla de cada cosa. Con esto, cada pantalla entra justo cuando la
nombra, y eso es lo que separa un vídeo correcto de uno bueno.

`small` va rápido y en español se porta bien. `medium` afina más y tarda unas
tres veces más; sin tarjeta gráfica, `small` es el punto sensato.

### 3. Ver qué hay en cada clip

Un fotograma del centro de cada uno, todos en una hoja:

```bash
ffmpeg -v error -y -ss <mitad> -i <clip> -frames:v 1 -vf scale=300:-2 fNN.png
ffmpeg -v error -y -i f%02d.png -vf "tile=6x2:padding=8:color=0x111111" hoja.png
```

### 4. Los planos de la app

```bash
node scripts/video/pantallas.mjs
```

Salen de las capturas de la tienda (`docs/tienda/capturas/listas/`) con un
empuje de zoom lento. **Se ven mejor que una grabación de pantalla del móvil** y
Alex no tiene que grabar nada.

### 5. Elegir el estilo de rótulo

```bash
node scripts/video/estilos.mjs
```

Renderiza el mismo plano con cuatro estilos **reales** y los pega en un vídeo
para comparar. No son bocetos: es exactamente lo que va a quedar.

Alex eligió el **4 · ROTUNDO** — letra grande con sombra dura, primera línea
blanca, segunda en el dorado `#c9a227`, sin barra de fondo. La sombra lo hace
legible sin oscurecer la imagen, y su metraje tiene buena luz que no conviene
tapar.

### 6. Montar

```bash
node scripts/video/montar.mjs
```

### 7. La copia ligera

El vídeo bueno pesa unos 35 MB y **no se puede mandar por el chat** (tope de
30 MB). Se hace una copia a 720×1280 con `-crf 28` — unos 5 MB — sólo para que
lo vea desde el móvil:

```bash
ffmpeg -y -i <final>.mp4 -vf scale=720:1280 -c:v libx264 -preset slow -crf 28 \
  -c:a aac -b:a 128k -movflags +faststart <final>-ligero.mp4
```

**La que se publica es siempre la grande.**

## Cómo se mantiene la voz intacta

La voz va en **una sola pista continua**. El vídeo se construye aparte, trozo a
trozo, y cada inserto de pantalla ocupa **exactamente los mismos segundos** que
el trozo de cara que sustituye. Al juntarlos, la voz no se mueve ni un cuadro:
se le sigue oyendo mientras se ve la app.

`montar.mjs` comprueba esa suma y **se niega a montar si no cuadra**.

## Las trampas, todas pagadas ya

**ffmpeg quiere todas las entradas antes de los filtros.** `-i` es opción de
entrada y `-vf` de salida; poner una entrada detrás de los filtros rompe el
análisis con un error que no menciona eso en ninguna parte.

**`drawtext` no entiende `iw`/`ih`, sólo `w`/`h`** — aunque `drawbox`, dos
líneas más arriba en el mismo filtro, sí las entienda. El error dice «undefined
constant» y no lleva a eso.

**En Windows la salida nula es `NUL`, no `-`.** Un `-f null -` hace que
`silencedetect` y `volumedetect` no impriman nada **sin dar error**: parece que
no hay silencios cuando lo que pasa es que no se ejecutó.

**Un solo `resize` por tubería**, tanto en ffmpeg como en sharp. Encadenar un
segundo pisa al primero en silencio.

**Cuidado con las capturas apaisadas.** `02-alarma-bloqueado.png` es 1220×1001 y
ha roto tres scripts distintos: escalada por el alto se sale del lienzo y ffmpeg
se niega a rellenar un hueco negativo. Usar siempre
`scale=…:force_original_aspect_ratio=decrease` y después `pad`.

**El antivirus intercepta HTTPS.** Python rechazaba descargar el modelo con un
`CERTIFICATE_VERIFY_FAILED`. Se arregla con `truststore.inject_into_ssl()` al
principio del script, que le dice a Python que confíe en lo mismo que confía
Windows. Es el mismo motivo por el que winget se queja del certificado de la
tienda.

**La consola de Windows va en cp1252** y revienta al imprimir una flecha. De ahí
el `sys.stdout.reconfigure(encoding="utf-8")`.

## Sobre cortar silencios

Es lo que recomienda todo el mundo, y **con Alex no aplica**. Se midió el
18-09-2026: cuarenta segundos hablando con **dos pausas de 0,25 s**. Quitarlas
ahorraría dos segundos a cambio de ocho saltos de imagen y de dejarle hablando
sin respirar.

**Medir antes de cortar.** Si las pausas internas suman menos de dos segundos,
la grasa está en la apertura, no en su voz.

## Identidad

La misma de la app, siempre:

```
fondo      #0b0d10      dorado   #c9a227
superficie #14181d      logro    #3f9e7a
texto      #e9ecef      tenue    #8b949e
```

Tipografías: **Segoe UI Bold** para los rótulos, **Georgia cursiva** para las
citas. Las dos están en Windows, así que no hay que instalar nada.

## Música

**Nunca poner una pista sin comprobar la licencia.** Un aviso de derechos en el
vídeo con el que quiere que la gente descargue la app es el peor sitio posible
para uno.

La biblioteca que sirve es **Pixabay Music**: uso comercial permitido, sin
atribución obligatoria, y lo único prohibido es revender la pista suelta. Se le
dan dos o tres opciones y **elige él** — la música cambia cómo se siente un
vídeo más que casi ninguna otra decisión.

## Y una cosa que no es técnica

Alex habla seguido, sin muletillas y sin arranques en falso: **no hay que
arreglarle la fluidez**, ya la tiene y es lo difícil. Lo que le falta son
**silencios** —uno después de la frase que más duela, uno antes de nombrar la
app, uno antes del cierre— y **variar la duración de las frases**, que le salen
casi todas de cinco segundos y el oído se acostumbra.

Si pide opinión sobre cómo habla, dársela con datos y sin adornos. La pidió el
18-09 y agradeció que fuera concreta.
