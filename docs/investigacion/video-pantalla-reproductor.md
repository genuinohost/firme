# Vídeo, pantalla compartida y «ver juntos» en las salas: documento de diseño

28-09-2026. Es para Alex y para quien lo construya. Todavía no hay nada construido ni se ha tocado el repositorio. Las cifras llevan su fuente al final entre corchetes. Si pone «no verificado» o «cálculo», no se comprobó en un móvil.

---

## 0. Antes de nada: el devocional se puede cortar en unos días

Esto no es de vídeo, pero afecta a lo que Alex llama «lo más importante».

- **El plan gratuito se corta.** La cuenta de Agora se creó en septiembre de 2026 y figura como «Cuenta gratuita, sin tarjeta» (`BITACORA.md`, línea 735). Las cuentas nuevas desde el 29-08-2025 entran solas en el paquete **Free**, que da 10.000 minutos al mes [1]. Pasado ese tope, Agora dice textualmente que el uso «results in service suspension» (el servicio se suspende) hasta comprar una recarga o un paquete [2].
- **Cuánto dura el regalo.** 28 personas × 60 min = **1.680 minutos al día**. Los 10.000 minutos alcanzan para unos 6 devocionales: en octubre, el corte llegaría hacia el día 6. Si en septiembre ya se gastaron más de 10.000, el corte puede llegar antes. No he visto la consola.
- **Qué hacer hoy:**
  1. Mirar en la consola de Agora el consumo (*Usage*) y el paquete contratado (*Subscriptions → RTC*).
  2. Contratar el paquete **Starter**: $45,99 al mes por 50.000 minutos [1]. Según la página de paquetes, el corte solo afecta al Free [2]; los de pago cobran el exceso. Sale unos $8 más caro que ir con recargas (~$38 al mes), pero no se corta.

---

## 1. La recomendación en tres frases

1. **La cámara, sí.** Se hace con el mismo motor nativo de Agora que ya lleva la voz. Basta con cambiar el paquete de «solo voz» por el **paquete Lite de vídeo de la misma versión 4.5.2**, que añade unos 1,3 MB a lo que baja cada móvil. Primero en los subgrupos de 2 a 5 personas; después, en la sala grande, solo para el anfitrión y quien tiene la palabra.
2. **YouTube se ve con un reproductor «Ver juntos», no compartiendo pantalla.**
   - Cada móvil reproduce el vídeo por su cuenta y el anfitrión manda el play, la pausa y el segundo exacto.
   - La música o los audios propios, que tienen que oírse también con la pantalla apagada a las 5 am, los emite el anfitrión por Agora. Eso ya se puede hacer hoy sin cambiar el SDK.
3. **Compartir pantalla queda como última fase, opcional,** solo si aparece un uso que no sea YouTube. Obliga a un permiso que Play revisa con vídeo de demostración, añade unos 8,7 MB a lo que baja cada móvil y, con YouTube, se ve a saltos, se oye como una llamada telefónica y choca con sus términos.

---

## 2. Qué se puede y qué no

| Lo que se pidió | ¿Se puede? | Cómo, o por qué no |
|---|---|---|
| Cámara en los subgrupos (2–5) | **Sí** | Vídeo nativo. Cinco cámaras por grupo es poco: Agora recomienda hasta 17 cámaras por canal [9]. Cada grupo ya tiene su propio canal (`src/logica/subgrupos.ts`). |
| Cámara en la sala de 28, estilo Zoom | **Sí, acotado** | Con todas las cámaras encendidas se pasa del tope recomendado de 17 y costaría hasta ~$1.529 al mes (sección 5). Se propone un «escenario»: el anfitrión y quien tiene la palabra. |
| Cámara con la pantalla apagada o la app en segundo plano | **No** | Desde Android 9, una app en segundo plano no puede usar la cámara [19]. Mantenerla exigiría un servicio de tipo cámara, con declaración en Play [20][25]. Al salir de la app, la cámara se apaga y la voz sigue. |
| Ver un vídeo de YouTube todos a la vez | **Sí** | Reproductor sincronizado (sección 4.1), con la pantalla encendida. |
| YouTube con la pantalla apagada, o meter su audio en la sala | **No** | Las políticas de YouTube prohíben reproducir con el reproductor fuera de la vista (III.I.9) y separar el audio del vídeo (III.I.7) [28]. |
| Música o audio propio para todos, también con la pantalla apagada | **Sí** | Mezcla de audio de Agora desde el móvil del anfitrión (sección 4.2) [10]. |
| Compartir pantalla (un documento, una app, la Biblia) | **Sí, con coste** | Hace falta:<br>• el paquete completo de vídeo;<br>• el permiso de proyección de pantalla (`mediaProjection`), que exige declaración en Play;<br>• pedir permiso en cada sesión.<br>Además se corta al bloquear la pantalla desde Android 15 QPR1 [22]. |
| **Compartir pantalla con el sonido de YouTube** | **No, para este uso** | Ver el párrafo siguiente. |
| Compartir pantalla desde la parte web de la app | **No** | `getDisplayMedia` no existe ni en Chrome ni en la WebView de Android [26], y Agora Web no comparte pantalla en móviles [14]. |

**¿Y compartir pantalla con el audio de YouTube?** Técnicamente, desde Android 10 se puede capturar el sonido de otra app si esa app lo permite; las que apuntan a Android 10 o superior lo permiten por defecto [23]. Pero:

- No encontré fuente oficial que diga si la app de YouTube lo bloquea. **No verificado.**
- Agora avisa de que algunos Xiaomi no capturan el audio del sistema [8].
- El motor usa `AUDIO_PROFILE_SPEECH_STANDARD` (32 kHz, mono, 18 kbps; `Sala.java`, línea 268) [12]: la música sonaría a teléfono.
- Agora aconseja no pasar de 15 imágenes por segundo al compartir pantalla, así que el vídeo se vería a saltos.
- Cuesta 4 veces más por minuto que el audio [1].
- Los términos de YouTube prohíben «transmit, broadcast» su contenido sin autorización [30].

