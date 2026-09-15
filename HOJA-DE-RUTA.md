Hoja de ruta
============

> **Este documento se lee al empezar cada sesión y se actualiza al terminarla.**
> Recoge **todo** lo que Alex ha pedido, lo que ya está hecho y lo que falta,
> para que nada se pierda por el camino.
>
> La app es de la comunidad cristiana **Genuino Love**, la identidad de Alex
> desde 2014. Eso debe verse en la app y en la ficha de Play Store.

Última revisión: **14 de septiembre de 2026**.

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
