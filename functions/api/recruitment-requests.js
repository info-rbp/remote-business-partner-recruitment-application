// POST /api/recruitment-requests — public JSON endpoint (employer "Start Recruitment" form).
// No public GET — admin-only retrieval lives under /api/admin/recruitment-requests.

import { newId, nowIso, run } from '../_lib/database.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import { validateRecruitmentRequestFields } from '../_lib/validation.js';
import { notifyRecruitmentRequest, deferEmail } from '../_lib/email.js';
import { created, validationError, forbidden, safeHandler } from '../_lib/responses.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  return safeHandler(async () => {
    const body = await request.json().catch(() => ({}));
    const {
      company_name, contact_name, email: contactEmail, phone, position_title,
      employment_type, location, remuneration, preferred_start_date, requirements,
      privacy_acknowledged
    } = body;
    const turnstileToken = body['cf-turnstile-response'] || body.turnstile_token;

    const turnstileResult = await verifyTurnstile(env, turnstileToken, request.headers.get('cf-connecting-ip'), 'recruitment_request');
    if (!turnstileResult.success) return forbidden('Verification failed. Please try again.');

    const err = validateRecruitmentRequestFields({
      company_name, contact_name, email: contactEmail, phone, position_title,
      employment_type, location, remuneration, preferred_start_date, requirements, privacy_acknowledged
    });
    if (err) return validationError(err);

    const id = newId();
    const timestamp = nowIso();
    await run(env, `
      INSERT INTO recruitment_requests (
        id, company_name, contact_name, email, phone, position_title, employment_type,
        location, remuneration, preferred_start_date, requirements,
        status, privacy_acknowledged, privacy_acknowledged_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 1, ?, ?, ?)
    `, [
      id, company_name, contact_name, contactEmail, phone || null, position_title, employment_type,
      location || null, remuneration || null, preferred_start_date || null, requirements || null,
      timestamp, timestamp, timestamp
    ]);

    deferEmail(context, notifyRecruitmentRequest(env, {
      id,
      company_name,
      contact_name,
      email: contactEmail,
      phone: phone || null,
      position_title,
      employment_type,
      location: location || null,
      remuneration: remuneration || null,
      preferred_start_date: preferred_start_date || null,
      requirements: requirements || null,
      created_at: timestamp
    }));

    return created({ id, status: 'New' });
  });
}
