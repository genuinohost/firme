---
name: video
description: Montar un vídeo vertical para redes con metraje que grabó Alex — transcribe su voz en local con Whisper, corta sobre la palabra exacta, mete planos de la app y rotula con la identidad de Genuino. Usar cuando haya grabado clips y quiera una pieza para WhatsApp, Instagram o TikTok.
---

# Montar un vídeo de Genuino

Todo corre en la máquina de Alex: **su voz no sale a ningún servidor**. Para
grabaciones suyas hablando de su fe, eso no es un detalle técnico.

Los scripts están en `scripts/video/`. Se ejecutan desde la raíz del proyecto.

## Segunda generación (19-09-2026): un proyecto por vídeo, y todo medido

El segundo vídeo (Filipenses 4:13, 80 s, de pie y lejos de la cámara) obligó a
rehacer el método. Lo que vale ahora es esto; `montar-pro.mjs` queda como
historia del primer vídeo.

```
videos-genuino/<proyecto>/
  proyecto.mjs          TODO lo particular: clip, cara, planos, música, cierre
  .trabajo/central.mp4  el clip preparado (1080×1920, 30 fps, −16 LUFS)
  .trabajo/palabras-grande.json   la transcripción con large-v3
  .trabajo/cara.json    la pista de la cara, muestra a muestra
  <nombre>.mp4  y  <nombre>-ligero.mp4
```

El orden, y qué script hace cada paso:

| Paso | Comando | Qué deja |
|---|---|---|
| 1 | preparar el clip a mano (ver abajo) | `.trabajo/central.mp4` |
| 2 | `python scripts/video/palabras.py central.mp4 palabras-grande.json large-v3` | palabras con tiempo |
| 3 | `python scripts/video/encuadrar.py central.mp4 80` | dónde está la cara, y los zooms que aguanta |
| 4 | `python scripts/video/musica.py musica/ <segundos>` | tempo, arco, golpes de cada pista |
| 5 | escribir `proyecto.mjs` | el plan |
| 6 | `node scripts/video/montar2.mjs <carpeta>` | el vídeo, la copia ligera, las pistas sueltas, `cortes.json` |
| 7 | `node scripts/video/comprobar.mjs <carpeta>` | el veredicto, con números |

**Nunca correr el paso 2 mientras el paso 1 sigue escribiendo.** ffmpeg no
cierra el `moov` hasta el final: el archivo existe, crece, y Whisper lo lee
truncado sin quejarse. Pasó el 19-09; se vio porque el JSON salió a medias.

### La cara se mide, y por plano

`encuadrar.py` usa YuNet (el detector de OpenCV 5; el modelo va en
`scripts/video/modelos/`, 232 KB). Devuelve el centro de la cara, cuánto ocupa
la cabeza y **los tres zooms calculados** para que los ojos caigan al 38 % del
alto. Y deja `cara.json`: la pista muestra a muestra.

`montar2.mjs` centra **cada plano** con la mediana de la cara en ese tramo. En
Filipenses Alex entra caminando: x = 0,52 los primeros diez segundos y 0,73 al
final; un centro único lo dejaba pegado al borde. Con la pista, el encuadre lo
sigue solo.

El primer intento midió por movimiento (lo que cambia entre fotogramas es él):
salía centrado en los brazos. **Lo que manda son los ojos.**

### Los cortes van al golpe DETECTADO, no a una rejilla

`k × pulso` vale con una pista electrónica (la Triunfal: 16 ms de error contra
la rejilla). Con un piano, no: los golpes se apartan 109 ms de media. Ahora
`montar2.mjs` lleva cada frontera al golpe real más cercano y después al cuadro
más cercano, así que la suma de cuadros es exacta y no hay desfase que
compensar. Medido en la v1 de Filipenses: **8 ms de desvío medio**.

### El plan lo hace un jurado

Tres editores independientes (ritmo, sentido, emoción) proponen el guion de
planos leyendo la transcripción y el metraje; un juez elige y injerta. Lo que
salió que yo no habría visto: cortar en cada «¿hasta cuándo…?», llevar el
primer plano a «Ahí está la clave» y a «nada es imposible» como frase entera,
poner los dos amaneceres en bisagras del discurso y **el aviso de que la cara
cambiaba de sitio**. En el prompt de cada agente va que sus descripciones de
herramientas se escriben en español: Alex las lee en el panel.

