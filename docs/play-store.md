Plan de publicación en Google Play
=================================

Alex quiere que Firme esté en Play Store para que otros hermanos la usen. Este
documento recoge el análisis y lo que falta, y se va actualizando.

---

## 1. Dónde compite Firme, y dónde no

Buscando lo que ya existe aparece un nicho **saturado**: decenas de apps casi
idénticas llamadas *Devocionales Cristianos*, *Devocional Diario*, *Devocional
español*… y por encima de todas, **Glorify**, con millones de descargas y un
equipo detrás.

> ⚠️ **Entrar como «devocional diario» es pelea perdida.** Misma promesa, mismo
> nombre, y enfrente empresas con presupuesto.

**Firme no es un devocional.** Es otra cosa, y esa diferencia es el activo:

| Las apps de devocionales | Firme |
|---|---|
| Te dan un texto para leer | Te **despierta** y te pide cuentas |
| Contenido para consumir | Una rutina que **cumples o no cumples** |
| Notificación que puedes ignorar | **Alarma de despertador** que atraviesa No molestar |
| Miden lecturas | Mide **rachas y cumplimiento** |
| Para leer | Para **compartir** con tus grupos |

Ninguna app de devocionales te levanta a las tres de la madrugada. Firme sí, y
está construida sobre eso.

### El hueco real

**Disciplina espiritual con alarmas de verdad.** Quien busca «devocional» quiere
leer; quien busca «levantarme a orar» quiere que algo lo despierte. El segundo es
un grupo más pequeño, mucho menos atendido, y mucho más fiel.

### Palabras por las que debería encontrarse

De más específica (poca competencia, alta intención) a más general:

1. **despertador para orar** · **alarma para orar** — nadie lo ocupa
2. **madrugar para orar** · **levantarse a orar**
3. **disciplina espiritual** · **disciplina cristiana**
4. **hábitos cristianos** · **rutina diaria cristiana**
5. **vida devocional** · **oración diaria** — aquí ya hay competencia dura

---

## 2. El nombre

El título de Play Store admite **30 caracteres** y es lo que más pesa para que te
encuentren. «Firme» a secas es corto y bonito, pero **nadie busca «firme»**.

La fórmula que funciona: **nombre propio + lo que hace**.

✅ **Decidido con Alex el 14 de septiembre de 2026.**

Él propuso «Despertador y agenda diaria para cristianos», que describe muy bien la
app y usa las dos palabras que mejor la encuentran. **No cabe: son 43 caracteres.**
Se reparte en dos campos:

| Campo | Límite | Texto |
|---|---|---|
| **Título** | 30 | `Firme: Despertador Cristiano` (28) |
| **Descripción corta** | 80 | `Despertador y agenda diaria para cristianos disciplinados` (57) |

Así el título conserva la marca —lo que se recuerda y se recomienda— y su frase
entera sale bajo el icono, que es donde se lee.

El **nombre del paquete** (`app.genuino.firme`) no se puede cambiar nunca una vez
publicado. El título visible sí.

---

## 3. Lo que Google exige

### Cuenta

- **$25**, pago único.
- **Cuenta personal:** prueba cerrada con **12 personas durante 14 días
  seguidos** antes de poder publicar.
- **Cuenta de organización** (Alexa Lounge, C.A.): se salta esa regla, pero
  necesita número **D-U-N-S** (gratis, semanas de espera).

✅ **Decidido: empezar con cuenta personal y pasar a organización después.**

El tipo de cuenta **no se puede convertir** —personal y organización son cosas
distintas y Google no cambia una por otra—, pero **la app sí se transfiere**, que
es lo que hace viable el plan:

| Se conserva al transferir | Se queda atrás |
|---|---|
| nombre del paquete | informes de pagos y ganancias |
| usuarios y descargas | promociones |
| comentarios y valoraciones | grupos de prueba |
| estadísticas y suscripciones | — |

Sin coste de transferencia; solo los $25 de la cuenta nueva. Tarda unos dos días
laborables. Si la app usa Firebase, hay que desvincularla y volverla a vincular.

**El precio de empezar personal son los 12 probadores durante 14 días**, que
encaja con la semana de prueba interna que pidió Alex — solo que son dos semanas
y doce hermanos.

### Ficha

| Recurso | Requisito |
|---|---|
| Título | 30 caracteres |
| Descripción corta | 80 caracteres — sale bajo el icono |
| Descripción larga | 4.000 caracteres |
| Icono | 512×512 PNG |
| Gráfico destacado | 1024×500 — **obligatorio** |
| Capturas de teléfono | mínimo 2, hasta 8 |
| Política de privacidad | **URL pública obligatoria** |
| Clasificación de contenido | cuestionario |
| Sección de seguridad de datos | declarar qué se recoge |

