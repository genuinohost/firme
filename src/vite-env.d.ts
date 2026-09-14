/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** La versión que lleva dentro la app. La escribe scripts/publicar-version.mjs. */
interface ImportMetaEnv {
  readonly VITE_VERSION_CODIGO: string;
  readonly VITE_VERSION_NOMBRE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
