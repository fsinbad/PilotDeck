/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_PLATFORM?: string;
  readonly VITE_DISABLE_LOCAL_AUTH?: string;
  readonly VITE_DINGTALK_SSO_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
