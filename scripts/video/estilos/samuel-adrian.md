# Estilo «recibos» — medido de Samuel Adrián (20-09-2026)

Alex: «quiero edición profesional al estilo del mexicano Samuel Adrián».
Nadie ha documentado cómo edita, así que **se midió** sobre tres shorts suyos
(«El efecto David Goggins», «Lo que faltó en el informe», «Le pidieron
disculparse por creer en Dios»; 56–58 s los tres), fotograma a fotograma y con
el audio analizado por bandas cada 100 ms. El informe completo, con cada
marca de tiempo, está en `.claude/skills/video/investigacion/2026-09-20-samuel-adrian.txt`.

Quién es: creador de Monterrey, 1,19 M de suscriptores, habla a cámara de
actualidad, familia y valores desde el mismo set (estantería, lámpara cálida,
micrófono Shure en brazo). Su formato vertical dominante es el short de ~57 s
recortado de un vídeo largo. Ojo: no es un estilo de rótulo gigante tipo
TikTok; es **cara + insertos de archivo y «recibos» + coletilla**.

## 1 · Ritmo

- **Gancho, 0–7 s**: cinco planos, mediana 1,4 s (≈ 40 cortes/min). La cara
  sólo 0,7 s al arrancar; el primer inserto entra a 0,8 s; el primer rótulo
  antes de 0,4 s. La primera frase lleva contexto y no saludo («Si no lo
  conocías, Goggins es…»), a ≈ 185 palabras por minuto.
- **Cuerpo**: en piezas narrativas la cara nunca aguanta más de 4–6 s sin un
  inserto de 1,5–2,5 s (a veces dos seguidos). En piezas de noticia, planos de
  cara de 6–10 s con un inserto cada 8–10 s, o un bloque largo del clip de la
  fuente con rótulo de nombre y cargo.
- **Sin transiciones**: todo corte seco. Nada de fundidos.
- **Duración**: 55–58 s cuando sale de un vídeo largo. El cuerpo escala, el
  gancho no.

## 2 · Rótulos

- Frases de **1–3 palabras**, **minúsculas normales con puntuación** («más
  disciplinados», «de voluntad.», «cadena nacional.»), una línea, centradas,
  a ≈ 67 % del alto del lienzo — dentro del vídeo, sobre el pecho, nunca sobre
  la cara.
- Negrita sans **blanca con contorno negro de 3–5 px** y sombra suave; cuerpo
  ≈ 60 px (altura de mayúscula 40–45 px sobre 1080).
- **Sin palabra en color, sin resalte, sin mayúsculas gritonas.** Cada rótulo
  dura lo que dura la frase (0,4–1,2 s). Si hay animación de entrada, es de
  muy pocos cuadros (no se vio ningún estado intermedio).
- El titular de arriba es otra cosa (sección 3).

## 3 · Lenguaje gráfico

- **Lienzo**: 1080×1920 negro con el vídeo recortado a ≈ 1:1,05 (1080×1140)
  y su borde superior a ≈ 500 px: banda negra superior del 26 %, inferior del
  14 %, vacía. Idéntico en cara e insertos. Sólo se rompe en la coletilla.
