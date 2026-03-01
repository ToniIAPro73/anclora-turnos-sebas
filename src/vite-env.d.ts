/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNUSED?: string;
  readonly VITE_TURNO_APP_API_KEY?: string;
  readonly VITE_TURNO_APP_ENDPOINT_URL?: string;
  readonly VITE_ENABLE_REMOTE_STORAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
