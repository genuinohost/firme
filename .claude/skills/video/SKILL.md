---
name: video
description: Montar un vídeo vertical profesional con metraje que grabó Alex — dirección de arte primero (estilos renderizados sobre sus fotogramas, él elige), después montaje medido (cara, color, golpes, rótulos) y comprobación con números antes de entregar. Usar cuando haya grabado clips y quiera una pieza para Instagram, TikTok o WhatsApp.
---

# El editor maestro de Genuino

Este skill es el método completo, en tres partes que van **en este orden y no
en otro**: entender, dirigir, montar. El primer vídeo salió con un 6 porque se
montó antes de entender; el cuarto le encantó porque se midió todo antes de
cortar. Lo que sigue es lo que hay entre los dos.

Todo corre en la máquina de Alex: **su voz no sale a ningún servidor.** Whisper
va en local (`faster-whisper`, modelo `large-v3`); no hace falta la API de
OpenAI ni ninguna clave. Para grabaciones suyas hablando de su fe, eso no es
un detalle técnico.

La historia de cómo se llegó aquí —cada fallo, cada medida, cada frase de
Alex— está en `HISTORIA.md`, en esta misma carpeta. Se lee cuando algo no
cuadre; aquí sólo está lo que vale ahora.

## Lo que Alex quiere, en sus palabras

> «Siempre quiero lo MEJOR PARA DIOS.» · «Quiero lo mejor de lo mejor.» ·
> «Debe poder leerse bien fácilmente.» · «Me gustan los efectos de zoom» y,
> cuando se pasaron: «los acercamientos son MUY BRUSCOS». · «B-roll de muy
> buena calidad, según el tema.» · «Que mi cara no se vea tan amarilla sino
> más natural y clara.» · «Siempre me gustan los tonos fríos que tienden a un
> poco azulado.»

Y una regla de trabajo que él mismo puso: **antes de fijar una decisión de
estilo, renderizar el mismo fotograma con las opciones y que elija él.**
Veinte segundos de render contra ocho minutos de un vídeo que no le va a
gustar. Eligió así la tipografía (Arial Black), el color (balance automático
con un punto de frío) y la música (Trailer para exhortar, piano para orar).

## Dónde vive cada vídeo

```
OneDrive\Desktop\videos-genuino\<proyecto>\
  proyecto.mjs                    TODO lo particular de ese vídeo
  .trabajo\central.mp4            el clip preparado (1080×1920, 30 fps, −16 LUFS)
  .trabajo\palabras-grande.json   la transcripción con large-v3, palabra a palabra
  .trabajo\cara.json              la pista de la cara, muestra a muestra
  .trabajo\pro\                   los intermedios, las pistas sueltas, cortes.json
  <Nombre>.mp4  y  <Nombre>-ligero.mp4
```

Su escritorio real está **dentro de OneDrive**. Los clips nuevos los deja en
Descargas o en la raíz de `videos-genuino`; el primer paso es darles carpeta.
Los cuatro proyectos hechos están copiados en `scripts/video/proyectos/` como
referencia: el de Filipenses es la plantilla.

## Parte 1 · Entender (antes de tocar nada)

Nada se decide hasta tener estas cinco cosas medidas. Cada una tiene su script
y todos se ejecutan desde la raíz de `firme`.

| Qué | Comando | Qué deja |
|---|---|---|
| El clip igualado | `ffmpeg … scale/pad 1080×1920, fps=30, loudnorm −16` (ver plantilla) | `.trabajo/central.mp4` |
| Las palabras con tiempo | `python scripts/video/palabras.py central.mp4 palabras-grande.json large-v3` | quién dice qué y cuándo |
| La cara | `python scripts/video/encuadrar.py central.mp4 80` | dónde está, cuánto ocupa, la pista por segundos |
| El color | `python scripts/video/color.py central.mp4 --frio=1` | la corrección medida y un antes/después |
| La música | `python scripts/video/musica.py musica/ <segundos>` | tempo, arco de energía, golpes de cada pista |

