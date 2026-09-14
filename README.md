# Firme

> 🧭 **[HOJA-DE-RUTA.md](HOJA-DE-RUTA.md) primero.** Recoge todo lo pedido, lo hecho
> y lo que falta. Se lee al empezar cada sesión y se actualiza al terminarla.

Aplicación de disciplina diaria: una rutina fija que se repite, las tareas del día
encima, alarma en cada bloque, y en cada alarma el porqué y una frase para no
desmayar.

Es una **PWA**: se instala en el móvil desde el navegador, funciona sin conexión y
todos los datos se quedan en el dispositivo. No hay servidor, ni cuenta, ni base de
datos.

## Comandos

```bash
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # compilación de producción; es la comprobación real de que nada se rompió
npm run preview    # sirve lo compilado
npm run desplegar  # compila y publica en Firebase Hosting
```

No hay framework de pruebas. `npm run build` comprueba tipos y compila todo.

## Estructura

```
src/datos/        tipos, almacenamiento local y el banco de frases
src/logica/       el día, las rachas, el programador de alarmas y el sintetizador de sonido
src/componentes/  las cinco pantallas y las piezas de interfaz
public/           iconos y el añadido al service worker (sw-avisos.js)
```

Alias de importación: `@/*` apunta a `src/*`.

Todo se escribe en español: archivos, variables, comentarios. Los identificadores que
impone una librería se quedan como están.

## Cómo funcionan las alarmas

Tres capas, de más a menos fiable:

1. **Con la app delante o recién usada** — un reloj en la propia app dispara la alarma
   a la hora exacta: pantalla completa, timbre en bucle y vibración.
2. **Con la app en segundo plano** — el navegador conserva los temporizadores un rato;
   si la alarma saltó mientras no mirabas, al volver se recupera (hasta 3 minutos de
   retraso). Además salta la notificación del sistema, que suena aunque la pestaña no
   esté delante.
3. **Con la app cerrada del todo** — aquí la web no llega sola. Hace falta *web push*
   desde un servidor. El service worker (`public/sw-avisos.js`) ya sabe recibirlos; lo
   que falta es quién los mande. Ver «Pendiente» abajo.

Los timbres se sintetizan con Web Audio: no hay archivos de sonido que descargar y
suenan igual sin conexión. El navegador no deja sonar hasta que hayas tocado la
pantalla al menos una vez; si la alarma salta antes de eso, la pantalla lo avisa y el
primer toque arranca el timbre.

## Despliegue

**En producción: https://genuino-pro.web.app**

```bash
npm run desplegar
```

Ya está todo configurado. Hace falta HTTPS para poder instalarla en el móvil, así que
en `localhost` solo se prueba desde el propio ordenador.

### ⚠️ Por qué el despliegue va con *target*

El proyecto de Firebase es **`genuino-host`**, el mismo que aloja **genuinohost.com**.
Ese es el *site* por defecto: un `firebase deploy --only hosting` a secas **sustituiría
la web pública por esta app**.

Por eso Firme vive en un site aparte, `genuino-pro`, atado al target `firme`:

- `.firebaserc` asocia el target `firme` → site `genuino-pro`
- `firebase.json` declara `"target": "firme"` en su bloque de hosting
- el script usa `firebase deploy --only hosting:firme`

Son tres cierres para lo mismo. **No quitar ninguno**, y no desplegar nunca con
`--only hosting` a secas desde este proyecto.

## Pendiente

- **Alarmas con la app cerrada.** Requiere web push: claves VAPID, guardar la
  suscripción, y algo que dispare a la hora exacta. La vía barata es Supabase:
  `pg_cron` cada minuto llamando a una Edge Function que empuje el aviso. El lado del
  navegador (`sw-avisos.js`) ya está hecho.
- **Copia de seguridad automática.** Hoy la copia es manual, desde Ajustes → Exportar.
  Si se borran los datos del navegador, se pierde el historial.