### Técnico

- **AAB** (Android App Bundle), no APK. Hay que cambiar la compilación.
- **Play App Signing**: Google firma; se sube la clave de subida.
- El almacén de firma actual sirve como clave de subida. **Sigue siendo crítico
  no perderlo.**

---

## 4. Decisiones de producto antes de publicar

### 4.1 El generador necesita un servidor propio

Pedirle a un hermano cualquiera una clave de OpenRouter es un muro infranqueable.
Nadie se crea una cuenta de OpenRouter para usar una app.

✅ **Decidido con Alex:** monta un **servidor propio que él paga**, para que
funcione sin fricción para todos.

- **Coste medido:** unos **9 céntimos de dólar por cada 1.000 mensajes**. Mil
  usuarios generando uno al día salen por unos **2,55 dólares al mes**.
- **Dónde:** Cloudflare Workers, gratis hasta 100.000 peticiones diarias.
- ⚠️ **Lo que no puede faltar: control de abuso.** Sin un límite por dispositivo,
  cualquiera puede vaciarle el saldo en una tarde. Hace falta tope diario por
  aparato y un techo de gasto global.
- ⚠️ La clave de OpenRouter vive **solo en el servidor**, nunca dentro del APK:
  un APK se abre y se lee.

Las reglas de estilo de los mensajes están en `docs/mensajes-whatsapp.md`.

### 4.2 El primer uso tiene que servirle a alguien que no es Alex

Hoy la app abre con una rutina de ejemplo y un «escribe aquí tu razón principal».
Para otro hombre, el primer minuto decide si se queda o la borra. **Falta un
recibimiento** que le pregunte a qué hora se levanta, qué áreas quiere cuidar, y
sobre todo **que escriba su porqué antes de nada**.

### 4.3 ⚠️ Las donaciones no pueden ir por fuera

Alex quiere que quien lo desee pueda donar, para que el proyecto se sostenga.
Bien, pero **no con un enlace a PayPal o similar**.

La política de pagos de Google obliga a que el dinero pase por su sistema. Hay
una excepción para donaciones, pero es solo para **organizaciones sin ánimo de
lucro registradas**, que deben acreditarlo con documentación. Alexa Lounge, C.A.
es una empresa: **no califica**.

> No es teoría: en 2026 le retiraron a **AnkiDroid** —un proyecto grande y
> respetado— la posibilidad de enlazar sus donaciones de Open Collective.

| Vía | Comisión | Riesgo |
|---|---|---|
| **Google Play Billing**, productos tipo «Apoyar el proyecto» | **15 %** | ninguno |
| Enlace externo a PayPal, Binance… | 0 % | **pueden retirar la app** |
| Constituir una ONG y acogerse a la excepción | 0 % | mucho trabajo |

**Recomendado: Google Play Billing.** De cada $10 donados llegan $8,50. Caro,
pero es lo que mantiene la app en la tienda, y una app retirada no recibe nada.

Productos sugeridos: **$1 · $5 · $10**, de una vez, sin suscripción y sin dar
nada a cambio dentro de la app — que la app entera siga siendo gratis para todos.

### 4.4 Los versículos

El banco va en **Reina-Valera 1909**, de dominio público. Correcto para publicar.
La RV1960 que pide Alex **no se puede empaquetar**: es de Sociedades Bíblicas
Unidas. Si se quiere, hay que pedirles permiso por escrito.

---

## 5. Por dónde seguir

Nombre y generador ya están decididos. Queda:

1. **Terminar el banco** hasta los 365. Es lo que da valor el primer día a quien
   la instale, y lo único que no se puede improvisar.
2. **El recibimiento del primer uso** (4.2). Sin esto, el que la instale abre una
   rutina que no es la suya y la borra.
3. **El servidor del generador** en Cloudflare Workers, con tope por dispositivo.
4. **Política de privacidad**, alojada en genuinohost.com. Es obligatoria y no
   cuesta nada: la app no recoge datos, todo vive en el móvil.
5. **Compilar AAB** y preparar la firma de subida.
6. **Gráficos:** icono 512×512, destacado 1024×500 y capturas de pantalla.
7. **Descripción corta y larga**, con las palabras del punto 1.
8. **Cuenta de Play personal** ($25) y reunir a los 12 probadores.
9. **Donaciones** con Google Play Billing (4.3), después de publicar.
10. **Prueba interna** de dos semanas con los doce, como pidió Alex.

> 📌 El orden importa: del 1 al 3 es trabajo de producto, y sin eso la ficha más
> bonita del mundo consigue descargas que se desinstalan al día siguiente.
