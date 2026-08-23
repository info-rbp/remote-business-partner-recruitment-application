// Firebase ID-token verification for staff-only endpoints, plus the
// staff_users approval check (spec items 27-29).
//
// This CRYPTOGRAPHICALLY VERIFIES the token's RS256 signature against
// Google's published public signing keys — it does not just decode the
// JWT payload and trust it. It checks: algorithm, signature, kid, aud
// (= FIREBASE_PROJECT_ID), iss (= https://securetoken.google.com/{PROJECT_ID}),
// exp (future), iat (past), and a non-empty sub (Firebase UID).
//
// A valid Firebase account is NOT sufficient by itself — the matching
// staff_users row must also exist with active = 1.

import { unauthorized, forbidden } from './responses.js';
import { first, run, nowIso } from './database.js';

const GOOGLE_PUBLIC_KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedKeys = null;
let cachedKeysExpiry = 0;

async function getGooglePublicKeys() {
  if (cachedKeys && Date.now() < cachedKeysExpiry) return cachedKeys;
  const res = await fetch(GOOGLE_PUBLIC_KEYS_URL);
  if (!res.ok) throw new Error('Failed to fetch Firebase public keys');
  const json = await res.json();
  cachedKeys = json;
  const cacheControl = res.headers.get('cache-control') || '';
  const match = /max-age=(\d+)/.exec(cacheControl);
  const maxAgeMs = match ? parseInt(match[1], 10) * 1000 : 60 * 60 * 1000;
  cachedKeysExpiry = Date.now() + maxAgeMs;
  return json;
}

function base64UrlDecode(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function verifyFirebaseIdToken(idToken, projectId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed token.');
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  if (header.alg !== 'RS256') throw new Error('Unexpected signing algorithm.');

  const keys = await getGooglePublicKeys();
  const pem = keys[header.kid];
  if (!pem) throw new Error('Unknown signing key (kid) — token rejected.');

  const { jwtVerify, importX509 } = await import('jose');
  const key = await importX509(pem, 'RS256');
  const { payload } = await jwtVerify(idToken, key, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId
  });

  if (!payload.sub) throw new Error('Token missing subject (uid).');
  return payload;
}

export async function requireStaffUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return { error: unauthorized('Missing bearer token.') };

  let payload;
  try {
    payload = await verifyFirebaseIdToken(match[1], env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.error('Firebase token verification failed:', err && err.message);
    return { error: unauthorized('Invalid or expired session. Please sign in again.') };
  }

  const staffUser = await first(env, 'SELECT * FROM staff_users WHERE firebase_uid = ?', [payload.sub]);
  if (!staffUser || !staffUser.active) {
    return { error: forbidden('This account is not authorised to access the RBP Recruitment Administration system.') };
  }

  await run(env, 'UPDATE staff_users SET last_login_at = ? WHERE id = ?', [nowIso(), staffUser.id]);
  return { staffUser, payload };
}
