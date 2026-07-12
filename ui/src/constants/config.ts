/**
 * Environment Flag: Is Platform
 * Indicates if the app is running in Platform mode (hosted) or OSS mode (self-hosted)
 */
export const IS_PLATFORM = import.meta.env.VITE_IS_PLATFORM === 'true';

/**
 * Matches server NUKEMAI_DISABLE_LOCAL_AUTH (injected in vite.config.js).
 */
export const DISABLE_LOCAL_AUTH = import.meta.env.VITE_DISABLE_LOCAL_AUTH === 'true';

/**
 * Whether DingTalk SSO login is enabled.
 * Injected at build time via VITE_DINGTALK_SSO_ENABLED.
 */
export const DINGTALK_SSO_ENABLED = import.meta.env.VITE_DINGTALK_SSO_ENABLED === 'true';