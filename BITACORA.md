# Bitácora — Firme

Registro de en qué punto quedó el trabajo. Lo más reciente arriba.
Se actualiza al terminar cada tanda de cambios.

> El contexto permanente (stack, convenciones, cómo funcionan las alarmas) vive en
> `README.md`. Aquí va el relato: qué pasó cada día y qué quedó a medias.

---

# 🧭 12 de septiembre de 2026 — no sonó nada, y las herramientas para saber por qué

## 🔴 El reporte: «no sonó nada y ya di permiso de batería»

Ni siquiera la prueba A, con la app abierta delante. **Eso no es la limitación conocida
de la plataforma** —esa solo afecta a la app cerrada— sino un fallo distinto.

El problema de fondo: el fallo está en su móvil y no hay forma de verlo desde aquí. Así
que en vez de adivinar, se construyeron las herramientas para que lo diagnostique él.

## La causa más probable, y encaja

**El diálogo de tarea ponía la hora a +30 minutos por defecto.** Si creó las tres tareas
sin pelearse con el selector de hora, sus alarmas estaban a media hora vista y él esperó
quince minutos. **No habían llegado.**

Comprobado en pantalla: a las 10:49 el diálogo proponía las 11:19.

Ahora hay atajos — **2 · 5 · 15 · 30 min · 1 h** — para que poner una prueba sea un toque.

⚠️ **Sigue sin confirmarse.** Es la hipótesis que mejor explica que no sonara *nada*, pero
falta que él mire el panel.

## Lo que se construyó para diagnosticarlo

En **Ajustes**, un panel «Comprobar la alarma» con las tres condiciones que tienen que
cumplirse, cada una con ✓ o ✕:

1. **Permiso de notificaciones** — concedido, sin conceder o bloqueado
2. **App instalada** — o si está corriendo en el navegador
3. **Hay un aviso programado** — cuál, a qué hora y cuánto falta

Y un botón **«Probar la alarma ahora»** que dispara la alarma de verdad al instante.

> 💡 **Ese botón es la pieza clave del diagnóstico:** si suena ahí pero no sonó a su hora,
> el problema es la programación, no la alarma. Son dos fallos distintos y hasta ahora no
> se podían separar.

Desplegado y verificado en producción. genuinohost.com intacta.

## 🔴 El token de Firebase caduca cada día

Tercer día seguido pidiendo `firebase login --reauth`. El patrón está claro: el token
expira de madrugada.

**Causa probable:** `auto@genuinohost.com` es una cuenta de **Google Workspace**, y esos
dominios suelen tener una política que caduca la sesión de Google Cloud a diario.

**Solución de raíz, si molesta:** una cuenta de servicio con permiso solo de Hosting.
Credencial que no expira, diez minutos de trabajo, y no se vuelve a tocar. **Ofrecido a
Alex, pendiente de que diga si lo montamos.**

## ⏭️ Esperando

Que Alex mire el panel en el móvil y diga:

- Qué pone en las tres líneas (✓ o ✕ en cada una)
- Qué pasa al pulsar «Probar la alarma ahora»

| Lo que vea | Qué significa |
|---|---|
| el botón **suena** | la alarma funciona; el fallo era la hora (+30 min) |
| **llena la pantalla pero no suena** | es el audio: volumen del móvil o el deslizador de Ajustes |
| **no hace nada** | fallo real, a buscarlo con lo que diga el panel |

⚠️ **Antes de nada tiene que forzar la actualización de la app:** cerrarla del todo
(deslizarla de recientes) y volver a abrirla, o seguirá viendo la versión cacheada sin
el panel.

---

# 🧭 11 de septiembre de 2026 — desplegada, y la bala que pasó rozando

## 🟢 Firme está en producción: **https://genuino-pro.web.app**

Alex renovó el login de Firebase y se desplegó. Service worker activo, HTTPS, sin
errores de consola. **Falta que la instale en el móvil y la use.**

## 🔴 El despliegue iba a tumbar genuinohost.com

Ayer quedó escrito el comando `firebase deploy --only hosting`. Al comprobar el proyecto
apareció lo que no se había verificado:

