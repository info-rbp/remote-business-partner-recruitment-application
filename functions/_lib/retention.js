// Soft-delete and retention helpers for recruitment requests and candidate-interest records.
//
// Deletion is two-stage:
//   1. Admin DELETE immediately hides the record and records a deletion marker.
//   2. Soft-deleted records are permanently purged after the grace period when
//      an authorised admin list request next runs.
//
// The separate deleted_records table avoids destructive schema alterations to
// existing recruitment tables and gives us a small audit trail during the grace period.

import { all, first, nowIso } from './database.js';

export const SOFT_DELETE_GRACE_DAYS = 30;

const RESOURCE_CONFIG = {
  candidate_interest: {
    table: 'candidate_interest',
    deletedStatus: 'Archived'
  },
  recruitment_request: {
    table: 'recruitment_requests',
    deletedStatus: 'Closed'
  }
};

export function activeRecordWhere(resourceType, tableAlias) {
  if (!RESOURCE_CONFIG[resourceType]) throw new Error(`Unsupported retention resource: ${resourceType}`);
  const alias = tableAlias || RESOURCE_CONFIG[resourceType].table;
  return `NOT EXISTS (
    SELECT 1 FROM deleted_records d
    WHERE d.resource_type = '${resourceType}' AND d.resource_id = ${alias}.id
  )`;
}

export async function getActiveRecord(env, resourceType, id) {
  const cfg = RESOURCE_CONFIG[resourceType];
  if (!cfg) throw new Error(`Unsupported retention resource: ${resourceType}`);
  return first(
    env,
    `SELECT * FROM ${cfg.table}
     WHERE id = ?
       AND ${activeRecordWhere(resourceType, cfg.table)}`,
    [id]
  );
}

export async function softDeleteRecord(env, resourceType, id, deletedBy) {
  const cfg = RESOURCE_CONFIG[resourceType];
  if (!cfg) throw new Error(`Unsupported retention resource: ${resourceType}`);

  const existing = await getActiveRecord(env, resourceType, id);
  if (!existing) return false;

  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE ${cfg.table} SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(cfg.deletedStatus, timestamp, id),
    env.DB.prepare(`
      INSERT INTO deleted_records (resource_type, resource_id, deleted_at, deleted_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(resource_type, resource_id)
      DO UPDATE SET deleted_at = excluded.deleted_at, deleted_by = excluded.deleted_by
    `).bind(resourceType, id, timestamp, deletedBy || null)
  ]);

  return true;
}

function cutoffIso(days) {
  const safeDays = Math.max(1, Math.min(3650, Number(days) || SOFT_DELETE_GRACE_DAYS));
  return new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function purgeExpiredSoftDeletes(env, graceDays = SOFT_DELETE_GRACE_DAYS) {
  const cutoff = cutoffIso(graceDays);
  const markers = await all(env, `
    SELECT resource_type, resource_id
    FROM deleted_records
    WHERE deleted_at <= ?
    ORDER BY deleted_at ASC
    LIMIT 100
  `, [cutoff]);

  if (!markers.length) return 0;

  const statements = [];
  for (const marker of markers) {
    const cfg = RESOURCE_CONFIG[marker.resource_type];
    if (!cfg) {
      // Unknown historical marker: remove the marker only, never interpolate an unknown table name.
      statements.push(
        env.DB.prepare('DELETE FROM deleted_records WHERE resource_type = ? AND resource_id = ?')
          .bind(marker.resource_type, marker.resource_id)
      );
      continue;
    }

    statements.push(
      env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(marker.resource_id),
      env.DB.prepare('DELETE FROM deleted_records WHERE resource_type = ? AND resource_id = ?')
        .bind(marker.resource_type, marker.resource_id)
    );
  }

  await env.DB.batch(statements);
  return markers.length;
}
