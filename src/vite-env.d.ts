/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIMARY_AGENT_URL?: string
  readonly VITE_USED_BOOK_AGENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