**Nunca transcribir mientras ffmpeg aún escribe el clip.** El archivo existe,
crece, y Whisper lo lee truncado sin quejarse. Esperar a que termine.

Después, **mirar**: una hoja de fotogramas (uno cada cinco segundos) y la
transcripción entera con sus pausas. De ahí sale la lectura del vídeo:
estructura (gancho → tesis → cita → mandato → cierre), el clímax, los gestos
que hay que enseñar (manos al pecho, mirada arriba, brazos abiertos, la Biblia
en alto), y lo que Whisper oyó mal.

**Lo que Whisper escribe se graba en la imagen.** Cada vídeo ha traído dos o
tres palabras mal oídas: «teciendo» por «siendo», «cualidades» por
«vanidades», «a Dios, señores» por «a dos señores», «colilla» por «polilla».
Las citas bíblicas son la pista: si una frase es un versículo, la palabra
buena es la del versículo. Se corrigen en `arreglos` y **se le dicen a Alex**
—las que sean de contexto y no de oído, marcadas como tales— para que las
confirme.

Y comprobar que Whisper no dejó palabras con duración cero (pasa cuando Alex
se traba y reinicia): `sanear()` en `subtitulos.mjs` las reparte, pero hay que
saber que estaban.

## Parte 2 · Dirigir (los estilos, y Alex elige)

Es la parte que faltaba y la que separa «bien hecho» de «profesional». Sigue el
método de Santiago Muñoz para editar con IA, adaptado a lo que ya tenemos:

1. **Proponer diez estilos.** Con la transcripción y los fotogramas delante,
   diez maneras de contar ESE vídeo. Un estilo no es un filtro: es una
   decisión sobre cada una de estas variables a la vez:

   | Variable | Lo que se decide |
   |---|---|
   | Ritmo | plano medio (1,8 / 2,3 / 3 s), dónde se acelera y dónde se respira |
   | Encuadre | cuánto se acerca, si sigue el gesto o la idea |
   | Rótulos | tipografía, tamaño, color de acento, una o dos líneas, palabra a palabra o frase |
   | Color | temperatura, contraste, cuánta luz |
   | Elementos | tarjeta de versículo, título de apertura, contador, mockup, nada |
   | Transiciones | corte seco, fundido de seis cuadros, ninguna |
   | Música | pista, cuándo entra, cuánto se oye |
   | Cierre | marca, «escribe amén», pregunta, nada |

2. **Visualizar mínimo y máximo de cada uno**, sobre SUS fotogramas, en el
   lienzo de diseño (el Artifact de tipo *Design*, que es el «Claude Design»
   del método: `Artifact quickstart intent=design`). El mínimo es el estilo
   con lo justo; el máximo, con todo lo que admite. Diez artboards con dos
   versiones cada uno, y Alex mira.

3. **Filtrar a tres.** Alex elige tres. No se discute el criterio: es su
   cara y su mensaje.

4. **Cinco variaciones** de los tres elegidos (mezclas, grados intermedios),
   renderizadas de verdad sobre un fotograma con `estilos.mjs` o a mano, y
   Alex elige una.

5. **Esa una es el proyecto**: sus decisiones van a `proyecto.mjs` y se
   guardan como estilo con nombre en `scripts/video/estilos/` para repetirlo
   en la serie sin volver a preguntar.

Si el vídeo es uno de una serie que ya tiene estilo elegido, se salta al
paso 5 y se dice.

**Estilos con nombre que ya existen** (`scripts/video/estilos/`):

- `samuel-adrian.md` — el estilo «recibos», **medido** de tres shorts de
  Samuel Adrián el 20-09-2026: lienzo con bandas negras y vídeo casi
  cuadrado, titular de dos líneas (dorada + blanca) desde el cuadro 1, rótulos
  de 1–3 palabras en minúsculas blancas sin resalte, gancho de cinco planos
  en siete segundos, **punch-in por corte y sin deriva** (justo lo que Alex
  pidió), insertos de archivo y «recibos» compuestos, whoosh en cada corte,
  coletilla pregrabada a pantalla completa. Lo único que no se copia es su
  color cálido: Alex va en frío.