### `comprobar.mjs`: el vídeo no se da por bueno hasta que lo diga

Mide sobre el archivo final y las pistas sueltas: ancho y duración de cada
rótulo, desvío de cada corte contra el golpe, cuadros repetidos en tres planos,
margen de la voz sobre la música, sonoridad y pico. **Falla** si un rótulo no
cabe, si un corte está a más de 40 ms del golpe, si un plano repite cuadros, si
la voz baja de 6 dB sobre la música o la sonoridad se sale de −14 ± 2 LUFS.
Con `sinApp: true` en el proyecto, falla también si un rótulo nombra la app.

El propio comprobador falló mudo la primera vez: leía la sonoridad de stdout y
ffmpeg la escribe por stderr — «NaN LUFS» sin ningún error.

### La música se elige con Alex, y el agachado se barre

La pista la elige él entre las medidas. El volumen y el agachado **no se ponen
de oído**: se exportan las pistas sueltas y se barre con `medir-audio.py`
hasta que el peor momento quede a ≥ 8–10 dB y ningún tramo apriete. El Trailer
necesitó 1,1 y 6:1 donde la Triunfal iba con 1,5 y 4:1.

### Rótulos: lo que se añadió

- Siete palabras y 2,6 s como topes (con seis y 2,3 salían «SANTO.» y «CON
  TODA TU MENTE,» sueltos en 0,39 s).
- Menos de medio segundo cuesta 140 puntos, más que juntar por una coma.
- **Parejas que no se separan**: Espíritu Santo, Cristo Jesús, Padre Celestial…
- Mientras la tarjeta del versículo está en pantalla, los rótulos palabra a
  palabra se callan.
- El oro casa por palabra entera: POSIBLE no enciende «imposible».

### Lo que dijo Alex de la v3, y ahora es regla

- **Tipografía: Arial Black**, elegida entre cuatro opciones renderizadas sobre
  un fotograma real (Segoe UI Black, Arial Black, Franklin Gothic,
  Bahnschrift). El proyecto la declara en `fuente: { archivo, anchos, tamano }`
  y el reparto mide con su tabla (`node scripts/video/anchos.mjs <ttf>`).
  Arial Black es más ancha: a 66 px caben los mismos rótulos que Segoe a 74.
- **Las dos líneas van pegadas.** El paso entre ellas es la letra más el borde
  de la caja: las cajas se tocan y se leen como un bloque.
- **Nada de B-roll de banco**, y menos repetido. «Es muy corto y no tiene
  sentido.» Si no hay metraje suyo para la frase, va su cara.
- **Los saltos de encuadre, suaves.** Pasos cortos (1,18 / 1,32 / 1,46), sólo
  entre encuadres vecinos —nunca abierto → cerca de un corte— y deriva del
  3–5 %. Con 1,12 → 1,52 y 8 % los vio «MUY BRUSCOS».
- **El cierre no repite la marca**: `@GenuinoLove` y «Sígueme para más».

> Antes de fijar una decisión de estilo, renderizar el mismo fotograma con las
> opciones y que elija él. Cuesta veinte segundos y evita un render de ocho
> minutos que no le va a gustar.

## Lo que hace falta, y ya está instalado

| Pieza | Para qué |
|---|---|
| ffmpeg | cortar, rotular, montar |
| opencv-python + `modelos/yunet.onnx` | detectar la cara para encuadrar |
| Pillow | medir anchos de fuente (`anchos.mjs`) |
| librosa | tempo, golpes y energía de la música |
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

`small` vale para **localizar** de qué habla en cada segundo, que es para lo
que sirve este paso. Para los rótulos no vale: ver abajo.

### 2 bis. Para los rótulos, el modelo grande — no es negociable

```bash
PYTHONIOENCODING=utf-8 python scripts/video/palabras.py <clip.mp4> <salida.json> large-v3
```

`small` transcribe bien las palabras y **puntúa mal**, y la puntuación es
justamente lo que decide dónde cortar un rótulo. Con `small` salió
«…en nuestro perfecto dios y es que el padre ha permitido…» sin un solo punto,
y el agrupador —que no puede adivinar— metió dos oraciones en el mismo rótulo.
También oyó «teciendo» por «creciendo» y «la goza» por «gózala», y eso queda
grabado en la imagen para siempre.

