/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPA_PROJECT_URL: string;
  readonly VITE_RESET_REDIRECT_BASE: string;
  // agrega aquí otras VITE_* si las usas
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
