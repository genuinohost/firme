Hoja de ruta
============

> **Este documento se lee al empezar cada sesión y se actualiza al terminarla.**
> Recoge **todo** lo que Alex ha pedido, lo que ya está hecho y lo que falta,
> para que nada se pierda por el camino.
>
> La app es de la comunidad cristiana **Genuino Love**, la identidad de Alex
> desde 2014. Eso debe verse en la app y en la ficha de Play Store.

Última revisión: **19 de septiembre de 2026** (versión 6.7).

---

## Lo que ya funciona

| | Qué | Dónde |
|---|---|---|
| ✅ | Rutina fija por días + tareas sueltas del día | `PantallaHoy` |
| ✅ | **Despertador nativo** con `setAlarmClock`, atraviesa No molestar | `AlarmaExacta.java` |
| ✅ | **La alarma repica ella misma** por el flujo de alarma, hasta que la paran | `ServicioAlarma.java` |
| ✅ | **Detecta la alarma que no sonó** y lo dice al abrir | `AvisoAlarmaPerdida` |
| ✅ | **Parte del despertador**: diagnóstico copiable, con lo que sonó de verdad | `logica/parte.ts` |
| ✅ | Alarma a pantalla completa, con el porqué y una frase | `PantallaAlarma` |
| ✅ | Frases de ánimo por área y momento | `datos/frases.ts` |
| ✅ | «Mi porqué»: los motivos, con uno de ancla | `PantallaPorque` |
| ✅ | Rachas, calendario de 35 días, registro de excusas | `PantallaProgreso` |
| ✅ | Editar y borrar tareas, **un día, varios o cada día** | `DialogoTarea` |
| ✅ | **Diario personal**, y notas al cerrar el día de un plan | `PantallaDiario` |
| ✅ | Cuenta atrás hasta la próxima alarma | `PantallaHoy` |
| ✅ | Compartir frases a WhatsApp | `logica/compartir.ts` |
| ✅ | ♥ Guardar frases y mensajes, con buscador | `logica/favoritas.ts` |
| ✅ | Mensaje diario para los grupos: banco + generador | `PantallaMensaje` |
| ✅ | Comunidad: grupos y reuniones en vivo | `PantallaComunidad` |
| ✅ | **15 planes** con racha propia, propósito y versículo | `PantallaPlanes` |
| ✅ | **Repaso de la noche**, punto por punto | `ExamenDelPlan` |
| ✅ | **Santidad con restauración**: una caída llevada a Dios no rompe la racha | `ExamenDeSantidad` |
| ✅ | Banco de **365 mensajes**, uno por día del año | `datos/mensajes/` |
| ✅ | Firma **@GenuinoLove** y enlace de descarga al compartir | `logica/compartir.ts` |
| ✅ | **Aviso de versión nueva** dentro de la app | `AvisoActualizacion` |
| ✅ | Código en GitHub y APK en Releases | `scripts/publicar-release.mjs` |
| ✅ | **Cuenta con Google**, perfil, foto, 249 países y amigos | `PantallaCuenta` |
| ✅ | **Ficha del hermano**: su perfil, sus cifras si las abre, su WhatsApp | `PantallaCuenta` |
| ✅ | **Muro**: las notas que cada uno decide publicar, con denuncia y bloqueo | `Muro.tsx`, `logica/muro.ts` |
| ✅ | **Frases favoritas en el perfil**, las que cada uno decide enseñar | `PantallaMensaje`, `logica/muro.ts` |
| ✅ | **Avisar de un fallo** desde la app, con capturas | `PantallaFallo`, `scripts/fallos.mjs` |
| ✅ | **Moderación**: retirar del muro lo que escribió otro | `Muro.tsx`, `scripts/moderador.mjs` |
| ✅ | **Las reglas del servidor, probadas de verdad** — 48 comprobaciones | `scripts/revisar-reglas.mjs` |
| ✅ | Desplegar **sin iniciar sesión nunca**, con la cuenta de servicio | `scripts/credenciales.mjs` |

---

## El propósito, que manda sobre todo lo demás

> **Fortalecer a los cristianos en su disciplina y su fidelidad diaria para con
> Dios.** Cada cosa que se añada tiene que servir a eso; lo que no, sobra por
> bonito que sea.

La app es de la comunidad **Genuino Love**.

---

## Las alarmas de madrugada · resuelto el 15-09 en la 3.7

Alex: «hoy en las alarmas de la madrugada no sonó». Es el fallo más grave que
puede tener esta app, porque de ella dependen sus compromisos con Dios.

**La causa: la app nunca reprodujo sonido alguno.** Se limitaba a publicar una
notificación y confiaba en que Android tocase el tono del canal. Eso falla de
madrugada por tres motivos distintos, y bastaba uno:

1. Una notificación suena **una vez y tres segundos**. No repica, y a nadie
   dormido lo levanta un pitido de tres segundos.
2. A las tres de la mañana el móvil está en **No molestar / modo Descanso**, y
   ahí la notificación se silencia. El código llamaba a `setBypassDnd(true)`,
   pero eso **no hace nada** sin el acceso a la directiva de notificaciones, que
   nunca se pidió. Por eso la prueba de media mañana sí sonaba: sin No molestar.
3. `FULL_WAKE_LOCK` está obsoleto desde Android 4.2 y no enciende la pantalla.

Y un cuarto, que es el que hacía todo lo demás invisible: **el diagnóstico
mentía.** Leía nuestras propias notas —«programé 136 alarmas»— en vez de
preguntarle al sistema. Podía salir todo verde con la cola vacía.

**Lo que se hizo:**

- `ServicioAlarma`: un servicio en primer plano que **reproduce el tono él
  mismo** por `STREAM_ALARM`, en bucle, hasta que alguien lo para. Ese flujo no
  pasa por el filtro de notificaciones: No molestar deja pasar las alarmas por
  definición. Tres redes por debajo (tono de alarma → de llamada → generado).
- Sube el volumen de alarma si está por debajo del 70 %. A cero no suena nada
  por bien que esté todo lo demás.
- El diagnóstico pregunta al sistema, uno por uno, con `FLAG_NO_CREATE`.
- **Detecta las que no sonaron** y lo dice al abrir la app, con el ajuste que
  casi siempre es la causa: el ahorro de batería.
- Se pide de verdad la exención de batería y el acceso a No molestar. Los
  permisos estaban declarados desde el principio pero no se pedían nunca.

**El 15-09 fallaron otra vez, y sus capturas cerraron el caso:** el móvil seguía
con la **3.3**, la versión anterior a todo esto. El arreglo nunca llegó a
instalarse, y en la barra de estado se veía la luna del No molestar — exactamente
la condición que deja muda a la 3.3.

Con la 3.7 instalada, **las dos pruebas sonaron**: «hacerla sonar ahora» y la de
pantalla apagada, ambas con No molestar puesto.

**Su móvil es un Xiaomi (MIUI).** El «Inicio automático» ya no existe en su
versión de HyperOS: quedó fusionado con «Ahorro de batería → Sin restricciones»,
que él ya tenía puesto. La app reconoce la marca y da las instrucciones de cada
fabricante (`consejoDelFabricante`).

> ⚠️ **Falta la prueba final:** que suene a las 3:00 de verdad, dormido.

---

## La app se llama **Genuino** · **14-09, decidido por Alex**

Antes se llamaba **Firme**, de 1 Corintios 15:58. El cambio lo propuso él y es
mejor: **«Genuino» es su marca desde 2014** y hay 7.000 personas que ya la
reconocen. Eso es distribución real, y las primeras instalaciones van a venir de
su gente, no de buscar en Play Store. Además consolida la casa: **Genuino Host**
el negocio, **Genuino Love** la comunidad, **Genuino** la app.

| | |
|---|---|
| Título de Play Store | `Genuino: Disciplina Cristiana` (29 de 30) |
| Descripción corta | `Despertador cristiano, agenda diaria y rachas para crecer en disciplina` (71 de 80) |
| Icono | La **G** de oro, dibujada como trazo en `scripts/iconos.mjs` |

> ⚠️ **El identificador interno `app.genuino.firme` NO se cambia.** No lo ve
> nadie, y cambiarlo haría que Android tratase la app como otra distinta: no se
> actualizaría sobre la instalada y **el usuario perdería su rutina, su porqué y
> sus rachas**. Lo irreversible al publicar es el identificador, no el nombre.

El razonamiento completo, incluido por qué el título dice «Disciplina» y no
«Despertador», está en `docs/play-store.md`.

---

## ✅ La alarma sonó (17-09) · y las dos cosas que faltaban (5.2)

**Primera prueba superada.** Alex, tras activar el «inicio automático» y probar
con la pantalla apagada: «SÍ sonó 😍». Y dos observaciones suyas que valían oro.

### «Paré la alarma SIN abrir la app. Verifica que siempre sea así»

Existía, pero **sólo por un camino**. La notificación del servicio llevaba
«Parar»; la **del respaldo salía pelada** — y el respaldo es justo el que
aparece cuando algo ya ha ido mal, el peor momento para dejar a alguien sin
salida, medio dormido y con la alarma encima. Eso explica su «otras veces
sonaba y no me daba opción de parar ahí».

- [x] **«Parar» y «Posponer» en las dos notificaciones**, siempre.
- [x] **Posponer, que no existía en ninguna.** Se reprograma con la misma
      maquinaria que las de verdad (`setAlarmClock`), **no con un temporizador
      nuestro**: un temporizador dentro del proceso muere en cuanto el sistema
      mate la app, que es exactamente lo que pasa de madrugada. Una posposición
      que no sobrevive al reposo es una posposición que no existe.