## Parte 3 · Montar y comprobar

```bash
node scripts/video/planificar.mjs palabras-grande.json <segundos> --doradas=…   # el plan base
node scripts/video/montar2.mjs <carpeta>                                      # el vídeo
node scripts/video/comprobar.mjs <carpeta>                                    # el veredicto
```

**El plan de planos.** `planificar.mjs` reparte los cortes donde el discurso
corta (puntos, comas, respiraciones), con planos de 1,6–3,4 s, cambiando
sólo al encuadre vecino y acercándose en lo que pesa. Es el criterio del
jurado de editores hecho código. Si hay cuota de agentes, un jurado (dos
editores con ángulos distintos y un juez) lo mejora: lee los fotogramas y
pone el corte donde está el gesto. **Después se lee entero**: propone, no
decide.

**El montaje** (`montar2.mjs`) hace lo que ya no se discute:
- cada corte al golpe detectado de la música más cercano y luego al cuadro
  (10 ms de desvío medido; una rejilla `k × pulso` falla 109 ms con un piano);
- cada plano centrado en la cara DE ESE PLANO (pista de `cara.json`), los
  ojos al 38 % del alto, y **la cabeza nunca se corta**: el borde superior
  queda una cabeza entera por encima de la cara más alta del plano;
- donde el original ya viene cortado (Alex se inclina a la cámara), cuadro
  completo, sin acercar;
- rótulos palabra a palabra que no parten frases (`subtitulos.mjs`: reparto
  óptimo del texto entero, medido en píxeles de la fuente elegida), dorados
  por palabra entera, callados mientras hay tarjeta;
- la tarjeta del versículo como una sola pieza (`tarjeta.py`), fundida entera;
- música con compresor propio, agachada bajo la voz y **bajadas puntuales**
  donde él baja la voz (`musica.bajadas`), sin enterrarla en el resto;
- las pistas sueltas y `cortes.json` para que el comprobador mida.

**La comprobación** (`comprobar.mjs`) se niega a dar el vídeo por bueno si:
un rótulo no cabe (960 px), un corte está a más de 40 ms del golpe, un plano
repite cuadros, la voz baja de 6 dB sobre la música, la música va más de
28 dB por debajo (no se oye), la sonoridad se sale de −14 ± 2 LUFS o el pico
pasa de −0,5 dBTP, o un rótulo nombra la app en un vídeo que no es de la app.

**Y después se mira.** Veinte fotogramas repartidos, más un recorte a
resolución completa de: el primer segundo, la tarjeta, cada cambio de
encuadre dudoso, el cierre. Los cinco fallos mudos del primer vídeo y los
tres del segundo se vieron así, no con números. Si el jurado adversario tiene
cuota, cuatro revisores (rótulos, encuadre, sonido, reglas) y un escéptico
por hallazgo; si no, se hace a mano y se dice.

**Entregar**: el ligero (720×1280) al móvil con `SendUserFile` y aviso con
`PushNotification`; el grande se queda en su carpeta y es el que se publica.
Y la bitácora y la hoja de ruta al día antes de cerrar.

## Las reglas del editor maestro

Las que no dependen del estilo elegido. Ninguna se negocia.

1. **Nunca tapar la cara.** Ni rótulo, ni tarjeta, ni mockup, ni logo encima
   de los ojos o la boca. La tarjeta va arriba y la cara se mide para saber
   dónde está; si no hay sitio, la tarjeta espera al plano abierto.
2. **Rótulos que se leen a la primera.** Nunca parten una frase, ni por
   delante ni por detrás, ni juntan dos oraciones; las dos líneas van
   pegadas como un bloque; nunca por debajo de los últimos 320 px (los tapa
   Instagram); ninguno de menos de medio segundo; parejas que no se separan
   (Espíritu Santo, Cristo Jesús, Padre Celestial).
