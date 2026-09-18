/**
 * Publica una versión: sube el APK a GitHub Releases y avisa a los móviles.
 *
 * Firebase Hosting en su plan gratuito prohíbe los archivos ejecutables, así que
 * el APK vive en GitHub Releases —gratis, sin límite y sin caducidad— y en
 * Firebase queda solo `version.json`, que es lo que consultan los móviles ya
 * instalados para saber si hay algo nuevo.
 *
 *   node scripts/publicar-release.mjs "Novedad una" "Novedad dos"
 *
 * Antes hay que tener el APK de release compilado y `gh` con la sesión iniciada.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APK = "android/app/build/outputs/apk/release/app-release.apk";
const GRADLE = "android/app/build.gradle";
const GH = "C:\\Program Files\\GitHub CLI\\gh.exe";

function gh(...args) {
  return execFileSync(existsSync(GH) ? GH : "gh", args, { encoding: "utf8" }).trim();
}

if (!existsSync(APK)) {
  console.error("No hay APK compilado. Ejecuta antes:");
  console.error("  cd android && ./gradlew assembleRelease");
  process.exit(1);
}

const gradle = readFileSync(GRADLE, "utf8");
const codigo = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
const nombre = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const etiqueta = `v${nombre}`;
const novedades = process.argv.slice(2);

// El repositorio se saca de git, para no tenerlo escrito en dos sitios.
/**
 * Que la web compilada lleve la misma versión que el APK.
 *
 * El 17-09-2026 se publicó una 4.7 que por dentro era la 4.6: `cap sync` copia
 * lo que haya en `dist`, y `dist` se había compilado antes de subir el número.
 * El manifiesto decía 29 y el JavaScript 28, así que la app pedía actualizarse
 * **para siempre** y al instalar no se callaba.
 *
 * Esto se comprueba aquí y no solo al compilar, porque publicar es el último
 * punto donde el fallo todavía es barato: una vez subido, ya está en los
 * teléfonos.
 */
function laWebCuadra() {
  const carpeta = "dist/assets";
  if (!existsSync(carpeta)) return false;
  let bien = false;
  for (const archivo of readdirSync(carpeta)) {
    if (!archivo.endsWith(".js")) continue;
    if (readFileSync(join(carpeta, archivo), "utf8").includes(`"${nombre}"`)) bien = true;
  }
  return bien;
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
 * APK**. Si un nombre aparece ahí, alguien lo va a ver.
 *
 * ── Y por qué con límites de palabra ──────────────────────────────────────
 *
 * Sin ellos, `alex` casaba dentro de `InternalException` —«Intern·alEx·ception»—
 * en el bundle de Firebase, y el guardián se ponía rojo en cada publicación.
 * Un aviso que salta siempre se acaba ignorando, y entonces no sirve el día que
 * importa. Es la tercera vez en dos días que aparece esta misma lección.
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
function sinDatosPersonales() {
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
  mirar("dist");
  return [...new Set(encontrados)];
}

const fugas = sinDatosPersonales();
if (fugas.length > 0) {
  console.error("Hay datos personales dentro de la app:");
  for (const f of fugas) console.error("  " + f);
  console.error("");
  console.error("Un ejemplo con el nombre de una persona real se lee como el dato");
  console.error("de esa persona. Cámbialo por algo que describa el campo.");
  process.exit(1);
}

if (!laWebCuadra()) {
  console.error(`La web de ${"dist"} no lleva la versión ${nombre}.`);
  console.error("El APK saldría con un número en el manifiesto y otro por dentro,");
  console.error("y la app pediría actualizarse para siempre. Compila con:");
  console.error("  npm run apk");
  process.exit(1);
}

const remoto = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const repo = remoto.replace(/^.*github\.com[:/]/, "").replace(/\.git$/, "");

console.log(`Publicando ${etiqueta} en ${repo}…`);

// Un nombre con la versión: así el que lo descarga sabe qué tiene.
const nombreArchivo = `Genuino-${nombre}.apk`;
// Con copyFileSync y no con `cp`: `cp` solo existe si esto se lanza desde
// Git Bash, y desde PowerShell el script se caia con un ENOENT confuso.
copyFileSync(APK, nombreArchivo);

const cuerpo =
  novedades.length > 0
    ? novedades.map((n) => `- ${n}`).join("\n")
    : "Mejoras y correcciones.";

try {
  gh(
    "release", "create", etiqueta,
    `${nombreArchivo}#Genuino ${nombre} para Android`,
    "--repo", repo,
    "--title", `Genuino ${nombre}`,
    "--notes", cuerpo,
  );
  console.log(`  Release ${etiqueta} creada.`);
} catch {
  // Si ya existía, se reemplaza el archivo en vez de fallar.
  gh("release", "upload", etiqueta, nombreArchivo, "--repo", repo, "--clobber");
  console.log(`  Release ${etiqueta} ya existía; archivo actualizado.`);
}

// El enlace estable a la última versión, que es al que apunta la app.
const enlace = `https://github.com/${repo}/releases/latest/download/${nombreArchivo}`;

writeFileSync(
  "public/version.json",
  JSON.stringify(
    {
      _lee_esto:
        "Lo genera scripts/publicar-release.mjs; no se edita a mano. Cuando la app esté " +
        "en Google Play, cambiar 'enlace' por la ficha de Play.",
      codigo,
      nombre,
      enlace,
      novedades,
      importante: false,
    },
    null,
    2,
  ) + "\n",
);

rmSync(nombreArchivo, { force: true });

console.log(`  version.json apunta a ${enlace}`);
console.log("");
console.log("Falta publicar la web para que los móviles se enteren:");
console.log("  npm run desplegar");
