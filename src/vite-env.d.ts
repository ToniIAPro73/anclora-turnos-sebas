/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNUSED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