**Conclusión: no.**

---

## 3. Arquitectura del vídeo

### 3.1 El paquete actual no trae cámara

Lo medí en Maven Central y en la caché de Gradle [6]:

- `agora-special-voice:4.5.2.135` y `agora-special-full:4.5.2.135` son **el mismo archivo**: misma huella SHA-1 `434c7b38…` y 28.513.292 bytes.
- Tiene las mismas 801 entradas que `voice-rtc-basic:4.5.2` y **ninguna clase de captura de cámara** (`VideoCaptureCamera*`).
- **Trampa:** el `.jar` sí trae `enableVideo`, `setupRemoteVideo` y `switchCamera`. El código compila sin avisar y falla después, en el teléfono.

Así que no basta con escribir código: **hay que cambiar de paquete.**

### 3.2 La elegida: vídeo nativo, con el mismo motor y el mismo canal que la voz, en el paquete Lite 4.5.2

| | **Nativo Lite 4.5.2** (elegido) | Nativo completo 4.5.2 | SDK web de Agora en la WebView |
|---|---|---|---|
| Cámara | Sí | Sí | Sí |
| Compartir pantalla | No [5] | Sí, con dos extensiones | No [14][26] |
| Descarga por móvil desde Play (parte de Agora, arm64) | 7,06 → 8,33 MB (**+1,3**) | 7,06 → 15,76 MB (**+8,7**) | +0,43 MB |
| APK que se instala a mano (dos arquitecturas; hoy 33,6 MB) | ~38,9 MB | ~68,8 MB (vuelven los cortes con conexiones venezolanas) | ~34 MB |
| Cobro | Una vez por persona | Una vez | **Dos canales: +25 % por cada persona que ve vídeo** [3] |
| Labios a la par con la voz | Sí, mismo motor | Sí | No garantizado: son dos motores y dos canales |
| Móviles baratos | Codificación nativa | Igual | Obliga a VP8. Con chips MediaTek no se puede enviar en H.264, y hay fallos documentados en WebView y en Android 12 [15] |
| Trabajo | Java (las vistas de vídeo) + React | Igual | Poco Java, pero un segundo token en el portero |

**Por qué el nativo:**

1. **Es la misma razón por la que se eligió nativo para la voz.** Agora dice que el soporte en WebView «depende del dispositivo» (`BITACORA.md`, líneas 660-663).
2. **Un solo motor y un solo canal:**
   - los labios van sincronizados;
   - hay una sola factura por persona;
   - se usa el mismo servicio en primer plano (`ServicioSala`).

**Por qué el Lite y no el completo:**

- Si compartir pantalla queda fuera, lo único que el completo añade son 7,4 MB de descarga.
- El Lite incluye las extensiones de codificación y decodificación de vídeo [4].
- Tiene la misma API que el completo. Pasar al completo más adelante es **cambiar una línea de Gradle** y añadir `screen-capture` y `full-screen-sharing`.

**Lo que se pierde:** los arreglos que tuviera la compilación especial .135. Agora no publica sus notas, así que no sé cuáles son. Por eso la fase 3 cambia el paquete **sin encender el vídeo** y lo deja una semana en devocionales reales.

**No usar `full-sdk`:** arrastra `full-screen-sharing`, cuyo manifiesto inyecta `FOREGROUND_SERVICE_MEDIA_PROJECTION` y un servicio de proyección de pantalla, aunque nunca se comparta pantalla. Eso obliga a la declaración en Play [25][32].

### 3.3 Cómo se pinta el vídeo junto a la parte web

Se sigue el mismo patrón que el plugin oficial de mapas de Capacitor [17]:

- **El vídeo, debajo; la web, encima.** Una capa de vídeo nativa va *debajo* de la WebView, y la WebView se vuelve transparente **solo mientras se ve la llamada**.
- **Cada recuadro es un `SurfaceView`.** Se coloca con los datos que manda la web: `getBoundingClientRect() × devicePixelRatio`. Se usa `SurfaceView` porque Android lo recomienda: `TextureView` compone cada píxel dos veces [18]. Agora acepta los dos [16].
- **Los controles se quedan en React.** La WebView queda encima y recibe todos los toques, así que botones, nombres y manos levantadas no cambian.
- **Límites:**
  - Nada de bordes redondeados ni animaciones *sobre* el vídeo; las esquinas se tapan con HTML por encima.
  - Rejillas fijas de 2×2 o 2×3, sin desplazamiento.

### 3.4 Reglas de construcción (para quien lo programe)

**Motor y canal:**
- En `Sala.java` (línea 263), cambiar `motor.disableVideo()` por `enableVideo()`.
- Fijar el vídeo con `setVideoEncoderConfiguration` en **640×360 y 15 imágenes por segundo**. Por defecto, Android sale a 960×540: en un grupo de 5, cada uno recibiría 4 × 518.400 = 2.073.600 píxeles, que Agora cobra como Full HD (×9 en vez de ×4) [1][3].
- En `ChannelMediaOptions`, `publishCameraTrack=false` por defecto. En `aplicarRol`, al pasar a oyente, poner también `publishCameraTrack=false`.
- Suscribirse **solo a los recuadros que se ven** en pantalla.
- En la sala grande, flujo doble (`enableDualStreamMode`): una versión pequeña para las miniaturas. Según la lista de API del Lite está disponible; **hay que confirmarlo en el prototipo.**

**Métodos del plugin:**
- `camara({encendida})`, `girar()`, `colocar({uid,x,y,ancho,alto})` y `quitar({uid})`.
- Las vistas se crean en el hilo principal (`bridge.executeOnMainThread`).
- Al quitar un recuadro, usar `VIEW_SETUP_MODE_REMOVE`.

