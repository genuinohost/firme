/**
 * Las dos comprobaciones que no se pueden saltar antes de publicar nada.
 *
 * Estaban escritas dentro de `publicar-release.mjs`, que sólo se usa para el
 * APK de GitHub. **El AAB de Google Play no pasaba por ninguna de las dos**, y
 * es justo el que peor perdona: un APK mal publicado se reemplaza en cinco
 * minutos; una versión subida a Play se queda con ese número **para siempre**,
 * y un nombre real colado dentro lo leen todos los que instalen desde la
 * tienda.
 *
 * Así que viven aquí, en un sitio, y las usan los dos.
 */
import { readdirSync, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Que la web compilada lleve la misma versión que el manifiesto de Android.
 *
 * El 17-09-2026 se publicó una 4.7 que por dentro era la 4.6: `cap sync` copia
 * lo que haya en `dist`, y `dist` se había compilado antes de subir el número.
 * El manifiesto decía 29 y el JavaScript 28, así que la app pedía actualizarse
 * **para siempre** y al instalar no se callaba.
 */
export function laWebCuadra(nombre, carpeta = "dist/assets") {
  if (!existsSync(carpeta)) return false;
  for (const archivo of readdirSync(carpeta)) {
    if (!archivo.endsWith(".js")) continue;
    if (readFileSync(join(carpeta, archivo), "utf8").includes(`"${nombre}"`)) return true;
  }
  return false;
}

/**
 * Que no se publique con datos personales del dueño dentro de la app.
 *
 * ── Por qué mira `dist` y no `src` ────────────────────────────────────────
 *
 * Al principio miraba el código fuente, y **se equivocaba en las dos
 * direcciones**: saltaba por los comentarios —que explican de dónde salió cada
 * decisión y nombran a quien la pidió, pero **no llegan al teléfono de nadie**,
 * porque el compilador los tira— y podía dejar pasar algo que sí llega.
 *
 * Lo que importa no es lo que está escrito, sino **lo que acaba dentro del
 * paquete**. Si un nombre aparece ahí, alguien lo va a ver.
 *
 * ── Y por qué con límites de palabra ──────────────────────────────────────
 *
 * Sin ellos, `alex` casaba dentro de `InternalException` —«Intern·alEx·ception»—
 * en el bundle de Firebase, y el guardián se ponía rojo en cada publicación.
 * Un aviso que salta siempre se acaba ignorando, y entonces no sirve el día que
 * importa.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * El 17-09-2026 el nombre real del dueño se coló **tres veces en un día**, las
 * tres como texto de ejemplo de un campo: en el nombre de usuario del registro,
 * en el nombre del perfil y en los ajustes. Un amigo suyo entró por primera vez
 * y se encontró el nombre de otra persona en su propia pantalla.
 *
 * Tres veces en un día no es mala suerte: es que «esto es sólo un ejemplo» se
 * escribe sin pensar. Por eso lo comprueba una máquina y no la memoria.
 */
export function sinDatosPersonales(raiz = "dist") {
  const prohibido = [
    /\bjohnny\b/i,
    /\bmart[ií]nez\b/i,
    /\balex\b/i,
    /16[.\s]?902[.\s]?126/,
    /\b195950337\b/,
    /\bguaicaipuro\b/i,
    /\bdalpe\b/i,
    /\bgede[oó]n(es)?\b/i,
    /\bgideons?\b/i,
  ];

  const encontrados = [];
  const mirar = (carpeta) => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = join(carpeta, entrada.name);
      if (entrada.isDirectory()) {
        mirar(ruta);
      } else if (/\.(js|css|html|webmanifest)$/.test(entrada.name)) {
        const texto = readFileSync(ruta, "utf8");
        for (const patron of prohibido) {
          if (patron.test(texto)) encontrados.push(`${entrada.name} → ${patron}`);
        }
      }
    }
  };
  // Las páginas legales llevan el correo de contacto a propósito, y Google lo
  // exige; el guardián no busca correos, así que no estorban.
  mirar(raiz);
  return [...new Set(encontrados)];
}

/**
 * Las dos juntas, con los mensajes que hacen falta. Corta el proceso si algo
 * está mal, porque aquí ya no hay nadie detrás que vaya a leer un aviso.
 */
export function revisarAntesDePublicar(nombre) {
  const fugas = sinDatosPersonales();
  if (fugas.length > 0) {
    console.error("Hay datos personales dentro de la app:");
    for (const f of fugas) console.error("  " + f);
    console.error("");
    console.error("Un ejemplo con el nombre de una persona real se lee como el dato");
    console.error("de esa persona. Cámbialo por algo que describa el campo.");
    process.exit(1);
  }

  if (!laWebCuadra(nombre)) {
    console.error(`La web compilada no lleva la versión ${nombre}.`);
    console.error("El paquete saldría con un número en el manifiesto y otro por dentro,");
    console.error("y la app pediría actualizarse para siempre.");
    process.exit(1);
  }
}
