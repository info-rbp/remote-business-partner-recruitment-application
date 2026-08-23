// Small D1 helpers. IDs and timestamps are generated server-side.

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function getCurrentBusinessDate(env) {
  const timeZone = (env && env.BUSINESS_TIMEZONE) || 'Australia/Perth';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fmt.format(new Date());
}

export async function all(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  const res = await stmt.all();
  return res.results || [];
}

export async function first(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  return await stmt.first();
}

export async function run(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  return await stmt.run();
}

export async function paginate(env, { table, whereSql = '1=1', whereParams = [], orderBy = 'created_at DESC', page = 1, limit = 25 }) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (page - 1) * limit;

  const totalRow = await first(env, `SELECT COUNT(*) as count FROM ${table} WHERE ${whereSql}`, whereParams);
  const total = totalRow ? totalRow.count : 0;
  const rows = await all(
    env,
    `SELECT * FROM ${table} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );

  return {
    rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
  };
}
