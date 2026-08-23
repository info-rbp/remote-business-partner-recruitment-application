// POST /api/candidate-interest — public JSON endpoint (spec item 36, 44).
// There is no public GET for this resource — admin-only retrieval lives
// under /api/admin/candidate-interest.

import { newId, nowIso, run } from '../_lib/database.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import { validateCandidateInterestFields } from '../_lib/validation.js';
import { created, validationError, forbidden, safeHandler } from '../_lib/responses.js';

export async function onRequestPost({ request, env }) {
  return safeHandler(async () => {
    const body = await request.json().catch(() => ({}));
    const {
      name, email: candidateEmail, phone, linkedin_url, preferred_roles,
      preferred_location, message, privacy_acknowledged
    } = body;
    const turnstileToken = body['cf-turnstile-response'] || body.turnstile_token;

    const turnstileResult = await verifyTurnstile(env, turnstileToken, request.headers.get('cf-connecting-ip'), 'candidate_interest');
    if (!turnstileResult.success) return forbidden('Verification failed. Please try again.');

    const err = validateCandidateInterestFields({
      name, email: candidateEmail, phone, linkedin_url, preferred_roles, preferred_location, message, privacy_acknowledged
    });
    if (err) return validationError(err);

    const id = newId();
    const timestamp = nowIso();
    await run(env, `
      INSERT INTO candidate_interest (
        id, name, email, phone, linkedin_url, preferred_roles, preferred_location, message,
        status, privacy_acknowledged, privacy_acknowledged_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 1, ?, ?, ?)
    `, [id, name, candidateEmail, phone || null, linkedin_url || null, preferred_roles || null, preferred_location || null, message || null, timestamp, timestamp, timestamp]);

    return created({ id, status: 'New' });
  });
}
