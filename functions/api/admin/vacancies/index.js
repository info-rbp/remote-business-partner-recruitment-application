import { all, newId, nowIso, run } from '../../../_lib/database.js';
import { requiredString, optionalString, optionalDate, oneOf, firstError, EMPLOYMENT_TYPES_VACANCY, VACANCY_STATUSES } from '../../../_lib/validation.js';
import { ok, created, validationError, safeHandler } from '../../../_lib/responses.js';

export async function onRequestGet({ env }) {
  return safeHandler(async () => {
    const rows = await all(env, 'SELECT * FROM vacancies ORDER BY created_at DESC');
    return ok(rows);
  });
}

export async function onRequestPost({ request, env }) {
  return safeHandler(async () => {
    const body = await request.json().catch(() => ({}));
    const status = body.status || 'Draft';

    const err = firstError(
      requiredString(body.title, 'Title', { min: 2, max: 200 }),
      requiredString(body.location, 'Location', { min: 1, max: 200 }),
      oneOf(body.job_type, EMPLOYMENT_TYPES_VACANCY, 'Employment type'),
      oneOf(status, VACANCY_STATUSES, 'Status'),
      optionalString(body.employer_name, 'Employer name', { max: 200 }),
      requiredString(body.description, 'Description', { min: 1, max: 20000 }),
      optionalDate(body.deadline_date, 'Deadline date')
    );
    if (err) return validationError(err);

    const id = newId();
    const timestamp = nowIso();
    const postedAt = status === 'Open' ? timestamp : null;

    await run(env, `
      INSERT INTO vacancies (
        id, title, employer_name, department, location, job_type, experience_level,
        salary_range, summary, description, responsibilities, requirements, benefits,
        status, is_featured, posted_at, deadline_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, body.title, body.employer_name || null, body.department || null, body.location,
      body.job_type, body.experience_level || null, body.salary_range || null, body.summary || null,
      body.description, body.responsibilities || null, body.requirements || null, body.benefits || null,
      status, body.is_featured ? 1 : 0, postedAt, body.deadline_date || null, timestamp, timestamp
    ]);

    return created({ id, status });
  });
}
