// Ensure unified YAML config is applied before reading flags.
import '../load-env.js';

/**
 * Environment Flag: Is Platform
 * Indicates if the app is running in Platform mode (hosted) or OSS mode (self-hosted)
 */
export const IS_PLATFORM = process.env.VITE_IS_PLATFORM === 'true';

/**
 * When true, skip JWT login/register in the web UI (single-user local mode).
 * Set NUKEMAI_DISABLE_LOCAL_AUTH=0 or false to require username/password again.
 * @type {boolean}
 */
export const DISABLE_LOCAL_AUTH =
  process.env.NUKEMAI_DISABLE_LOCAL_AUTH !== '0' &&
  process.env.NUKEMAI_DISABLE_LOCAL_AUTH !== 'false';

/**
 * DingTalk SSO is enabled when both APP_KEY and APP_SECRET are configured.
 * @type {boolean}
 */
export const DINGTALK_SSO_ENABLED =
  !!process.env.DINGTALK_APP_KEY && !!process.env.DINGTALK_APP_SECRET;