```
Site ID      │ Default URL
genuino-host │ https://genuino-host.web.app   ← el site por DEFECTO
```

**Un solo site, y es el de la web pública.** Ese comando habría sustituido genuinohost.com
—la web a la que apuntan el Instagram y las 10 fichas— por la app de disciplina.

⚠️ **La lección: antes de desplegar en un proyecto compartido, listar los sites.** No dar
por hecho que el site por defecto está libre.

### Cómo quedó blindado

Alex eligió el ID **`genuino-pro`**. Tres cierres para lo mismo:

| Dónde | Qué |
|---|---|
| `.firebaserc` | target `firme` → site `genuino-pro` |
| `firebase.json` | `"target": "firme"` en el bloque de hosting |
| `package.json` | `firebase deploy --only hosting:firme` |

**Verificado después del despliegue:** genuinohost.com sigue devolviendo 200 con su
título de siempre, y genuino-pro.web.app sirve Firme.

💡 **El ID del site no se cambia luego:** la app instalada y los datos guardados van
atados al dominio. Cambiarlo obliga a reinstalar y se pierde el historial.

## Arreglos de la mañana, y dos avisos que exageré

**El que importaba:** la cuenta atrás decía «quedan **120:00**» en cualquier bloque de más
de una hora — y la rutina de ejemplo tiene dos de 120 minutos y uno de 90. Ahora dice
«quedan 1 h 54 min».

**Los dos que vendí de más, y hay que decirlo:**

- Anuncié que los bloques que cruzan medianoche eran un fallo serio. **No lo era:** el día
  termina a medianoche igual. El cambio (`finDe()` recorta el fin a las 24 h) es coherencia
  interna, no algo que se viera en pantalla.
- Anuncié que la racha «quemaba batería» al recalcularse cada segundo. **Medido: 36 ms por
  minuto.** Despreciable. El cambio es correcto —un historial no debe colgar de un reloj de
  segundos— pero no era urgente.

**Un caso de borde que sí era real:** un aviso previo que caería antes de medianoche (un
bloque a las 00:05 con aviso de 10 minutos) se quedaba esperando un minuto que nunca
llegaba. Ahora se descarta.

## ✅ Instalada en el móvil

Alex la instaló el mismo día. **La app ya está en su teléfono.**

## ⏭️ Por dónde se sigue: la prueba que decide lo siguiente

Antes de montar nada de servidor hay que saber si de verdad hace falta. Quedó pendiente
esto, que son quince minutos:

### Primero, el ajuste de Android que puede ahorrarlo todo

Android mata las apps en segundo plano, y eso es exactamente lo que rompe las alarmas.
Se quita por app:

> **Ajustes → Aplicaciones → Firme → Batería → Sin restricciones**

La ruta cambia según fabricante (Xiaomi lo llama «Ahorro de batería», Samsung «Sin
restricciones»). Al estar instalada, Firme aparece como una app normal en la lista.
Comprobar de paso que las **notificaciones** estén permitidas.

**Es gratis y puede evitar todo el trabajo del web push.**

### Las tres pruebas

Poner tres tareas de una vez desde **+ tarea**, con alarma:

| | Cuándo | Qué hace | Qué significa |
|---|---|---|---|
| **A** | +2 min | deja la app abierta | si falla aquí hay un fallo real que arreglar |
| **B** | +5 min | sale al inicio y **apaga la pantalla** | **la que decide.** Es su día real |
| **C** | +10 min | cierra la app del todo (deslizándola de recientes) | la que probablemente falle; es el límite conocido |

### El criterio acordado

| Resultado | Decisión |
|---|---|
| **B suena** | no se monta nada; la app sirve tal cual |
| **B falla** | se monta el web push en Cloudflare Workers (gratis, unas horas) |
| **C falla pero B suena** | es lo esperado. Decide Alex si le compensa |

## Lo que sigue pendiente de él

1. **Escribir su porqué** — sigue con el texto de relleno, y es la pieza de la que cuelga
   todo lo demás: sale en la pantalla de Hoy y en cada alarma.
