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

**Por eso hace falta el plan Blaze de Firebase.** A este volumen el gasto
esperado es $0 (el regalo de Functions son 2 millones de invocaciones al mes),
pero pide tarjeta.

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
