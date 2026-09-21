# Estilo «historia con imágenes»

Medido el 20-09-2026 sobre el segundo vídeo que mandó Alex: TikTok de
**@danielapolofi**, 95,6 s de los que 91,5 son montaje.

Alex: «Otro que me gusta, pero con un tono más movido. Me gusta la edición, y
todos los detalles».

Medido con `python scripts/video/medir-estilo.py <vídeo> --hasta=91.5`.

---

## 1 · La estructura, que es lo que lo hace distinto

No es un hablando-a-cámara con adornos: es **una historia contada a dos
voces**, la suya y la de las imágenes.

```
0,0 - 5,5 s     PANTALLA PARTIDA: ella arriba (media pantalla), abajo un
                hombre mayor solo en una cocina. En la costura, el titular
                a tres líneas, quieto los cinco segundos.
5,5 - 13,5 s    ella a pantalla completa
13,5 s          DESTELLO ROJO de un cuadro sobre su cara: el golpe
14 - 23 s       B-ROLL entero, nueve segundos: primeros planos de ancianos
23 - 34 s       ella
34 s            segundo destello rojo
35 - 42 s       B-ROLL
43 - 48 s       ella
49 - 55 s       B-ROLL
56 - 91 s       ella, hasta el final, con un fundido a negro al cerrar
```

**El B-roll va en bloques de 7 a 9 segundos, no en insertos de dos.** Eso es
lo contrario de lo que veníamos haciendo y de lo que dicen casi todos los
manuales. Funciona porque las imágenes **cuentan la misma historia** que ella
está contando: no ilustran una palabra, sostienen un párrafo entero.

## 2 · Lo que se ve

| | |
|---|---|
| Lienzo | 576×1024 en la copia bajada, 30 fps, a sangre |
| Fondo | estudio a oscuras con focos de fondo desenfocados, micro en cuadro |
| Cortes | **63 en 91 s: uno cada 1,4 s**; plano mediano de 1,0 s |
| Gancho | sólo 2 cortes en los primeros 7 s: el titular manda, no el ritmo |
| Cuerpo | 43 cortes por minuto |
| Re-encuadres | 12 saltos de la misma toma, uno cada 7 s |
| Música | **ninguna**: el suelo en las pausas está a −48 dB |
| Cierre | fundido a negro sobre su cara. Sin tarjeta de marca |

## 3 · El encuadre

```
la cara ocupa de alto      32 %   (18 % ella · hasta 66 % en los primeros
                                   planos del B-roll)
centro de la cara          y=0,29   x=0,51
```

Ella va en **plano medio corto**, la cara en el tercio superior, el micro
delante. El B-roll sí va cerradísimo: caras de anciano llenando el cuadro.
El contraste entre los dos tamaños es parte del efecto.

Nuestro metraje: la cara de Alex ocupa el **12 %**. Aquí el objetivo
razonable no es el 51 % del otro vídeo, sino **este 30 %**: se llega
acercándose a metro y medio de la cámara, sin nada raro.

## 4 · Los rótulos

```
banda con texto            y=0,58 a y=0,62
línea del rótulo           y=0,60
en pantalla                el 91 % del tiempo
```

- **2 a 4 palabras**, MAYÚSCULAS, blanco, **negrita condensada** (tipo Anton
  o Impact; en Windows, Bahnschrift Condensed Bold es lo más parecido).
- Sin ninguna palabra en color. **Tampoco aquí.**
- El titular de apertura es la excepción: **tres líneas** quietas cinco
  segundos, que es el gancho entero.
- Los rótulos van **encima del B-roll igual que encima de ella**, a la misma
  altura. Eso cose las dos capas: no parecen dos vídeos pegados.

## 5 · El sonido

```
sonoridad                  −21,0 LUFS   ·   LRA 3,4   ·   pico +0,0 dBTP
pausas de más de 0,25 s    9 en 91 s, suman 3,9 s
fondo en las pausas        −48 dB  ->  no hay música
```

LRA 3,4 es una voz **muy comprimida**: suena igual de fuerte todo el rato,
que es lo que aguanta el altavoz de un móvil en la calle. Y −21 LUFS es bajo
porque la plataforma lo sube sola.

## 6 · El detalle que Alex llamó «todos los detalles»

1. **El destello rojo** en la palabra que duele: un cuadro (0,03 s) con la
   imagen virada a rojo. Dos veces en todo el vídeo, ni una más.
2. **La pantalla partida** del arranque: el titular vive en la costura entre
   las dos imágenes, no encima de una cara.
3. **El rótulo no se mueve nunca de sitio.** Ni sube, ni rebota, ni cambia de
   tamaño. Lo que cambia es la imagen de detrás.
4. **Los bloques de B-roll empiezan y acaban en el mismo sitio de la frase**,
   nunca a mitad de palabra.
5. **Cierra con un fundido**, no con un corte seco a negro.

## 7 · El aviso, y hay que dárselo a Alex

**El B-roll de este vídeo está generado con inteligencia artificial.** Se ve
en la piel del anciano, en los guantes y en el fondo industrial. No es
metraje de banco ni rodado.

Eso tiene tres consecuencias que decide él, no yo:

- **TikTok e Instagram exigen etiquetar** el contenido generado con IA. No
  etiquetarlo es incumplir sus normas.
- En un vídeo de fe, poner una cara inventada haciendo de persona real es una
  decisión de fondo, no de estilo. Vale para una parábola; no vale para
  ilustrar un testimonio.
- Nosotros hoy **no generamos vídeo**: lo que tenemos es su metraje y los
  bancos con licencia (`broll.py` busca en Pexels, Pixabay y Coverr). Para
  este estilo hacen falta 20–25 segundos de material bueno por vídeo, y ahí
  sí hay que elegir entre buscar mucho, grabarlo él, o pagar un banco.

## 8 · Qué se copia

1. **El B-roll en bloques largos**, de 7 a 9 s, contando la misma historia.
   Ya no insertos de 1,3 s como el amanecer que no gustó.
2. **El titular de apertura quieto**, cinco segundos, sobre una imagen partida.
3. **Rótulos de 2–4 palabras a y=0,60, sin palabra en color**, siempre a la
   misma altura, encima de todo.
4. **Un destello de un cuadro** en la frase que más pesa. Uno o dos por vídeo.
5. **Cerrar en su cara con fundido**, no en una pantalla negra con la marca.
6. **Comprimir más la voz** (LRA por debajo de 5) para que se oiga en la calle.

## 9 · Qué NO se copia

- Las caras generadas por IA, mientras Alex no decida lo contrario.
- Quitar la música del todo: su sala no es un estudio tratado. Se baja, no se
  quita.
- Los −21 LUFS: nosotros entregamos a −14, que es lo que piden las redes.
