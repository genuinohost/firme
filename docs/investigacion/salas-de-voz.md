# Las salas de voz — decisiones y trampas

> Verificado contra la documentación oficial el **24 de septiembre de 2026**.
> Se lee **antes** de tocar el código de la sala. Lo que hay aquí ya costó una
> vuelta atrás.

## Qué pidió Alex, en sus palabras

> «Necesito poder llamar a mis amigos a través de la app.» (24-09-2026)
>
> «La app debe tener la capacidad de realizar una llamada grupal. Al menos 30
> personas o más unidas en una llamada para poder leer los devocionales y
> comentarlos.» (24-09-2026)

Las dos frases son el mismo sistema con dos tamaños: una sala de dos y una sala
de treinta. Se construye **una sola**.

## La primera decisión, y por qué se tiró el primer plan

El plan inicial era **WebRTC a mano**: señalización en Firestore, STUN gratis, y
listo. Sirve para dos personas y **no sirve para treinta**.

Sin servidor que reparta, cada móvil se conecta con todos los demás: 30
personas son **29 conexiones y 29 subidas de audio simultáneas por teléfono**.
Ningún móvil aguanta eso, y menos con datos venezolanos.

Un grupo necesita un **SFU**: un servidor al que cada uno sube su voz una vez y
que reparte a los demás. Eso no se improvisa, así que se usa uno hecho.

## Qué proveedor, y cuánto cuesta de verdad

Medido con el consumo real: **30 personas × 45 min = 1.350 minutos×participante
por devocional**, que es la unidad con la que factura todo el mundo.

| Cadencia | min/mes | Agora | LiveKit Cloud | Daily |
|---|---|---|---|---|
| 1 × semana | 5.400 | **$0** | pasa del regalo (5.000) → **$50/mes** | **$0** |
| 2 × semana | 10.800 | **$1/mes** | $50/mes | $3/mes |
| Todos los días | 40.500 | **$30/mes** | $50/mes | $122/mes |

**Agora**, por una razón concreta: cobra el audio aparte del vídeo — $0,99 por
mil minutos frente a $3,99 del vídeo — y regala 10.000 minutos al mes. Los demás
cobran el mismo precio por audio que por vídeo, y aquí **no hay vídeo**.

