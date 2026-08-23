import { paginate } from '../../../_lib/database.js';
import { ok, safeHandler } from '../../../_lib/responses.js';

export async function onRequestGet({ request, env }) {
  return safeHandler(async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const vacancyId = url.searchParams.get('vacancy_id') || '';
    const q = (url.searchParams.get('q') || '').trim();
    const page = url.searchParams.get('page') || 1;
    const limit = url.searchParams.get('limit') || 25;

    const whereParts = ['1=1'];
    const whereParams = [];
    if (status) { whereParts.push('status = ?'); whereParams.push(status); }
    if (vacancyId) { whereParts.push('vacancy_id = ?'); whereParams.push(vacancyId); }
    if (q) {
      whereParts.push('(candidate_name LIKE ? OR email LIKE ?)');
      const like = `%${q}%`;
      whereParams.push(like, like);
    }

    const { rows, pagination } = await paginate(env, {
      table: 'applications',
      whereSql: whereParts.join(' AND '),
      whereParams,
      orderBy: 'applied_at DESC',
      page, limit
    });

    return ok(rows, { pagination });
  });
}