3. **B-roll excelente o ninguno.** Lo que suma es metraje SUYO (la app
   funcionando en su mesa, su casa, su Biblia). De banco, sólo si es de muy
   alta calidad, del tema exacto, en vertical, sin texto en otro idioma —las
   Biblias de los bancos vienen en alemán, inglés y portugués— y nunca
   repetido dos veces. Un amanecer prestado de 1,3 s no suma: se quita.
4. **Color natural y frío.** Balance automático (`colorcorrect=analyze=median`)
   más el punto de frío que eligió (`--frio=1`), más un poco de luz. Nunca
   calentar: su salón ya es cálido y sale amarillo.
5. **Movimiento suave.** Pasos de zoom cortos (1,15 / 1,30 / 1,44), sólo entre
   encuadres vecinos, deriva del 3–5 % alternando signo. «MUY BRUSCOS» es lo
   que pasa con 1,12 → 1,52 y 8 %.
6. **La tipografía es Arial Black** a 66 px con su tabla de anchos, hasta que
   él elija otra sobre un fotograma real.
7. **El cierre no repite la marca.** `@GenuinoLove` y «Sígueme para más»;
   si él pide «escribe un gran amén», el cierre lo repite en grande.
8. **La app sólo aparece en vídeos de la app.** Un devocional no lleva
   capturas, ni tarjeta de la app, ni «descárgala»; `sinApp: true` en el
   proyecto lo vigila.
9. **Nada de otras organizaciones**, ni en rótulos, ni en cierres, ni en
   documentos.
10. **Lo que él grabó se respeta.** No se le arregla la fluidez (la tiene), no
    se le cortan silencios (no los tiene: dos pausas de 0,25 s en cuarenta
    segundos), y sus palabras no se cambian sin decírselo.

## Lo aprendido de los mejores skills de edición (20-09-2026)

Se investigaron los skills de edición de vídeo para Claude que existen
(video-use, claude-remotion-skill, tiktok-video-skills, los de Tella —cut-video,
add-zooms, b-roll-finder—, chrislema/videoeditor, claude-youtube-editor,
video-editor-agent, HyperFrames, Remotion, color-grade-ai…) y el vídeo de
Santiago Muñoz al detalle. Los informes enteros, con fuentes, están en
`investigacion/` dentro de esta carpeta. Lo que vale para nosotros, en
números:

**Corte.** Cortar sólo en límites de palabra, con 50 ms de aire antes de la
primera palabra y 80 ms después de la última (el ASR deriva 50–100 ms).
Silencios de ≥ 400 ms son cortes limpios; 150–400 ms sólo con comprobación
visual; < 150 ms nunca. Antes de quitar un silencio, medir su amplitud: si hay
una risa o una reacción, se queda. Cada segmento se re-codifica (nunca
`-c copy` en el corte: deja cuadros congelados) con `afade` de 30 ms en cada
extremo. Si un corte quitó más del 70 % del clip, el umbral está roto.

**Ritmo.** El texto del gancho en pantalla desde el cuadro 1, sin fundido
desde negro. Una interrupción visual cada 2–4 s con intervalos deliberadamente
**irregulares** («un metrónomo se lee como aburrimiento»). Nunca más de 90
cuadros sin un elemento nuevo, pero tras cada golpe un *hold* de 15–20 cuadros
quietos, y al menos tres momentos de quietud por pieza: «el movimiento
constante se lee amateur; el contraste se lee caro». Denso en el gancho,
escaso y preciso en el cuerpo.

**Zoom.** Tres tipos con números: *punch* (corte seco dentro, hold 0,35 s,
corte seco fuera) sobre una palabra enfatizada, pico 1,18–1,30; *ratchet* en
listas, +0,04 por ítem; *Ken Burns* ≤ 1,14, «el único movimiento suave».
Tope 1,35 en 1080p. Nunca empezar el vídeo acercado. Máximo dos planos
seguidos al mismo nivel.