**Eventos:**
- `onRemoteVideoStateChanged`: quién enciende o apaga la cámara.
- `onLocalVideoStateChanged`: cámara ocupada o bloqueada.

**Al salir y volver a la app:**
- Al salir (`handleOnStop`): `enableLocalVideo(false)` y `muteAllRemoteVideoStreams(true)`. Así la persona vuelve a pagar como audio, no gasta datos y **no hace falta un servicio de tipo cámara**.
- Al volver (`handleOnResume`): restaurar lo anterior.

**Permisos:**
- `CAMERA`, pedido en el momento de encender la cámara.
- `<uses-feature android:name="android.hardware.camera" android:required="false"/>`, y lo mismo para `.autofocus`. Sin eso, Play oculta la app a los móviles sin cámara [24].

**Portero (`worker/src/index.js`):** no cambia. El token de quien habla ya permite publicar vídeo; un oyente no puede encender la cámara, lo que encaja con la moderación actual.

**Nunca** añadir el tipo de servicio `camera` en un camino de código que pueda ejecutarse con la pantalla apagada.

---

## 4. El reproductor «Ver juntos»

Son dos piezas distintas porque cubren dos casos distintos:

| | 4.1 YouTube sincronizado | 4.2 Audio emitido por Agora |
|---|---|---|
| Qué se pone | Cualquier vídeo de YouTube que permita incrustarse | Archivos propios o con licencia: música, audios grabados |
| Pantalla apagada (las 5 am) | **No** (política de YouTube) | **Sí**: es el mismo audio de la sala |
| Sincronía | Cada móvil se recoloca si se desvía más de 1,5 s | Perfecta: es un solo flujo |
| Coste en Agora | $0 | $0: todos ya reciben el audio del canal |
| Cambios en Play | Ninguno | Ninguno |
| Cambia el SDK | No | No: el paquete actual ya trae la mezcla de audio y el reproductor (comprobado con `javap`, **sin probar en un móvil**) |

### 4.1 YouTube sincronizado: cómo funciona

1. **El anfitrión elige el vídeo.** Pega un enlace de YouTube y la sala guarda en Firestore `video: {id, estado, pos, en}`, donde `en` es la hora del servidor. Solo se escribe al dar play, pausar, saltar o cambiar de vídeo.
2. **Cada móvil lo reproduce por su cuenta** con el reproductor IFrame oficial y calcula dónde debería ir: `pos + (ahora − en)` si está en marcha. Si se desvía más de 1,5 s, salta a ese punto. Esto también corrige el desfase de los anuncios, que cada móvil ve por su lado [29].
3. **Arranque automático:**
   - Dentro de la app puede arrancar solo, porque Capacitor lo permite (`Bridge.java`, línea 592). YouTube solo lo acepta si más de la mitad del reproductor está a la vista [27].
   - Quien esté en otra pantalla ve un botón «Ver».
   - En la versión web abierta en el navegador hace falta un toque.
4. **Cuánto cuesta en Firestore:** unas 1.680 lecturas por sesión, frente a 50.000 gratis al día [34]. Los datos móviles los gasta cada persona.

### 4.2 Audio emitido por Agora: cómo funciona

- **El anfitrión elige un archivo:** uno del móvil, con el selector del sistema (no pide permiso), o uno de una lista subida a Storage.
- **Todos lo oyen a la vez.** `startAudioMixing` lo mete en el canal y lo oyen todos, también el anfitrión [10]. El cancelador de eco de Agora sabe que suena y lo descuenta.
- **Formatos:** MP3, AAC, OPUS, FLAC, WAV y AMR, desde un archivo o un enlace directo [11].
- **Calidad de música.** Mientras suena hay que pasar a `AUDIO_PROFILE_MUSIC_STANDARD` (48 kHz, 64 kbps) [12] y volver al perfil de voz al terminar. **No verificado** que el perfil se pueda cambiar ya dentro del canal.
- **Nunca YouTube por aquí:** descargar sus vídeos o separar el audio está prohibido [28].

### 4.3 Límites de YouTube que condicionan el diseño

- **Tamaño.** El reproductor tiene que medir al menos 200×200 px [27]. En un móvil de 360 px de ancho, un 16:9 con márgenes (328×184) **no cumple**: hay que ponerlo a todo lo ancho o en un contenedor de al menos 200 px de alto.
- **Nada encima.** No puede haber nada superpuesto al reproductor: ni botones flotantes, ni la manito, ni avisos. Los controles van debajo [27].
- **Error 153.** Sale si la petición no identifica a la app (`Referer`) [29].
  - Capacitor sirve la app como `https://localhost`, así que puede salir en la app. Hay un informe de que en Android funciona [33]; **no verificado hoy**.
  - Si falla: una página propia en Firebase Hosting que contenga YouTube y se controle con `postMessage`.
  - No cambiar `server.hostname`: la app cambiaría de origen y se perdería lo guardado en `localStorage` e IndexedDB (deducción, no probado).
- **Trampa en el propio código.** `PantallaSala.tsx`, líneas 1153 y 1701, usa `referrerPolicy="no-referrer"` en las fotos. **No copiarlo al reproductor:** YouTube lo prohíbe [27].
- **Vídeos bloqueados.** Si el dueño no permite incrustarlo, salen los errores 101 o 150; pasa a menudo con videoclips. Hay que avisar al anfitrión con un mensaje claro.
- **Volumen.** En el escenario que usa la app (`CHATROOM`), la voz de Agora va por el volumen de llamada [13]. El vídeo de la WebView va, en principio, por el volumen multimedia; **no verificado**. Los botones físicos moverían las voces y no el vídeo: hace falta un deslizador dentro de la app.
- **Eco.** El cancelador de Agora no conoce el sonido de la WebView. Un micrófono abierto con altavoz reenviaría el vídeo a todos con retraso. Mientras suena, se cierran los micrófonos (`publishMicrophoneTrack=false`) y el anfitrión pausa para hablar, o se piden auriculares.
- **Riesgo con Play.** Play prohíbe las apps que usan una API incumpliendo sus términos [31]. Respetar las reglas de arriba es obligatorio, no opcional.
- **Reglas de Firestore.** `firestore.rules` (línea ~242) limita los campos de la sala con `hasOnly`: hay que añadir `video` y su prueba.

