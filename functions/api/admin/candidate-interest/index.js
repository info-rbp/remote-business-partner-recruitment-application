import { paginate } from '../../../_lib/database.js';
import { ok, safeHandler } from '../../../_lib/responses.js';

export async function onRequestGet({ request, env }) {
  return safeHandler(async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const page = url.searchParams.get('page') || 1;
    const limit = url.searchParams.get('limit') || 25;

    const whereParts = ['1=1'];
    const whereParams = [];
    if (status) { whereParts.push('status = ?'); whereParams.push(status); }

    const { rows, pagination } = await paginate(env, {
      table: 'candidate_interest',
      whereSql: whereParts.join(' AND '),
      whereParams,
      orderBy: 'created_at DESC',
      page, limit
    });
    return ok(rows, { pagination });
  });
}