- [x] La alarma pospuesta vuelve **con su nombre y su porqué**, y con sus dos
      botones: se puede posponer las veces que haga falta.
- [x] Los minutos salen del **ajuste del usuario**, no de una cifra escrita a
      fuego. Se guardan en disco al programar, porque una notificación no puede
      preguntarle nada a la app cuando suena a las tres. Por defecto, **10**.
- [x] Identificadores de pospuesta en su propio rango: reutilizar el de la
      original se llevaría por delante otra alarma de la rutina.

### «No encendió la pantalla sola»

- [x] **Android 14 sacó a un permiso aparte** lo de abrirse a pantalla completa,
      y **se lo niega a las apps instaladas después** — sin avisar:
      `setFullScreenIntent` no falla, simplemente no hace nada. Otro fallo
      silencioso, el quinto de la serie.
- [x] Ahora se pregunta con `canUseFullScreenIntent()`, sale como línea propia
      en el diagnóstico y en el parte, y hay **botón para concederlo**.

---

## ⚠️ La cruz roja que no era un fallo (5.1)

Alex mandó una captura de Ajustes con **«24 alarmas puestas en el sistema ✗ —
Android se guardó 24 de las 141 que le dimos»** en rojo.

**Eso es el funcionamiento normal, no un fallo.** A Android no se le entregan
las 141 a propósito: `setAlarmClock` es la alarma más cara que existe para el
sistema, así que se le dan **las próximas 24** y las demás se arman solas según
van sonando.

El mismo error de criterio estaba en el parte y **allí se corrigió en la 4.9;
en esta tarjeta se quedó**. Peor todavía: al arreglar en la 4.9 el contador que
mentía —contaba `PendingIntent` ya cancelados y decía 141—, la cifra pasó a ser
honesta y **destapó la comparación mala**, que hasta entonces quedaba tapada por
la mentira.

- [x] La tarjeta compara ahora contra **lo que debería haber puesto**
      (`min(enCola, ventana)`), no contra la lista entera.
- [x] Y lo explica en vez de dejarlo en un número suelto: «las 24 siguientes,
      quedan 141 en la lista y se van armando solas».

**Un diagnóstico que grita cuando no pasa nada se deja de leer** — y entonces no
sirve el día que sí pasa. Es la segunda vez en dos días que este mismo principio
aparece; queda escrito para que no haya una tercera.

---

## 🛟 La red de seguridad: copiar las alarmas al reloj del móvil (5.0)

Alex activó el «inicio automático» el 17-09 por la tarde. Esa es la causa más
probable de los dos días mudos y probablemente baste. Pero hay algo que ninguna
app puede prometer: **vive dentro de una app de terceros, y MIUI, EMUI y ColorOS
se reservan el derecho de congelarlas de madrugada.** Contra eso no hay permiso
que valga.

**El reloj del propio teléfono no lo congela nadie**, porque es del sistema.

- [x] **Copiar al reloj las alarmas de antes de las 7**, con un botón en
      Ajustes (`AlarmClock.ACTION_SET_ALARM` con `EXTRA_SKIP_UI`).
- [x] **Sólo las de madrugada**, y no es una cifra caprichosa: son las que
      fallan, las que no se pueden recuperar después, y las únicas por las que
      merece la pena aguantar que suenen dos cosas a la vez. Copiar la rutina
      entera llenaría el reloj de diez alarmas y acabaría con Alex
      desactivándolas todas.
- [x] **Se dice que van a sonar las dos**, y que eso es a propósito. Él dijo que
      estas alarmas son «parte de la columna vertebral para cumplir a Dios»:
      ante esa frase, un pitido de más es un precio ridículo comparado con un
      silencio. Y se le dice cómo quitarlas cuando la nuestra se haya ganado la
      confianza.

---

## 🔴 CORS: por qué la app nunca supo que había versión nueva

Alex, el 17-09: «no actualiza desde la app y es importante». Y antes, el 16-09:
«la aplicación no me deja actualizar a la 4.0». **Nunca funcionó.**

Dentro de la app la web se sirve desde `https://localhost`, así que pedir
`genuino-pro.web.app/version.json` es una petición **entre orígenes distintos**.
Firebase Hosting no mandaba `Access-Control-Allow-Origin`, el navegador la
bloqueaba, `fetch` lanzaba, y el `catch` concluía **«no hay nada nuevo»**.

Sin un error en ninguna parte. Sólo un silencio que se leía como «estás al día».

**Y le pasaba lo mismo a `comunidad.json`** — por eso «Juntos» se veía vacío. No
era que faltaran los enlaces: **el archivo que los trae no llegaba nunca.**

- [x] **Cabecera CORS en `firebase.json`** para los dos archivos, y desplegada.
      Esto arregla **los móviles ya instalados sin que actualicen nada**, que es
      lo que importaba hoy.
- [x] **Y no depender de eso**: las dos peticiones pasan ahora por
      `CapacitorHttp`, que pide desde el lado nativo, **donde CORS no existe**.
      Confiar en una cabecera que cualquiera puede quitar sin darse cuenta es
      dejar la puerta abierta al mismo fallo.
- [x] Con tiempo de espera, además: sin él una respuesta lenta deja la promesa
      colgada para siempre y el aviso no sale igualmente.

**El patrón que se repite en todos los fallos de estos dos días** — y conviene
tenerlo delante: `window.open` devolvía `null`, el `fetch` bloqueado lanzaba y
se tragaba, el contador de alarmas contaba intents cancelados, el cajón de
reposo contestaba «desconocido». **Ninguno daba error.** Todo fallo que se
captura y se convierte en un valor de aspecto normal es un fallo que no se puede
depurar. Cuando algo «no hace nada», sospechar primero de un `catch` silencioso.

---

## 🌱 Lo que viene: que la app tenga cosas muy buenas

Alex, la noche del 17-09: **«a la aplicación ahora es que le falta tener cosas
muy buenas. Todo eso lo vamos a seguir mejorando, y tendremos mejores
capturas».**

Tiene razón, y conviene entender por qué. **Casi todo lo del 16 y el 17 fue
quitar lo que estorbaba**: alarmas que no sonaban, actualizaciones que nunca
llegaron, enlaces que no abrían, contadores que mentían. Nada de eso se ve en
una captura de pantalla — pero sin ello no había sobre qué construir.

**Ahora el cimiento aguanta.** Lo que se ponga encima a partir de aquí sí se
nota, y las capturas mejoran solas cuando lo que enseñan es mejor.

### Ideas sobre la mesa, sin comprometer ninguna todavía

Están **sin priorizar a propósito**: las ordena Alex, no yo. Y antes de
construir cualquiera, preguntarle — su lista manda sobre esta.

- **Que la alarma tome la pantalla entera** con el versículo y el porqué. Ya
  está hecho; falta el permiso de Android 14. Es la captura que vende la app.
- **Las frases de ánimo.** 10 de 29 son de filósofos paganos. Se le planteó el
  17-09 y **decidió no tocarlo por ahora** — no volver a sacarlo sin que él lo
  pida.
- **Invitar amigos por enlace**, no sólo por nombre de usuario.
- **Qué se ve de un amigo.** Hoy: nombre, usuario y foto. Nada más, a propósito.
- **«Juntos»**: faltan las URL reales de los grupos y las redes.
- **La huella** para abrir la app, además del código.
- **Más planes**, que el catálogo siempre puede crecer.
- **Frases desde internet**, que quedó pendiente de un servidor propio.

### Las capturas, cuando haya más que enseñar

Seis listas en `docs/tienda/capturas/listas/`. Se rehacen con `npm run capturas`
en cuanto haya pantallas mejores — el script ya las deja a medida de Play.

---

## 🏪 Google Play: dónde está el trámite (17-09)

- [x] Cuenta de desarrollador creada, **Genuino Love**, personal, ID
      8797743598995316700. Los 25 $ pagados el 15-09.
- [x] **Identidad enviada y aceptada por el formulario**, a nombre de JOHNNY
      ALEXANDER MARTINEZ. «Enviada — nosotros nos encargamos del resto».
- [x] ⚠️ **La licencia de conducir venezolana la rechazó**; el **pasaporte** sí
      entró. Si hay que repetirlo con otra cuenta, ir directo al pasaporte: es
      un documento de viaje internacional y su sistema sabe leerlo.
- [ ] Esperando la revisión de Google. **Varios días.**
- [ ] **Verificar el teléfono de contacto** — bloqueado hasta que aprueben la
      identidad. Es el orden que ellos imponen, no un fallo.
- [ ] **Rehacer el formulario de datos de Play**, ahora que hay cuentas: Google
      pregunta qué se recoge y dónde, y declararlo mal es motivo de retirada.
- [ ] Capturas de pantalla para la ficha.

---

## 🔴 El parte del 17-09: qué dijo y qué se arregló con él

**El primer parte de verdad**, y descartó de golpe casi todo lo que llevábamos
dos días mirando. Xiaomi 23078PND5G, Android 16.

**Lo que está bien** (y por tanto deja de ser sospechoso): alarmas exactas
concedidas, fuera del ahorro de batería, avisos permitidos, acceso a No molestar
concedido y el filtro en «todo pasa», **volumen de alarma 15/15**, sin
restricción en segundo plano, sin ahorro de energía.

**Lo que dijo de verdad:** el diario salta de **16/09 22:00** a nada. El 16
dispararon **doce alarmas con 0 segundos de desfase** — funciona. Y el 17 **no
se disparó ni una**. No es que sonaran mudas: **el sistema no despertó a la
app**. Eso apunta a que MIUI la congeló de madrugada, que es exactamente lo que
evita el «inicio automático».

**Tres fallos del propio diagnóstico, que salieron al leerlo:**

