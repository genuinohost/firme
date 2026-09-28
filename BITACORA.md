# Bitácora — Firme

Registro de en qué punto quedó el trabajo. Lo más reciente arriba.
Se actualiza al terminar cada tanda de cambios.

> El contexto permanente (stack, convenciones, cómo funcionan las alarmas) vive en
> `README.md`. Aquí va el relato: qué pasó cada día y qué quedó a medias.

---

# 🧭 28 de septiembre de 2026 — la manito, siempre; y la revisión del timbre en marcha

## «La manito en las llamadas siempre debe estar disponible para pedir permiso para hablar»

Alex, 28-09-2026. Hasta la 6.19 el botón del medio era el micrófono si podías hablar y la mano
si no: con **micrófonos libres** para la lectura, o con la palabra dada, la mano desaparecía, y
quien quería COMENTAR no tenía cómo pedir turno sin abrir el micro encima de la lectura.

Ahora, si puedes hablar y no eres el anfitrión, hay **cuatro botones**: altavoz, micro (grande),
mano y salir, algo más estrechos para que quepan en 360 px. Al anfitrión no le sale: es él quien
da la palabra. El texto de micrófonos libres lo dice: «abre el tuyo cuando te toque leer; para
comentar, levanta la mano». Publicado en la **6.20**.

## En marcha: la revisión del timbre y las salas

Con el mismo método que la del movimiento (cuatro lentes + un escéptico por hallazgo + un
buscador de faltantes), pero sobre lo que de verdad importa: **seguridad** del portero y de las
reglas (¿puede un extraño hacer sonar 30 móviles, sacar un token de publicador, gastar el saldo
de Agora?), el **timbre** de punta a punta (FCM → ServicioAvisos → ServicioAlarma → «te llaman»),
las **salas** (tokens, papeles, micLibre, el anfitrión que se va, el foreground service, lo que
cuesta) y **lo que ve Joseito**. Lo que confirme va a la siguiente versión.

---

# 🧭 28 de septiembre de 2026 — la 6.19: lo que encontró la revisión de la 6.18

## Cómo se revisó

Cuatro revisores independientes leyeron el diff de la 6.18, cada uno con una lente (rendimiento
en el WebView, corrección en React, regresiones de CSS, experiencia y accesibilidad): 29
hallazgos distintos. A cada uno le tocó **un escéptico** con la orden de refutarlo con el código
delante; sobrevivieron **24**, ninguno grave (12 medios, 12 leves), y un quinto revisor buscó lo
que nadie había mirado y trajo 5 más. Los 5 refutados eran o coreografía buscada (Hoy entra dos
veces con la intro, a propósito) o código que ya no existía.

**Lo que más valió fue el escéptico**: cuatro arreglos propuestos eran peores que el defecto
(quitar `will-change` al rodillo, dígitos en `lh` con la tira en `em` —salía «79:80»—, quitar
`pointer-events-auto` al brindis, temporizadores para el brillo). Sin él se habrían aplicado.

## Lo que se arregló (todo en la 6.19)

| Dónde | Qué pasaba | Qué se hizo |
|---|---|---|
| `recien.ts` | Marcar y deshacer en un segundo dejaba `subio`/`reciente` pegados: la siguiente celebración no salía | El estado se fija siempre al resultado; `useAcabaDe` acepta una **clave** (la fecha) |
| Filas | Tocar ‹ para ver ayer «cumplía» cada bloque delante de ti (lavado, tachadura, ✓) | La fila celebra sólo si la fecha no cambió |
| Intro | Con alarma o llamada al arrancar volvía a salir entera al cerrarlas, y remontaba Hoy | Si llegan, el saludo se da por hecho |
| Intro | Con código de bloqueo salía DESPUÉS del PIN, como un peaje | Ahora saluda encima del teclado, pegada al splash |
| Intro | Mientras se disolvía tragaba toques; con «menos movimiento» era una capa invisible 1,4 s | `pointer-events-none` al irse; con «menos», no hay intro |
| ♥ de la cita | Rebotaba al montar si la frase ya estaba guardada (cada vuelta a Hoy) | `useAcabaDe(guardada)`: sólo al guardar |
| La G de la racha | Un svg sin medidas se estiraba a 124 px: tachaba «DÍAS SEGUIDOS» y bajaba a la tarjeta de abajo | `size-14`, pegada al número; y vive 1400 ms, lo que dura su fundido |
| Velos fijos dentro de `main` | Mientras `main` entra transformado, un diálogo `fixed` se desliza con él y salta al asentarse (el editor de rutina al tocar un bloque desde Hoy) | `Capa`: portal al `body`. Rutina, Planes, Hoy (saltar), tarea, aviso del diario |
| Brillo del botón | Mancha quieta 1,8 s al montar; infinito (compositor despierto); permanente con «menos» | `backwards`, 3 pasadas, y `display:none` con «menos» |
| Brasa | Infinita | 3 respiraciones |
| `.toque` | Transicionaba `box-shadow` y `filter` (repintado en hilo principal 600 ms) | Sólo transform y colores; la sombra del botón es fija |
| Rodillo | 700 ms de transición cada segundo en las cuentas atrás; 3 px por debajo de la línea base; al volver del fondo podía dar casi una vuelta entera; debajo de un velo hacía rehacer el desenfoque 40 veces por segundo | `porSegundos` (200 ms en la última cifra); `baseline`; salta al medio ANTES del paso; `:root:has(.velo) .rodillo-tira { transition: none }` |
| Filas apagadas | Entraban a brillo pleno y caían a 0,55 de golpe | `aparece` acaba en `--opacidad-final`; `.fila-apagada` |
| «Menos movimiento» | La fila marcada se ponía de verde macizo; franja de oro quieta | Base `opacity: 0` y `display: none` para los pseudoelementos que sólo existen para animarse |
| Brindis / aviso | Tapaban la última fila 5,2 s sin hacer nada; el segundo aviso nacía un cuadro con la clase de salida | Tocarlos los retira; la bandera se apaga en el mismo temporizador |
| Titular del día completo | `aria-label` en un `<p>` no se anuncia (nombre prohibido): TalkBack no lo leía | `sr-only` + un solo `aria-hidden` |
| Pestaña activa | Tocarla otra vez ponía `--dir` a 0 a media animación: salto lateral | Salir antes si es la misma |
| **Service worker en el APK** | Al instalar una versión nueva, el SW viejo servía la anterior desde caché y a los segundos recargaba solo: dos intros y lo que hubiera a medias, perdido | En nativo no se registra, y los ya instalados se dan de baja |