2. **Poner su rutina de verdad.** La que trae es un ejemplo.
3. Revisar las citas bíblicas (Reina-Valera 1909).

---

# 🧭 10 de septiembre de 2026 — el día uno: la app existe y funciona

## Qué se pidió

Una aplicación para ser un hombre disciplinado: planificar el día, que **suene una alarma**
según la actividad, que dé **frases de ánimo** para cumplir y no desmayar, y que **recuerde el
porqué** de seguir esforzándose.

## Las dos decisiones de Alex

Antes de escribir una línea se preguntaron las dos cosas que cambiaban todo el trabajo:

| Pregunta | Respuesta |
|---|---|
| ¿Dónde tiene que sonar la alarma? | **En el móvil, siempre** |
| ¿Cómo es el día que se planifica? | **Rutina fija + tareas del día** encima |

Esas dos respuestas fijaron el resto: PWA instalable, no app de escritorio.

## Por qué PWA y no una app de Android de verdad

Una app nativa con `AlarmManager` sonaría mejor —alarma del sistema, sin internet, sin
navegador de por medio—. Se descartó porque **compilar un APK exige Android Studio y unos
8 GB de instalación** en el Windows. La PWA se instala desde el navegador, se aloja gratis y
se prueba hoy mismo.

Es un compromiso consciente, no un descuido. Ver «el límite honesto» más abajo.

## Qué se construyó

Proyecto nuevo en **`C:\Users\InvitadosPro\developer\firme`**, aparte del de WhatsApp.
Vite + React 19 + TypeScript + Tailwind v4. Sin servidor, sin cuenta, sin base de datos:
**todo vive en el dispositivo**.

Cinco pantallas:

- **Hoy** — la línea del día. El bloque que toca sale grande, con cuenta atrás, su motivo y
  una frase. *Cumplido* / *Lo salto*.
- **Mi porqué** — sus razones, escritas por él. Una es el ancla y sale en cada alarma.
- **Rutina** — los bloques fijos: hora, duración, días, área, timbre, aviso previo y el
  porqué de cada uno.
- **Progreso** — racha, récord, % medio, calendario de 35 días, cumplimiento por área y
  **el registro de sus propias excusas**.
- **Ajustes** — permisos, volumen, margen de gracia, bancos de frases, exportar/importar.

**La alarma** ocupa la pantalla entera. Timbre en bucle (campana, diana o pulso,
**sintetizados con Web Audio** — no hay archivos que descargar y suenan sin conexión),
vibración y notificación del sistema. Dentro: el porqué del bloque y la razón ancla.
*Empiezo ahora* / *5 minutos más* / *Hoy no puedo*.

**La fricción antes de saltar es intencionada:** enseña el porqué y pide escribir qué se lo
impidió. Esas excusas se guardan y se leen luego en frío, en Progreso.

## Qué se verificó de verdad

- ✅ **La alarma de las 21:30 saltó sola** en la versión compilada, sin tocar nada. Prueba
  completa de extremo a extremo.
- ✅ Service worker de producción registrado, activo y controlando la página. Sin errores.
- ✅ `npm run build` limpio. 17 entradas en el precache: la app abre sin conexión.
- ✅ Recorridas las cinco pantallas en móvil (375 px) y escritorio.

## Siete arreglos de la primera pasada por el navegador

1. La cabecera de Hoy se partía en dos líneas y capitalizaba cada palabra.
2. Las frases atadas a un área salían en bloques de otra («el rato a solas» en el
   bloque de ejercicio).
3. El % medio contaba como fallados **los días anteriores a instalar la app**.
4. El calendario pintaba igual un día sin usar y un día fallado.
5. El aviso de ánimo se leía translúcido sobre la lista.
6. **`animation-fill-mode: both` dejaba elementos invisibles** cuando el navegador no
   llegaba a pintar. Quitado: peor caso, aparece sin animación.
7. Se pedía vibrar antes del primer toque, que el navegador rechaza y deja escrito en
   la consola.

## 🔴 El límite honesto: con la app cerrada, no suena

