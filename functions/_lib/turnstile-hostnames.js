export const DEFAULT_TURNSTILE_ALLOWED_HOSTNAMES = Object.freeze([
  'remote-business-partner-recruitment-application.pages.dev',
  'recruitment.remotebusinesspartner.com.au'
]);

function normaliseHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

export function getTurnstileAllowedHostnames(env) {
  const configured = String(env && env.TURNSTILE_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map(normaliseHostname)
    .filter(Boolean);

  return [...new Set([
    ...DEFAULT_TURNSTILE_ALLOWED_HOSTNAMES,
    ...configured
  ].map(normaliseHostname).filter(Boolean))];
}

export function isTurnstileHostnameAllowed(env, hostname) {
  const candidate = normaliseHostname(hostname);
  return Boolean(candidate && getTurnstileAllowedHostnames(env).includes(candidate));
}