Comprobado en el navegador: portal en `body`, `0s` de transición bajo el velo y `0.7s` fuera,
lavado a 0.22 y ✓ una sola vez, ♥ quieto al montar y animado al tocar, `baseline`, última cifra
a 200 ms, `.toque` sin `box-shadow`. Sin errores en consola.

## Pendiente

- Que Alex vea la 6.19 en el Xiaomi.
- Lo del timbre (Joseito, Nazdrely) y el certificado de Agora siguen igual.

---

# 🧭 28 de septiembre de 2026 — «los que yo señale»: el dueño nombra desde el móvil

## Lo que faltaba

Alex, al pedir el timbre: «te suena cada vez que yo, y sólo yo (**o alguno de los otros
administradores que yo señale**), hagan la llamada». La primera mitad estaba desde la 6.15: sólo
quien está en `moderadores/{uid}` puede llamar. La segunda no: para señalar a alguien había que
pedírmelo y yo corría `scripts/moderador.mjs` desde este PC con la cuenta de servicio.

## La decisión

Se tomó sin preguntar, porque las alternativas tenían un agujero claro:

| Opción | Qué pasaba |
|---|---|
| Cualquier moderador nombra a otros | «los que yo señale» pasa a ser «los que señale cualquiera que yo señalé»; y uno podría quitar a Alex |
| Una lista aparte de «llamadores» | Dos listas que se desincronizan; el Worker y las reglas ya miran `moderadores` |
| **Dos rangos en la misma lista** | El **dueño** (`dueno: true`, uno, lo pone la cuenta de servicio) nombra y quita desde la app; los moderadores llaman, abren salas y retiran lo ajeno, pero **no nombran a nadie**; al dueño no lo quita nadie, ni él mismo |

Lo hacen cumplir las **reglas del servidor**: crear sólo el dueño y nunca con el campo `dueno`
(no se puede fabricar otro dueño); editar nadie (no hay ascensos); borrar sólo el dueño y nunca
al dueño. La lista entera sólo la ve él. `dueno` va sin ñ porque el lenguaje de reglas no admite
ñ en nombres de campo.

## Qué hay

- `firestore.rules`: `esDueno()`, `moderadorRazonable()` y el bloque nuevo de `moderadores`.
  **13 pruebas nuevas** en `revisar-reglas.mjs` (103 en total, todas pasan), incluidas las dos
  que importan: «nadie edita un moderador (ni para ascenderlo a dueño)» y «al dueño no lo
  quita nadie, ni él mismo».
- `scripts/moderador.mjs dueño correo@`: pone el rango con `updateMask` (sin la máscara, PATCH
  reemplaza el documento entero). `ver` marca DUEÑO y enseña el @usuario.
- `logica/moderadores.ts` + `componentes/QuienPuedeLlamar.tsx`: en **Juntos**, debajo de la
  comunidad de voz, una tarjeta que sólo ve el dueño: la lista, «Quitar», y un campo para nombrar
  por @usuario. Quien no tiene perfil no se puede nombrar, y se dice.
- **Alex ya es dueño en producción** y las reglas están desplegadas. La tarjeta le saldrá con la
  6.19 (en la web de `genuino-pro.web.app` ya está).

## Pendiente

- ~~Publicar la 6.19~~ — publicada con la revisión, ver la entrada de arriba.

---

# 🧭 28 de septiembre de 2026 (madrugada) — «quiero más power»: el movimiento con peso

## Lo que pidió, en dos tiempos

Por la mañana del 27: «una muy breve intro… cualquier mínima actividad que hagas debe tener alguna
reacción, alguna animación, todo sutil, todo suave». Salió la **6.17**: una curva, tres tiempos,
la intro de un segundo, las pantallas que se posan, el ✓ que rebota.

