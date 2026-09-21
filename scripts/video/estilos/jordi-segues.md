# Estilo «cara y nada más»

Medido el 20-09-2026 sobre el vídeo que mandó Alex: TikTok de
**@thejordisegues**, 47,5 s de los que 43,4 son montaje (los últimos 4,1 son
la coletilla de la plataforma, que no cuenta y se recorta antes de medir).

Alex: «ese estilo también me gusta mucho».

Medido con `python scripts/video/medir-estilo.py <vídeo> --hasta=43.4`.

---

## 1 · Lo que se ve

| | |
|---|---|
| Lienzo | 576×1024 en la copia bajada (el original será 1080×1920), 25 fps |
| Bandas | ninguna: imagen a sangre, sin marco ni titular arriba |
| Fondo | pared roja con luz de contra, micro de podcast dentro del cuadro |
| B-roll | **cero insertos en 43 segundos** |
| Música | **ninguna**: el suelo de sala en las pausas está en −40 dB |
| Cierre | acaba en su cara. Sin tarjeta de marca, sin pantalla negra |

## 2 · El encuadre, que es TODO el estilo

```
la cara ocupa de alto      51 %   (entre 33 y 56 %)
centro de la cara          y=0,52   x=0,54
la frente queda en         y=0,26   (en algún plano, 0,14)
```

**La cara ocupa la mitad del cuadro.** No es un plano medio: es un primer
plano de los que en cine se llaman «de detalle». La coronilla se sale del
cuadro en varios planos y está hecho a propósito: lo que importa son los ojos
y la boca, y ocupan el centro geométrico de la pantalla.

Para comparar, el metraje de Alex: **la cara ocupa el 12 %**. Para llegar al
51 % habría que acercar cuatro veces, y a partir de 1,6 la imagen se ablanda.

> **Esto no se arregla editando: se arregla grabando.** Si Alex quiere este
> estilo, tiene que ponerse a **50–60 cm de la cámara**, no a tres metros. Con
> el clip de cuerpo entero no hay montaje que lo consiga.

## 3 · El ritmo

No hay cortes de escena —es una sola toma continua— pero el encuadre salta
**cada segundo y medio aproximadamente**, en promedio un salto cada 1,5 s y
más apretado en los primeros siete segundos.

Los saltos son **por corte, sin deriva**: dentro de cada plano la imagen está
quieta. Nada de zoom lento. Es exactamente lo que Alex pidió cuando dijo que
los acercamientos eran «MUY BRUSCOS»: lo brusco no era el corte, era el
movimiento dentro del plano.

Un detector de escenas no ve nada de esto —mismo fondo, misma persona— y por
eso `medir-estilo.py` mide los saltos por la cara, fotograma a fotograma.

## 4 · Los rótulos

```
banda con texto            y=0,63 a y=0,66
línea del rótulo           y=0,65
en pantalla                el 91 % del tiempo
```

- **1 a 3 palabras** por rótulo, nunca más.
- **MAYÚSCULAS**, blanco, **negrita cursiva**, con sombra suave. La cursiva es
  lo que da la sensación de prisa.
- **Ninguna palabra en color.** Ni una en 43 segundos. El acento lo pone el
  tamaño y el corte, no el color.
- Altura de letra ≈ 4 % del alto del cuadro (unos 75–80 px sobre 1920).
- Van **sobre el pecho**, no abajo del todo: a y=0,65 quedan lejos de la cara
  y lejos de los botones de la aplicación.

## 5 · El sonido

```
sonoridad                  −15,7 LUFS   ·   pico +0,1 dBTP   ·   LRA 7,1
pausas de más de 0,25 s    4 en 43 s, suman 1,5 s
fondo en las pausas        −40 dB  ->  no hay música
```

Voz sola, sin cama musical. El pico por encima de cero es de la recompresión
de la plataforma, no del montaje: nosotros seguimos entregando a −1,5 dBTP.

## 6 · Qué se copia y qué no

**Se copia:**

1. El salto de encuadre **por corte y sin deriva**, cada 1,5 s.
2. Rótulos de 1–3 palabras, blancos, a y=0,65, sin palabra en color.
3. Acabar **en su cara**, no en una pantalla negra con la marca.

**No se copia:**

- Cortar la coronilla. Alex sale con la cabeza entera: es su vídeo y su cara.
- Quitar la música. Aquí funciona porque hay un micro de podcast y una sala
  tratada; con el audio de un salón, la voz sola suena a vídeo casero. La
  música de Genuino se queda, agachada bajo la voz.
- Su color cálido rojizo. Alex va en frío, como eligió.

## 7 · La condición

Este estilo es **un 80 % decisión de rodaje y un 20 % de montaje**. El día que
Alex grabe cerca —cara llenando medio cuadro, luz de frente, fondo a oscuras—
lo tenemos. Con el metraje actual sale una imitación blanda.

Lo que sí se puede hacer YA con lo que hay: subir el tamaño de sus encuadres
todo lo que aguante la nitidez, saltar por corte sin deriva, y bajar los
rótulos a y=0,65 en una sola línea de 1–3 palabras.
