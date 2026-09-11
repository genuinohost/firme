# Bitácora — Firme

Registro de en qué punto quedó el trabajo. Lo más reciente arriba.
Se actualiza al terminar cada tanda de cambios.

> El contexto permanente (stack, convenciones, cómo funcionan las alarmas) vive en
> `README.md`. Aquí va el relato: qué pasó cada día y qué quedó a medias.

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

4. **Revisar las citas bíblicas.** Van en Reina-Valera 1909 (dominio público). Él es Capellán
   Nacional de los Gedeones: que las repase antes de fiarse.

5. **Copia de seguridad.** Hoy es manual, Ajustes → *Exportar*. Si se borran los datos del
   navegador, se pierde el historial.

## Cabos sueltos del entorno

- El `.claude/launch.json` de **agente-whatsapp** tiene dos entradas añadidas —`firme` y
  `firme-produccion`— porque el panel del navegador lee ese archivo, no el de este proyecto.
  Confirmadas allí junto con su entrada de bitácora.
- Este proyecto tiene su propio `.claude/launch.json` con la entrada `firme`, por si algún
  día el panel aprende a leerlo.