Por la noche, viéndola en el móvil: **«casi no se notan los efectos y el dinamismo: quiero más
power. Tienes que superar al Joseito»**. Tenía razón: era correcta y no se sentía.

## Cómo se decidió la 6.18

No a ojo. Se pidieron **tres propuestas independientes** de sistema de movimiento y se hicieron
juzgar por dos jueces con la misma rúbrica (carácter, coherencia, rendimiento en WebView, respeto
a «reducir movimiento»):

| Propuesta | Idea | Nota |
|---|---|---|
| **Peso propio** | Todo se mueve con resortes: se pasa un pelo y vuelve, como algo con masa | **7,9 / 8,2 — ganó** |
| Enfoque | Cinematográfico: el logo enfoca como una cámara, destello donde cae el dedo | injertos |
| Linotipia | Editorial: el ✓ se dibuja, la G se traza, la cabecera a tiempos, la fecha pasa página | injertos |

Lo que faltaba no era velocidad: era **peso**. Una curva Bézier frena y se para; un resorte se pasa
y vuelve. Las cuatro curvas de la 6.18 son resortes muestreados en 29 puntos (`linear()`), con
Bézier de repuesto para WebViews viejos. Viven en `estilos.css` **y** en `logica/resorte.ts`
—la misma mano para CSS y para la Web Animations API.

## Lo que hay en la 6.18

- **Intro** de 1,4 s: el logo *enfoca* (copia borrosa que se disuelve mientras la nítida llega con
  resorte, destello a los 480 ms), «Genuino» letra a letra, y al irse **Hoy vuelve a entrar
  debajo** (`escena` en la clave de `<main>`). Se salta con un toque.
- **Cambiar de pantalla**: la nueva llega **desde el lado hacia el que se fue** (`--dir`), baja y se
  posa con rebote. La marca de la barra **se estira a mitad de camino** —más cuanto más lejos
  salta— y se recoge (WAAPI en `useLayoutEffect`, sin `fill`). El icono activo sube y crece.
- **El dedo**: hunde en 80 ms sin rebote, vuelve con resorte en 600 ms, y **se ilumina justo donde
  cayó el dedo** (`seguirElDedo()` pone `--x/--y`; el CSS pinta el destello). La fila entera
  responde al tocar cualquier cosa dentro.
- **Cumplido**: el ✓ entra girando con resorte y suelta un anillo, **el trazo del ✓ se dibuja**, la
  fila se lava de verde y el nombre **se tacha de izquierda a derecha**. Sólo en la fila que se
  acaba de marcar (`useAcabaDe`), nunca al abrir la pantalla.
- **La racha rueda** como un cuentakilómetros (`Rodillo`, sólo transform) y, al subir, **la G del
  icono se traza en oro detrás** y el número crece. Los segundos de la cuenta atrás también ruedan.
- **Día completo**: catorce motas de oro salen del botón que se tocó (`celebrarDia`, WAAPI en una
  capa que se quita a los 1100 ms), un barrido de oro cruza la tarjeta, el titular sube palabra a
  palabra, se dibuja un filete, y la tarjeta queda con **brasa**.
- La cabecera de Hoy entra a tres tiempos; la fecha **pasa página** al cambiar de día; las
  etiquetas de sección llevan filete; el botón Cumplido tiene halo y un reflejo cada 7 s.
- **«Menos movimiento»** en Ajustes. Con eso o con «reducir movimiento» del móvil, `App.tsx` pone
  `<html data-movimiento="menos">` y todo queda quieto en su estado final.

## Comprobado

Con fotogramas **congelados** en el navegador (pausando `document.getAnimations()` a 330 y
640 ms): la G dibujándose, el barrido, el anillo del ✓, la tachadura a medias, el dígito rodando.
Y en vivo: 14 motas creadas, `data-movimiento` puesto y quitado desde Ajustes, `--dir` 1 y -1
según el sentido, `linear()` reconocido por el navegador. Cero errores en consola.

**Sin probar en el móvil todavía.** El WebView de un Xiaomi de gama media es la prueba real.

## Regla que se aprendió

**Un `requestAnimationFrame` no dispara con el panel del navegador oculto**: un script que lo
esperaba se colgó 45 s. Para congelar animaciones basta forzar el reflow (`el.offsetWidth`).

## Pendiente

- Que Alex vea la 6.18 en su móvil y diga si es «más power» o pasado de vueltas. Luego, las
  referencias de José que prometió mandar.
- El timbre: Joseito con permisos y pantalla apagada; Nazdrely y Play Services.
- Regenerar el certificado de Agora (se pegó en el chat) y volver a poner el secreto.
- 5 probadores de 12 para Play.

---

# 🧭 27 de septiembre de 2026 (noche) — el timbre sonó de verdad, y lo que Joseito vio

## 🟢 Sonó

Joseito grabó su móvil: **con la app cerrada, le sonó**, desbloqueó, tocó *Entrar* y entró a la
sala de Alex como oyente. «Devocional · 2 dentro». La cadena entera del timbre —el móvil apuntado
al tema, el Worker con la cuenta recortada, FCM, `ServicioAvisos`, `ServicioAlarma`, la pantalla
«Te llaman»— funcionó a la primera llamada real.