- [x] **El cajón de reposo decía «desconocido» y tiraba la prueba.** El código
      decodificaba 10/20/30/40/45 y mandaba todo lo demás a «desconocido» —
      incluido el **50, «NUNCA»**, que es el peor de la lista: con ese el
      sistema le retira a la app el derecho a despertarse. Ahora se decodifica,
      y si sale cualquier otro se **enseña el número**.
- [x] **«Armadas con Android: 141 de 141» era mentira.** `cancelarTodas` crea
      los PendingIntent con `FLAG_UPDATE_CURRENT` para poder cancelarlos, y
      `AlarmManager.cancel()` quita la alarma pero **deja vivo el
      PendingIntent**; la comprobación con `FLAG_NO_CREATE` los seguía
      encontrando. Solo hay {@code VENTANA}=24 puestas de verdad. Ahora se
      cancelan también los PendingIntent, y el parte dice «24 de 141, se arman
      de 24 en 24» — que es la verdad y además se entiende.
- [x] **El aviso «⚠ no coinciden» gritaba sin motivo.**
      `getNextAlarmClock()` devuelve la siguiente alarma **de cualquier app**;
      que el despertador del móvil de Alex a las 9:30 no sea la nuestra de las
      16:30 es lo normal. Ahora sólo avisa cuando significa algo: que el sistema
      no tenga ninguna, o que la suya caiga después de la nuestra.
- [x] **Y lo más importante: el parte ahora dice lo que FALTA.** Antes sólo
      guardaba lo que sonó, así que una noche entera perdida era un hueco entre
      dos líneas y había que darse cuenta de una **ausencia**. Ahora cada alarma
      que no se disparó queda apuntada como **NO LLEGÓ**, con su hora y su
      nombre. Tres veredictos, que son tres problemas distintos: *NO LLEGÓ* (el
      sistema no despertó a la app), *MUDA* (llegó y el ruido falló) y *SONÓ*.

---

## 🔴 La 4.7 que por dentro era la 4.6

Alex, tras instalar dos veces: «sigue en 4.6». No era despiste suyo.

**`npx cap sync` copia lo que haya en `dist` en ese momento**, y `dist` se había
compilado *antes* de subir el número en `build.gradle`. Vite hornea la versión
al compilar leyendo ese archivo, así que el APK salió con:

| | Decía |
|---|---|
| Manifiesto de Android | `versionCode 29` · `versionName 4.7` |
| **JavaScript de dentro** | **4.6** |

Y no era solo un número mal puesto en una pantalla: `versionInstalada()` devolvía
**28** mientras `version.json` anunciaba **29**, así que la app iba a **insistir
para siempre** con que había una actualización que al instalarse no callaba el
aviso.

- [x] **`npm run apk`** (`scripts/compilar-apk.mjs`): compila la web **primero**,
      comprueba que el JavaScript lleva de verdad la versión de `build.gradle`,
      y sólo entonces sincroniza y compila. El orden deja de depender de que
      alguien se acuerde.
- [x] **`npm run publicar` se niega** a subir un APK cuya web no cuadre. Publicar
      es el último punto donde el fallo todavía es barato: después ya está en
      los teléfonos.
- [x] De paso, dos fallos en los scripts de compilación que llevaban ahí desde
      siempre: el ayudante `correr()` **ignoraba las opciones**, así que el
      `cwd: "android"` de gradlew se perdía; y con `shell: true` en Windows un
      `gradlew.bat` suelto se busca en el PATH y no en el `cwd`. Los dos
      fallaban con un «Command failed» que no decía nada.
- [x] Publicada la **4.8**, con manifiesto y JavaScript comprobados uno a uno
      antes de subirla.

---

## 🔴 El fallo de la 4.7: `window.open` no hacía nada

Alex, el 17-09: «no se descarga el instalador desde la app». Verificado contra
el código fuente de Capacitor, y la causa se llevaba por delante **tres cosas a
la vez sin dejar rastro**.

**`window.open(url, "_blank")` dentro de la app no hace absolutamente nada.**
Android solo lo atiende si el WebView lleva `setSupportMultipleWindows(true)` y
un `onCreateWindow` que lo recoja; Capacitor no pone ninguno de los dos, así
que la llamada **devuelve `null` en silencio**. No falla, no avisa, no registra
nada — la peor forma de romperse, porque nadie puede depurar lo que no se queja.

Estaba en tres sitios, con la misma línea copiada:

| Dónde | Qué llevaba roto |
|---|---|
| Aviso de versión nueva | no descargaba el instalador |
| Ajustes → versión | el botón no hacía nada |
| **«Juntos»** | **ningún enlace de grupo ni de red abría** |

Eso explica algo que se había leído mal: «Juntos» no estaba desaprovechado sólo
por faltarle las URL — **aunque se hubieran puesto las buenas, no habría abierto
ninguna.**

- [x] Plugin nativo `Navegador.java`: un `ACTION_VIEW` y que decida Android
      quién lo atiende. El navegador descarga; un enlace de WhatsApp lo recoge
      WhatsApp.
- [x] **Devuelve si se pudo abrir, y se mira.** Dar por hecho que sí es el error
      que tuvo esto escondido tanto tiempo. Si no se pudo, se enseña la
      dirección y un botón para copiarla.
- [x] Después de tocar «Descargar», la app **dice dónde ha ido el archivo**: a
      la bandeja de notificaciones y a Descargas, con su nombre. Alex ya se
      quedó una vez con un «no veo el instalador» — el instalador estaba, pero
      nadie le había dicho dónde mirar.
- [x] Y avisa de que Android pedirá permiso para instalar desde el navegador la
      primera vez, que es donde se atasca casi todo el mundo.

⚠️ **Esta corrección no puede llegar por la vía que arregla.** La versión que
Alex tiene instalada tiene el botón roto, así que **la 4.7 hay que instalarla a
mano una vez**. A partir de ahí, la actualización desde la app ya funciona.

---

## 🆕 Lo pedido el 16-09 por la tarde

### I. Dictar por voz · ✅ **hecho en la 4.5**
> Alex: «necesito poder crear tareas y comentarios en mi diario con voz. Hay
> veces donde no puedo escribir».

No es comodidad. Esta app se usa **a las tres de la madrugada**, medio dormido
y con una mano. Una nota que hay que teclear en esas condiciones es una nota
que no se escribe — y el diario vale justo por lo que se anota **cuando
aprieta**, no por lo que se redacta tranquilo al día siguiente.

- [x] **Plugin nativo propio** (`Dictado.java`, con `SpeechRecognizer`). Se
      descartó el de la comunidad: una dependencia más que puede chocar con
      Capacitor 8 y el SDK 36, para algo que son cien líneas — y así el idioma
      y el comportamiento son los que queremos.
- [x] **Micrófono en los cuatro sitios**: nota del diario, nota de un plan,
      nota del repaso de la noche (las dos variantes) y **nombre de una tarea**.
- [x] **El botón no aparece si el móvil no sabe transcribir.** Se pregunta al
      sistema. Un micrófono que se toca y no hace nada deja la app pareciendo
      rota, que es peor que no ofrecerlo.
- [x] **Enseña lo que va oyendo** mientras se habla, y **late al ritmo de la
      voz**: dictar a ciegas y descubrir al final que no cogió nada es lo que
      hace que nadie vuelva a usarlo.
- [x] El permiso se pide **al tocar el botón**, no al arrancar: pedirlo antes de
      que se entienda para qué es la forma más rápida de que te lo nieguen.
- [x] **Dos silencios de 2,5 s** antes de cortar. De serie corta al primer
      silencio, y quien dicta una nota se para a pensar a mitad de frase.
- [x] `<queries>` en el manifiesto: sin eso, en Android 11+ el sistema dice
      que no hay motor de voz **aunque lo haya**.
- [x] Lo dictado **se añade** a lo escrito, nunca lo sustituye, con pruebas
      (`npm run revisar-dictado`): si eso falla sale «Hoy me costólevantarme»,
      y quien lo ve no vuelve a tocar el micrófono.
- [x] Respaldo en el navegador, para probar la pantalla sin compilar un APK.
- [ ] **Falta probarlo en el móvil de Alex.** En el navegador del escritorio el
      micrófono está bloqueado; lo que se comprobó ahí es que el fallo se
      cuenta bien y el botón vuelve a su sitio.

### J. Cuenta, perfil y amigos · ✅ **abierto el 17-09 en la 5.3**

**Los dos tropiezos al abrirlo, y lo que enseñaron**

1. **«Algo salió mal. Inténtalo otra vez.»** Ese mensaje era mío, y es el pecado
   que llevamos todo el día persiguiendo. Con él se perdieron **dos diagnósticos
   equivocados** —`rgcfaIncludeGoogle`, descartado comparando los dos APK clase
   por clase, y el VPN, descartado por Alex apagándolo— y un rato largo. Al
   enseñar el error de verdad, la causa salió **en un solo intento**: faltaba
   declarar `providers: ["google.com"]` en `capacitor.config.json`, porque el
   plugin no habilita ninguno por su cuenta.
2. **El acceso rebotaba** a la pantalla de elegir cuenta. `skipNativeAuth`
   estaba en `false`, así que entraban **las dos capas**: el plugin por lo
   nativo y nosotros por JavaScript. El plugin sólo debe traer la credencial;
   quien tiene que quedar dentro de Firebase es la capa JS, que es la que
   Firestore reconoce.

**Regla que sale de aquí:** un mensaje de error bonito que oculta la causa no es
amabilidad, es una factura aplazada. Se enseña el código feo.
> Alex: «la opción de iniciar sesión, tener un perfil muy elegante, con detalles
> de ciudad, país, etc., y la capacidad para agregar amigos. Todo estilo la app
> Biblia YouVersion». Y ese mismo día: «debemos seguir mejorando. Quiero la
> capacidad de agregar amigos».

