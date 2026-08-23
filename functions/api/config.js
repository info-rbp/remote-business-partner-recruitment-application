import { ok } from '../_lib/responses.js';

// Public runtime configuration. Only values that are safe to expose to the browser belong here.
export function onRequestGet({ env }) {
  return ok({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null
  });
}
