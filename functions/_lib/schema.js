// Idempotent runtime bootstrap for the D1 schema.
//
// SQL migrations remain documented under /migrations, while this helper makes
// production resilient when a newly-bound D1 database has not been migrated by
// Wrangler. Each schema version is recorded in rbp_schema_migrations.

let schemaReadyPromise = null;

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS rbp_schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`;

const SCHEMA_V1 = [
  `CREATE TABLE IF NOT EXISTS vacancies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    employer_name TEXT,
    department TEXT,
    location TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('Full-Time','Part-Time','Casual','Contract','Temporary')),
    experience_level TEXT,
    salary_range TEXT,
    summary TEXT,
    description TEXT NOT NULL,
    responsibilities TEXT,
    requirements TEXT,
    benefits TEXT,
    status TEXT NOT NULL CHECK (status IN ('Draft','Open','Closed')),
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
    posted_at TEXT,
    deadline_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status)`,
  `CREATE INDEX IF NOT EXISTS idx_vacancies_deadline ON vacancies(deadline_date)`,

  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    vacancy_id TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    linkedin_url TEXT,
    cover_note TEXT,
    status TEXT NOT NULL CHECK (status IN ('Applied','Screening','Shortlisted','Interview','Offer','Hired','Rejected','Withdrawn')),
    internal_notes TEXT,
    resume_key TEXT NOT NULL,
    resume_filename TEXT NOT NULL,
    resume_type TEXT NOT NULL,
    resume_size INTEGER NOT NULL,
    privacy_acknowledged INTEGER NOT NULL CHECK (privacy_acknowledged IN (0,1)),
    privacy_acknowledged_at TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_applications_vacancy ON applications(vacancy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`,
  `CREATE INDEX IF NOT EXISTS idx_applications_applied ON applications(applied_at)`,

  `CREATE TABLE IF NOT EXISTS recruitment_requests (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    position_title TEXT NOT NULL,
    employment_type TEXT NOT NULL,
    location TEXT,
    remuneration TEXT,
    preferred_start_date TEXT,
    requirements TEXT,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Engaged','Closed')),
    privacy_acknowledged INTEGER NOT NULL CHECK (privacy_acknowledged IN (0,1)),
    privacy_acknowledged_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_requests_status ON recruitment_requests(status)`,

  `CREATE TABLE IF NOT EXISTS candidate_interest (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    linkedin_url TEXT,
    preferred_roles TEXT,
    preferred_location TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Archived')),
    privacy_acknowledged INTEGER NOT NULL CHECK (privacy_acknowledged IN (0,1)),
    privacy_acknowledged_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_interest_status ON candidate_interest(status)`,

  `CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin','recruiter')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_staff_firebase_uid ON staff_users(firebase_uid)`
];

const SCHEMA_V2 = [
  `CREATE TABLE IF NOT EXISTS deleted_records (
    resource_type TEXT NOT NULL CHECK (resource_type IN ('candidate_interest','recruitment_request')),
    resource_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    deleted_by TEXT,
    PRIMARY KEY (resource_type, resource_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at ON deleted_records(deleted_at)`
];

async function isVersionApplied(env, version) {
  return env.DB
    .prepare('SELECT version FROM rbp_schema_migrations WHERE version = ?')
    .bind(version)
    .first();
}

async function applyVersion(env, version, statements) {
  const applied = await isVersionApplied(env, version);
  if (applied) return;

  const prepared = statements.map(sql => env.DB.prepare(sql));
  prepared.push(
    env.DB
      .prepare('INSERT OR IGNORE INTO rbp_schema_migrations (version, applied_at) VALUES (?, ?)')
      .bind(version, new Date().toISOString())
  );

  // D1 batch is transactional. A partially-created schema version is rolled
  // back and can safely retry on a later request.
  await env.DB.batch(prepared);
}

async function initialiseSchema(env) {
  if (!env || !env.DB) {
    throw new Error('Cloudflare D1 binding "DB" is not configured for this deployment.');
  }

  await env.DB.prepare(CREATE_MIGRATIONS_TABLE).run();
  await applyVersion(env, 1, SCHEMA_V1);
  await applyVersion(env, 2, SCHEMA_V2);
}

export function ensureSchema(env) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = initialiseSchema(env).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}
