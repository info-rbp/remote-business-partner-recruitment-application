import { first, run, nowIso } from '../../../_lib/database.js';
import { ok, notFound, validationError, safeHandler } from '../../../_lib/responses.js';
import { oneOf, INTEREST_STATUSES } from '../../../_lib/validation.js';

export async function onRequestGet({ env, params }) {
  return safeHandler(async () => {
    const row = await first(env, 'SELECT * FROM candidate_interest WHERE id = ?', [params.id]);
    if (!row) return notFound();
    return ok(row);
  });
}

export async function onRequestPatch({ request, env, params }) {
  return safeHandler(async () => {
    const existing = await first(env, 'SELECT * FROM candidate_interest WHERE id = ?', [params.id]);
    if (!existing) return notFound();

    const body = await request.json().catch(() => ({}));
    const allowedKeys = Object.keys(body).filter(k => k !== 'status');
    if (allowedKeys.length > 0) return validationError(`The following fields cannot be updated here: ${allowedKeys.join(', ')}.`);
    if (body.status === undefined) return validationError('No editable fields were supplied.');

    const err = oneOf(body.status, INTEREST_STATUSES, 'Status');
    if (err) return validationError(err);

    await run(env, 'UPDATE candidate_interest SET status = ?, updated_at = ? WHERE id = ?', [body.status, nowIso(), params.id]);
    return ok({ id: params.id });
  });
}
