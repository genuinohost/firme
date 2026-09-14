/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** La versión que lleva dentro la app. La escribe scripts/publicar-version.mjs. */
interface ImportMetaEnv {
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** La versión, inyectada desde android/app/build.gradle en vite.config.ts. */
declare const __VERSION_CODIGO__: number;
declare const __VERSION_NOMBRE__: string;
