import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        // Los avisos de las notificaciones viven aparte para poder tocarlos
        // sin pelearse con el service worker que genera Workbox.
        importScripts: ["/sw-avisos.js"],
        cleanupOutdatedCaches: true,
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