**Rótulos.** 1–3 palabras por golpe (2–3 en frases), rompiendo en pausas
> 0,2 s y sin separar artículo de sustantivo. Tamaño 56–80 px (≈ 8 % del alto)
en registro normal, 80–120 en registro «Hormozi». Contorno negro 5–8 px y
sombra. Banda al 62–70 % del alto y dentro del 80 % central. **Una sola
palabra en color por frase**, o una cada 3–5 frases; varias «destruyen el
efecto». Los rótulos van los **últimos** en la cadena de filtros, después de
cualquier overlay. Cada rótulo ≥ 0,5 s en pantalla; la cara ≥ 30 % descubierta
en toda ventana de 0,3 s.

**Sonido.** Un efecto de sonido llega 2–3 cuadros **antes** de que aterrice
el visual («pronto se siente sincronizado; tarde se siente roto»). 8–12 por
minuto como máximo. Whoosh en movimiento, *riser* en tensión, *impact* en
énfasis, *click* en cambio. Música elegida **primero** y −18 dB bajo la voz.
El sonido es la mitad de la calidad percibida.

**B-roll.** Antes de buscar, enunciar la tesis del vídeo y una frase por
idea («¿de qué va realmente esta línea?»). Cada idea va por una de cuatro
rutas: *recibo* (titular, captura, dato), *entidad* (persona, lugar, objeto →
la fuente real), *concepto* (idea abstracta → gráfico propio) o *memoria*
(librería propia). El inserto se ancla **0,2–0,5 s después** de la palabra
clave: tarde se lee intencional, pronto se lee error. Mejor una idea sin
inserto que rellena. El inserto lleva la misma corrección de color que la cara
y el mismo tipo de movimiento (fijo con fijo, mano con mano). Verificación: un
fotograma a mitad de cada inserto y en cada unión, en cuadrícula.

**Anti-«hecho con IA».** Cero interpolación lineal; las entradas animan 2–3
propiedades a la vez, escalonadas 3–6 cuadros; las salidas más rápidas que las
entradas; un solo color héroe por cuadro; Ken Burns en toda imagen fija; sin
emojis; sin cierre de plantilla.

**Verificación.** Re-transcribir el máster y comparar con lo que debía
quedar: palabras de más = fantasmas de un falso arranque; palabras de menos =
cortadas. Duración de vídeo y audio iguales al milisegundo. Fotogramas a
**escala de móvil** (no a resolución de exportación), en cada corte ± 1,5 s,
primeros 2 s, últimos 2 s y tres puntos medios. Tope de tres pasadas de
autocorrección; después, avisar a Alex.

**Para copiar un estilo (Samuel Adrián o quien sea): medirlo antes.** Tres a
cinco vídeos suyos, fotogramas a 2 fps en hojas de 5×4, cortes con
`select='gt(scene,0.25)'`, cortes por minuto por tramo (gancho, cuerpo,
cierre), mediana de duración de plano, % de cara frente a inserto, registro
de rótulos (posición, tamaño, mayúsculas, color) y del audio (tempo, arco).
Sale una **guía de estilo** de siete secciones —ritmo, rótulos, lenguaje
gráfico, gramática del B-roll, color, sonido, directrices de montaje— y de
ahí un plan por línea del guion. Sin medirlo, «estilo de X» es una opinión.

**Los motores.** Lo que hacemos con ffmpeg tiene techo en la animación de
texto. Los skills profesionales usan **HyperFrames** (HTML → vídeo, de HeyGen;
`npx hyperframes render`, con `lint` y `check` que detectan desbordes,
colisiones y contraste) o **Remotion** (React; `createTikTokStyleCaptions` a
1200 ms para 2–4 palabras por página). Es el siguiente escalón si Alex pide
rótulos con rebote, resaltado animado o mockups: se decide cuando llegue su
vídeo de ejemplo.

### El color, medido (y por qué no el automático)

