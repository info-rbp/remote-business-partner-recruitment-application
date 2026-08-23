-- Remote Business Partner — D1 schema (spec items 3-9)
-- Run with: wrangler d1 migrations apply rbp-recruitment --remote
-- (create a separate preview/development database and run this same
-- migration against it — see DEPLOYMENT.md. Preview deployments must not
-- automatically access genuine candidate data.)

CREATE TABLE vacancies (
    id TEXT PRIMARY KEY,

    title TEXT NOT NULL,
    employer_name TEXT,                    -- INTERNAL ONLY. Never returned via public API.

    department TEXT,
    location TEXT NOT NULL,

    job_type TEXT NOT NULL
        CHECK (
            job_type IN (
                'Full-Time',
                'Part-Time',
                'Casual',
                'Contract',
                'Temporary'
            )
        ),

    experience_level TEXT,
    salary_range TEXT,

    summary TEXT,
    description TEXT NOT NULL,
    responsibilities TEXT,
    requirements TEXT,
    benefits TEXT,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'Draft',
                'Open',
                'Closed'
            )
        ),

    is_featured INTEGER NOT NULL DEFAULT 0
        CHECK (is_featured IN (0, 1)),

    posted_at TEXT,
    deadline_date TEXT,                    -- YYYY-MM-DD, or NULL for "open until closed"

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_vacancies_status ON vacancies(status);
CREATE INDEX idx_vacancies_deadline ON vacancies(deadline_date);

CREATE TABLE applications (
    id TEXT PRIMARY KEY,

    vacancy_id TEXT NOT NULL,

    candidate_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,

    linkedin_url TEXT,
    cover_note TEXT,

    status TEXT NOT NULL
        CHECK (
            status IN (
                'Applied',
                'Screening',
                'Shortlisted',
                'Interview',
                'Offer',
                'Hired',
                'Rejected',
                'Withdrawn'
            )
        ),

    internal_notes TEXT,

    -- CV file bytes live only in the private R2 bucket (CV_BUCKET); this row
    -- stores metadata and the private object key only.
    resume_key TEXT NOT NULL,
    resume_filename TEXT NOT NULL,
    resume_type TEXT NOT NULL,
    resume_size INTEGER NOT NULL,

    privacy_acknowledged INTEGER NOT NULL
        CHECK (privacy_acknowledged IN (0, 1)),

    privacy_acknowledged_at TEXT NOT NULL,  -- server-generated, never a client timestamp

    applied_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (vacancy_id)
        REFERENCES vacancies(id)
);

CREATE INDEX idx_applications_vacancy ON applications(vacancy_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_applied ON applications(applied_at);

CREATE TABLE recruitment_requests (
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

    status TEXT NOT NULL DEFAULT 'New'
        CHECK (
            status IN (
                'New',
                'Contacted',
                'Engaged',
                'Closed'
            )
        ),

    privacy_acknowledged INTEGER NOT NULL
        CHECK (privacy_acknowledged IN (0, 1)),

    privacy_acknowledged_at TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_requests_status ON recruitment_requests(status);

CREATE TABLE candidate_interest (
    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,

    linkedin_url TEXT,
    preferred_roles TEXT,
    preferred_location TEXT,
    message TEXT,

    status TEXT NOT NULL DEFAULT 'New'
        CHECK (
            status IN (
                'New',
                'Contacted',
                'Archived'
            )
        ),

    privacy_acknowledged INTEGER NOT NULL
        CHECK (privacy_acknowledged IN (0, 1)),

    privacy_acknowledged_at TEXT NOT NULL,

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_interest_status ON candidate_interest(status);

-- A valid Firebase account must NOT automatically become an authorised RBP
-- user. Staff access requires: valid Firebase account + matching
-- firebase_uid + staff_users.active = 1. This prevents an unauthorised
-- Firebase user from gaining RBP staff access simply by creating an account.
CREATE TABLE staff_users (
    id TEXT PRIMARY KEY,

    firebase_uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,

    display_name TEXT,

    role TEXT NOT NULL DEFAULT 'recruiter'
        CHECK (
            role IN (
                'admin',
                'recruiter'
            )
        ),

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
);

CREATE INDEX idx_staff_firebase_uid ON staff_users(firebase_uid);
