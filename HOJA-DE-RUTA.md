Hoja de ruta
============

> **Este documento se lee al empezar cada sesión y se actualiza al terminarla.**
> Recoge **todo** lo que Alex ha pedido, lo que ya está hecho y lo que falta,
> para que nada se pierda por el camino.
>
> La app es de la comunidad cristiana **Genuino Love**, la identidad de Alex
> desde 2014. Eso debe verse en la app y en la ficha de Play Store.

Última revisión: **17 de septiembre de 2026** (versión 5.1).

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

### J. Cuenta, perfil y amigos · **en marcha, falta un clic de Alex**
> Alex: «la opción de iniciar sesión, tener un perfil muy elegante, con detalles
> de ciudad, país, etc., y la capacidad para agregar amigos. Todo estilo la app
> Biblia YouVersion». Aprobado el 16-09: **Firebase**.

**Hecho**

- [x] **Firebase montado sobre el proyecto que ya existe** (`genuino-host`).
      Registradas la app web y la de Android, y las dos huellas del certificado
      de firma (SHA-1 y SHA-256), que es lo que hace falta para que el acceso
      con Google funcione en el móvil.
- [x] **Reglas de Firestore escritas y desplegadas** (`firestore.rules`). Es lo
      único que separa los datos de las personas de cualquiera con una conexión:
      la app cliente se puede reescribir en una tarde, las reglas no. Todo lo
      que no se prohíbe ahí, está permitido para todo el mundo.
- [x] **Perfil**: nombre, nombre de usuario único, foto, **ciudad y país** (con
      bandera, y Venezuela la primera), versículo de cabecera y desde cuándo.
- [x] **Amigos**: buscar por nombre de usuario, pedir, aceptar, quitar. Cada
      lado guarda su copia — parece redundante y es justo lo que impide que
      nadie toque la lista de otro salvo para dejar ahí una solicitud suya.
- [x] **El nombre de usuario es único de verdad.** Firestore no tiene índices
      únicos: se consigue haciendo del nombre la clave de un documento y
      prohibiendo sobrescribirlo, todo dentro de una transacción.
- [x] **Borrar la cuenta desde dentro, y que se borre.** Play lo exige y además
      es lo decente. Se avisa expresamente de que **el diario no se toca**,
      porque lo que más asusta al borrar es no saber si te llevas eso también.
- [x] **Política de privacidad rehecha.** Ya no puede decir «no recogemos ningún
      dato»: ahora dice exactamente qué sube con cuenta, qué no sube nunca,
      dónde se guarda y cómo borrarlo. También el micrófono del dictado.
- [x] **Firebase se carga en diferido.** Pesa más que media app; cargarlo al
      arrancar le costaría un par de segundos a cada usuario en cada apertura,
      incluidos los que nunca vayan a crear cuenta — que van a ser la mayoría,
      muchos con mala conexión y un teléfono barato. Sólo se carga al entrar en
      la pantalla de la cuenta, o al arrancar si ya se había entrado en ese
      móvil.

**La decisión de fondo, tomada y escrita en tres sitios**

**El diario, las notas y los repasos no suben nunca.** Ni cifrados, ni «solo
para el dueño», ni «por si se pierde el móvil». Ahí se anota una caída y lo que
se le dijo a Dios por ella. Está dicho en `nube.ts`, en `firestore.rules` y en
la propia pantalla — porque la tentación de sincronizarlo «para que no se
pierda» va a volver, y va a sonar razonable.

Y la segunda, que no es técnica: **no hay tabla de rachas de los amigos**, ni
«quién va ganando», ni insignias. La constancia anima; la comparación hunde, y
convertir la fidelidad en un marcador volvería esto un escaparate. Las cifras
del perfil salen del propio teléfono y **no las ve ningún amigo**.

**⚠️ Bloqueado esperando a Alex — dos clics en la consola**

`identitytoolkit` responde `CONFIGURATION_NOT_FOUND`: **Authentication no está
activado** en el proyecto. Sin eso, entrar con Google no puede funcionar, y por
eso **no se publica APK todavía**: no se entrega una pantalla que lleva a un
callejón.

1. Consola de Firebase → **Authentication** → *Comenzar*.
2. Pestaña **Sign-in method** → activar **Google** → elegir el correo de soporte
   → Guardar.

Después: volver a bajar `google-services.json` (ahora viene sin los clientes de
OAuth), compilar, probar el acceso de verdad en el móvil y publicar.

**Lo que falta después**

- [ ] Probar el acceso con Google en el móvil de Alex.
- [ ] **Rehacer el formulario de datos de Play Store.** Google pregunta qué se
      recoge y dónde; declararlo mal es motivo de retirada.
- [ ] Decidir qué se ve de un amigo. Hoy: nombre, usuario, foto. Nada más, a
      propósito, hasta decidirlo con cuidado.
- [ ] Invitar por enlace, además de por nombre de usuario.
- [ ] Vigilar el coste. Hoy el plan gratuito sobra de largo, pero deja de ser
      cero en cuanto haya volumen.

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
- [ ] **Más planes.** Sigue queriendo que crezca el catálogo (van 15).

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

## Pendiente de Alex

- [ ] **Reunir 12 probadores** — bloquea la publicación entera
- [ ] Crear la cuenta de Play ($25)
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