Alex eligió el balance automático (`colorcorrect=analyze=median`) sobre un
fotograma. Investigado en el código del filtro: `analyze` recalcula **en cada
fotograma** la mediana de toda la imagen; si la cara domina el cuadro la
vuelve gris, y puede parpadear entre planos. `color.py` hace lo mismo con
**números fijos**: mide lo más claro y neutro del clip (la pared) en YUV y
aplica `colorcorrect=rl:rh:bl:bh` constante a todo el vídeo — mismo aspecto,
sin parpadeo, y el mismo balance vale para el B-roll. Después el punto de
frío (`colorbalance … pl=1`), la luz con **`curves`** (no con `eq=brightness`,
que saca los blancos de rango: superblancos ilegales por encima de 235) y
`vibrance` apenas. En el «Trabajo»: pared U = −0,089 / V = +0,057 →
`rl=rh=−0,057, bl=bh=+0,089`.

### El B-roll, con herramienta

`python scripts/video/broll.py "<tema>" --ingles="<topic>"` busca en Pexels
(primero: rechaza contenido de IA), Pixabay (descarta la etiqueta «ai
generated») y Coverr; sólo vertical de verdad (ancho < alto, ≥ 1080×1920,
elegido por medidas y no por la etiqueta «quality», que miente), ≥ 8 s, sin
logos ni texto; y deja `broll-candidatos.png` numerado **para que Alex
apruebe antes de descargar**. Las claves son suyas y van en variables de
entorno: `PEXELS_KEY`, `PIXABAY_KEY`, `COVERR_KEY`. Fuera Videvo/Freepik y
Vecteezy (exigen crédito) y Mixkit por script (lo prohíben sus términos).
Las Biblias de los bancos están en inglés, alemán y portugués: sólo valen los
planos donde el texto no se lee.

## Herramientas, y qué mide cada una

| Script | Para qué |
|---|---|
| `palabras.py` | transcribir con `large-v3`, palabra a palabra (el `small` puntúa mal y oye peor) |
| `encuadrar.py` | la cara con YuNet (`modelos/yunet.onnx`): centro, tamaño, pista por segundos |
| `color.py` | la corrección de color medida, con `--frio=0/1/2`, y su antes/después |
| `musica.py` | tempo, golpes y curva de energía de cada pista candidata |
| `planificar.mjs` | el plan base de planos desde la transcripción |
| `montar2.mjs` | el montaje, desde `proyecto.mjs` |
| `comprobar.mjs` | el veredicto con números |
| `medir-audio.py` · `medir-cortes.mjs` · `medir-movimiento.py` | las tres medidas sueltas, para barrer ajustes |
| `subtitulos.mjs` · `tarjeta.py` · `anchos.mjs <ttf>` | rótulos, tarjeta, tablas de anchos por fuente |
| `estilos.mjs` | el mismo plano con varios estilos reales, para elegir |

Instalado: ffmpeg 9, Python 3.12 con `faster-whisper`, `truststore`, `librosa`,
`opencv-python`, `Pillow`, `numpy`; Node 24.

## Las trampas, todas pagadas ya

**ffmpeg quiere todas las entradas antes de los filtros.** `-i` es opción de
entrada y `-vf` de salida; una entrada detrás de los filtros rompe el análisis
con un error que no lo menciona.

**`drawtext` no entiende `iw`/`ih`, sólo `w`/`h`.** El error dice «undefined
constant» y no lleva a eso.

**En Windows la salida nula es `NUL`, no `-`.** `-f null -` hace que
`silencedetect` y `volumedetect` no impriman nada sin dar error.

**`loudnorm` escribe su informe por stderr.** Leyéndolo de stdout sale «NaN»
sin ningún aviso. `spawnSync` devuelve las dos salidas.

**Un solo `resize` por tubería.** Un segundo pisa al primero en silencio.

**`scale=…:force_original_aspect_ratio=decrease` y después `pad`**, siempre:
una captura apaisada escalada por el alto se sale del lienzo.

**El antivirus intercepta HTTPS.** `truststore.inject_into_ssl()` al principio
del script. Y HuggingFace: `HF_HUB_DISABLE_XET=1` o la descarga del modelo
se corta.