Medido en el audio del vídeo: sonido continuo del segundo 1 al 28, silencio justo al tocar
*Entrar*, y después el audio de la sala.

## Antes de eso: «Llamando» a nadie

La primera llamada de Alex salió a un tema **vacío**: ni Joseito ni Nazdrely estaban
apuntados. Google acepta un aviso a un tema aunque no haya nadie, y el botón repitió «Llamando»
como éxito. Ahora el botón dice **«Llamando a N»**, y si N es cero lo dice antes de llamar.

Nazdrely tiene cuenta y perfil desde el 18 y aun así no pudo apuntarse: lo que le falla es
apuntar **su móvil** a los avisos de Google (Play Services / permiso de notificaciones). El
mensaje era «mira tu conexión»; ahora distingue Google de la red.

## Lo que Joseito vio, y las tres correcciones

> «Me estaba sonando el teléfono, pero en ningún lado me aparecía una notificación ni nada
> visible. Tuve que buscar a mano entre las notificaciones qué era lo que sonaba. Y suena
> como una alarma, no como una llamada de un grupo: me aparece pausar o posponer 10 min.»

| Lo que vio | Por qué | Arreglo (6.16) |
|---|---|---|
| Sólo una notificación enterrada, sin pantalla | En su Xiaomi faltan dos permisos de MIUI («ventanas emergentes en segundo plano» y «mostrar en pantalla de bloqueo»); sin ellos una app en segundo plano no puede poner nada encima, y la pantalla completa no sale | Al apuntarse, la app mira el móvil y pide **sólo lo que falta**, con botón: pantalla completa, ahorro de batería, inicio automático, y en Xiaomi los dos de MIUI |
| «Parar / Posponer 10 min» | Era la notificación de las alarmas | Estilo de **llamada entrante** (`CallStyle`), el mismo del teléfono: arriba del todo, **Responder / Rechazar**, no se quita de un manotazo. «Ahora no» además olvida la llamada |
| Suena a alarma | Tono de alarma | Para llamadas, **el tono de llamada** del móvil. Sigue por el flujo de alarma: suena en No molestar y en silencio |

## Comprobado

Java compila con los tres cambios; 43 del Worker; 90 reglas. **Sin probar todavía**: que con la
pantalla apagada se encienda sola en el Xiaomi de Joseito — depende de que active los permisos
que ahora la app le pide.

## Pendiente

- Que Joseito active los permisos y Alex vuelva a llamar con su pantalla apagada.
- Nazdrely: actualizar Play Services y reintentar «Unirme».
- Regenerar el certificado de Agora.
- 5 probadores de 12 para Play.

---

# 🧭 27 de septiembre de 2026 (tarde y noche) — «Funciona PERFECTO», y el timbre

## 🟢 La primera voz que cruza el sistema entero

Alex, con dos móviles: **«Funciona PERFECTO»**. Él de anfitrión, su mamá (Fanny) con la palabra.
Firebase → Worker en Cloudflare → token de Agora → SDK nativo → micrófono → «se te está
oyendo». Todo lo de tres días, de punta a punta, por primera vez.

## Tres versiones en un día

**6.12** — la app se trababa en una alarma sin contestar y las siguientes se perdían en
silencio (cola); la segunda alarma ya no hereda el corte de la primera; el aviso de parar
vuelve arriba cada 15 s y va coloreado. **La descarga no funcionaba desde Venezuela**: GitHub
redirige a `objects.githubusercontent.com` y se cae. Firebase Hosting niega los APK en Spark
con todas las letras. Lo sirve el Worker, reanudable. Y el APK pasa de 62,6 a 31,2 MB
quitando las dos arquitecturas de emulador.

**6.13** — «Compartir la app»: manda el archivo mismo por WhatsApp/Bluetooth/Compartir cercano.
Play Protect bloquea en el móvil de la mamá: *Más detalles → Instalar de todos modos*. Le va a
pasar a todos hasta estar en Play. **Y las reglas de las salas no estaban en producción**: se
cambiaron en dos commits después del último despliegue. Desde hoy `npm run desplegar` pasa las
reglas por el emulador y las sube con la web, siempre.

**6.14** — botones como los de WhatsApp (SVG, no emoji) y **micrófonos libres**: interruptor
del anfitrión, «Con permiso» / «Libres», enforzado en el token. Al recibir libres, el propio
queda cerrado — como en WhatsApp.

## El timbre (6.15)

Alex: «VITAL que yo pueda hacer que le suene la llamada a los que voluntariamente están
dentro del grupo de voz […] cada vez que yo, y sólo yo (o los administradores que yo señale),
hagan la llamada». Eligió **las dos**: alarma a hora fija y llamada espontánea por push.

