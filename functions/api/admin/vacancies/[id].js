import { first, run, nowIso } from '../../../_lib/database.js';
import { ok, noContent, validationError, notFound, conflict, safeHandler } from '../../../_lib/responses.js';
import { oneOf, optionalString, optionalDate, VACANCY_STATUSES, EMPLOYMENT_TYPES_VACANCY } from '../../../_lib/validation.js';

const EDITABLE_FIELDS = [
  'title', 'employer_name', 'department', 'location', 'job_type', 'experience_level',
  'salary_range', 'summary', 'description', 'responsibilities', 'requirements', 'benefits',
  'status', 'is_featured', 'deadline_date'
];

export async function onRequestPatch({ request, env, params }) {
  return safeHandler(async () => {
    const existing = await first(env, 'SELECT * FROM vacancies WHERE id = ?', [params.id]);
    if (!existing) return notFound();

    const body = await request.json().catch(() => ({}));

    if (body.status !== undefined) {
      const err = oneOf(body.status, VACANCY_STATUSES, 'Status');
      if (err) return validationError(err);
    }
    if (body.job_type !== undefined) {
      const err = oneOf(body.job_type, EMPLOYMENT_TYPES_VACANCY, 'Employment type');
      if (err) return validationError(err);
    }
    if (body.deadline_date !== undefined) {
      const err = optionalDate(body.deadline_date, 'Deadline date');
      if (err) return validationError(err);
    }
    if (body.title !== undefined) {
      const err = optionalString(body.title, 'Title', { max: 200 });
      if (err) return validationError(err);
    }
    if (body.location !== undefined) {
      const err = optionalString(body.location, 'Location', { max: 200 });
      if (err) return validationError(err);
    }

    const sets = [];
    const values = [];
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        sets.push(`${field} = ?`);
        values.push(field === 'is_featured' ? (body[field] ? 1 : 0) : body[field]);
      }
    }
    if (sets.length === 0) return validationError('No editable fields were supplied.');

    if (body.status === 'Open' && existing.status !== 'Open') {
      sets.push('posted_at = ?');
      values.push(nowIso());
    }
    sets.push('updated_at = ?');
    values.push(nowIso());
    values.push(params.id);

    await run(env, `UPDATE vacancies SET ${sets.join(', ')} WHERE id = ?`, values);
    return ok({ id: params.id });
  });
}

export async function onRequestDelete({ env, params }) {
  return safeHandler(async () => {
    const existing = await first(env, 'SELECT * FROM vacancies WHERE id = ?', [params.id]);
    if (!existing) return notFound();

    const appCount = await first(env, 'SELECT COUNT(*) as count FROM applications WHERE vacancy_id = ?', [params.id]);
    if (appCount && appCount.count > 0) {
      return conflict(
        'vacancy_has_applications',
        'This vacancy has applications and cannot be permanently deleted. Close the vacancy instead.'
      );
    }

    await run(env, 'DELETE FROM vacancies WHERE id = ?', [params.id]);
    return noContent();
  });
}