**Funcionando.** Alex activó el acceso con Google en la consola y
`google-services.json` vino ya con sus dos clientes de OAuth.

- [x] Entrar con **Google**, con el selector nativo de Android — un toque, sin
      contraseñas que recordar. En el navegador, ventana emergente.
- [x] **Perfil**: nombre, nombre de usuario único, foto, **ciudad y país** (con
      bandera, Venezuela la primera), versículo de cabecera y desde cuándo.
- [x] **Amigos**: buscar por nombre de usuario, pedir, aceptar, quitar.
- [x] **Borrar la cuenta** desde dentro, y que se borre. Play lo exige y además
      es lo decente.
- [x] **Reglas de Firestore** desplegadas: es lo único que separa los datos de
      las personas de cualquiera con una conexión.
- [x] **Firebase se carga en diferido**: quien no use la cuenta no paga ni un
      segundo de arranque por ella.

**Las dos decisiones de fondo, que no se tocan**

1. **El diario, las notas y los repasos no suben nunca.** Escrito en tres
   sitios —`nube.ts`, `firestore.rules` y la propia pantalla— porque la
   tentación de sincronizarlo «para que no se pierda» va a volver y va a sonar
   razonable.
2. **No hay tabla de rachas de los amigos**, ni «quién va ganando», ni
   insignias. La constancia anima; la comparación hunde. Las cifras del perfil
   salen del propio teléfono y **no las ve ningún amigo**.

**Lo que falta**

- [ ] ⚠️ **Añadir `genuino-pro.web.app` a los dominios autorizados** de
      Authentication. Ahora mismo están `localhost`,
      `genuino-host.firebaseapp.com` y `genuino-host.web.app` — falta el de la
      app. **No bloquea el móvil** (el acceso nativo no usa esa lista), pero sin
      él la versión web no puede entrar.
- [ ] **Rehacer el formulario de datos de Play Store.** Google pregunta qué se
      recoge y dónde; declararlo mal es motivo de retirada.
- [ ] Invitar por enlace, además de por nombre de usuario.
- [ ] Decidir qué más se ve de un amigo. Hoy: nombre, usuario y foto. Nada más,
      a propósito.
- [ ] ⚠️ **MFA en la cuenta de Google antes del 20 de octubre de 2026** o se
      pierde el acceso a la consola de Firebase — la de esta app y la de
      genuinohost.com. Avisado en la propia consola.

---

## 🔴 Lo pedido el 16-09, por orden de gravedad

> Alex: «trabaja arduamente y profesionalmente para que las alarmas nunca
> fallen». Y: «anota todo, que nada se te escape». Esta lista es esa promesa.

### A. Las alarmas · **lo más grave, no se cierra hasta que suene**

**17-09: tampoco sonaron.** Ya no se adivina más sobre el código — lo de la 4.2
está bien hecho y probado. Lo que queda por descartar es **el móvil**, y en un
Xiaomi hay un sospechoso por encima de todos:

- [x] **Botón que abre el «inicio automático» del fabricante** (4.6). Es el
      ajuste que más alarmas mata en MIUI, **no aparece en ninguna lista de
      permisos de Android**, y sin él el sistema congela la app y se traga sus
      alarmas aunque todo lo demás esté concedido. Ya se le dieron a Alex las
      instrucciones por escrito el 15-09 y su respuesta fue **«no lo conseguí»**
      — unas instrucciones que no se pueden seguir no sirven de nada. Ahora la
      app abre la pantalla ella misma, probando las direcciones conocidas de
      cada marca y **preguntando antes al sistema si existen** (lanzar una que
      no existe deja una pantalla en blanco o tumba la app).
- [x] El botón sale en **dos sitios**: en Ajustes, y **en el aviso de alarma
      perdida por delante del ahorro de batería** — en un Xiaomi esa es la
      causa más probable, y la primera tarjeta que se lee es la que se toca.
- [ ] ⚠️ **Sigue faltando el parte.** Es lo único que distingue «no se disparó»
      de «se disparó y salió muda», y desde la 4.2 lo dice con todas las letras
      (SONÓ / MUDA, volumen, No molestar). **También dice qué versión está
      instalada**, que es la otra mitad del problema: el 16-09 se perdió medio
      día depurando un arreglo que nunca había llegado al teléfono.

**Lo hecho en la 4.2 — se le cerraron las salidas al silencio.**

Alex dijo: «la alarma no sonó en la madrugada, en la app tienen la
notificación». Esa frase es la pista entera: **hubo notificación y no hubo
ruido.** Revisada la cadena de arriba abajo, aparecieron tres agujeros por los
que se escapa exactamente ese fallo, y los tres están tapados:

- [x] **La app se daba por buena sin comprobar que sonaba.** El receptor
      arrancaba el servicio, y si arrancar no lanzaba una excepción lo daba por
      resuelto. La bandera `SONANDO` se ponía a cierto **antes** de reproducir
      nada. Ahora se pone **después**, sólo si el reproductor está sonando de
      verdad, y el receptor espera hasta tres segundos a que se confirme.
- [x] **Si a los tres segundos no hay ruido, se reintenta**, y si sigue mudo
      **suena el propio receptor**, con el tono de alarma por STREAM_ALARM.
      Para quedarse en silencio ahora tienen que fallar cuatro cosas seguidas.
- [x] **El móvil podía volver a dormirse mientras arrancaba el servicio.**
      AlarmManager sólo mantiene el procesador en pie mientras dura
      `onReceive`, y arrancar un servicio es asíncrono. Ahora se coge un
      `WakeLock` antes de nada y se usa `goAsync()`.
- [x] **Quedaban notificaciones de la época 3.x en la cola de Android.** Aquel
      sistema entregaba las alarmas como notificaciones corrientes y **nunca se
      cancelaron** al cambiar al despertador propio. Siguen saltando a su hora,
      mudas bajo No molestar, y dejan por la mañana justo lo que Alex describe:
      una notificación sin ruido. Se limpian al abrir la app.
- [x] **El diario ahora dice si sonó, no sólo si se disparó.** Cada apunte lleva
      el veredicto (SONÓ / MUDA), si arrancó el servicio, si hubo que
      reintentar, si tuvo que entrar el último recurso, el volumen de alarma y
      cómo estaba No molestar. El parte lo enseña en una línea por alarma.
- [x] **Se lee el filtro de No molestar.** En **silencio total** Android calla
      también el flujo de alarma: ninguna app del mundo suena con eso puesto. Es
      la única causa sin arreglo desde dentro, y ahora el parte la nombra.

**Lo que falta**

- [ ] **La prueba de fuego: la madrugada del 17-09.** Si vuelve a fallar, el
      parte dirá por qué con nombre y apellidos.
- [ ] Pedir el parte por la mañana. Ya no es para adivinar: es para leer el
      veredicto.

### B. Las rachas · ✅ **verificadas a fondo, 4.2**
- [x] **La racha inicial ya no sale en cero.** Eran dos fallos encadenados: el
      día en curso se medía contra **todos** sus bloques —a las diez de la
      mañana, tres de diez daba 0,30 y la racha caía a cero— y, al arreglarlo,
      el filtro no hacía nada porque comparaba el registro contra `undefined`
      cuando `sucesosDelDia` lo deja en `null`. Ahora el día de hoy se mide
      sólo por lo que ya tocó, con su margen de gracia.
- [x] **Las rachas de los planes**, revisadas: una caída llevada a Dios no
      rompe la racha; una noche sin repasar sí la corta.
- [x] **Pruebas escritas**, no comprobaciones a ojo: `npm run revisar-rachas`,
      12 comprobaciones, incluido el caso exacto que veía Alex.

### C. Editar tareas · ✅ **arreglado en la 4.2**
- [x] **Todas las filas se tocan**, no sólo las tareas sueltas. Antes los
      bloques de la rutina y los compromisos de los planes no respondían a
      nada, y desde fuera eso no se lee como «esto se edita en otro sitio»: se
      lee como que la app está rota.
- [x] Y cada una **abre lo que se tocó**: la tarea suelta su diálogo, el bloque
      de rutina su ficha ya abierta, el compromiso de un plan la ficha del plan.
      Llevar a la lista y que el usuario vuelva a buscar no era arreglarlo.
- [x] De paso, un fallo escondido: tocar un compromiso de plan marcaba el plan
      **sin cambiar de pestaña**, así que no pasaba nada de nada.

### D. Los planes · ✅ **hecho en la 4.3**
- [x] **Comentar cada día del plan activo.** En la ficha de cada plan, arriba:
      se escribe cuando aprieta, sin esperar a la noche y sin tener que
      declarar todavía si el día se ganó o se perdió. Va al diario, ligado al
      plan, y las últimas cinco se leen ahí mismo.
- [x] **Encontrada la razón de que no viera las notas del repaso.** Estaban,
      pero **sólo aparecían después de contestar todos los puntos**. Él hacía
      repasos a medias y nunca llegó a verlas, y acabó pidiendo como nueva una
      función que llevaba dentro desde la 4.0. Una función que no se ve es una
      función que no está: ahora se ve siempre.
- [x] **Más planes: de 15 a 21** (5.7). Elegidos por lo que pesa en su
      comunidad, no por rellenar la lista: **Interceder por nombre**,
      **Guardar los ojos** (el teléfono y la mirada), **Grabar la Palabra**,
      **Honrar a mi esposa**, **Perdonar de corazón** y **Poner orden en el
      dinero**.
