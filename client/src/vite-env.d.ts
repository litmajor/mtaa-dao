/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_ENABLE_MESSAGING?: string;
  readonly VITE_FEATURE_USER_FOLLOWS?: string;
  readonly VITE_STRIPE_PUBLIC_KEY?: string;
  readonly VITE_DAO_SUBSCRIPTION_MANAGER_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