- **Titular de curiosidad** (sólo en piezas narrativas, no en noticia): dos
  líneas en mayúsculas centradas en la banda superior (a 17–22 % del alto),
  negrita sans tipo Arial Black ≈ 80 px, **primera línea amarilla (≈ #F2D21B),
  segunda blanca**, desde el cuadro 1 hasta el final, sin animación. Distinto
  del título del short y de la primera frase hablada. Con nuestra paleta, la
  primera línea en dorado #c9a227 hace el mismo papel.
- **Encuadre**: punch-in **por corte**, no por zoom animado. Tres encuadres
  fijos (medio con micrófono y manos · medio corto · primer plano con la cara
  al 60 % del ancho), relación ≈ 1,2× y 1,4×, cambio sólo al final de frase.
  Dentro de un plano el encuadre es idéntico 3–4 s después: **sin deriva ni
  Ken Burns sobre la cara.** Ojos al 35–40 % del alto de la banda, cabeza
  siempre entera, cara un poco a la derecha del centro.

## 4 · Gramática del B-roll

Tres rutas, todas a pantalla completa dentro de la banda, a sangre, sin
marco:

1. **Archivo de la entidad**: clips y fotos de la persona de la que habla,
   portada de su libro. Las fotos antiguas se dejan con su look (sepia,
   marca de cámara): no se igualan.
2. **«Recibo» diseñado**: compuesto tipo miniatura — persona recortada +
   objeto que prueba el dato (billete, tarjeta) + fondo tintado de un color o
   bandera. Es lo que abre las piezas de noticia (2–3 s fijos antes de la
   cara).
3. **Clip de la fuente original** (cadena nacional, entrevista) con rótulo
   inferior de nombre y cargo.

**Nunca metraje de banco genérico. Nunca capturas de tuits crudas.** Inserto
de 1,5–2,5 s, anclado 0,2–0,5 s después de la palabra clave. Las fotos fijas
sin movimiento apreciable (si hay Ken Burns es ≤ 1,05).

## 5 · Color

Set fijo, cálido y oscuro: estantería desenfocada a la derecha, lámpara de
filamento a la izquierda, pared oscura, profundidad de campo corta. Piel
cálida natural, contraste alto, negros densos. Los insertos **no** llevan la
corrección de la cara: cada uno conserva su tono. La coletilla, grabada otro
día con luz de día, tampoco se iguala — se nota y no importa.

> Para Alex esto es lo único que NO se copia: él quiere tonos fríos y su salón
> es claro. Se copia el ritmo, el lienzo, los rótulos y el B-roll; el color es
> el suyo (`color.py --frio=1`).

## 6 · Sonido (medido cada 100 ms en tres bandas)

- Voz continua a ≈ 185 ppm, sin huecos ≥ 250 ms: **no hay silencios que
  cortar** (igual que Alex).
- **Whoosh en cada corte de inserto**: pico en 5–12 kHz de 0,3–0,5 s que
  arranca ligeramente **antes** del corte, unos 20 dB bajo la voz.
- **Golpe grave** sólo en el corte fuerte del gancho (< 150 Hz sube 10–13 dB).
- **Música**: en piezas de noticia, **ninguna** (silencio de sala en los
  huecos). En piezas narrativas, una cama **sólo de graves** que entra tras
  el gancho (≈ 4,5 s), con un motivo que se repite cada ≈ 2,6 s (≈ 93 ppm),
  10–12 dB por debajo de los picos de voz y sin contenido medio: no ensucia la
  palabra.

## 7 · Cierre

Los tres terminan igual: corte a **la misma coletilla pregrabada** (otro día,
otra camisa, luz de día detrás), primer plano **a pantalla completa 9:16** —
desaparecen las bandas—, micrófono en primer término: «¿Te gustó este short?
Puedes ver el vídeo completo en mi canal». Arranca a ≈ 54,5 s, dura 2,5–3 s.
Sin logo, sin tarjeta, sin «sígueme», sin bucle.

## Directrices de montaje (cómo se hace con lo nuestro)

| Qué | Cómo |
|---|---|
| Lienzo | `crop=1080:1140:0:(ih-1140)/2,pad=1080:1920:0:500:color=black` sobre `central.mp4`; los insertos pasan por el mismo crop/pad |
| Titular | dos `drawtext` con Arial Black 80: `y=330` dorado, `y=420` blanco; en `drawtext` son `w`/`h`, no `iw`/`ih` |
| Rótulos | modo «frase» en `subtitulos.mjs`: grupos de 1–3 palabras por pausas > 0,2 s y puntuación, minúsculas, una línea, 60 px, contorno 4–5 px, banda al 67 %, **sin dorado** (o una palabra por frase si Alex lo pide); siguen siendo el último filtro |
| Gancho | `planificar.mjs` con tramo «gancho» 0–7 s de plano medio 1,4 s; cara ≤ 0,8 s al arrancar; primer inserto a 0,8 s |
| Encuadre | encuadres fijos 1,0 / 1,2 / 1,4 sin deriva, cambio sólo por corte al final de frase. **Es lo que Alex pidió** («los acercamientos son MUY BRUSCOS» fue contra el zoom animado) |
| B-roll | `broll.py` por la ruta entidad/recibo primero; compuestos con Pillow (persona recortada + objeto + fondo tintado) |
| Sonido | whoosh por corte desde `cortes.json` (`adelay` 2–3 cuadros antes, `amix normalize=0`); impacto sólo en el gancho; cama de graves `lowpass=f=150` a −20 dB, comprobada con `medir-audio.py` |
| Cierre | grabar UNA vez a Alex 2,5–3 s en primer plano a pantalla completa y concatenar a cada short (`concat=n=2:v=1:a=1`, mismos 1080×1920 / 30 fps / 48 kHz) |

## Afinado con los archivos (20-09-2026, con permiso de Alex)

Descargados los tres shorts (`videos-genuino/referencias/samuel-adrian/`,
1080×1920) y medidos cuadro a cuadro:

- **Edita a 24 fps** (23,976), no a 30. Es parte del look «cine».
- **Los rótulos entran de golpe, sin ninguna animación**: diez cuadros
  consecutivos alrededor de la entrada de «Si no lo conocías,» son idénticos.
  Nada de pop de escala. Y el rótulo **no se corta con el plano**: sigue en
  pantalla mientras cambia la imagen debajo.
- **Los cortes son secos, sin fundido**: entre el cuadro 3 y el 4 de un
  corte no hay ningún estado intermedio.
- **Las fotos fijas llevan un Ken Burns muy leve**: diferencia media entre
  cuadros 0,59 (nuestros planos de cara dan ~5,8): un empuje diez veces más
  lento que un plano de cámara, ≈ 1,03–1,05.
- **Cortes medidos** (`select='gt(scene,0.12)'`; los punch-in entre dos
  encuadres de cara parecidos se escapan, así que la densidad real es algo
  mayor): narrativo 17 cortes (5 en el gancho de 7 s, 15/min en el cuerpo,
  plano mediana 2,5 s); noticia 23 (un montaje de «recibos» de 39 a 47 s con
  planos de 0,8–1,5 s; mediana 1,6 s); noticia con clip largo de la fuente
  11 (mediana 3,7 s, un plano de 15,7 s).
- **Whoosh en 13 de 17 cortes** del narrativo y en 17 de 23 del de noticia:
  pico de agudos de +12 a +28 dB sobre la mediana, que arranca **entre 50 y
  450 ms antes del corte** (mediana ≈ −150 ms, unos 3–4 cuadros a 24 fps).
  Nunca después.
- **Huecos de voz**: uno de 0,48 s en el narrativo; seis de 0,26–0,54 s en el
  de noticia. No hay silencios que cortar; el ritmo lo ponen los cortes.
- **Cama de graves** en el narrativo desde el gancho: picos por encima de
  −40 dB durante casi todo el cuerpo, sin tempo claro (el detector da 123 ppm
  sobre un motivo escaso; no fiarse). Nombre de la pista: no aparece en la
  descripción ni en los metadatos.

Sigue sin verificarse la fuente exacta de los rótulos (negrita sans
geométrica; Arial Black da el mismo peso).