- [x] Tres llevan **restauración** —una caída llevada a Dios no rompe la
      racha—: santidad, los ojos y perdonar. **Confirmado por Alex el 17-09**
      tras planteárselo: «está bien así, déjalo con restauración». En «los
      ojos» es donde más importa: quien cae ahí ya llega cargando vergüenza, y
      una racha que se pone a cero por ser sincero **enseña a esconderlo**.
- [x] **`npm run revisar-planes`**: horas bien escritas, días en rango, timbres
      que existen, versículos con su cita, y que ningún plan con puntos se
      quede sin hora de repaso. Un plan mal formado no revienta — se ofrece,
      alguien lo empieza, y falla el día que tenía que sonar.

### E. El diario · ✅ **hecho en la 4.3**
- [x] **Ya no está escondido.** Sube a la barra de abajo, como sexta pestaña,
      al lado de Planes. Una cosa que se escribe todos los días no puede vivir
      dentro del cajón de «Más».
- [x] **Guardar, compartir y descargar.** El diario entero sale como archivo de
      texto: en Android se escribe en Documentos y se abre el menú del sistema
      —Drive, WhatsApp, donde quiera—; en el navegador se descarga. Y cada nota
      suelta se puede compartir por separado, **sin firma de marca**: eso es
      suyo, no propaganda.
- [x] El archivo sale agrupado por días, con la fecha escrita en letra y, en
      las notas que nacieron de un plan, **cómo acabó aquel día**.

### F. La pantalla del mensaje · ✅ **hecha en la 4.4**

**Alex tenía razón, y la causa era literal.** Ese bloque volcaba **los 365
temas del banco de golpe** —uno por mensaje, en minúscula, como un muro de
etiquetas diminutas al final de la pantalla. Eso no es una lista, es un
vertido: nadie encuentra nada en 365 fragmentos, y lo que se lee de un vistazo
es que algo se rompió.

- [x] **Nueve áreas en vez del muro.** Y no están adivinadas: cada tanda del
      banco se escribió alrededor de un asunto, y eso ya estaba dicho en la
      cabecera de su archivo. Aquí sólo se recoge y se agrupa lo que se
      emparenta. La diferencia no es de adorno — con el muro había que saber ya
      qué palabra buscar; con las áreas se llega sabiendo sólo cómo está uno
      hoy, que es como se llega de verdad.
- [x] Cada área se abre y enseña sus mensajes **por su título, con su emoji**,
      dentro de su propia caja con desplazamiento: abrir un área de cincuenta
      ya no empuja media pantalla hacia abajo.
- [x] **La pantalla se reordenó por cómo se usa.** Casi todos los días Alex
      entra, coge el mensaje de hoy y lo pega: eso son dos toques y ahora está
      arriba del todo. Buscar y generar era lo excepcional, y ocupaba el sitio
      de lo corriente.
- [x] **Pruebas escritas** (`npm run revisar-areas`): que ningún mensaje se
      quede sin área, que ninguno esté en dos, y que ninguna área quede vacía.
      Sin esto, añadir una tanda 16 y olvidarse de meterla haría desaparecer
      sus mensajes de la pantalla **sin que saltara nada**.

### G. «Juntos» · **el armazón, hecho en la 4.3**
- [x] **TikTok** añadido como tipo de enlace, con Facebook de propina.
- [x] **Los grupos se separan de las redes**: no es lo mismo entrar a un grupo
      —donde te esperan y te echan de menos si faltas— que seguir una cuenta.
- [x] **Un enlace sin rellenar ya no se enseña.** Antes los huecos de ejemplo
      llevaban a una página rota, y un enlace roto en la pantalla de la
      comunidad hace más daño que no tener pantalla.
- [ ] ⚠️ **Faltan las URL de verdad.** Están pendientes de Alex y no se
      inventan: el enlace del grupo de WhatsApp, el canal de Telegram, y las
      cuentas de Instagram y TikTok de Genuino Love. Se ponen en
      `public/comunidad.json`, se despliega, y les cambia a todos sin
      actualizar la app.

### H. Privacidad de lo que se escribe · ✅ **el código, hecho en la 4.3**
- [x] **Código de cuatro números al abrir la app.** Se pone en Ajustes, con
      teclado propio y margen configurable para no pedirlo cada vez que se sale
      un momento a WhatsApp.
- [x] El código **no se guarda**: se guarda su huella (SHA-256 con sal), que no
      se puede deshacer.
- [x] **La alarma pasa por encima del bloqueo.** A las tres de la madrugada,
      con la alarma repicando, obligar a teclear cuatro números antes de poder
      decir «cumplido» es lo que hace que alguien acabe quitando el código. En
      esa pantalla no hay nada privado; lo íntimo sigue detrás.
- [x] Se dice lo que es y lo que no: impide que alguien abra la app y se ponga
      a leer, **no cifra el almacenamiento**. Prometer una caja fuerte donde
      hay un pestillo sería peor que no poner nada.
- [ ] **La huella.** Queda pendiente: necesita `androidx.biometric` en el
      plugin nativo. El código es la base de todos modos — la huella siempre
      tiene que poder caer en él cuando falla.

---

## Fase 1 — Terminar lo empezado

Esto es lo que hace que la app sirva. Antes de Play Store, antes de cuentas.

### 1.1 ✅ Banco de 365 mensajes — hecho
### 1.2 ✅ Pantallas de planes y repaso de la noche — hecho

### 1.3 Lo que falta de los planes

- [x] ✅ **Elegir la debilidad propia**, en la ficha de cada plan. El repaso la
      destaca con ★ y se lleva su balance aparte.
- [ ] ⚠️ **Que el repaso de la noche suene.** La hora del examen todavía no
      genera alarma; sin eso hay que acordarse de abrirlo. **Es lo siguiente.**
- [ ] Añadir puntos propios a un plan, y crear uno desde cero.
- [x] ✅ Editar horas, pausar y eliminar un plan, desde su ficha.
- [x] ✅ Ficha de cada plan: racha, récord, días limpios y días restaurados.

### 1.3 ✅ Diario personal — hecho el 15-09

Espacio libre y privado, sin formato impuesto, con buscador. `PantallaDiario`.

**Y atado al repaso de la noche**, que es lo que lo hace distinto de un
cuaderno: al cerrar el día de un plan se puede escribir cómo se sintió vencer o
caer, y esa nota llega al diario **con el plan y con cómo acabó el día**. Al
releerla dentro de un año no se lee «me costó» a secas: se lee junto a si aquel
día venció o cayó.

- [ ] Falta que se exporte con la copia de seguridad.

### 1.4 Estadísticas de verdad · **pedido el 14-09**
Alex: «todo tipo de seguimiento y análisis estadístico es VITAL».
- **En qué se está fallando**: «cuidar la lengua, 11 días de los últimos 30».
- Evolución por semanas y por meses, no solo el día.
- Comparar planes entre sí.
- Mejor hora del día, mejor día de la semana.
- Racha máxima histórica por plan.

### 1.4b Las frases por tema, sin pedirle una clave a nadie · **pedido el 15-09**

Alex: «el banco se queda corto cuando quiero generar frases según una frase. Lo
mejor es que salga desde internet».

Tiene razón, y hoy el generador **pide una clave de OpenRouter**, que es un muro
infranqueable para cualquiera que no sea él. **Esto es exactamente la Fase 2.1**:
el servidor propio. Sin él, esta función no sirve para nadie más.

> Es la razón más fuerte para hacer el servidor antes que las cuentas.

### 1.5 Recibimiento del primer uso
Hoy la app abre con la rutina de Alex. Quien la instale debe poder, en dos
minutos: elegir sus planes, poner su hora de levantarse y **escribir su porqué**.

### 1.6 Marca Genuino Love
En «Más», en el «acerca de», en la ficha de Play Store y en el gráfico
destacado. La app pertenece a la comunidad, no a una persona.

---

## Fase 2 — Cuenta y servidor

Alex lo quiere, y es lo que permite amigos, grupos y no perder los datos.

> ⚠️ **Cambia la naturaleza de la app.** Hoy todo vive en el móvil y por eso su
> política de privacidad es de tres líneas. Con cuentas hay datos personales,
> moderación y una sección de «Seguridad de datos» en Play Store mucho más
> exigente. Merece hacerse bien, no rápido.

### 2.1 Servidor del generador · **decidido: lo paga Alex**
- **Cloudflare Workers**, gratis hasta 100.000 peticiones al día.
- La clave de OpenRouter **solo en el servidor**: un APK se abre y se lee.
- ⚠️ **Tope por dispositivo y techo de gasto global.** Sin eso, cualquiera le
  vacía el saldo en una tarde.
- Coste medido: **9 céntimos por cada 1.000 mensajes**.

### 2.2 Cuentas y perfil
- **Firebase Auth**, que ya tiene contratado. Correo y Google; el teléfono
  cuesta dinero y además es un dato sensible.
- Perfil: nombre, foto, y **teléfono opcional** como pidió Alex.
- ⚠️ **Entrar debe ser opcional.** Quien no quiera cuenta debe poder usar la app
  entera igual. Obligar a registrarse ahuyenta a la mitad en el primer minuto.

### 2.3 Copia de seguridad en la nube
Con cuenta, que el historial no se pierda al cambiar de móvil. **Hoy se pierde**
si se desinstala, y eso duele más cuanto más larga sea la racha.

### 2.4 ⭐ Convocar a todos · **pedido el 15-09**

Alex: «una opción estilo WhatsApp de poder llamar a todos los que tengan la app
instalada».

**Esto es, con diferencia, la idea más potente que ha tenido para esta app**, y
encaja con lo único que Genuino sabe hacer y nadie más: hacer sonar un teléfono
que está dormido. Un líder convoca, y **suena el móvil de toda la comunidad a la
vez**, atravesando el No molestar, como una alarma. Al responder, se abre la sala
de oración.