Fuentes: [Agora](https://docs.agora.io/en/realtime-media/voice/reference/pricing),
[LiveKit](https://livekit.com/pricing),
[Daily](https://www.daily.co/pricing/video-sdk/).

### El presupuesto entero

Devocional semanal (5.400) + llamadas de uno a uno entre los 30 miembros
(~1.800) = **7.200 minutos**, dentro del regalo. **$0/mes.**

## ⚠️ La trampa más importante: el SDK web NO vale dentro de la app

Agora tiene un SDK de JavaScript, y sería lo cómodo: la app es una web dentro de
un WebView. Su propia documentación dice esto:

> El soporte para enviar y recibir audio en apps con WebView integrado
> **depende del dispositivo**.
> — [Agora Docs](https://docs-legacy.agora.io/en/All/faq/web_on_mobile)

«Depende del dispositivo» es exactamente el fallo que esta app lleva un mes
persiguiendo con las alarmas: funciona en el móvil de quien lo programa y no en
el de un hermano, y no hay forma de saberlo hasta que alguien se queda fuera del
devocional.

**Así que en Android va el SDK nativo, envuelto en un plugin de Capacitor
nuestro.** Como `Dictado` y `AlarmaExacta`: el patrón ya está en el repo.

Los plugins de Capacitor para Agora que circulan son de comunidad y con poca
actividad. La superficie que hace falta es pequeña —entrar, salir, silenciar,
quién está hablando— y una dependencia sin mantener en el camino de una promesa
es peor que cien líneas de Java.

En la web (el PWA) sí se usa el SDK de JavaScript, y si un navegador no puede,
se dice y se manda a la app. La sala es de la app; la web es cortesía.

## Los límites, comprobados

- **128 personas hablando a la vez** en un canal, oyentes sin límite. Cada uno
  puede escuchar a 50 a la vez.
  ([Agora Docs](https://docs.agora.io/en/help/general-product-inquiry/capacity))
  Con 30 no hay nada que pensar.
- 30 micrófonos abiertos **no es un devocional, es un ruido**. La sala nace con
  todos en silencio menos quien lee, y hay **mano levantada** para comentar. No
  es una limitación técnica: es lo que hace que se pueda leer y comentar.

## Quién puede entrar: el portero es la Cloud Function

Agora no deja entrar a un canal sin un **token firmado** con el secreto del
proyecto. El secreto **no puede viajar en la app** —quien descompile el APK lo
tendría—, así que lo firma una Cloud Function.

Y eso resuelve de paso el control de acceso, que de otra forma no tendría dónde
vivir: **la función es el portero.** Antes de firmar comprueba que

1. quien pide ha entrado con su cuenta,
2. la sala existe y está abierta,
3. no está expulsado.

Las reglas de Firestore no pueden hacer esto: no saben nada de Agora. Y poner la
puerta en el cliente es no poner puerta.

### ⚠️ Y por eso el portero NO está en Firebase

Lo natural era una Cloud Function, y así se escribió primero. No se pudo
desplegar: **las Cloud Functions exigen el plan Blaze**, Blaze exige tarjeta, y
el 25-09-2026 Google la rechazó con `OR_CCREU_01`.

La causa no es la tarjeta: **Google Cloud no opera en Venezuela**. Venezuela ni
siquiera aparece en la lista de países del formulario, y una tarjeta con
dirección venezolana no pasa aunque se elija otro país. La de Binance, además,
es prepagada, y Google Cloud no acepta prepagadas.

No es algo que se arregle intentándolo otra vez.

**El portero vive en un Worker de Cloudflare**, plan gratuito, sin tarjeta:
100.000 peticiones al día, y un devocional de treinta gasta treinta. El código
de Firebase se guarda en `functions/index.js` marcado como no usado, por si
algún día hay una tarjeta que Google acepte.

Lo que **no** está duplicado es la decisión de quién habla: vive en
`functions/decidir.js` y la importan los dos porteros. La regla que sostiene un
devocional de treinta no puede tener dos versiones.

### Las dos decisiones que hacen que esto no necesite secretos de Google

**Comprobar quién llama.** En una Cloud Function la plataforma te da el `uid`
hecho. Fuera hay que verificar el JWT de Firebase a mano: firma RS256 contra las
claves públicas de Google, y después `iss`, `aud` y `exp`. Los dos pasos hacen
falta — **comprobar la firma y no el contenido no vale de nada**, porque Google
firma los tokens de todos sus proyectos con las mismas claves y un token
legítimo de un proyecto ajeno pasaría.

**Leer Firestore.** Lo normal sería una cuenta de servicio, que lo ve todo y
habría que guardar en Cloudflare. No hace falta: Firestore acepta **el propio
token de la persona** y aplica `firestore.rules` como si leyera ella. Así en
Cloudflare no hay ninguna credencial de Google, y el portero no puede ver nada
que la persona no viera. Lo que decide no es qué ve, sino qué firma.

El precio es que esas tres lecturas tienen que seguir permitidas por las reglas.
Hay tres comprobaciones con ese nombre en `scripts/revisar-reglas.mjs`, porque
si alguien las cerrara por prudencia nadie entraría a ningún devocional y
ninguna otra prueba se enteraría.

## La sala no es una pantalla nueva: es una reunión

`src/logica/comunidad.ts` **ya** trae reuniones de `comunidad.json`, con nombre,
días, hora, zona horaria y `url`. Alex ya publica ese archivo y le llega a todos
en seis horas sin publicar una versión nueva.

Un devocional en Genuino es **una reunión cuya `url` apunta a la sala propia** en
vez de a Zoom. Eso reaprovecha, sin escribir nada:

- cómo se publican y se cambian sin pasar por Google Play,
- el horario y la zona del anfitrión,
- la pantalla «Juntos», donde ya se ven,
- **y la alarma**: el devocional puede ser un bloque de la rutina, y la alarma de
  las 5 de la mañana ya sabe sonar aunque el móvil esté dormido.

Convocar es lo que WhatsApp no sabe hacer y esta app sí.

## Lo que queda fuera de la primera versión, dicho a propósito

- **Vídeo.** No hace falta para leer un devocional, cuesta cuatro veces más y es
  lo primero que se cae en una red mala.
- **Grabar la sala.** Grabar a treinta hermanos comentando su vida es una
  decisión que no se toma de pasada. Si algún día se hace, se pregunta primero y
  se avisa dentro de la sala.
- **El timbre con la app cerrada.** Es la fase 3, y necesita push. Para el
  devocional no bloquea: la alarma ya convoca.

## Desplegar el portero

```bash
cd worker
npx wrangler login                              # abre el navegador, una vez
npx wrangler secret put AGORA_APP_CERTIFICATE   # lo pide por teclado
npm run desplegar
```

Cloudflare da una dirección `https://genuino-portero.<algo>.workers.dev`. **Esa
dirección se publica en `comunidad.json`, en el campo `portero`**, y no va fija
en el APK: si algún día cambia de sitio, con el valor dentro del paquete harían
falta días de revisión de Google Play con el devocional sin dejar entrar a
nadie. El valor por defecto de `src/logica/comunidad.ts` es sólo la red de
seguridad.

## Probar sin cuentas: los emuladores

Todo esto se puede comprobar **sin cuenta de Agora y sin plan Blaze**, porque
firmar un token es matemática local y las reglas corren igual en el emulador.

```bash
npm run revisar-reglas    # las reglas de Firestore, 78 preguntas
npm run revisar-portero   # el portero ENTERO, 28 preguntas
```

`revisar-portero` llama al Worker **igual que lo llama la app** y no necesita ni
Cloudflare ni cuenta ni red: el manejador de un Worker es una función normal. Se
levantan dos cosas de mentira y cada una por su motivo:

- **Las claves de Google**: se genera un par RSA y se publica el juego en un
  servidor local, así las pruebas firman tokens con firma de verdad y **el
  portero no tiene ningún modo de «no comprobar»** — que sería lo cómodo y es
  justo el interruptor que acaba encendido en producción.
- **Firestore**: un servidor local con la forma exacta de su API. Que las reglas
  sean correctas ya lo comprueba `revisar-reglas` con el emulador de verdad.

### Y la app entera contra los emuladores

Para mirar lo que hay detrás de «haber entrado» —abrir un devocional, la lista
de salas— sin usar la cuenta de verdad de nadie:

```bash
echo VITE_EMULADORES=1 > .env.local
npx firebase emulators:start --only firestore,functions,auth --project genuino-host
npm run dev
```

`.env.local` está ignorado por git y **no existe en la máquina que compila lo
que se publica**, así que en el paquete de Google Play esto es la constante
`false` y el código ni se incluye. Al terminar, **borrarlo**: si se queda, la app
intenta hablar con `127.0.0.1` y no funciona nada.

### Tres trampas ya pagadas

**El descubrimiento de funciones tarda más de diez segundos.** Cuando se pasa,
el emulador **no falla: arranca sin funciones**, y todas las llamadas responden
404. Las pruebas no dicen «no se pudo cargar», dicen «esa sala no existe» nueve
veces. Se sube con `FUNCTIONS_DISCOVERY_TIMEOUT=60`, que ya va puesto en
`scripts/revisar-sala.mjs`.

**Los emuladores sobreviven a que se cierre la terminal.** Queda un `java`
ocupando el 8199 y el siguiente arranque falla con «port taken». Se matan por
puerto, no por nombre.

**La entrada con Google no se puede completar desde un panel de navegador**: el
flujo de ventana emergente necesita un opener y responde «No matching frame». Se
entra creando la sesión a mano desde la consola de la página.