| Pieza | Dónde | Cómo |
|---|---|---|
| Apuntarse | el propio móvil | se suscribe al tema `devocional`; sin lista de tokens en ningún servidor |
| Llamar | Worker `/llamar` | verifica sesión, que quien llama **modera**, que la sala está abierta; **un** aviso al tema |
| Sonar | `ServicioAvisos` → `ServicioAlarma` | aviso de datos, prioridad alta; suena con la maquinaria de las alarmas |
| Entrar | `App.tsx` | «Te llaman al devocional» → Entrar / Ahora no; llamadas de más de 10 min se olvidan |
| A hora fija | `BloqueRutina.sala` | «Ponerla en mi rutina» convierte la reunión en bloque; la alarma ofrece «Entrar al devocional» |

### La única llave de Google que hay en Cloudflare

`genuino-timbre@genuino-host.iam.gserviceaccount.com`, **recortada**: sólo puede enviar avisos.
La clave entró por tubería directa a `wrangler secret put FCM_CUENTA`, sin tocar disco ni
imprimirse. Alex lo decidió con el riesgo delante (lo peor: avisos falsos; se revoca en un
minuto).

⚠️ **Le falta el permiso**, y sólo Alex puede darlo: la cuenta de despliegue no tiene
`setIamPolicy`. En Google Cloud → IAM → añadir `genuino-timbre@…` con el rol **Firebase Cloud
Messaging API Admin**. Hasta entonces «Llamar» devuelve error del portero.

### Comprobado

**42** del Worker (con un Google y un FCM de mentira y una clave RSA real en el formato exacto
de Google: quien no modera → 403 y ningún aviso; quien modera → un aviso al tema con sala,
nombre y quién; el token de Google se pide una vez y se reutiliza) · **90** reglas (nadie ve si
otro está apuntado; la lista sólo quien modera) · **23** de la decisión · Java compila con
Messaging · web compila.

**No probado todavía**: que un móvil suene de verdad. Necesita el permiso de arriba y dos
teléfonos.

## Pendiente

- ⚠️ **El rol de FCM** para `genuino-timbre@…` (Alex, en la consola).
- Regenerar el certificado de Agora (quedó en el chat).
- El parte de las alarmas con la 6.12+.
- 5 probadores de 12 para Play. Play Protect lo va a pedir a cada uno hasta entonces.
- Lista de «quién puede llamar» desde la app (hoy: los que moderan, desde la consola).

---

# 🧭 27 de septiembre de 2026 — el portero en Cloudflare, y las salas publicadas

## 🔴 Google Cloud no opera en Venezuela

Al activar Blaze, la tarjeta rechazada: `OR_CCREU_01`. La causa **no es la tarjeta**. Venezuela
ni siquiera aparece en la lista de países del formulario, y una dirección venezolana no pasa
aunque se elija otro país. La de Binance además es prepagada, y Google Cloud no acepta
prepagadas.

No se arregla intentándolo otra vez. **El portero se mudó a un Worker de Cloudflare**: gratis,
sin tarjeta, 100.000 peticiones al día. Un devocional de treinta gasta treinta.

### Las dos decisiones que evitan guardar secretos de Google en Cloudflare

**Comprobar quién llama.** En una Cloud Function la plataforma da el `uid` hecho; fuera hay que
verificar el JWT a mano. Firma RS256 contra las claves públicas de Google, y **después** `iss`,
`aud` y `exp`. Los dos pasos: Google firma los tokens de **todos** sus proyectos con las mismas
claves, así que uno legítimo de un proyecto ajeno pasaría la firma.

**Leer Firestore con el token de la propia persona**, no con una cuenta de servicio. Firestore
aplica las reglas como si leyera ella. Así en Cloudflare no hay ninguna credencial nuestra, y el
portero no puede ver nada que ella no viera. Lo que decide no es qué ve, sino qué firma.

El precio: esas tres lecturas tienen que seguir permitidas. Hay tres pruebas con ese nombre en
`revisar-reglas.mjs`, porque si alguien las cerrara por prudencia nadie entraría a ningún
devocional y **ninguna otra prueba se enteraría** — las del Worker usan un Firestore de mentira.

### Y no hay modo de «no comprobar»

Sería lo cómodo para las pruebas y es justo el interruptor que acaba encendido en producción.
En vez de eso, las pruebas **generan su propio par de claves RSA** y firman tokens de verdad.
El código que corre en las pruebas es el mismo que corre de verdad, sin ramas.

## Tres errores míos, encadenados

1. **Le di los pasos al revés.** `wrangler secret put` guarda el secreto *dentro* del Worker, así
   que no puede correr antes del primer despliegue. El error lo decía con todas las letras.
2. **Le di una ruta de Git Bash** (`/c/Users/...`) y la pegó en el Símbolo del sistema.
3. **Al limpiar `firebase.json` quité el emulador de autenticación**, que hace falta para el
   flujo que yo mismo había documentado. Repuesto.

## El certificado, expuesto

Alex lo pegó en el chat. No es una emergencia —la conversación es suya— pero **queda pendiente
regenerarlo en Agora** y volver a ponerlo con `wrangler secret put`.

## Publicado

- **Worker:** `https://genuino-portero.genuinohost.workers.dev`, con el certificado ya guardado.
- **6.11 (53)** en GitHub Releases, y `version.json` anunciándola.
- **`comunidad.json`** lleva la dirección del portero, así que mudarlo no cuesta una versión de
  Play.

## Tocar una reunión ahora la abre