**Cómo se hace, y por qué así:**

| Pieza | Decisión |
|---|---|
| El repique | **La maquinaria de alarma que ya existe** (`ServicioAlarma`). Ya sabe sonar con el móvil bloqueado y en No molestar |
| El aviso | **Firebase Cloud Messaging**, gratis y sin límite práctico. Mensaje de prioridad alta, que despierta el aparato |
| La sala | **Meet, Zoom o Jitsi**, como ya hace `PantallaComunidad`. Gratis y sin mantener |

> ⚠️ **No hacer una llamada de voz propia.** Lo caro de una llamada de grupo es
> el audio: hacen falta servidores TURN que retransmiten el sonido de cada
> participante, y eso se paga por gigabyte todos los días. La sala ya está
> resuelta con Meet. **Lo que nadie más puede darle es que suene el teléfono de
> todos**, y eso ya lo sabemos hacer.

**Lo que no es negociable, y hay que construir desde el primer día:**

- **Solo convocan los líderes que Alex designe.** Si puede cualquiera, la app se
  convierte en un arma de spam y Google la retira de Play Store. Sin discusión.
- **Cada uno acepta ser convocado, y en qué horario.** Un hermano en otro huso
  no puede recibir un repique a las 3 de su madrugada sin haberlo consentido.
- **Tope de convocatorias al día**, y quién convocó queda registrado.
- En Play Store esto entra en «Seguridad de datos» y exige política de privacidad
  seria: hay identidad, hay envío entre usuarios y hay moderación.

Depende de 2.1 (servidor) y 2.2 (cuentas). Antes de eso no se puede empezar.

### 2.5 Amigos y grupos
- Añadir amigos, ver sus rachas, animarse.
- **Grupos que comparten el mismo plan**: ir juntos a por los 40 días.
- ⚠️ Con gente hay que moderar: denunciar, bloquear, y alguien que responda.
  Google lo exige en apps con contenido entre usuarios.

---

## Fase 3 — Play Store

Decisiones ya tomadas, en `docs/play-store.md`.

| Decidido | |
|---|---|
| Título (30) | `Genuino: Disciplina Cristiana` |
| Descripción corta (80) | `Despertador cristiano, agenda diaria y rachas para crecer en disciplina` |
| Cuenta | **personal ahora**, transferir a Alexa Lounge con el D-U-N-S |
| Donaciones | **Google Play Billing**, 15 % — nunca un enlace a PayPal |
| Posicionamiento | despertador y disciplina, **no** «devocional» (saturado) |

### Falta
- [ ] Política de privacidad, alojada en genuinohost.com
- [ ] Compilar **AAB** en vez de APK
- [ ] Icono 512×512 · **gráfico destacado 1024×500** · capturas
- [ ] Descripción larga (4.000) con las palabras del punto 1 del plan
- [ ] Clasificación de contenido y «Seguridad de datos»
- [ ] Cuenta de desarrollador, **$25**
- [ ] **12 probadores durante 14 días** ← el cuello de botella
- [ ] Donaciones con Play Billing, después de publicar

---

## Fase 4 — Los vídeos y la publicidad

Alex es buen orador y graba bien. Eso es un activo que la mayoría de las apps no
tiene, y conviene usarlo como lo que es: **él delante de la cámara vale más que
cualquier animación bonita**.

### Lo que hay que preparar antes de grabar

- [ ] **Guion de 30 segundos** para el anuncio pagado. Un solo mensaje, un solo
      problema, una sola promesa.
- [ ] **Guion de 15 segundos** para vídeo vertical (Reels, Shorts).
- [ ] **Vídeo de 2 minutos** para la ficha de Play Store, contando la app entera.
- [ ] **Capturas de pantalla** que se intercalen con él hablando.

### El ángulo, que no es el obvio

No vender «una app de hábitos». El gancho es lo que nadie más resuelve:

> **«¿Cuántas veces le prometiste a Dios que mañana te levantabas a orar?»**

Ese es el dolor real y el hueco del mercado. Genuino es lo único que **te despierta
de verdad** —alarma que atraviesa el No molestar— y luego te pide cuentas.

Lo que debería salir en el vídeo, por orden de fuerza:

1. La alarma de las 3:00 **sonando** con el móvil bloqueado. Eso es la prueba.
2. La racha: días seguidos, en grande.
3. El repaso de santidad, y que **una caída llevada a Dios no rompe la racha**.
   Eso emociona y distingue: no es una app que te castiga.
4. El mensaje diario para compartir en el grupo, con la firma.

### Lo que hace falta saber antes de pagar publicidad

⚠️ **Antes de invertir en anuncios, la app tiene que retener.** Pagar tráfico
hacia una app que se desinstala al tercer día es tirar el dinero — y eso ya pasó
con la publicidad del negocio, que nunca dio reuniones porque el problema no era
el mensaje.

Primero los 12 probadores durante 14 días. Si ellos siguen usándola al final de
las dos semanas, entonces sí.

---

## Más allá de lo pedido

Cosas que no ha pedido y que esta app necesita para estar a la altura.

### Vale la pena
- **Widget en la pantalla de inicio** con la próxima alarma y la racha. Es lo que
  hace que una app de hábitos no se olvide.
- **Aviso de racha en peligro**: si a las nueve de la noche falta un bloque, un
  toque suave. Salva más rachas que cualquier otra cosa.
- **Exportar el diario y el progreso** en PDF, para releerlo al cabo de un año.
- **Modo de solo lectura sin alarmas** para quien solo quiere los mensajes.
- **Accesibilidad**: tamaños de letra grandes y buen contraste. Muchos hermanos
  mayores van a instalarla.
- **Sonidos de alarma elegibles**, incluido el tono del móvil.

### Para pensar más adelante
- **Traducción al inglés y al portugués.** «Millones de cristianos» no hablan
  todos español, y Brasil es enorme.
- **Versión para iPhone**: Capacitor ya lo permite; hace falta un Mac y $99 al año.
- **Plan de lectura bíblica guiado** con el texto dentro (ojo: versión libre).
- **Testimonios**: que alguien cuente qué cambió en él a los 90 días.

---

## 🌐 El muro: notas públicas o privadas (6.3, 17-09)

Alex: «las notas en el diario y exámenes deben tener la opción de pública o
privada. **Lo público lo puede ver todo el mundo, amigos o no**».

**Esto cambió una promesa que estaba escrita en tres sitios.** Hasta hoy la app
decía, en la pantalla de la cuenta, en la política de privacidad y en la
cabecera de `firestore.rules`, que el diario **no subía nunca**. La promesa se
ha reescrito en los tres, no se ha borrado sin más: quien instaló la app con la
promesa vieja tiene derecho a leer la nueva.

**La regla que la sustituye:** nada de lo que se escribe sale del teléfono salvo
la nota concreta en la que su dueño tocó «publicar». Todo nace privado, lo que
ya estaba escrito sigue privado —ninguna nota vieja tiene la marca—, y retirar
una la borra del servidor de verdad.

### Lo que **no** viaja, aunque la nota sea pública

Sube el texto, el nombre y el nombre de usuario. **No sube de qué plan viene la
nota ni cómo acabó aquel día**, aunque dentro de la app se vean juntos. Decir
«esto es del plan de los ojos» o «aquel día fallé» cuenta la batalla de alguien
aunque su texto no la cuente. Es la misma familia de la decisión del diario, y
se resuelve igual: lo delicado sólo sale si lo escribe él.

### Denunciar, bloquear y moderar no son un extra

En cuanto una app enseña a unos usuarios lo que escriben otros, **la política de
contenido generado de Google Play exige** poder denunciar, poder bloquear y que
alguien pueda retirar. Sin las tres, la app no entra en la tienda — y la tienda
es lo que Alex más quiere. Están las tres:

| Lo que exige Play | Dónde está |
|---|---|
| Denunciar | Menú «⋯» de cada nota → *Denunciar esta nota* (colección `denuncias`) |
| Bloquear | Mismo menú → *No ver nada de …* (`usuarios/{uid}/bloqueados`) |
| Retirar lo ajeno | `moderadores/{uid}`; quien esté ahí puede borrar cualquier nota |

También hay que **cambiar la respuesta del cuestionario de clasificación**: la
app ya no es «sin contenido generado por usuarios».

### Y un fallo de la 6.2 corregido de paso

Al borrar la cuenta se borraba `usuarios/{uid}`, pero **Firestore no borra las
subcolecciones con el padre**: el WhatsApp guardado en `privado/contacto` se
quedaba en el servidor después de que la pantalla dijera «se va de verdad». Se
nombran ahora una por una todas las colecciones que cuelgan de una cuenta —
amigos, privado, bloqueados y las notas publicadas—, y **cada colección nueva
tiene que pasar por ahí**.

---

## 🏪 EN GOOGLE PLAY · 18-09-2026

**La app está subida.** Cuenta de desarrollador verificada, aplicación creada
(`app.genuino.firme`), versión **47 (6.5)** publicada en **prueba interna** y
lista de probadores con tres correos.

Enlace para los probadores:
`https://play.google.com/apps/internaltest/4701479158459093667`

### Lo irreversible que salió bien: la clave de firma

Play ofrece por defecto **generar una clave nueva**. Aceptarlo habría firmado
la versión de la tienda con una clave distinta a la de los APK ya instalados, y
**Android se niega a actualizar cuando la firma no coincide**: la única salida
habría sido desinstalar, que borra el diario, las rachas y los planes, porque
todo vive en el teléfono.

Se subió la clave propia (`android/firme-firma.jks`, alias `firme`) con la
herramienta PEPK. Comprobado contra el certificado que devuelve Play:

