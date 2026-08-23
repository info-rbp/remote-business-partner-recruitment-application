import { all, getCurrentBusinessDate } from '../../_lib/database.js';
import { ok, safeHandler } from '../../_lib/responses.js';

const PUBLIC_FIELDS = [
  'id', 'title', 'department', 'location', 'job_type', 'experience_level',
  'salary_range', 'summary', 'description', 'responsibilities', 'requirements',
  'benefits', 'is_featured', 'posted_at', 'deadline_date'
];

function toPublicVacancy(row) {
  const out = {};
  for (const f of PUBLIC_FIELDS) out[f] = row[f];
  return out;
}

export async function onRequestGet({ request, env }) {
  return safeHandler(async () => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const location = (url.searchParams.get('location') || '').trim();
    const jobType = (url.searchParams.get('job_type') || '').trim();

    const currentBusinessDate = getCurrentBusinessDate(env);
    const whereParts = ["status = 'Open'", '(deadline_date IS NULL OR deadline_date >= ?)'];
    const whereParams = [currentBusinessDate];
    if (q) {
      whereParts.push('(title LIKE ? OR summary LIKE ? OR description LIKE ?)');
      const like = `%${q}%`;
      whereParams.push(like, like, like);
    }
    if (location) {
      whereParts.push('location = ?');
      whereParams.push(location);
    }
    if (jobType) {
      whereParts.push('job_type = ?');
      whereParams.push(jobType);
    }

    const sql = `
      SELECT
        id, title, department, location, job_type, experience_level,
        salary_range, summary, description, responsibilities, requirements,
        benefits, is_featured, posted_at, deadline_date
      FROM vacancies
      WHERE ${whereParts.join(' AND ')}
      ORDER BY is_featured DESC, posted_at DESC
    `;
    const rows = await all(env, sql, whereParams);
    return ok(rows.map(toPublicVacancy));
  });
}
