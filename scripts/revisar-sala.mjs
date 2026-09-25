/**
 * Levanta los emuladores y le hace las preguntas al portero.
 *
 *   npm run revisar-sala
 *
 * Las preguntas están en `revisar-sala-preguntas.mjs`. Esto sólo arranca lo que
 * hace falta para poder hacerlas, y existe por una razón concreta.
 *
 * ── El minuto de descubrimiento ───────────────────────────────────────────
 *
 * El emulador de funciones, antes de servir nada, **carga el código y le
 * pregunta qué funciones trae**. Ese paso tiene diez segundos de plazo, y aquí
 * no le bastan: el proyecto usa módulos de ES en Windows y la primera carga se
 * va de tiempo.
 *
 * Cuando se pasa, el emulador no falla: **arranca sin ninguna función**, y
 * entonces todas las llamadas responden 404. Eso es lo desagradable — las
 * pruebas no dicen «no se pudo cargar», dicen «esa sala no existe» nueve veces,
 * que parece un fallo del portero y no lo es. Costó media hora la primera vez.
 *
 * Se comprobó midiendo aparte: el módulo tarda **un segundo** en cargar. El
 * plazo de diez no lo agota el código, lo agota el arranque del emulador.
 *
 * Así que el plazo se sube aquí, una vez, y no en la memoria de nadie.
 *
 * ── Y no toca producción ──────────────────────────────────────────────────
 *
 * A propósito **no** se preparan las credenciales de la cuenta de servicio,
 * aunque estén a mano. El emulador avisa de que lo que no emula lo pide a
 * producción; sin credenciales, eso no puede pasar ni por error. Lo que se está
 * probando es una puerta, y una prueba de una puerta no debería poder abrir la
 * de verdad.
 */
import { execSync } from "node:child_process";

process.env.FUNCTIONS_DISCOVERY_TIMEOUT = "60";

// La orden entera como una cadena, y no como lista de argumentos.
//
// Con lista y `shell: true`, Node los pega con espacios sin entrecomillar nada,
// asi que el ultimo —«node scripts/revisar-sala-preguntas.mjs»— llegaba partido
// en dos y firebase respondia «Too many arguments». Las comillas de dentro son
// las que lo mantienen de una pieza.
const ORDEN =
  "npx firebase emulators:exec --only firestore,functions,auth" +
  " --project genuino-pruebas" +
  ' "node scripts/revisar-sala-preguntas.mjs"';

try {
  execSync(ORDEN, { stdio: "inherit" });
} catch {
  // `execSync` ya imprimio lo suyo; lo que importa es el codigo de salida, para
  // que un fallo pare una cadena de comprobaciones.
  process.exit(1);
}