Con la app delante, en segundo plano reciente o con la notificación del sistema, suena. **Si
Android mata la app, no hay alarma.** La web no puede despertar sola.

⚠️ **Mientras tanto, no usarla como despertador sin la alarma del móvil de respaldo.**

Para arreglarlo hace falta *web push* desde un servidor. El lado del navegador ya está
escrito (`public/sw-avisos.js` sabe recibir y mostrar el aviso); falta quien empuje.

## 💰 Lo que costaría arreglarlo (investigado hoy)

**El envío de push no cuesta nada.** Los servicios de los navegadores —FCM para Chrome,
Mozilla para Firefox, Apple para Safari— entregan gratis e ilimitado. Se firma con claves
VAPID propias.

Lo que se paga es **el disparador**, alguien que se despierte cada minuto:

| Dónde | Coste | Sirve |
|---|---|---|
| **Cloudflare Workers** (gratis) | **$0** | ✅ cron cada minuto; 1.440 de 100.000 peticiones diarias |
| Supabase (gratis) | $0 | ⚠️ se pausa a los 7 días sin actividad; solo 2 proyectos y ya hay uno |
| Firebase Functions + Scheduler | ~$0 de consumo | ⚠️ obliga al plan Blaze: tarjeta y riesgo de factura |
| Vercel Hobby | $0 | ❌ un cron **al día**, y ni a hora fija |
| Vercel Pro | $20/mes | ✅ pero absurdo para esto |

**Recomendado: Cloudflare Workers gratis.** Cuenta nueva, sin tarjeta, y el plan de pago
($5/mes) no se tocaría ni de lejos.

**La letra pequeña no es dinero:** para despertarle con la app cerrada, el servidor **tiene
que conocer su rutina**. Habría que subir horarios y suscripción a Cloudflare. Deja de ser
cien por cien local.

**El criterio acordado:** usarla unos días. **Si la alarma suena bien con la app instalada,
no montar nada.** Si falla de verdad con el móvil en el bolsillo, es gratis arreglarlo.

## ⏭️ Por dónde se sigue

1. **Desplegarlo — es lo único que bloquea todo lo demás.** Hace falta HTTPS para poder
   instalarla en el móvil. Las credenciales de Firebase de Alex **caducaron**:

   ```
   firebase login --reauth
   firebase use --add
   npm run desplegar
   ```

   Conviene crear un *site* aparte en Hosting para no mezclarlo con genuinohost.com, y
   añadirlo a `firebase.json` con `"site": "..."`.

2. **Instalarla:** abrir la URL en el móvil → menú de Chrome → *Instalar aplicación*. Dentro,
   Ajustes → *Activar* notificaciones.

3. **Personalizarla, que es lo que la hace servir:** la rutina que trae es un ejemplo
   (levantarse 5:30, oración, ejercicio…). Hay que poner la suya y, sobre todo, **escribir su
   porqué** — ahora mismo tiene el texto de relleno.

4. **Revisar las citas bíblicas.** Van en Reina-Valera 1909 (dominio público). Alex tiene
   formación y responsabilidad ministerial: que las repase antes de fiarse.

5. **Copia de seguridad.** Hoy es manual, Ajustes → *Exportar*. Si se borran los datos del
   navegador, se pierde el historial.

## Cabos sueltos del entorno

- El `.claude/launch.json` de **agente-whatsapp** tiene dos entradas añadidas —`firme` y
  `firme-produccion`— porque el panel del navegador lee ese archivo, no el de este proyecto.
  Confirmadas allí junto con su entrada de bitácora.
- Este proyecto tiene su propio `.claude/launch.json` con la entrada `firme`, por si algún
  día el panel aprende a leerlo.

---

# 19 de septiembre · los rótulos, y una palabra que él no dijo

Alex vio el vídeo del día anterior y dijo la frase que ordenó toda la jornada:

> «Es imperdonable que pongas subtítulos donde las frases queden a la mitad.
> Debe poder leerse bien fácilmente.»

