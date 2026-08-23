const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(env, token, remoteip) {
  if (!token || typeof token !== 'string') {
    return { success: false, reason: 'missing_token' };
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('TURNSTILE_SECRET_KEY is not configured.');
    return { success: false, reason: 'not_configured' };
  }

  const body = new URLSearchParams();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  let json;
  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    json = await res.json();
  } catch (err) {
    console.error('Turnstile siteverify request failed:', err && err.message);
    return { success: false, reason: 'siteverify_unreachable' };
  }

  return { success: !!json.success, reason: json['error-codes'] || null };
}