```
SHA-1    D8:51:A8:B6:D2:76:43:22:CC:85:85:8D:6B:46:F1:8B:F9:9A:75:D4
SHA-256  63:55:90:41:46:BF:FA:AA:22:E0:7B:5C:53:A6:C1:AC:77:14:F1:0B:A1:DA:21:17:D1:C2:6A:36:3B:0F:42:00
```

Idénticos a los del almacén. La versión de Play entra encima sin desinstalar.

> **El `.jks` y su contraseña son ahora lo más importante del proyecto.** Sin
> ellos no se puede volver a publicar ninguna actualización, nunca.

### Lo que falta para producción

1. Completar la ficha: descripciones, gráficos, clasificación de contenido y
   seguridad de datos. Todo preparado en `docs/tienda/ficha.md`.
2. **Prueba cerrada: 12 probadores, 14 días seguidos.** Es el reloj largo, y no
   empieza hasta que estén los 12 dentro.
3. Dos respuestas que cambiaron con el muro: «¿los usuarios pueden
   intercambiar contenido?» → **sí**, y la fila de *Mensajes* en seguridad de
   datos va como **compartida**.

---

## 🐞 Avisar de un fallo, y los cuatro que lo provocaron (6.7, 18-09)

Alex: «los hermanos deberían tener un botón especial para escribir y mandar
capturas de los errores de la app. Por ejemplo, Nazdrely me acaba de agregar
como amigo, me agregó pero no puede entrar a mi perfil y ver mis rachas».

Se miraron los datos reales en vez de adivinar, y **no era un fallo: eran
cuatro**, los cuatro mudos.

| Lo que pasaba | Por qué |
|---|---|
| Nazdrely no veía nada de Alex | Su solicitud seguía **sin aceptar**: «enviada» por su lado, «recibida» por el de él |
| A Alex nada le avisó | La solicitud vivía dentro de «Mi cuenta»; quien no entra ahí no se entera |
| Tocar su nombre no hacía nada | La ficha sólo se abría para los **ya aceptados**; las filas pendientes no respondían y no decían por qué |
| La ficha de José dice «prefiere no enseñar sus cifras» | **Él nunca decidió eso.** Su perfil no tiene cifras publicadas, y la app le atribuía una intención |

Arreglados los cuatro: las filas pendientes se tocan y la ficha explica en qué
punto está la amistad, «Más» lleva un contador de quién te espera, y cuando no
hay cifras se dice que no las hay en vez de inventar un motivo.

> **La regla que queda:** cuando la app no sepa algo, que lo diga. Atribuirle
> una decisión a alguien que no la tomó es peor que dejar el hueco en blanco.

### Y el botón

**Más → Avisar de un fallo.** Se escribe (o se dicta), se añaden hasta tres
capturas, y va con un parte técnico automático: versión, teléfono, y
**cuántos** planes, tareas y notas hay — los números, nunca el contenido.

**No pide cuenta, y es deliberado.** Lo intuitivo sería exigirla para evitar
basura, pero los dos peores fallos de este proyecto han sido fallos de
*entrar*: el login que rebotaba y el registro que no terminaba. Quien más
necesita avisar es justo el que no puede entrar; exigirle cuenta es dejarle sin
voz cuando el fallo es grave. El ruido se borra en un minuto; un fallo que
nadie pudo contar dura meses.

Los avisos no los puede leer nadie desde la app. Se leen así:

```bash
npm run fallos
```

Las capturas se guardan en `docs/fallos/` para poder mirarlas.

---

## 🛡️ El permiso que no tenía botón (6.6, 18-09)

Las reglas dejaban a un moderador retirar lo que escribió otro **desde el
17-09**, y hasta hoy eso no servía para nada por dos motivos, los dos mudos:

1. **La colección `moderadores` estaba vacía.** El permiso existía y no había
   nadie dentro.
2. **La app no podía saber si eres moderador**, porque las reglas prohibían
   leer esa colección entera — ni siquiera el documento propio. Sin poder
   preguntarlo, no había forma de enseñar el botón.

Un permiso sin botón es un permiso que no existe, y Google Play no mira las
reglas: mira si en la app se puede retirar algo.

Arreglado: cada uno puede leer **su propio** documento de moderador (nadie
puede sacar la lista ni comprobar si lo es un tercero), el muro enseña
«Retirar del muro (moderación)» a quien manda, y las frases del perfil también.

Los moderadores se dan de alta con la cuenta de servicio, sin tocar la consola:

```bash
node scripts/moderador.mjs poner correo@gmail.com
```

---

## 💬 Las frases favoritas, en el perfil (6.5, 18-09)

Alex, cuando le pregunté si publicarlas o dejarlas privadas: **«que se puedan
publicar también, cada quien decide»**.

Cada frase guardada tiene ahora un botón **«a mi perfil»**, apagado siempre.
Las que lleves las ve cualquiera, con tu nombre; las que no, no salen del
teléfono. Aparecen en la ficha de un hermano bajo **«lo que le sostiene»**.

Van **aparte del muro**, no mezcladas con él, y es una decisión: una nota es lo
que alguien vivió ese día, una frase guardada es algo que le sostuvo. Juntarlas
en el mismo hilo convertiría el muro en una cadena de versículos reenviados,
que es justo lo que no hace falta.

### La trampa del identificador

El id de una frase guardada es **la huella de su texto**. Dos hermanos que
guarden el mismo versículo —salen del mismo banco, va a pasar a diario—
tendrían exactamente el mismo id. Con el texto por clave, **el segundo en
publicar chocaría contra el documento del primero**: las reglas se lo negarían
y él sólo vería «no se pudo», sin manera de entender por qué ni de arreglarlo.

La clave del documento lleva el uid delante (`uid.huella`). Hay una prueba que
lo comprueba: *«DOS personas pueden publicar la MISMA frase»*.

---

## 🔒 Las reglas, probadas por fin (18-09, 6.4)

`firestore.rules` es lo único que separa el WhatsApp, el perfil y las notas de
la gente de cualquiera con una conexión. **Y nunca se habían comprobado.** Se
escribían, se desplegaban —«rules file compiled successfully»— y a otra cosa.
Pero que compilen sólo dice que están bien escritas: una regla que por error
deja leer el teléfono de otro compila igual de bien que la que no lo deja.

Ahora hay **48 comprobaciones** contra el emulador de Firestore, hechas en
nombre de un extraño:

```bash
npm run revisar-reglas
```

Preguntan lo incómodo: ¿lee un desconocido el WhatsApp de otro? ¿Y quien mandó
una solicitud que nadie aceptó? ¿Se puede publicar firmando con el nombre de
otro? ¿Se puede colar en una nota pública de qué plan viene? ¿Puede alguien
hacerse moderador a sí mismo? ¿Se puede inventar una colección para el diario?

**Y se comprobó que las comprobaciones sirven.** Se rompieron las reglas a
propósito —el muro dejó de ser público, el WhatsApp se abrió a cualquiera con
cuenta— y las tres pruebas que tenían que ponerse rojas se pusieron rojas. Una
prueba que nunca ha fallado no ha demostrado nada.

Desplegar las reglas pasa ahora por ahí obligatoriamente:

```bash
npm run desplegar-reglas
```

Si una comprobación falla, **no sube nada**. Un `allow read` de más no rompe
nada, no da error y no se ve en ninguna pantalla: deja la puerta abierta y
nadie se entera hasta que alguien pasa por ella.

---

## 🔑 Desplegar sin iniciar sesión, esta vez de verdad (18-09)

Alex, el 16-09: «es molestoso iniciar sesión a cada rato». Se puso una cuenta
de servicio, cuya clave no caduca… y el 18-09 volvió a fallar con **«Your
credentials are no longer valid»**.

**La clave nunca fue el problema.** El CLI de Firebase **prefiere la sesión de
usuario guardada antes que la cuenta de servicio**, y la guardada
(`auto@genuinohost.com`) había caducado. Con un usuario caducado delante, ni
mira `GOOGLE_APPLICATION_CREDENTIALS`. El mensaje decía «no hay credenciales»
teniendo la clave puesta: miraba al sitio equivocado.

El arreglo (`scripts/credenciales.mjs`): los despliegues corren con **su propia
carpeta de configuración**, vacía de usuarios. Sin sesión que estorbe, el CLI
usa la cuenta de servicio. No se cierra la sesión de Alex, que es suya.

> Y una lección repetida: la primera versión del arreglo **salía antes de
> aislar** cuando la variable ya venía puesta en el sistema —que es el caso de
> Alex—, así que seguía fallando igual. El arreglo tiene que pasar siempre que
> haya clave, venga de donde venga.

---

## 🧰 La red de seguridad que no se estaba ejecutando (18-09)

`vite-node` no estaba instalado, así que **los seis scripts de revisión
llevaban tiempo sin poder ejecutarse**: fallaban con un «no se reconoce como un
comando» que nadie leía, porque nadie los lanzaba. Una red de seguridad que no
se ejecuta no es una red: es un archivo.

Instalado, los seis pasan. Y ahora:

- `npm run revisar` los lanza todos de un tirón.
- `npm run apk` **los ejecuta antes de compilar**. Compilar el APK es el último
  sitio por el que pasa todo antes de llegar a un teléfono; si algo está roto,
  que se sepa ahí y no en el móvil de alguien.

---

## 🔴 Bloquear sin poder desbloquear (arreglado en la 6.4)

La 6.3 dejaba bloquear a alguien desde el muro y **no tenía ninguna pantalla
para quitarlo**. Un toque mal dado en el menú «⋯» dejaba a un hermano invisible
para siempre, sin aviso y sin vuelta atrás.