---

## 5. Costes al mes

**Precios de Agora** [1][3]:

| Tipo | Cuenta como… | Precio por 1.000 minutos |
|---|---|---|
| Audio | 1 minuto estándar | $0,99 |
| Vídeo HD (hasta 921.600 px recibidos) | 4 minutos estándar | $3,99 |
| Full HD | 9 minutos estándar | $8,99 |

**Cómo cobra Agora el vídeo:**
- A cada persona se le cobra por **la suma de píxeles del vídeo que recibe**, no por cuántas cámaras emite.
- El tramo más bajo de vídeo es HD: cualquier vídeo recibido, por pequeño que sea, cuenta ×4.
- Quien no recibe vídeo (por ejemplo, con la pantalla apagada) paga audio.

**Supuestos de la tabla:**
- 28 personas, 60 min, 30 devocionales al mes.
- Las actividades ocurren **dentro** de la hora, así que sustituyen minutos de audio.
- El precio de cada minuto extra es $0,94 por mil (recarga de 25.000 minutos a $23,50) o $0,99 por mil (exceso del Starter).
- Son cálculos, no facturas.

| Escenario | Minutos estándar al mes | Coste al mes |
|---|---|---|
| **Hoy, solo voz** | 50.400 | **~$38** (Free + recargas; **se corta** si se acaban) · **$46,39** (Starter, no se corta) |
| + Subgrupos con cámara 640×360, 15 min, **una vez por semana** (25 personas) | +4.500 | **+$4–5** |
| + Subgrupos con cámara, 15 min **todos los días** | +33.750 | +$32–33 |
| Trampa: subgrupos diarios con la cámara por defecto, 960×540 (Full HD) | +90.000 | +$85–89 |
| + Cámara del anfitrión **10 min al día** (saludo, oración), todos mirando | +25.200 | **+$24–25** |
| Cámara del anfitrión **toda la hora**, los 28 mirando | 201.600 en total | **$171–185** en total, en lugar de los $38 |
| Lo mismo, con la mitad escuchando con la pantalla apagada | ~126.000 en total | ~$110–134 en total |
| Trampa: estilo Zoom ingenuo, las 28 cámaras toda la hora (2K+, ×36) | 1.814.400 | ~$1.529 |
| + Compartir pantalla 15 min × 4 al mes, a 1280×720 | +4.860 | **+$4,6** |
| Lo mismo en vertical, a 720×1600 (Full HD) | +12.960 | +$12 |
| **«Ver juntos» con YouTube** | 0 | **$0** |
| **Audio emitido por Agora** | 0 | **$0** |

**Combinación razonable:** voz diaria + subgrupos con cámara una vez por semana + cámara del anfitrión 10 min al día + YouTube + audio. Sale a **~$67 al mes con recargas, o ~$76 con Starter y exceso.**

**Datos móviles de cada persona:** con 4 cámaras recibidas en un subgrupo, una ronda de 15 min puede gastar del orden de 20 a 180 MB por persona, según reciba miniaturas o cámaras completas. **Es un cálculo, no una medición:** se mide en la fase 4.

---

## 6. Google Play y tamaño de la app

**Permisos por fase.** Cada permiso nuevo supone otra revisión en Play; el de pantalla, además, un formulario con vídeo.

| Fase | Permiso nuevo | ¿Declaración en Play Console? |
|---|---|---|
| 1. YouTube juntos | Ninguno | No |
| 2. Audio emitido por Agora | Ninguno | No |
| 3. Cambio de paquete de Agora | Ninguno, si el manifiesto del Lite no trae ninguno. El paquete de voz actual no declara permisos (comprobado en la caché de Gradle). Revisarlo en el manifiesto final que genera la compilación. | No |
| 4 y 5. Cámara | `CAMERA`, más `uses-feature … required="false"` | No encontré un formulario específico para `CAMERA` (**no verificado**). Hay que actualizar «Seguridad de los datos» con fotos y vídeos procesados al momento, sin guardarse. |
| 6. Compartir pantalla (opcional) | `FOREGROUND_SERVICE_MEDIA_PROJECTION` y un servicio de proyección de pantalla (los inyecta la extensión de Agora) | **Sí:** declaración de servicio en primer plano con enlace a un vídeo de demostración [25]. Hay un caso público de subida bloqueada por esto [32]. |
| Nunca | `FOREGROUND_SERVICE_CAMERA` | Se evita apagando la cámara al salir de la app. |

**Tamaño.** Son sumas de los paquetes en Maven Central, no compilaciones:

| | Descarga desde Play por móvil (arm64, parte de Agora) | APK a mano, dos arquitecturas | APK a mano, solo arm64 |
|---|---|---|---|
| Hoy (voz .135) | 7,06 MB | 33,6 MB (medido) | — |
| **Lite 4.5.2** | 8,33 MB | ~38,9 MB | ~25,3 MB |
| Completo 4.5.2 | 15,76 MB | ~68,8 MB | ~42 MB |
| + pantalla compartida | +0,13 MB | +0,4 MB | +0,4 MB |

- Con el Lite, el APK que se instala a mano se queda por debajo de 40 MB.
- Si algún día se pasa al completo, hay que sacar **un APK por arquitectura** (`splits { abi { … } }` en `build.gradle`). Hoy `abiFilters` las junta (línea 37).

