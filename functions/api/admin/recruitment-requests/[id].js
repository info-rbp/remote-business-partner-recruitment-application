import { run, nowIso } from '../../../_lib/database.js';
import { getActiveRecord, softDeleteRecord } from '../../../_lib/retention.js';
import { ok, notFound, validationError, safeHandler } from '../../../_lib/responses.js';
import { oneOf, REQUEST_STATUSES } from '../../../_lib/validation.js';

export async function onRequestGet({ env, params }) {
  return safeHandler(async () => {
    const row = await getActiveRecord(env, 'recruitment_request', params.id);
    if (!row) return notFound();
    return ok(row);
  });
}

export async function onRequestPatch({ request, env, params }) {
  return safeHandler(async () => {
    const existing = await getActiveRecord(env, 'recruitment_request', params.id);
    if (!existing) return notFound();

    const body = await request.json().catch(() => ({}));
    const allowedKeys = Object.keys(body).filter(k => k !== 'status');
    if (allowedKeys.length > 0) return validationError(`The following fields cannot be updated here: ${allowedKeys.join(', ')}.`);
    if (body.status === undefined) return validationError('No editable fields were supplied.');

    const err = oneOf(body.status, REQUEST_STATUSES, 'Status');
    if (err) return validationError(err);

    await run(env, 'UPDATE recruitment_requests SET status = ?, updated_at = ? WHERE id = ?', [body.status, nowIso(), params.id]);
    return ok({ id: params.id });
  });
}

export async function onRequestDelete({ env, params, data }) {
  return safeHandler(async () => {
    const deleted = await softDeleteRecord(
      env,
      'recruitment_request',
      params.id,
      data && data.staffUser ? data.staffUser.email : null
    );
    if (!deleted) return notFound();
    return ok({ id: params.id, deleted: true, purge_after_days: 30 });
  });
}