El clip dura menos de un minuto. `large-v3` en CPU tarda unos minutos y se
descarga una vez. **Cuesta menos que revisar los rótulos a mano.**

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

### 6. La música, elegida midiendo

```bash
python scripts/video/musica.py <carpeta-musica> 55
```

Saca el tempo, los golpes y **la curva de energía**. Un vídeo que abre con una
pregunta incómoda y cierra llamando a descargar necesita una pista que empiece
baja y suba; eso se ve en la curva, no hay que adivinarlo:

```
                     arco     forma
piano emotivo       +0,14     ▇▃▅▆▆▃▄▄██▄   descartada
trailer inspirador  +0,38     ▅▅▅▅▅▅█████   descartada
triunfal            +0,76     ▂▂▂▄▃▃▄▇███   ← la elegida
```

Guarda también los golpes en un `.txt`, para cortar encima de ellos.

### 7. Las palabras, una a una

```bash
python scripts/video/palabras.py <clip> <salida.json>
```

Whisper con `word_timestamps=True`. Es lo que permite los subtítulos que se
encienden al hablar — **lo que más retiene de todo lo que se hace aquí**.

### 8. Montar

```bash
node scripts/video/montar-pro.mjs      # el bueno
node scripts/video/montar.mjs          # el simple, sin música ni subtítulos
```

El guion de planos vive en la constante `GUION`: cada bloque dice cuántos
**pulsos** dura y con qué encuadre, así que todos los cortes caen sobre la
música. El último bloque absorbe lo que sobre, y el script **se niega a montar**
si las duraciones no cuadran con la voz al milisegundo.

### 9. La copia ligera

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

## Los rótulos: la regla que no se rompe

**Un rótulo NUNCA termina a mitad de frase.** Alex, sobre la primera versión:
«es imperdonable que pongas subtítulos donde las frases queden a la mitad».
Salían cosas como «HA PERMITIDO QUE» o «TIENES QUE»: obligan a leer dos veces,
y en cincuenta segundos nadie lee dos veces.

La regla es fácil de enunciar y tiene **tres caras**, no una. Las tres han
fallado ya, en este orden:

| Falta | Cómo se ve |
|---|---|
| Cerrar colgando | `HA PERMITIDO QUE` · `TIENES QUE` |
| Abrir colgando | `DE CUMPLIR` · `A AUMENTAR` · `QUE INSTALAR` |
| Tragarse una frontera | `DIOS / Y ES QUE EL PADRE` — dos oraciones juntas |

La segunda y la tercera aparecieron **al arreglar la primera**: al arrastrar
palabras para no cerrar mal, el corte se va al otro lado. Por eso el agrupador
no decide rótulo a rótulo.

`scripts/video/subtitulos.mjs` puntúa **todos los repartos posibles** del texto
y elige el mejor del conjunto (programación dinámica, de atrás hacia delante).
Si empeorar un rótulo salva los tres siguientes, lo empeora. Lo que se puntúa:

- cerrar en palabra de apoyo → +300
- abrir en palabra de apoyo, salvo que ahí empezara frase → +90
- llevar un punto o una coma **dentro** → +250
- llevar una respiración larga dentro → +150
- alejarse de los 16 caracteres → +1 por carácter
- durar menos de medio segundo, o pasar de 24 caracteres por segundo → +45/+40
- **premios** por cortar donde el hablante cortó: −35 en punto, −30 en pausa

Topes duros: 1550 px de texto, 6 palabras, 2,3 s. Una palabra suelta siempre
cabe, si no el reparto se quedaría sin solución.

Cuando la línea pasa de 900 px se **parte en dos**, con el mismo criterio: la de
arriba tampoco acaba en palabra de apoyo. Y si el único sitio por donde partir
deja la primera línea colgando, **no se parte**: se aguanta una línea de hasta
940 px, que se lee mejor que un corte malo.

### Se mide en píxeles, no en caracteres

Contar caracteres miente. `CONSTANTEMENTE A CUMPLIR` y `A NUESTRO PERFECTO
DIOS.` tienen los mismos **24 caracteres** y ocupan **1103 y 1006 píxeles**: el
primero se sale del cuadro de 1080 y el segundo no. Por eso
`scripts/video/anchos.json` guarda el ancho real de cada letra de Segoe UI Bold,
medido de la fuente, y el agrupador suma píxeles. Calculado contra real: **1 px
de diferencia**.