Lo que encontré al revisar los 41 rótulos uno por uno fue peor que lo que él
vio. Había **tres** formas de partir una frase y sólo estaba tapada una. Las
otras dos aparecieron justamente **al arreglar la primera**: al arrastrar
palabras para no cerrar en «que», el corte se va al otro lado y sale
`DE CUMPLIR`. El detalle técnico está en la hoja de ruta; lo que importa aquí
es el patrón, que ya se repitió toda la semana pasada: **cada fallo de este
proyecto ha sido mudo**. Nada dio error. Sólo salió algo de aspecto normal.

## Lo que casi se publica

La transcripción con el modelo pequeño de Whisper oyó «teciendo». Yo lo parcheé
a mano como «creciendo» y lo di por bueno. El modelo grande, cuando por fin
terminó de bajar, oyó lo que de verdad dijo: **«gózate siendo cada día más
disciplinado»**.

Los rótulos van grabados en la imagen. Habría quedado ahí para siempre, en un
vídeo sobre su fe, una palabra que él no dijo — puesta por mí y firmada con su
cara.

> **La regla que sale de aquí:** para los rótulos, modelo grande siempre. Y lo
> que yo «arreglo» a mano de su voz se marca como conjetura **hasta que él lo
> confirme**.

Y funcionó a la primera: el único que quedaba marcado —«dejar de fallar en» o
«fallarle a»— se lo pregunté y contestó el mismo día. **Dijo «fallarle a».** Los
dos modelos de Whisper se equivocaban; el rótulo estaba bien. No hay ninguna
palabra suya sin confirmar en el vídeo.

## Y una cosa que no era del vídeo

Pidió que **suene una alarma en el PC y le llegue un aviso al móvil** cada vez
que termino y me quedo esperando. Montado con un gancho `Stop` en
`~/.claude/settings.json` que lanza `~/.claude/alarma.ps1`, para que no dependa
de que yo me acuerde.

Es coherente con el resto: trabaja con esto de fondo mientras hace otras cosas,
y sale de casa a seguir desde el móvil.


---

# 19 de septiembre, noche · Filipenses 4:13, y cinco versiones

Alex pidió el segundo vídeo con una frase: «perfecciona toda tu metodología,
quiero lo mejor de lo mejor». Y una advertencia a tiempo: «ese vídeo NO es para
aplicación, mucho cuidado» — yo ya había propuesto cerrar con la tarjeta del
versículo de la app. Lo descarté en el acto.

El método cambió de verdad, no de nombre: un proyecto por vídeo, la cara
medida con un detector de rostros y **por plano** (entra caminando: x = 0,52 al
principio, 0,73 al final), los cortes sobre los golpes detectados y no sobre
una rejilla, el plan hecho por un jurado de tres editores, y un comprobador
que se niega a dar el vídeo por bueno si un rótulo no cabe, un corte se aleja
del golpe, un plano repite cuadros o la música le tapa.

## Lo que dijo de la v3

Cuatro cosas, sin rodeos: la tipografía no, las líneas muy separadas, el
B-roll no («y mucho menos que lo replicaras dos veces»), los zooms «MUY
BRUSCOS», y la marca duplicada en el cierre. Las cuatro son criterio para
siempre, y las cuatro se arreglaron midiendo: le rendericé el mismo fotograma
con cuatro tipografías y eligió Arial Black; los pasos de zoom se acortaron y
sólo se cambia al encuadre vecino; el B-roll se fue entero.

## Lo que aprendí sobre mí

Dos parches míos fallaron mudos y salieron versiones sin lo que yo creía haber
puesto (la v4 sin la tipografía). Las dos veces lo vio el fotograma, no el
código. Sigue siendo la lección de la semana.

Y la cuota de agentes del plan se acabó a media tarde: la revisión adversaria
no llegó a correr. El jurado vale lo que cuesta, pero cuesta.


---

# 20 de septiembre, madrugada · los otros tres

Alex dijo «haz todo» y salieron los tres que quedaban de la carpeta, con la
plantilla de Filipenses: preparar, transcribir con el modelo grande, medir la
cara, plan, montar, comprobar, mirar fotogramas, mandar. La «Oración» a la
primera; el «Trabajo» a la tercera (una bajada de música en un solo tramo, y
un plano donde la cara ya venía cortada en la grabación); «¿Hasta cuándo?» a
la segunda (la música no se oía).