---

## 7. Plan por fases, de menos a más riesgo

**Fase 0. Blindar el devocional (antes que nada, 1 día)**
- **Entrega:**
  - el paquete de Agora resuelto (sección 0);
  - la prueba del riesgo 1 de la sección 8 y, si falla, su arreglo: capturar el error y quedarse como servicio de reproducción.
- **Cómo se prueba:** en un Android 14 o superior, con la pantalla apagada, el anfitrión suelta y recoge los micrófonos. La app no puede cerrarse.

**Fase 1. «Ver juntos» con YouTube (solo web; sin permisos ni SDK nuevo)**
- **Primero, una hora de prueba:** poner el reproductor de YouTube en la app instalada. Si sale el error 153, se usa la página propia en Firebase Hosting.
- **Entrega:**
  - el anfitrión pega un enlace y todos ven el vídeo a la par;
  - botón «Ver» para quien esté en otra pantalla;
  - deslizador de volumen;
  - micrófonos cerrados mientras suena;
  - reglas de Firestore con su prueba.
- **Cómo se prueba:**
  - 3 o 4 móviles distintos, incluidos uno barato con chip MediaTek y un Xiaomi;
  - desfase de menos de 1,5 s tras play, pausa y salto;
  - un vídeo con anuncio;
  - un videoclip que no deje incrustarse;
  - la versión web en el navegador.

**Fase 2. Audio emitido por Agora (SDK actual)**
- **Entrega:**
  - el anfitrión elige un archivo y todos lo oyen;
  - pausa, continuar y volumen;
  - perfil de música mientras suena.
- **Cómo se prueba** en una sala de prueba, **nunca en la de las 5**:
  - con la pantalla apagada en el anfitrión y en los oyentes;
  - calidad de la voz frente a la música;
  - eco con micrófonos abiertos;
  - que al terminar vuelve al perfil de voz sin cortar a nadie.

**Fase 3. Cambiar el paquete de Agora (voz .135 → Lite 4.5.2), sin encender el vídeo**
- **Entrega:** una línea de Gradle más la librería `aosl`. No se ve nada nuevo.
- **Cómo se prueba:**
  - medir el APK y el `.aab`;
  - revisar el manifiesto final: que no entre ningún permiso;
  - **una semana de devocionales reales** en prueba cerrada, comparando cortes, eco, batería y pantalla apagada con la versión actual.
- **Si falla:** se prueba `full-rtc-basic`, sin las extensiones de pantalla y con un APK por arquitectura.

**Fase 4. Cámara en los subgrupos (2–5)**
- **Entrega:**
  - botones de cámara y de girar;
  - rejilla fija;
  - nombres y manos en React por encima;
  - la cámara se apaga al salir de la app y vuelve al entrar.
- **Permisos:** `CAMERA`. Supone una revisión nueva en Play.
- **Cómo se prueba:**
  - un grupo de 5 con móviles baratos durante 15 minutos: imágenes por segundo, temperatura, batería y MB gastados;
  - que la consola de Agora cobre **HD y no Full HD**;
  - bloquear la pantalla a mitad: la voz sigue y la cámara se apaga y vuelve;
  - que el vídeo no se encienda sobre la pantalla de bloqueo, porque `MainActivity` tiene `showWhenLocked="true"`.

**Fase 5. Cámara en la sala grande**
- **Entrega:**
  - el «escenario»: el anfitrión y quien tiene la palabra, con flujo doble;
  - un interruptor «Ver cámaras», que controla el gasto.
- **Cómo se prueba:**
  - un devocional real con 28 personas;
  - el coste del día en la consola frente a la tabla de la sección 5;
  - que quien escucha con la pantalla apagada factura como audio.

**Fase 6 (opcional). Compartir pantalla**
- **Solo si** hay un uso que la fase 1 no cubre.
- **Entrega:**
  - el paquete completo y las dos extensiones;
  - resolución fijada en 1280×720 en horizontal, o 540×1200 en vertical;
  - perfil de música si se comparte sonido;
  - declaración en Play con vídeo.
- **Cómo se prueba:**
  - se pide permiso en cada sesión;
  - se corta bien al bloquear, en Android 15 QPR1;
  - se registra el aviso de parada, `onStop`, que Android exige [22].

---

## 8. Riesgos abiertos y qué probar en un móvil real antes de comprometerse

1. **Riesgo que ya existe hoy (no es de vídeo).**
   - Qué pasa: cuando el anfitrión suelta los micrófonos, cada oyente cambia de papel él solo, aunque tenga la pantalla apagada (`PantallaSala.tsx`, líneas 767-796). Eso lleva a `aplicarRol` y a `ServicioSala.arrancar(..., true)` (`Sala.java`, línea 392), que llama a `startForeground` con tipo micrófono sin capturar el error (`ServicioSala.java`, líneas 93-97).
   - Por qué importa: Android 14 prohíbe crear un servicio de micrófono sin una Activity visible [21]. No sé si el servicio ya en marcha lo evita.
   - Si falla, la app se cierra en pleno devocional. **Es la primera prueba.**
2. **El error 153 de YouTube** con `https://localhost` en la app instalada.
3. **El Lite frente a la compilación .135:** que la voz del devocional sea igual; que el flujo doble exista; la calidad en MediaTek.
4. **La mezcla de audio en el paquete de voz:**
   - que funcione de verdad (solo está comprobado que las clases existen);
   - que el perfil se pueda cambiar dentro del canal;
   - que no suene como una llamada por la vía del volumen de llamada. Si suena así, probar el escenario `GAME_STREAMING` mientras suena.