**La consola de Windows va en cp1252**: `sys.stdout.reconfigure(encoding="utf-8")`
en todo script de Python, y `PYTHONIOENCODING=utf-8` al llamarlo.

**YuNet devuelve `float32`** y `json` no lo escribe: `float()` a todo.

**`zoompan`: `d` es cuántos cuadros saca por CADA cuadro de entrada.** Con
vídeo siempre `d=1`; el `d` grande sólo con imagen fija.

**`fps=30` va ANTES de `zoompan` y también DENTRO (`:fps=30`).** Detrás, el
filtro siguiente rellena huecos para siempre (30 GB). Sin el de dentro,
`zoompan` saca 25 y `-r 30` repite un cuadro de cada seis.

**`zoom` en `zoompan` siempre arranca en 1,0.** `min(zoom+paso, 1.45)` y
`max(zoom-paso, 1.0)` se quedan clavados. Todo movimiento se calcula desde
`on`, el número de cuadro.

**Una deriva que baje de 1,0** pide más imagen de la que hay y se ve el borde:
el montaje se detiene.

**Al matar una tarea, el ffmpeg hijo sobrevive**: `Get-Process ffmpeg |
Stop-Process -Force`.

**`-filter_complex_script` desapareció en ffmpeg 9.** La cadena va en `-vf` o
`-filter_complex`; `execFileSync` la entrega sin límite de longitud.

**El recorte (`-t`) va como opción de SALIDA**, después de los filtros.

**Un rótulo acaba exactamente donde empieza el siguiente.** Alargarlo con
`Math.max` hace que dos se dibujen encima.

**Contar caracteres miente.** Dos rótulos de 24 letras miden 1103 y 1006 px.
Se mide en píxeles de la fuente, con su tabla (`anchos-<fuente>.json`).

**Los golpes de un piano no siguen una rejilla** (109 ms de error). Cortar
sobre los golpes detectados, no sobre `k × pulso`.

**Un parche por texto puede fallar en silencio** (una comprobación mal hecha
y la v4 salió sin la tipografía elegida). Después de cada parche, comprobar
en el archivo que está lo que se cree que está.

**No leer un archivo que ffmpeg aún escribe.** El `moov` se escribe al final.

**La cuota de agentes del plan se acaba.** Dos jurados murieron a medias en
un día. Todo el método funciona sin agentes; los agentes mejoran, no
sostienen.

## Identidad

La misma de la app, siempre:

```
fondo      #0b0d10      dorado   #c9a227
superficie #14181d      logro    #3f9e7a
texto      #e9ecef      tenue    #8b949e
```

Rótulos en **Arial Black**; citas y frases del cierre en **Georgia cursiva**.
Las dos están en Windows.

## Música

**Nunca una pista sin comprobar la licencia.** Pixabay Music: uso comercial,
sin atribución, no revender la pista suelta. Se le dan dos o tres opciones
medidas (tempo, arco) y **elige él**. Hasta ahora: Trailer inspirador (112
ppm) para exhortar, piano emotivo (129 ppm) para orar; la Triunfal (136 ppm)
fue la del vídeo de la app y no tiene golpe hasta el segundo 15.

El volumen y el agachado **se barren con `medir-audio.py`**, no se ponen de
oído: la voz tiene que ir ≥ 8–10 dB por encima en el peor momento y la
música ≤ 28 dB por debajo de media. Con el Trailer: 0,95–1,1 y 6:1; con el
piano, 1,2 y 5:1 como punto de partida.

## Y una cosa que no es técnica

Alex habla seguido, sin muletillas y sin arranques en falso: **no hay que
arreglarle la fluidez**, ya la tiene y es lo difícil. Lo que le falta son
silencios —uno después de la frase que más duela, uno antes del cierre— y
variar la duración de las frases. Si pide opinión sobre cómo habla, dársela
con datos y sin adornos: la pidió el 18-09 y agradeció que fuera concreta.

Y cuando algo no le gusta, lo dice en una frase. Esa frase va a este archivo.