Con 60 px de margen a cada lado quedan 960 útiles. Si algún día cambia la fuente
o el tamaño:

```bash
node scripts/video/anchos.mjs
```

**El silencio cuenta como puntuación.** Whisper da el segundo de cada palabra,
así que un hueco de 0,16 s ya es coma y uno de 0,34 s es punto. Ojo: con un
orador que no respira —como Alex— casi todos los huecos son 0,000, y entonces
**la única frontera que queda es la puntuación del modelo grande**. Ésa es la
razón de fondo de la sección 2 bis.

```
antes                          después
HA PERMITIDO QUE          →    HA PERMITIDO / QUE DISEÑEMOS
TODO LO QUE               →    CON TODO LO / QUE EL PADRE
DIOS / Y ES QUE EL PADRE  →    PERFECTO DIOS.
  (dos oraciones)               Y ES QUE EL PADRE
```

**Y la altura importa tanto como el corte.** Instagram y TikTok tapan los
últimos ~320 píxeles de los 1920 con el texto del post y los botones. Los
rótulos van a `h*0,720` con una línea y a `h*0,687` / `h*0,771` con dos: por
debajo de eso se leen en el ordenador y **no se leen en el móvil**, que es
donde los va a ver todo el mundo.

**Y las palabras clave van en dorado** — DIOS, DESPERTADOR, PALABRA, HERMANOS,
DISCIPLINA, GLORIA. El rótulo entero cambia de color, no la palabra suelta:
colorear una palabra dentro de un texto centrado obliga a calcular anchuras y
se acaba desalineando.

## Tres encuadres de una sola toma

Lo que llevó el vídeo de un 6 a un 8 sin volver a grabar.

Se midió el primer montaje: **plano medio de 7,7 segundos** en todo el cuerpo,
cuando lo que funciona en formato corto está entre 1,5 y 3. Se paraba en cuanto
él empezaba a hablar.

De un plano abierto se recortan un medio y un primer plano. Cortando entre
ellos cada dos o tres segundos, **una sola toma parece rodada con tres
cámaras**, y de paso se arregla que él salía pequeño en un móvil.

```
abierto   zoom 1,00   centro 0,50
medio     zoom 1,22   centro 0,42
cerca     zoom 1,45   centro 0,36
```

**El centro sube al acercarse** porque la cara está en el tercio superior: por
el medio geométrico, el primer plano corta la frente.

**Tope 1,45.** La fuente es 1080×1920: a 1,7 se muestrean 635 píxeles de ancho
y se ve blando.

## El B-roll y el zoom: dos frenadas de más

Las dos veces el error fue **corregir de más**, y las dos se vieron sólo
mirando el vídeo montado.

**El B-roll.** Se quitó el amanecer que abría flojo y con él se quitó B-roll de
todas partes: quedaron 2 planos de 1,3 s sobre 17. Quitar una cosa de la
apertura no es razón para quitarla del resto. Lo sano son **5 o 6 planos de
B-roll** en un vídeo de 45 s, repartidos donde las palabras los piden.

**Y el B-roll bueno es el suyo.** Alex tenía grabada la app funcionando en su
teléfono, sobre su mesa (`6.1-celular-y-la-alarma`), mientras yo le decía que
eso era justo lo que faltaba. **Antes de bajar nada de un banco, mirar lo que
él grabó.**

> ⚠️ **Las Biblias de los bancos de vídeo no están en español.** Las tres que se
> bajaron eran alemana, inglesa y portuguesa, y el texto se lee. En un vídeo de
> un Capellán venezolano eso lo nota cualquiera. Si hay que poner un plano de
> una Biblia, o es la suya o no hay plano.

**El zoom.** La deriva estaba al 4 %: técnicamente existía, prácticamente no se
veía. Los números que funcionan:

| Qué | Deriva |
|---|---|
| Sus planos hablando | 7–9 % |
| B-roll | 15–17 % |
| Capturas de la app | 18 %, **saliendo** |

Y **alternando**: unos planos entran y otros salen. Si todos empujan hacia
dentro, a los diez segundos el ojo deja de registrarlo.

Las capturas de la app **salen** del zoom, no entran. Entrando, el fotograma
más recortado es el último y lo que queda en el ojo es la interfaz cortada — en
este vídeo cortaba por la mitad los números de la racha, que es lo mejor que
tiene la app.