5. **Los botones de volumen** moverían las voces y no el vídeo de YouTube: confirmarlo.
6. **Eco:** el vídeo de YouTube colándose por un micrófono abierto con altavoz, según cada modelo de móvil.
7. **`showWhenLocked`:** que la cámara no se encienda sobre la pantalla de bloqueo.
8. **Coste real:** el tramo que cobra Agora (HD o Full HD) y los MB por persona en un subgrupo de 5.
9. **Solo si llega la fase 6:**
   - si la app de YouTube deja capturar su audio (no verificado; indicio en el foro de Zoom);
   - los Xiaomi que no capturan el audio del sistema [8].
10. **La cuenta de Agora:** el paquete real y el consumo de septiembre. No tuve acceso a la consola.

**Archivos que se tocarían** (hoy sin modificar):
- `C:\Users\InvitadosPro\developer\firme\android\app\src\main\java\app\genuino\firme\Sala.java`
- `C:\Users\InvitadosPro\developer\firme\android\app\src\main\java\app\genuino\firme\ServicioSala.java`
- `C:\Users\InvitadosPro\developer\firme\android\app\src\main\AndroidManifest.xml`
- `C:\Users\InvitadosPro\developer\firme\android\app\build.gradle` (línea 101, la dependencia; línea 37, las arquitecturas)
- `C:\Users\InvitadosPro\developer\firme\src\componentes\PantallaSala.tsx`
- `C:\Users\InvitadosPro\developer\firme\firestore.rules`
- `C:\Users\InvitadosPro\developer\firme\worker\src\index.js` (solo si un oyente tuviera que encender la cámara)

---

## 9. Lo que tiene que decidir Alex

1. **Agora:** paquete Starter ($45,99 al mes, no se corta) o seguir con recargas (~$38, se corta si se acaban).
2. **Arranque:** empezar por la fase 0 y la 1 (YouTube juntos), sí o no.
3. **Compartir pantalla:** dejarlo fuera y cubrir YouTube con «Ver juntos», o mantenerlo como fase 6.
4. **Sala grande:** cámara solo para el «escenario» (anfitrión y quien tiene la palabra), o cámara abierta a todos, con su coste.

---

## Fuentes

[1] Agora, precios RTC (10.000 minutos gratis, desde el 29-08-2025, $0,99 / $3,99 / $8,99, Starter): https://docs.agora.io/en/realtime-media/rtc/reference/pricing.md
[2] Agora, paquetes de suscripción (suspensión del Free): https://docs.agora.io/en/realtime-media/rtc/subscription-packages.md
[3] Agora, precios de vídeo y cobro por resolución recibida: https://docs.agora.io/en/video-calling/overview/pricing
[4] Agora, optimizar el tamaño de la app (Lite y extensiones): https://docs.agora.io/en/realtime-media/video/build/optimize-and-operate/app-size-optimization
[5] Agora, API del Lite (sin captura de pantalla; su reproductor solo audio): https://api-ref.agora.io/en/video-sdk/android/4.x/API/rtc_lite_api.html
[6] Maven Central, `io.agora.rtc` (tamaños y huellas medidos): https://repo1.maven.org/maven2/io/agora/rtc/
[7] Agora, notas de versión (4.5.2; el Lite desde la 4.4.0): https://docs.agora.io/en/realtime-media/video/reference/release-notes
[8] Agora, compartir pantalla en Android: https://docs.agora.io/en/realtime-media/rtc/build/capture-and-render-video/screen-sharing
[9] Agora, capacidad (17 cámaras por canal): https://docs.agora.io/en/api-reference/faq/product/capacity
[10] Agora, mezcla de audio: https://docs.agora.io/en/voice-calling/advanced-features/audio-mixing-and-sound-effects
[11] Agora, reproductor multimedia: https://docs.agora.io/en/broadcast-streaming/advanced-features/play-media
[12] Agora, perfiles de audio: https://api-ref.agora.io/en/voice-sdk/android/4.x/API/enum_audioprofiletype.html
[13] Agora, volumen del sistema: https://docs.agora.io/en/api-reference/faq/integration/system_volume
[14] Agora Web, plataformas admitidas: https://docs.agora.io/en/realtime-media/voice/reference/supported-platforms/web
[15] Agora, compatibilidad de navegadores (VP8): https://docs.agora.io/en/help/general-product-inquiry/browser_support
[16] Agora, `VideoCanvas`: https://api-ref.agora.io/en/video-sdk/android/4.x/API/class_videocanvas.html
[17] Capacitor Google Maps (WebView transparente): https://capacitorjs.com/docs/apis/google-maps y https://github.com/ionic-team/capacitor-google-maps
[18] Android, `SurfaceView` frente a `TextureView`: https://source.android.com/docs/core/graphics/arch-tv
[19] Android 9, la cámara en segundo plano: https://developer.android.com/about/versions/pie/android-9.0-changes-all
[20] Android, tipos de servicio en primer plano: https://developer.android.com/develop/background-work/services/fgs/service-types
[21] Android, restricciones al arrancar servicios en segundo plano: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
[22] Android, proyección de pantalla (MediaProjection): https://developer.android.com/media/grow/media-projection
[23] Android, captura del audio de otras apps: https://developer.android.com/media/platform/av-capture
[24] Android, `uses-feature`: https://developer.android.com/guide/topics/manifest/uses-feature-element
[25] Play Console, declaración de servicios en primer plano: https://support.google.com/googleplay/android-developer/answer/13392821
[26] MDN, datos de compatibilidad de `getDisplayMedia`: https://github.com/mdn/browser-compat-data/blob/main/api/MediaDevices.json
[27] YouTube, funcionalidad mínima requerida: https://developers.google.com/youtube/terms/required-minimum-functionality
[28] YouTube, políticas para desarrolladores: https://developers.google.com/youtube/terms/developer-policies
[29] YouTube, API IFrame (error 153): https://developers.google.com/youtube/iframe_api_reference
[30] Términos de YouTube: https://www.youtube.com/t/terms
[31] Google Play, política sobre el uso de API de terceros: https://support.google.com/googleplay/android-developer/answer/16559646
[32] Agora-Flutter-SDK, issue #1458: https://github.com/AgoraIO-Extensions/Agora-Flutter-SDK/issues/1458
[33] Capacitor, issue #8205 (YouTube incrustado): https://github.com/ionic-team/capacitor/issues/8205
[34] Firestore, cuotas: https://firebase.google.com/docs/firestore/quotas