Una reunión dice **a qué hora** hay devocional; la sala es **el sitio**. Hasta hoy, tocar una
reunión a su hora contestaba «esa sala no existe» — verdad, e inútil: el anfitrión estaba
delante, queriendo empezar, y la app lo mandaba a buscar otro botón.

Ahora, si la sala no existe y quien llega puede abrirla, se le ofrece ahí mismo. Y el botón ya
no dice «Enlace», que prometía salir de la app.

## El tamaño

El APK pesa **62,6 MB** porque carga las cuatro arquitecturas. Por Play cada móvil se baja la
suya, unos 20 MB. Si molesta instalarlo a mano, quitando las dos de emulador (x86) bajaría a
unos 31.

## Comprobado

**28** del portero (firma rota, caducado, otro proyecto, sin firmar, expulsado, sala cerrada,
roles, CORS) · **78** reglas · el APK se descarga (200) · los dos JSON dicen lo que deben.

## Lo que falta

- ⚠️ **Que suene.** Nada de esto se ha oído todavía. Hacen falta dos móviles.
- Regenerar el certificado de Agora.
- Fase 3: el timbre con la app cerrada.

---

# 🧭 24 de septiembre de 2026 (madrugada) — las salas de voz

Alex, dos mensajes seguidos: «necesito poder llamar a mis amigos a través de la app» y luego
«la app debe tener la capacidad de realizar una llamada grupal. Al menos 30 personas o más
unidas en una llamada para poder leer los devocionales y comentarlos».

Son el mismo sistema con dos tamaños. Se construye **una sola sala**.

## 🔴 Se tiró el primer plan, y mejor así

El plan era **WebRTC a mano**: señalización en Firestore, STUN gratis, cero proveedores.
Sirve para dos personas y **no sirve para treinta**: sin un servidor que reparta, cada móvil
se conecta con todos los demás — 29 conexiones y 29 subidas de audio simultáneas por
teléfono. Ningún móvil aguanta eso, y menos con datos venezolanos.

Se tiró al recibir el segundo mensaje, antes de escribir la primera línea del motor. Si el
mensaje hubiera llegado dos días después, se tiraba con el trabajo hecho.

## Tres decisiones, las tres medidas

**Agora, no LiveKit ni Daily.** Cobra el audio aparte del vídeo —$0,99 frente a $3,99 por mil
minutos— y regala 10.000 al mes. El devocional semanal gasta 5.400.

| Cadencia | Agora | LiveKit | Daily |
|---|---|---|---|
| 1 × semana | **$0** | $50/mes | $0 |
| Todos los días | **$30/mes** | $50/mes | $122/mes |

**SDK nativo, no el de JavaScript.** Su propia documentación: el soporte de audio en apps con
WebView «depende del dispositivo». Eso es exactamente el fallo que este proyecto lleva un mes
persiguiendo con las alarmas — funciona en el móvil de quien programa y no en el de un
hermano. Así que plugin de Capacitor propio, como `Dictado` y `AlarmaExacta`.

**La versión del SDK, elegida midiendo:**

```
4.5.2.135        28,5 MB   <- esta
4.5.3.3.BASIC    27,2 MB
4.5.3.4.1        68,7 MB
4.6.3.1          72,3 MB
```

Desde 4.5.3 las compilaciones normales empaquetan los modelos de supresión de ruido por IA y
**triplican el tamaño**. Actualizar a ciegas se lleva la app de ~20 MB a ~40.

Coste real medido en el APK: **15,1 MB de librerías nativas** para un móvil arm64.

## La regla de la que depende todo

**Nadie se da la palabra a sí mismo.**

30 micrófonos abiertos no son un devocional, son un ruido. Se entra escuchando, se levanta la
mano, y el anfitrión da la palabra. Y eso **no se cumple por educación**:

1. El rol viaja **firmado dentro del token** de Agora. Comprobado leyendo el código de la
   librería, no de memoria: con rol `SUBSCRIBER` el token **no lleva el privilegio de publicar
   audio**. El oyente no es alguien a quien la app no le enciende el micrófono — es alguien
   cuyo permiso no incluye encenderlo. Un APK modificado no se salta esto.
2. El token lo firma una **Cloud Function**, porque el certificado de Agora no puede viajar en
   la app. Esa función es la puerta: comprueba cuenta, sala abierta y no expulsado.
3. Quién tiene la palabra vive en `salas/{canal}/dentro/{uid}.palabra`, y **las reglas de
   Firestore sólo dejan moverlo al anfitrión**: al tocar tu propia ficha, ese campo tiene que
   quedarse exactamente como estaba.

Si la regla 3 cediera, cedería el audio. Tiene una prueba con ese nombre:

```
ok   NADIE SE DA LA PALABRA A SI MISMO - de esto depende el audio
```

## La sala no es una pantalla nueva: es una reunión

`comunidad.ts` **ya** traía reuniones de `comunidad.json` con nombre, días, hora y zona. Un
devocional de Genuino es una reunión cuya `url` apunta a la sala propia en vez de a Zoom:

```
genuino://sala/devocional-manana
https://genuino-pro.web.app/sala/devocional-manana   ← para pegar en WhatsApp
```

