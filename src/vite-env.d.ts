/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNUSED?: string;
  readonly VITE_TURNO_APP_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
