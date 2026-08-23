import { ok } from '../_lib/responses.js';

function parseAllowedHostnames(value) {
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

// Public runtime configuration. Only values that are safe to expose to the browser belong here.
export function onRequestGet({ env }) {
  return ok({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    turnstileAllowedHostnames: parseAllowedHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES)
  });
}
