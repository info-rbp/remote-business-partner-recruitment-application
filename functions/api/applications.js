// POST /api/applications — public, multipart/form-data (spec items 15-20).
//
// Expected client fields: vacancy_id, candidate_name, email, phone,
// linkedin_url, cover_note, resume, privacy_acknowledged, cf-turnstile-response
//
// The client must NEVER be able to set: status, vacancy_title,
// employer_name, applied_at, internal_notes, resume_key — all determined
// server-side.
//
// Required order of operations:
//   receive submission -> validate Turnstile -> validate required fields
//   -> retrieve vacancy from D1 -> confirm exists -> confirm status=Open
//   -> confirm deadline not passed -> validate CV -> generate application id
//   -> upload CV to private R2 -> insert application metadata into D1
//   -> return success
//
// R2/D1 failure safety (spec item 20): upload CV to R2 first, then insert
// into D1. If the D1 insert fails, delete the just-uploaded R2 object so no
// orphaned CV is left behind. If the R2 upload itself fails, no D1 row is
// ever created.

import { newId, nowIso, first, run, getCurrentBusinessDate } from '../_lib/database.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import { validateResumeFile, buildResumeKey, storeResume, deleteResume } from '../_lib/files.js';
import { validateApplicationFields } from '../_lib/validation.js';
import { validationError, forbidden, notFound, conflict, tooLarge, unsupportedMediaType, safeHandler, created } from '../_lib/responses.js';

export async function onRequestPost({ request, env }) {
  return safeHandler(async () => {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return validationError('Expected multipart/form-data.');
    }
    const form = await request.formData();

    const vacancyId = form.get('vacancy_id');
    const candidateName = form.get('candidate_name');
    const candidateEmail = form.get('email');
    const phone = form.get('phone');
    const linkedinUrl = form.get('linkedin_url') || '';
    const coverNote = form.get('cover_note') || '';
    const privacyAcknowledged = form.get('privacy_acknowledged');
    const turnstileToken = form.get('cf-turnstile-response') || form.get('turnstile_token');
    const resumeFile = form.get('resume');

    // ---- 1. Turnstile verification first (spec: do not save any data, do
    // not upload CV to R2, if Turnstile fails) ----
    const turnstileResult = await verifyTurnstile(env, turnstileToken, request.headers.get('cf-connecting-ip'), 'job_application');
    if (!turnstileResult.success) return forbidden('Verification failed. Please try again.');

    // ---- 2. Required-field validation ----
    const fieldErr = validateApplicationFields({
      vacancy_id: vacancyId,
      candidate_name: candidateName,
      email: candidateEmail,
      phone,
      linkedin_url: linkedinUrl,
      cover_note: coverNote,
      privacy_acknowledged: privacyAcknowledged
    });
    if (fieldErr) return validationError(fieldErr);

    // ---- 3. Vacancy must exist, be Open, and not be past its deadline ----
    const vacancy = await first(env, 'SELECT * FROM vacancies WHERE id = ?', [vacancyId]);
    if (!vacancy) return notFound('This vacancy could not be found.');

    const currentBusinessDate = getCurrentBusinessDate(env);
    const isExpired = vacancy.deadline_date && vacancy.deadline_date < currentBusinessDate;
    if (vacancy.status !== 'Open' || isExpired) {
      return conflict('applications_closed', 'Applications for this position have closed.');
    }

    // ---- 4. CV validation (extension AND MIME type; size; emptiness) ----
    const resumeErr = validateResumeFile(resumeFile);
    if (resumeErr) {
      if (resumeErr.code === 'too_large') return tooLarge(resumeErr.message);
      if (resumeErr.code === 'unsupported_type') return unsupportedMediaType(resumeErr.message);
      return validationError(resumeErr.message);
    }

    // ---- 5. Generate id, upload to R2, then insert into D1 ----
    const id = newId();
    const resumeKey = buildResumeKey(id, resumeFile.name);

    try {
      await storeResume(env, resumeKey, resumeFile);
    } catch (err) {
      console.error('R2 upload failed:', err && err.message);
      return internalErrorFallback();
    }

    const timestamp = nowIso();
    try {
      await run(env, `
        INSERT INTO applications (
          id, vacancy_id, candidate_name, email, phone, linkedin_url, cover_note,
          status, internal_notes, resume_key, resume_filename, resume_type, resume_size,
          privacy_acknowledged, privacy_acknowledged_at, applied_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Applied', NULL, ?, ?, ?, ?, 1, ?, ?, ?)
      `, [
        id, vacancyId, candidateName, candidateEmail, phone, linkedinUrl || null, coverNote || null,
        resumeKey, resumeFile.name, resumeFile.type, resumeFile.size,
        timestamp, timestamp, timestamp
      ]);
    } catch (err) {
      // D1 insert failed after a successful R2 upload — delete the now-orphaned object.
      console.error('D1 insert failed after R2 upload, cleaning up:', err && err.message);
      await deleteResume(env, resumeKey);
      return internalErrorFallback();
    }

    return created({ id, status: 'Applied' });
  });
}

function internalErrorFallback() {
  return new Response(JSON.stringify({
    success: false,
    error: 'internal_error',
    message: 'We could not process your application. Please try again shortly.'
  }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
