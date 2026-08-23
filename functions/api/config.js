import { ok } from '../_lib/responses.js';
import { getTurnstileAllowedHostnames } from '../_lib/turnstile-hostnames.js';

// Public runtime configuration. Only values that are safe to expose to the browser belong here.
export function onRequestGet({ env }) {
  return ok({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    turnstileAllowedHostnames: getTurnstileAllowedHostnames(env)
  });
}