---

# Revisión crítica del diseño (28-09-2026)

Un segundo agente revisó el documento contra las fuentes. Sus correcciones mandan sobre lo de arriba donde se contradigan.

**Correcciones al documento de diseño**

Fuentes verificadas el 28-09-2026. No modifiqué nada del repositorio.

## A. Afirmaciones falsas o que cambian una decisión

1. **§3.4, «el portero no cambia; un oyente no puede encender la cámara»: hoy es falso.**
   - La autenticación de coanfitrión («Co-host authentication») sigue pendiente (`BITACORA.md` líneas 72 y 119-124). Sin ella, «Role_Subscriber still has the same privileges as Role_Publisher».
   - Además, `worker/src/index.js:445-462` firma el permiso de publicar vídeo con el mismo plazo que la voz. Así, el anfitrión no puede apagar la cámara de alguien sin quitarle también la palabra.
   - Corrección: activar la autenticación de coanfitrión en la fase 0, como requisito para la cámara. Separar en el portero el permiso de publicar vídeo del de publicar audio, y añadir «Apagarle la cámara» a la moderación.

2. **§5 y fase 4: con 28 personas hay subgrupos de 6, no de 5.**
   - `src/logica/subgrupos.ts:31` da como máximo 5 grupos. Con 28 personas salen 6+6+6+5+5.
   - Quien está en un grupo de 6 recibe 5 × 640×360 = 1.152.000 píxeles. Eso pasa de 921.600 y Agora lo cobra como Full HD (×9), no como HD (×4). Umbrales: https://docs.agora.io/en/realtime-media/rtc/reference/pricing.md
   - Los grupos de 5 quedan justo en el límite (921.600): cualquier redondeo del codificador los pasa a Full HD.
   - Recalculado (cálculo mío): cámara una vez por semana, **+10.440 minutos** (no 4.500); todos los días, **+78.300** (no 33.750, unos $74-78).
   - Corrección: usar **480×270** (5 × 129.600 = 648.000, con margen), o suscribirse a 4 cámaras como mucho. La prueba de la fase 4 debe hacerse con un grupo de 6.

3. **§0 y §5: falta la opción más barata de Agora.**
   - Agora cobra menos al público de «Broadcast streaming»: el audio vale ×0,57 y el vídeo HD ×2, en vez de ×1 y ×4 (misma página de precios).
   - Se consigue poniendo `audienceLatencyLevel = AUDIENCE_LATENCY_LEVEL_LOW_LATENCY`. El valor por defecto es ULTRA_LOW, que es lo que usa hoy `Sala.java:275-281`. Agora dice que esto «affects your pricing tier»: https://docs.agora.io/en/broadcast-streaming/get-started/get-started-sdk
   - Cálculo con 2 personas hablando y 26 escuchando: la voz baja de 50.400 a unos **30.300 minutos al mes**, unos $19 con recargas. La cámara del anfitrión toda la hora bajaría a la mitad.
   - A cambio, los oyentes tienen más retraso: Agora habla de «slightly higher latency» y no da la cifra. Con los micrófonos libres no se ahorra nada, porque todos pasan a hablar.
   - Esto cambia la decisión 1 de Alex: puede que el paquete Starter sobre.

4. **§0, «si en septiembre ya se gastaron más de 10.000, el corte puede llegar antes»: la lógica está mal.**
   - Los 10.000 minutos gratis son **por mes**. Pasarse en septiembre cortaría en septiembre, no adelantaría el corte de octubre. Además, las salas se publicaron el 27-09 (`BITACORA.md` línea 551).
   - Contratar Starter hoy: Agora dice «Upgrades take effect immediately for the entire calendar month», así que probablemente cobra septiembre entero. No verificado.
   - Alternativa: una recarga de 25.000 minutos hoy ($23,50, vale un año) y decidir el paquete el 1 de octubre. Fuente: https://docs.agora.io/en/realtime-media/rtc/subscription-packages.md

5. **§3.4: faltan dos ajustes que evitan cámaras y cobros sin querer.**
   - Según la referencia de Agora, tras `enableVideo()` la captura local queda activada por defecto. Hay que llamar a `enableLocalVideo(false)` justo después, para que no se abra la cámara ni pida el permiso hasta que la persona toque el botón. Referencia: https://api-ref.agora.io/en/video-sdk/android/4.x/API/class_irtcengine.html
   - Al entrar al canal, poner `autoSubscribeVideo=false`. Si no, en la sala grande todos reciben vídeo, y pagan vídeo, aunque no se pinte en pantalla.

## B. Costes mal atribuidos o mal calculados

6. **Algunas filas usan paquetes que el documento no nombra en sus supuestos.**
   - Con los supuestos declarados, la cámara del anfitrión toda la hora sale a **$180-196**, no a $171-185. Los $171 salen de la recarga de 1 millón de minutos ($891) y los $185, del paquete Pro ($133,99).
   - Los ~$1.529 salen del paquete Business Plus ($1.217,99 más el exceso).
   - Hay que decir qué paquete usa cada cifra.

