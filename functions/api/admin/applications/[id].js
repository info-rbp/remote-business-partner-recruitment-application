import { first, run, nowIso } from '../../../_lib/database.js';
import { ok, noContent, notFound, validationError, safeHandler } from '../../../_lib/responses.js';
import { oneOf, optionalString, APPLICATION_STATUSES } from '../../../_lib/validation.js';

export async function onRequestGet({ env, params }) {
  return safeHandler(async () => {
    const row = await first(env, 'SELECT * FROM applications WHERE id = ?', [params.id]);
    if (!row) return notFound();
    return ok(row);
  });
}

export async function onRequestPatch({ request, env, params }) {
  return safeHandler(async () => {
    const existing = await first(env, 'SELECT * FROM applications WHERE id = ?', [params.id]);
    if (!existing) return notFound();

    const body = await request.json().catch(() => ({}));
    const allowedKeys = Object.keys(body).filter(k => !['status', 'internal_notes'].includes(k));
    if (allowedKeys.length > 0) {
      return validationError(`The following fields cannot be updated here: ${allowedKeys.join(', ')}.`);
    }

    if (body.status !== undefined) {
      const err = oneOf(body.status, APPLICATION_STATUSES, 'Status');
      if (err) return validationError(err);
    }
    if (body.internal_notes !== undefined) {
      const err = optionalString(body.internal_notes, 'Internal notes', { max: 5000 });
      if (err) return validationError(err);
    }
    if (body.status === undefined && body.internal_notes === undefined) {
      return validationError('No editable fields were supplied.');
    }

    const sets = [];
    const values = [];
    if (body.status !== undefined) { sets.push('status = ?'); values.push(body.status); }
    if (body.internal_notes !== undefined) { sets.push('internal_notes = ?'); values.push(body.internal_notes); }
    sets.push('updated_at = ?');
    values.push(nowIso());
    values.push(params.id);

    await run(env, `UPDATE applications SET ${sets.join(', ')} WHERE id = ?`, values);
    return ok({ id: params.id });
  });
}

export async function onRequestDelete({ env, params }) {
  return safeHandler(async () => {
    const existing = await first(env, 'SELECT * FROM applications WHERE id = ?', [params.id]);
    if (!existing) return notFound();
    if (existing.resume_key) {
      await env.CV_BUCKET.delete(existing.resume_key).catch(e => console.error('R2 delete failed', e && e.message));
    }
    await run(env, 'DELETE FROM applications WHERE id = ?', [params.id]);
    return noContent();
  });
}