> Una deriva negativa que baje de 1,0 hace que `zoompan` pida más imagen de la
> que hay y se vea el borde. El montaje **se detiene** si eso pasa, en vez de
> sacar un vídeo con un marco raro.

## El gancho: los tres primeros segundos

El mismo vídeo con aperturas distintas mueve el coste por instalación **de dos
a cuatro veces**, y el 65 % de quien aguanta tres segundos se queda diez.

El primer montaje abría con un amanecer en fundido: **el primer fotograma era
casi negro**. Se tiró el activo más valioso en un plano bonito y vacío.

**Abrir con su cara y su voz, en primer plano.** El B-roll se gana el sitio
más adelante, no al principio.

## Lo que hace que un vídeo enganche

Por orden de cuánto cambia el resultado. Si hay que recortar, se recorta de
abajo hacia arriba.

1. **Subtítulos que se encienden al hablar.** Grupos de dos o tres palabras,
   cada uno en su segundo. Sin esto lo demás sobra.
2. **Cortes sobre el golpe.** Un corte medio segundo antes del pulso se siente
   flojo y nadie sabe decir por qué.
3. **Corrección de color.** El metraje de móvil sale plano; con curva en S,
   sombras frías y luces cálidas parece rodado.
4. **Que nada esté quieto.** Zoom del 4 al 7 % en cada plano, alternando
   dirección para que los cortes no se sientan repetidos.
5. **La música apartándose de la voz** con `sidechaincompress`. Sin eso hay que
   elegir entre no oír la música o no entenderle a él.
6. **B-roll, poco.** Dos o tres segundos donde las palabras lo pidan. Más
   convierte un testimonio propio en un anuncio genérico, y lo que vende aquí
   es que es él.

## Los subtítulos van grabados: revisarlos SIEMPRE

Whisper oye mal, y lo que escribe se queda en la imagen para siempre. En el
primer vídeo falló cuatro veces:

```
"fallar en nuestro perfecto"  ->  "fallarle a nuestro perfecto"
"cumplir con todos los que"   ->  "cumplir con todo lo que"
"descarga la goza"            ->  "descárgala, goza"
"teciendo cada día"           ->  "creciendo cada día"
```

En un vídeo sobre fidelidad a Dios, un «teciendo» resta más de lo que suma
cualquier efecto. En `montar-pro.mjs` hay una lista `ARREGLOS` para esto: las
sustituciones respetan el número de palabras para no mover ni un tiempo.

**Y mirar fotogramas del resultado antes de entregarlo.** Así se vieron los
rótulos pisándose y un «DESCARGALA» sin tilde, que ningún script iba a avisar:

```bash
ffmpeg -i final.mp4 -vf "select='eq(n\,180)+eq(n\,900)',scale=270:-2,tile=4x1" -frames:v 1 vistazo.png
```

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

**`zoompan`: `d` es cuántos cuadros saca por CADA cuadro de entrada**, no la
duración del plano. Con `d=53` sobre un vídeo de 53 cuadros ffmpeg genera
2.809. Con vídeo va siempre **`d=1`**; el `d` grande sólo vale con imagen fija.

**`fps=30` va ANTES de `zoompan`, jamás después.** Detrás, si la fuente va a 25,
las marcas de tiempo se descuadran y el filtro siguiente se queda rellenando
huecos **para siempre**: sin error, comiéndose la memoria. Llegó a 30 GB.

**Al matar una tarea, el ffmpeg hijo sobrevive.** Hay que comprobarlo aparte o
se queda ahogando la máquina en silencio:

```bash
powershell -NoProfile -Command "Get-Process ffmpeg | Stop-Process -Force"
```

**`-filter_complex_script` desapareció en ffmpeg 9.** La cadena se pasa tal
cual en `-vf`; `execFileSync` la entrega sin pasar por el intérprete de
órdenes, así que no hay límite de longitud.

**El recorte (`-t`) va como opción de SALIDA**, después de los filtros. Como
opción de entrada, con `fps` de por medio, la duración sale distinta de la
pedida y descuadra los cortes sobre el golpe.

**Un rótulo debe acabar exactamente donde empieza el siguiente.** Alargarlo con
`Math.max` tapa el parpadeo y crea algo peor: cuando alguien habla rápido, dos
rótulos se dibujan encima y sale un amasijo ilegible.

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