Ahora, en **Mi cuenta**, aparece «a quién no estás leyendo» con un botón para
soltar a cada uno. La tarjeta no se enseña si no hay nadie bloqueado: una
sección vacía titulada «bloqueados» sugiere que esto va de pelearse, y no va de
eso.

**La regla que queda escrita:** toda acción que esconde a una persona tiene que
tener su contraria a la vista, y en la misma versión.

---

## 🎬 El vídeo, y el skill que lo repite (18/19-09)

Alex grabó once clips en su casa —viendo la tele, comiendo, al teléfono,
trabajando— más dos tomas largas hablando a cámara. De ahí salió una pieza
vertical de **52 segundos** para WhatsApp, Instagram y TikTok.

### Lo que hizo la diferencia: oírle

Al principio no se podía. Se veía **dónde** hablaba —midiendo niveles de
audio— pero no **qué** decía, así que los planos de la app acababan
amontonados al final del vídeo.

Se instaló **Whisper en local** (Python 3.12 + faster-whisper). Gratis, sin
clave de API y, lo que más importa aquí, **su voz no sale de su máquina**: son
grabaciones suyas hablando de su fe.

Con la transcripción llegaron los segundos exactos de cada frase, y con ellos
el montaje bueno: la alarma entra cuando dice «es un despertador para el
momento de orar», los mensajes cuando dice «una preciosa comunidad con tus
hermanos», los planes cuando dice «creciendo cada día más disciplinado».

### Todo guardado como skill

`.claude/skills/video/` y `scripts/video/`. El próximo vídeo es un comando,
no una tarde. Dentro quedan las **seis trampas** que costaron esta —todas
mudas, ninguna daba error— y la identidad visual de la app para que los
rótulos no desentonen.

### Lo que se midió y no se hizo

Cortar silencios es lo que recomienda todo el mundo. Se midió: **cuarenta
segundos hablando con dos pausas de 0,25 s**. Quitarlas habría ahorrado dos
segundos a cambio de ocho saltos de imagen y de dejarle hablando sin respirar.

> **La regla:** medir antes de cortar. Si las pausas internas suman menos de
> dos segundos, la grasa está en la apertura, no en su voz.

### La segunda vuelta (19-09): los rótulos

Alex vio el vídeo y puso el dedo donde había que ponerlo:

> «Es imperdonable que pongas subtítulos donde las frases queden a la mitad.
> Debe poder leerse bien fácilmente.»

Tenía razón, y el fallo era **más grande de lo que se veía**. Hay tres formas
de partir una frase y sólo estaba tapada una:

| Falta | Cómo se veía |
|---|---|
| Cerrar colgando | `HA PERMITIDO QUE` |
| Abrir colgando | `DE CUMPLIR` · `A AUMENTAR` |
| Tragarse un punto | `DIOS / Y ES QUE EL PADRE` — dos oraciones |

Las dos últimas **aparecieron al arreglar la primera**: al arrastrar palabras
para no cerrar mal, el corte se va al otro lado. Por eso el agrupador ya no
decide rótulo a rótulo — puntúa todos los repartos posibles del texto entero y
se queda con el mejor del conjunto.

**Y se mide en píxeles, no en letras.** `CONSTANTEMENTE A CUMPLIR` y
`A NUESTRO PERFECTO DIOS.` tienen las mismas 24 letras y ocupan **1103 y 1006
píxeles** en un cuadro de 1080. El reparto prefería el que se salía porque
quedaba «más equilibrado». `scripts/video/anchos.json` guarda el ancho real de
cada letra de Segoe UI Bold; calculado contra real, **un píxel de diferencia**.

### El modelo pequeño casi le pone palabras en la boca

`small` escribe bien las palabras y **puntúa mal**, y la puntuación es lo único
que marca el final de una frase cuando el orador no respira — y Alex no respira:
entre palabra y palabra hay `0,000` segundos casi siempre.

Peor aún: oyó «teciendo» donde el grande oye **«siendo»**, y «descarga la goza»
donde dijo **«descárgala, gózate»**. Se había parcheado a mano como «creciendo».
Los rótulos van grabados en la imagen: habría quedado ahí para siempre una
palabra que Alex no dijo.

> **La regla:** para los rótulos, `large-v3`. Tarda unos minutos y se descarga
> una vez. Cuesta menos que revisar los rótulos a mano, y muchísimo menos que
> publicar una palabra inventada.

### Dos cosas más que no se veían en el monitor

- **Una banda oscura detrás del texto.** El borde y la sombra no bastaban sobre
  las capturas claras de la app: el dorado sobre blanco no se leía.
- **Los rótulos suben de `h*0,826` a `h*0,771`.** Por debajo de eso los tapan el
  texto del post y los botones de Instagram y TikTok. Se leían en el ordenador y
  no en el móvil, que es donde los va a ver todo el mundo.

### Dónde quedó: 7,5 sobre 10

Lo que subió de 6 a 7,5 fue quitar fallos, no añadir virtudes. **Los 2,5 que
faltan no son de edición, son de metraje**, y sólo los puede dar Alex:

- otro lugar y otra ropa — todo es el mismo salón, el mismo día
- un **segundo ángulo real**; los tres encuadres salen de recortar la misma toma
- la **app grabada en movimiento**, con su dedo tocándola, no capturas quietas

### Pendiente del vídeo

- [x] ~~Elegir la **música**~~ — elegida la 4 de Pixabay, medida con librosa
      (136 pulsaciones por minuto) y todos los cortes van sobre el pulso
- [ ] El **vídeo del permiso** de servicio en primer plano, subido a YouTube
      como «No listado», para la declaración de Play.
- [x] ~~Confirmar si dijo «fallar en» o «fallarle a»~~ — **«fallarle a»**,
      confirmado por Alex el 19-09. Los dos modelos de Whisper oyen «fallar
      en»; el rótulo se queda como está.

---

## 🔮 Lo que Alex quiere que venga, y lo que traerá consigo

Dicho el **18-09-2026**, mientras rellenábamos la ficha de Play. Queda escrito
porque cada una de estas tres cosas cambia lo que hay que construir, y dos de
ellas cambian lo que hay que declarar.

### Imágenes y vídeo entre usuarios

> «En un futuro próximo sí vamos a intercambiar imágenes, vídeos y audios.
> Prefiero que pongamos sí de una vez. Eso es muy importante para mí.»

Ya está **declarado en el cuestionario de clasificación**, a propósito: rehacer
ese cuestionario obliga a empezarlo de cero, así que se adelantó. La
clasificación salió igualmente 3+ en todos los territorios.

**Lo que hay que resolver antes de construirlo:**

- **Entre quién.** No es lo mismo una imagen entre hermanos ya aceptados que
  una imagen en un muro abierto que lee cualquiera sin cuenta. Lo segundo
  multiplica el riesgo y las obligaciones.
- **Moderación.** Un texto ofensivo se ve leyéndolo; una imagen no se revisa
  igual, y Google vigila esto con especial dureza. Retirar una imagen tiene
  que ser tan fácil como retirar una nota, y probablemente haga falta algo más
  que eso.
- **Dónde se guardan.** Las fotos de perfil van dentro del documento, encogidas
  a 192 píxeles. Eso no vale para imágenes compartidas: haría falta un almacén
  de archivos, con sus reglas, su coste y su borrado al eliminar la cuenta —
  que es justo lo que se evitó a propósito con las fotos de perfil.

### Notas de voz

Mismo caso, y **declarado igual** en clasificación y en seguridad de datos
(*grabaciones de voz o de sonido*). El dictado actual **no cuenta**: lo
transcribe el motor de Android y el audio no sale del teléfono. Esto sería
audio de verdad viajando entre personas.

### Guías de estudio y presentaciones en PDF

> «Quizás en su momento subamos guías de estudios y presentaciones PDF.»

**Esto es distinto a los dos anteriores y no se declara**: los sube Alex para
que la gente los lea, así que no es dato de ningún usuario — es contenido que
se reparte. Sólo habría que declarar *Archivos y documentos* el día que **los
usuarios suban los suyos**.

> **La regla que salió de aquí:** declarar de más cuando corregirlo sea caro
> —el cuestionario de clasificación obliga a rehacerlo entero—, y ajustar sobre
> la marcha cuando sea barato —el formulario de seguridad de datos se edita
> cuando quieras—.

---

## Pendiente de Alex

- [x] ~~Darse de alta como moderador~~ — hecho el 18-09 con
      `node scripts/moderador.mjs poner genuino.love@gmail.com`
- [ ] 🔴 **Reunir 12 probadores** para la prueba cerrada — 14 días seguidos, y
      es lo que marca cuándo se puede pedir producción
- [x] ~~Crear la cuenta de Play~~ — hecha y verificada el 18-09
- [ ] Dar los enlaces reales para `public/comunidad.json`
- [ ] **Revisar los versículos del banco** — él es Capellán y su palabra está de por medio
- [ ] Decidir si pedir permiso a Sociedades Bíblicas Unidas para usar la RV1960

---

## Reglas que no se negocian

1. **Todo en español**: archivos, variables, comentarios.
2. **Versículos del banco en Reina-Valera 1909**, que es de dominio público. La
   RV1960 no se puede empaquetar sin permiso de Sociedades Bíblicas Unidas.
3. **Las alarmas tienen que sonar siempre.** Es la promesa de la app y lo que
   más le importa a Alex: sus compromisos con Dios dependen de eso.
4. **Tono de aliento, nunca de reproche.** Quien abre esta app ya sabe dónde
   falla; necesita que alguien lo levante.
5. **La app entera gratis.** Donar no da ventajas ni quita anuncios.
6. **Nada de publicidad.**
7. `npm run build` antes de dar nada por terminado.
8. **La bitácora se actualiza al cerrar cada sesión.**