Eso reaprovecha, sin escribir nada: publicar y cambiar sin pasar por Google Play, el horario,
la pantalla «Juntos» — **y la alarma**. Convocar es lo que WhatsApp no sabe hacer y esta app
sí.

## Dos cosas que se descubrieron haciéndolo

**`agora-token` es CommonJS.** Un `import { RtcRole } from "agora-token"` falla al **cargar el
módulo**, no al escribirlo: habría reventado al desplegar. Se vio al ejecutarlo.

**Android 14 corta el micrófono** a una app en segundo plano sin servicio en primer plano de
tipo `microphone`. Sin eso, mirar una notificación a mitad del devocional te saca de la sala —
y en silencio. De ahí `ServicioSala`.

## Comprobado

- **74 reglas de Firestore**, 17 nuevas de las salas.
- **20 del portero**, incluidas las que leen los privilegios dentro del token.
- El **Java compila contra el SDK de verdad**: cada llamada a Agora que escribí existe.
- El **APK entero se ensambla**: BUILD SUCCESSFUL.
- La app arranca y «Juntos» se pinta sin errores de consola.

## Lo que falta

- ⚠️ **El App ID de Agora.** Cuenta gratuita, sin tarjeta. Sin él no hay voz.
- ⚠️ **El plan Blaze de Firebase**, para la Cloud Function. Gasto esperado $0, pide tarjeta.
- Desplegar el portero y poner el secreto `AGORA_APP_CERTIFICATE`.
- Probar con dos móviles de verdad. Nada de esto se ha oído todavía.
- Fase 3: el timbre con la app cerrada (push + pantalla de llamada). Para el devocional no
  bloquea, porque la alarma ya convoca.

---

# 🧭 24 de septiembre de 2026 (noche) — llamar a un hermano, y la copia que casi se borra sola

## Llamar, y a quién

Alex: «necesito poder llamar a mis amigos a través de la app. Por ejemplo, quiero llamar
a Joseito.»

En la ficha de cada hermano, **«Llamarle» primero y en botón fuerte**, encima de escribir
por WhatsApp. Es el marcador del teléfono con el número puesto: se abre y decide él.

> ⚠️ **WhatsApp no deja empezar una llamada desde un enlace**, sólo abrir la conversación.
> Prometer «llamada de WhatsApp» sería mentir, así que no se promete.

Y la otra mitad, que es la que vale: **la app dice a quién buscar**. Un nombre, el motivo,
y el botón para llamarle. `src/logica/aQuienBuscar.ts`.

**Un nombre, no una lista.** Una lista de cinco hermanos a los que convendría llamar se
mira, se siente culpa y se cierra. Un nombre se llama.

Tres señales, por orden de fuerza:

| Señal | De dónde sale |
|---|---|
| Se le rompió la racha | **De este móvil**, que recuerda qué racha llevaba cada uno. Cero datos nuevos publicados. |
| Lleva días en cero | Cayó hace tiempo y no se ha levantado. El que menos se nota. |
| Hace mucho que no le buscas | Mide lo tuyo, no lo suyo. Funciona con quien tiene las rachas apagadas. |

Con el tiempo la tercera será la que más suene, y está bien: lo normal entre hermanos no
es que alguien se esté cayendo, es que se dejó de llamar.

El hermano **no se entera** de nada de esto. Sólo se lee lo que él ya decidió publicar.

## La copia en la nube — y el fallo que casi se publicó

Alex: «los datos básicos deberían estar en una nube, porque no todo el mundo va a estar
pendiente de exportar una copia». Tenía razón, y era un fallo de diseño: pedirle a alguien
que exporte un respaldo «por si acaso» es pedirle que piense en perder el móvil **antes**
de perderlo.

Sube la rutina, los planes, las tareas y los registros. **No sube el diario**, ni la excusa
que alguien escribió al saltarse algo, ni en qué áreas cayó.

### 🔴 Y esto es lo que hay que recordar de hoy

La primera versión subía la copia cada veinte segundos sin mirar qué había arriba. Léase
la secuencia entera:

1. Alguien reinstala la app → rutina de ejemplo, cero historial.
2. Entra con su cuenta **para recuperar lo suyo**.
3. Veinte segundos después, la copia automática sustituye sus 43 días por el teléfono vacío.
4. Todavía no ha llegado a tocar el botón de traerla.

**El respaldo escrito para que nadie pierda su racha habría sido el que la borra**, y sin
un solo mensaje de error. Se encontró antes de compilar, leyendo la secuencia en voz alta.

Arreglo: la subida automática **se niega a pisar una copia con más historial que este
teléfono**. Se comprueba una vez por ejecución — cuesta una lectura al abrir la app y
compra que el caso del móvil nuevo sea imposible, no improbable. El botón de «Guardar
ahora» sí puede pisarla, pero pone los dos números delante y el botón peligroso no es el
fuerte.

### La regla es la promesa

`usuarios/{uid}/respaldo/rutina`, **sólo su dueño** — ni los hermanos aceptados, que sí
pueden leer el WhatsApp. Y la regla lista los campos que caben: **el diario no está en la
lista, así que no cabe**. No depende de que la app se acuerde de quitarlo.

