import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * La versión, leída de `build.gradle` al compilar.
 *
 * Antes vivía escrita a mano en `.env.local`, que además está en `.gitignore`.
 * Se quedó congelada en la 2.5 mientras la app iba por la 3.4, así que el aviso
 * de versión nueva enseñaba un número falso y en otra máquina no habría existido
 * siquiera. Un número que hay que acordarse de actualizar acaba desfasado
 * siempre; este sale del mismo sitio del que lo saca Android.
 */
function versionDeAndroid(): { codigo: number; nombre: string } {
  const gradle = readFileSync(
    fileURLToPath(new URL("./android/app/build.gradle", import.meta.url)),
    "utf8",
  );
  const codigo = gradle.match(/versionCode\s+(\d+)/);
  const nombre = gradle.match(/versionName\s+"([^"]+)"/);
  if (!codigo || !nombre) {
    throw new Error("No se pudo leer la versión de android/app/build.gradle");
  }
  return { codigo: Number(codigo[1]), nombre: nombre[1] };
}

const version = versionDeAndroid();

export default defineConfig({
  define: {
    __VERSION_CODIGO__: JSON.stringify(version.codigo),
    __VERSION_NOMBRE__: JSON.stringify(version.nombre),
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icono.svg", "icono-180.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        /**
         * Firebase fuera del precacheado.
         *
         * Son 700 KB entre Firestore y Auth, y el service worker se los baja
         * **en la primera visita** aunque nadie vaya a crear una cuenta — que
         * van a ser casi todos. Al entrar Firebase, el precacheado pasó de 728
         * KB a 1,4 MB de golpe: el doble de datos en el primer arranque, y
         * mucho de ello para una pantalla que la mayoría no abrirá nunca.
         *
         * Se cargan cuando hacen falta y se cachean entonces. Esto no es una
         * optimización de manual: en Venezuela, con una conexión mala y un
         * teléfono barato, ese medio mega es la diferencia entre que la app
         * abra o que alguien la cierre creyendo que no funciona.
         */
        globIgnores: ["**/index.esm-*.js"],
        // Los avisos de las notificaciones viven aparte para poder tocarlos
        // sin pelearse con el service worker que genera Workbox.
        importScripts: ["/sw-avisos.js"],
        cleanupOutdatedCaches: true,
        /**
         * La política de privacidad es una página aparte, no parte de la app.
         *
         * Sin esto, el service worker responde a **cualquier** navegación con
         * el index de la aplicación: quien ya hubiera abierto la web vería la
         * app en lugar de la política. El servidor la devuelve bien —así que
         * Google no lo notaría—, pero una persona sí.
         */
        navigateFallbackDenylist: [/^\/privacidad/, /^\/borrar-cuenta/],
      },
      manifest: {
        name: "Genuino — disciplina cristiana",
        short_name: "Genuino",
        description:
          "Tu rutina, tus tareas y tus razones. Con alarma en cada bloque y una frase para no desmayar.",
        lang: "es",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0d10",
        theme_color: "#0b0d10",
        categories: ["productivity", "lifestyle"],
        icons: [
          { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icono-mascara.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: { enabled: true, type: "module" },
    }),
  ],
  server: { host: true },
});
