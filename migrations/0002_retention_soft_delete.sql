-- Remote Business Partner — retention/deletion controls (schema version 2)
-- Safe to apply after 0001_initial.sql and safe if runtime bootstrap already
-- created these objects because all DDL uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS deleted_records (
    resource_type TEXT NOT NULL
        CHECK (resource_type IN ('candidate_interest','recruitment_request')),
    resource_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    deleted_by TEXT,
    PRIMARY KEY (resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at
    ON deleted_records(deleted_at);

INSERT OR IGNORE INTO rbp_schema_migrations (version, applied_at)
VALUES (2, datetime('now'));
