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
 * El 17-09-2026 un amigo de Alex entró por primera vez y **se encontró el
 * nombre real de Alex de ejemplo** en el campo del nombre de usuario. Era un
 * simple `placeholder`, pero quien lo ve no distingue un ejemplo del dato de
 * otra persona: lo que concluye es que la app le está enseñando una cuenta
 * ajena.
 *
 * Y ese mismo día hubo que limpiar otra fuga parecida —el nombre de la
 * organización en la que sirve, que sus políticas internas prohíben mencionar—.
 * Dos en un día es un patrón, no mala suerte: lo que uno escribe pensando «esto
 * es sólo un ejemplo» acaba en el teléfono de un desconocido.
 *
 * Se mira **el código de la app**, no las páginas legales: el correo de
 * contacto sí tiene que estar en la política de privacidad y en la de borrado
 * de cuenta, porque Google lo exige.
 */
function sinDatosPersonales() {
  const prohibido = [
    /johnny/i,
    /mart[ií]nez/i,
    /16[.s]?902[.s]?126/,
    /195950337/,
    /guaicaipuro/i,
    /dalpe/i,
    /gede[oó]n/i,
    /gideon/i,
  ];

  const encontrados = [];
  const mirar = (carpeta) => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = join(carpeta, entrada.name);
      if (entrada.isDirectory()) {
        mirar(ruta);
      } else if (/.(tsx?|json)$/.test(entrada.name)) {
        const texto = readFileSync(ruta, "utf8");
        for (const patron of prohibido) {
          if (patron.test(texto)) encontrados.push(`${ruta} → ${patron}`);
        }
      }
    }
  };
  mirar("src");
  return encontrados;
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
