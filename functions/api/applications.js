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

    const turnstileResult = await verifyTurnstile(env, turnstileToken, request.headers.get('cf-connecting-ip'));
    if (!turnstileResult.success) return forbidden('Verification failed. Please try again.');

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

    const vacancy = await first(env, 'SELECT * FROM vacancies WHERE id = ?', [vacancyId]);
    if (!vacancy) return notFound('This vacancy could not be found.');

    const currentBusinessDate = getCurrentBusinessDate(env);
    const isExpired = vacancy.deadline_date && vacancy.deadline_date < currentBusinessDate;
    if (vacancy.status !== 'Open' || isExpired) {
      return conflict('applications_closed', 'Applications for this position have closed.');
    }

    const resumeErr = validateResumeFile(resumeFile);
    if (resumeErr) {
      if (resumeErr.code === 'too_large') return tooLarge(resumeErr.message);
      if (resumeErr.code === 'unsupported_type') return unsupportedMediaType(resumeErr.message);
      return validationError(resumeErr.message);
    }

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