`npm run revisar-reglas`: **57 comprobaciones, sin problemas** (9 nuevas). La que importa:

```
ok   EL DIARIO NO CABE en la copia, ni mandandolo a proposito
```

Lo que las reglas **no** pueden vigilar es lo que va dentro de `registros`: no saben
recorrer un mapa. Que la excusa de cada día se quede en el móvil lo decide
`src/logica/respaldoNube.ts`, en un solo sitio y a propósito.

## Precios, para el devocional de ~30

| Cadencia | Agora | LiveKit | Daily |
|---|---|---|---|
| 1 × semana | **$0** | $50/mes | **$0** |
| Todos los días | **$30/mes** | $50/mes | $122/mes |

Pero **la llamada de grupo de WhatsApp aguanta 32**, que es justo el tamaño. Lo que
WhatsApp no da, y sí vale dinero, es **convocar**: la alarma a la hora, quién vino, quién
lleva tres días sin cumplir. Eso Genuino ya lo puede hacer.

## Lo que queda

- ⚠️ **Desplegar las reglas** (`firestore:rules`). Hasta entonces «Guardar ahora» falla.
  La 6.10 no debe salir antes que esto.
- Subir la 6.9 a la prueba interna y hacer las dos declaraciones de Play.
- Faltan 5 probadores de los 12.
- **Exportar los datos antes de reinstalar desde Play**: la firma es distinta y hay que
  desinstalar.
- Cifrar el diario, cuando la prueba cerrada esté corriendo.
- Decidir qué hace `allowBackup` de Android con el diario. Sigue sin respuesta.

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


---

# 21 de septiembre · «Debes ser fructífero», el primero con el estilo medido

El vídeo de marzo, grabado en una avenida de Caracas. Montado con las piezas
nuevas: apertura a pantalla partida con titular quieto, B-roll en bloques,
cortes secos sin deriva, rótulos de 2–4 palabras sin dorado, cierre sobre su
cara. **La cara ocupa el 23 % del alto** (en Filipenses era el 12 %): sigue
lejos del 32 % de Daniela, pero se nota en cada plano.

**El audio no se limpió, y es un resultado, no una omisión.** Cuatro
tratamientos medidos contra el original, transcribiendo cada uno con large-v3:

    original             200 palabras · confianza 0,959 · dudosas 4
    sólo EQ              198 · 0,958 · 6
    DeepFilterNet 12 dB  199 · 0,953 · 6
    DeepFilterNet 20 dB  200 · 0,937 · 6
    DeepFilterNet tope   192 · 0,940 · 8
    DF 20 + post-filtro  203 · 0,933 · 12

Gana el original en todo. Y los cinco garabatean el mismo tramo (12–17 s), o
sea que ahí no se entiende en la grabación, no en el proceso. Queda una
prueba de oído con Alex: tres versiones de diez segundos, que elija él.

Cinco fallos, y de dónde salió cada uno:

- **`sanear()` colgado para siempre** porque mi transcripción escribió `f`
  donde el agrupador espera `fin`: NaN, las dos comparaciones falsas, bucle
  infinito, cuarenta minutos sin un mensaje. Ahora valida al entrar.
- **El B-roll llevaba la corrección de color de su piel** y salía turbio. Lo
  vi en la primera hoja de fotogramas. Ahora va aparte.
- **El bosque entraba negro**: no era el clip, era mi fundido de 0,2 s en un
  corte que cae sobre un golpe. Los tres referentes cortan en seco; quitado.
- **La música 32 dB por debajo de la voz**, o sea muda: el ruido de la calle
  mantenía el agachado pisado todo el rato. Con volumen 1,9 y ratio 3, 16 dB.
- **El rótulo sobre la cara en 11 muestras**, que sólo vio el comprobador.
  Los rótulos bajaron de 0,60 (la altura de los referentes) a 0,73: ellos
  graban en estudio con la cara alta, y Alex ocupa más cuadro.

**Y al verlo él, dos cosas más.** «Los B-roll duran mucho y son pocos: mejor
más y que duren menos» — de 4 bloques de 3 a 5,6 s (28 % del vídeo) a **7
insertos de 1,4–1,6 s** (16 %), y de 24 a 29 planos. Su metraje tiene energía
propia; los bloques largos de Daniela Pol funcionan porque ella está sentada
y quieta en un estudio.

Y «el primer B-roll no queda bien a mitad de pantalla»: el bosque es un clip
9:16 metido en una franja de 1080×652, así que **se perdía el 66 % del
cuadro** y quedaba una tira de troncos sin cielo ni suelo. Se probaron los
seis clips recortados a esa franja: el árbol y la silueta componen bien pero
sus cielos claros **se comen el titular**; ganan las naranjas, que tienen el
follaje oscuro y son, además, el fruto del que habla el texto.

**Corrección a lo que escribí antes:** dije que los cuatro vídeos anteriores
llevaban el `pl=1` y **no es cierto**. Se montaron antes de reescribir
`color.py` y llevan la corrección vieja. El único afectado fue éste, y ya
está arreglado. Casi le hago gastar una hora de máquina para producir cuatro
archivos idénticos a los que ya tenía.
