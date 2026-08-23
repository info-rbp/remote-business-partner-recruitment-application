import { first, getCurrentBusinessDate } from '../../_lib/database.js';
import { ok, notFound, safeHandler } from '../../_lib/responses.js';

const PUBLIC_FIELDS = [
  'id', 'title', 'department', 'location', 'job_type', 'experience_level',
  'salary_range', 'summary', 'description', 'responsibilities', 'requirements',
  'benefits', 'is_featured', 'posted_at', 'deadline_date'
];

export async function onRequestGet({ params, env }) {
  return safeHandler(async () => {
    const currentBusinessDate = getCurrentBusinessDate(env);
    const row = await first(
      env,
      `SELECT
        id, title, department, location, job_type, experience_level,
        salary_range, summary, description, responsibilities, requirements,
        benefits, is_featured, posted_at, deadline_date
      FROM vacancies
      WHERE id = ? AND status = 'Open' AND (deadline_date IS NULL OR deadline_date >= ?)`,
      [params.id, currentBusinessDate]
    );
    if (!row) return notFound('This vacancy is no longer available.');
    const out = {};
    for (const f of PUBLIC_FIELDS) out[f] = row[f];
    return ok(out);
  });
}