7. **Datos móviles: el tope de «20 a 180 MB» se queda corto.**
   - Agora recomienda unos 400 kbps para 640×360 a 15 imágenes por segundo, y el doble en directo: https://docs.agora.io/en/api-reference/faq/integration/video_profile
   - Recibiendo 4 o 5 cámaras durante 15 minutos salen **180-450 MB**, más 45-90 MB de subida (cálculo).
   - Corrección: fijar la tasa de bits a mano y usar el flujo pequeño por defecto también en los subgrupos.
   - En YouTube no se puede limitar la calidad: `setPlaybackQuality` ya no hace nada.

## C. Riesgos olvidados

8. **La cámara sobre la pantalla de bloqueo.**
   - `MainActivity` tiene `showWhenLocked` y **también `turnScreenOn="true"`** (`AndroidManifest.xml:19-20`). Un timbre o una alarma enciende la pantalla y `handleOnResume` volvería a encender la cámara, con el móvil en el bolsillo.
   - Corrección: no restaurar la cámara si `KeyguardManager.isKeyguardLocked()`. Mejor aún, que se reactive solo con un toque.

9. **El arreglo del riesgo 1 (fase 0) está incompleto.**
   - Capturar el error no basta: un servicio de reproducción en segundo plano **graba silencio**. Android exige una Activity visible para los permisos «mientras se usa» y no da excepción por tener ya un servicio en marcha: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
   - Corrección: no pasar a nadie a hablar con la app en segundo plano. Subir el servicio a tipo micrófono al volver a la app (`handleOnResume`).
   - Y en el `catch`, llamar igualmente a `startForeground` con tipo reproducción; si no, el sistema cierra la app a los 5 segundos.

10. **YouTube puede seguir sonando con la pantalla apagada.**
    - Capacitor, al pausar, llama a `cordovaWebView.handlePause(keepRunning)` (`Bridge.java:1370-1378`), y el servicio en primer plano mantiene vivo el proceso. No verifiqué si la WebView se pausa sola.
    - Si sigue sonando, se incumple la política III.I.9 de YouTube. Hay que pausar el reproductor a la fuerza con `visibilitychange` o el evento `pause` de la app.

11. **La sincronía con relojes desfasados.**
    - `pos + (ahora − en)` compara la hora del servidor con el reloj de cada móvil. Un desfase de segundos rompe el margen de 1,5 s.
    - Corrección: que el portero devuelva la hora en milisegundos y cada móvil calcule su desfase. Además, no saltar mientras el vídeo carga y usar un margen de unos 3 s, o con conexiones lentas se queda saltando sin parar.

12. **El foco de audio entre la WebView y Agora.**
    - Al dar play en YouTube, la WebView pide el foco de audio y puede cortar o bajar la voz de Agora. No verificado; añadirlo a las pruebas de la fase 1.
    - Añadir también a esa prueba la batería y la temperatura del móvil barato con YouTube y Agora a la vez.

## D. Orden de las fases

13. **Adelantar la semana de prueba del paquete nuevo.**
    - La fase 3 es lo más largo antes de la cámara, que es lo primero que pidió Alex, y no depende de las fases 1 y 2. Debería correr **en paralelo con la fase 1**.
    - La fase 2 hay que volver a probarla sobre el paquete Lite, o hacerla directamente sobre él.

14. **Hay compilaciones de Lite más nuevas en la misma versión 4.5.2.**
    - En Maven están `agora-special-lite:4.5.2.218` (7-09-2026, 42,9 MB) y `lite-sdk:4.5.2.217` (2-09-2026), además de la `lite-sdk:4.5.2` que propone el documento.
    - Preguntar a soporte de Agora si alguna trae los arreglos de la .135. Índice: https://repo1.maven.org/maven2/io/agora/rtc/
    - El POM de `lite-sdk:4.5.2` solo trae `lite-rtc-basic` y `lite-video-codec-dec`, sin extensión de codificación, al contrario de lo que dice [4]. En la fase 3, comprobar que un MediaTek publica la cámara.

## E. Fuentes y detalles menores

15. **Play:** la declaración con vídeo se exige para **todos** los tipos de servicio en primer plano, también el de micrófono y el de reproducción que la app ya usa: https://support.google.com/googleplay/android-developer/answer/13392821
    - Pantalla compartida no es un trámite nuevo: es ampliar esa declaración (la bitácora, línea 836, la tiene pendiente).
    - [31] es la página «Device and Network Abuse», no una política de API de terceros.

16. **Cambiar el perfil de audio dentro del canal** está documentado: «can be called either before or after joining the channel». Queda como prueba, no como «no verificado».

17. **Pantalla compartida:** [8] solo dice que Agora usa 15 imágenes por segundo por defecto, no que aconseje no pasar de ahí.

18. **Fuentes que no dicen lo que se les atribuye:**
    - [15] no habla de MediaTek ni de Android 12; solo dice que algunos Android no tienen H.264.
    - [29] no dice nada de los anuncios.
    - [33] es un problema de iOS (CORS), no del error 153.

19. **Error 153:** la norma de YouTube pide que las apps con WebView se identifiquen con su nombre de paquete en formato https (`https://app.genuino.firme`), no con `https://localhost`: https://developers.google.com/youtube/terms/required-minimum-functionality
    - Citarlo, y fijar también el parámetro `origin` del reproductor.

**Lo que sí se sostiene:**
- La huella SHA-1 idéntica de las dos compilaciones .135.
- La API del Lite: mezcla de audio, flujo doble, `setVideoEncoderConfiguration`, y el reproductor solo de audio.
- Los 17 vídeos por canal.
- La resolución por defecto de 960×540.
- Las normas de YouTube III.I.7 y III.I.9, el tamaño mínimo de 200 px y la regla de no superponer nada.
- Que `getDisplayMedia` no existe en Chrome Android ni en la WebView.
- El corte de la pantalla compartida al bloquear, desde Android 15 QPR1.
- `uses-feature` para la cámara y el autofoco.
- Los números de línea que cita el documento.