El jurado murió otra vez por la cuota del plan a mitad de camino. Sirvió lo
que entregó —el plan del «Trabajo» es de su editor de ritmo y es mejor que el
mío— y para lo demás quedó `planificar.mjs`, que es su criterio en código.
Nada de esto depende ya de que haya agentes.

Dos palabras cambiadas por contexto y no de oído: «a dos señores» y
«polilla». Las dos avisadas; las dos cuestan un render si me equivoqué.


---

# 20 de septiembre, noche · dos estilos medidos y una voz rescatada de una avenida

Alex mandó dos vídeos: «ese estilo también me gusta mucho» (Jordi Segués) y
«me gusta la edición, y todos los detalles» (Daniela Pol). En vez de opinar se
midieron, y para eso hizo falta una herramienta que no existía: los cortes de
un hablando-a-cámara re-encuadrado no los ve un detector de escenas —mismo
fondo, misma persona— y `scdet` encontró 1 corte donde hay uno cada segundo y
medio. `medir-estilo.py` los busca por la cara, fotograma a fotograma.

Lo que salió, y que contradice lo que hacíamos: ninguno de los dos pinta una
palabra de color, ninguno deja el plano derivando, ninguno cierra en pantalla
negra con la marca. Y la que pesa: **la cara de Alex ocupa el 12 % del alto y
ellos van al 32 y al 51 %.** Eso no se arregla montando. Se arregla grabando a
metro y medio.

El motor aprendió los dos estilos: apertura a pantalla partida con titular,
bloques de B-roll de 7–9 s, destello de dos cuadros, cierre sobre la cara,
sin música. Probado con 18 s del metraje de Filipenses. Tres fallos, y de
dónde salió cada uno: dos de MIRAR las hojas de fotogramas (el recorte de la
mitad de arriba dejaba a Alex pequeño; `drawbox` quiere `ih` donde `drawtext`
quiere `h`) y uno de MEDIR (el comprobador exigía cara dentro de un bloque de
B-roll y daba por malo un montaje bueno).

El B-roll pasó de estar programado a funcionar. Alex sacó las claves de Pexels
y Pixabay; la primera prueba dio 403 y no era la clave: al añadir la
autorización se borraba el User-Agent y Cloudflare responde «error code 1010»,
que se lee igual que una clave inválida. Se perdió un rato comparando letras
en una captura. Se añadió Wikimedia Commons, que no necesita clave y es la
única fuente de acontecimientos: los bancos no tienen catástrofes.

Y llegó «Debes ser fructífero», grabado en marzo en mitad de una avenida. La
voz va **5,5 dB por encima del tráfico**. Cuatro herramientas medidas sobre el
mismo clip: `afftdn` no hace nada (5,6), RNNoise llega a 18,9 y
**DeepFilterNet a 30,5**. Con el pulido detrás, 28,3 dB de margen y la banda
donde se entiende acaba por encima del original. Queda comprobar con Whisper
que la limpieza no se comió consonantes; eso corre ahora.

**Y la comprobación con Whisper dijo que no.** El audio limpio con
DeepFilterNet a tope transcribe PEOR que el original: confianza 0,959 → 0,940,
palabras dudosas 4 → 8, y se perdió una frase entera («que cada día siga
juntando con tu vida») y el final se convirtió en otra cosa («que nos traiga
los desafíos» donde dice «que nunca nos desampara»). El margen de voz sobre
ruido subió 23 dB y la inteligibilidad bajó: **los dos números iban en
direcciones contrarias y el que manda es el segundo.**

Queda para mañana, en este orden: probar `--atenua=20` (ya generado) y el
post-filtro, transcribir cada uno y quedarse con el que Whisper entienda
mejor, no con el que mida más limpio. Si ninguno gana al original, la
limpieza se queda en suave y se acepta algo de avenida de fondo: es un vídeo
grabado en la calle y sonar a calle no es un defecto.
