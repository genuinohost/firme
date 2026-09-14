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

| Propuesta | Caracteres | A favor | En contra |
|---|---|---|---|
| **Firme: Disciplina con Dios** | 26 | Mantiene el nombre y dice para qué es | «disciplina» se busca menos que «oración» |
| **Firme: Despertador de Oración** | 29 | Ataca la búsqueda que nadie ocupa | Suena solo a alarma, y hace más |
| **Firme: Rutina y Oración Diaria** | 30 | Cubre las dos búsquedas principales | Menos memorable |
| **Madruga con Dios — Firme** | 25 | Describe el uso real, muy evocador | Cambia la identidad de la app |

📌 **Pendiente: que Alex elija.** Es su app y el nombre lo condiciona todo.

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

## 4. Tres decisiones de producto antes de publicar

### 4.1 El generador de mensajes no puede pedir una clave de OpenRouter

Para Alex está bien; para un hermano cualquiera es un muro infranqueable. Nadie
va a crearse una cuenta de OpenRouter para usar una app.

| Opción | Coste para Alex | Experiencia |
|---|---|---|
| **Dejarlo oculto**, solo para quien ponga su clave | $0 | El banco es lo único que ve la mayoría |
| **Servidor propio** que pague Alex | ~$0,09 por cada 1.000 mensajes | Funciona para todos, sin fricción |
| **Quitarlo** de la versión pública | $0 | Más simple, se pierde función |

Con el coste medido, mil usuarios generando un mensaje al día costarían unos
**$2,55 al mes**. No es prohibitivo, pero **escala con el éxito** y necesita un
servidor. Ver `docs/mensajes-whatsapp.md`.

### 4.2 El primer uso tiene que servirle a alguien que no es Alex

Hoy la app abre con una rutina de ejemplo y un «escribe aquí tu razón principal».
Para otro hombre, el primer minuto decide si se queda o la borra. **Falta un
recibimiento** que le pregunte a qué hora se levanta, qué áreas quiere cuidar, y
sobre todo **que escriba su porqué antes de nada**.

### 4.3 Los versículos

El banco va en **Reina-Valera 1909**, de dominio público. Correcto para publicar.
La RV1960 que pide Alex **no se puede empaquetar**: es de Sociedades Bíblicas
Unidas. Si se quiere, hay que pedirles permiso por escrito.

---

## 5. Por dónde seguir

1. **Alex elige nombre.** Desbloquea todo lo demás.
2. Decidir qué pasa con el generador (4.1).
3. Construir el recibimiento del primer uso (4.2).
4. Política de privacidad, alojada en genuinohost.com.
5. Compilar AAB y preparar la firma de subida.
6. Gráficos: icono, destacado y capturas.
7. Redactar descripción corta y larga con las palabras del punto 1.
8. Semana de prueba interna, como pidió Alex.
