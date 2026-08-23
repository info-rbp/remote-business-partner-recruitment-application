# Remote Business Partner Recruitment Application

A lightweight recruitment website and staff administration application for **Remote Business Partner**.

The application is deliberately small and conventional. It provides the public recruitment journey, vacancy/application management, employer recruitment requests and candidate-interest registrations without adding AI, a client portal, a candidate account system or other unnecessary platform complexity.

## Public application

- **Home** — recruitment proposition, employer/candidate pathways and current vacancy preview
- **Current Vacancies** — open/current roles with keyword, location and employment-type filters
- **Vacancy Detail** — full job advertisement and secure candidate application with CV upload
- **For Candidates** — candidate value proposition, recruitment process and Register Your Interest form
- **For Employers** — fixed-fee recruitment proposition and Start Recruitment form
- **Privacy Policy** — privacy information and explicit pre-launch legal-information gaps
- **Staff Login** — Firebase Email/Password authentication for approved staff only

## Staff administration

The authenticated administration area provides:

- Overview metrics
- Create, edit, publish, close and delete eligible vacancies
- Candidate application review and status management
- Private CV download
- Internal application notes
- Employer recruitment requests and full request detail
- Candidate-interest registrations

## Architecture

```text
Browser
   |
   v
Cloudflare Pages
   |
   v
Cloudflare Pages Functions
   |
   +--> D1 database
   |
   +--> private R2 CV bucket
   |
   +--> Cloudflare Turnstile validation

Staff Browser
   |
   +--> Firebase Authentication
              |
              v
       Firebase ID token
              |
              v
       /api/admin/* middleware
              |
              +--> cryptographic token verification
              +--> approved staff_users record required
```

### Required services

| Requirement | Service |
|---|---|
| Website hosting | Cloudflare Pages |
| Server-side API | Cloudflare Pages Functions |
| Structured data | Cloudflare D1 |
| CV/document storage | Private Cloudflare R2 |
| Staff authentication | Firebase Authentication, Email/Password only |
| Public form protection | Cloudflare Turnstile |

Firebase is used **only for staff authentication**. The project does not require Firebase Hosting, Firestore or Firebase Storage.

## Repository structure

```text
.
├── index.html
├── vacancies.html
├── vacancy.html
├── for-candidates.html
├── for-employers.html
├── privacy.html
├── login.html
├── admin.html
├── css/
├── js/
├── functions/
│   ├── _lib/
│   └── api/
│       ├── vacancies/
│       ├── applications.js
│       ├── candidate-interest.js
│       ├── recruitment-requests.js
│       └── admin/
├── migrations/
│   └── 0001_initial.sql
├── scripts/
│   └── prelaunch-check.mjs
├── DEPLOYMENT.md
├── PRELAUNCH_BLOCKERS.md
├── wrangler.toml.example
├── _headers
├── robots.txt
└── sitemap.xml
```

## Local preparation

Requires Node.js 18.17+.

```bash
npm install
npm run prelaunch
```

The `prelaunch` script intentionally fails if known prototype/security artefacts are reintroduced, including GenSpark `tables/*` calls, Base64 CV storage, placeholder phone numbers, service-account/private-key material, or obvious committed secrets.

For Cloudflare-local development, first create a real `wrangler.toml` from `wrangler.toml.example`, create/bind development D1/R2 resources and configure the required secrets, then use:

```bash
npm run dev
```

## Deployment

Read **[DEPLOYMENT.md](DEPLOYMENT.md)** before deployment. It contains the required Cloudflare and Firebase provisioning sequence, D1 migration instructions, R2 privacy requirements, Turnstile setup and staff-account seeding process.

The application intentionally ships with placeholder values in:

- `js/firebase-config.js`
- `js/turnstile-config.js`
- `wrangler.toml.example`

Those values must be replaced/configured in the correct environment before staff authentication or public forms can operate.

## Production readiness

This repository contains the application code, but cloning it does **not** make the system production-ready by itself.

Before collecting real candidate or employer information, all items in **[PRELAUNCH_BLOCKERS.md](PRELAUNCH_BLOCKERS.md)** must be resolved, including:

- production and preview D1 resources provisioned and migrated
- private R2 buckets provisioned
- Firebase project configured and approved staff users seeded
- Turnstile production keys configured
- privacy-policy legal entity / ABN / address / retention details finalised
- acceptance tests run against the real deployment

Do not claim production readiness solely because the HTML pages render.

## Data and security model

### Public vacancy access

Public API routes return only vacancies that are:

- `Open`; and
- not past their configured closing date.

Draft, Closed and expired vacancies are filtered server-side and are not returned to public browsers. Internal vacancy fields such as `employer_name` are excluded from public API responses.

### Candidate applications

Applications are submitted through `POST /api/applications` using `multipart/form-data`.

The server:

1. verifies Turnstile;
2. validates the candidate fields;
3. verifies the vacancy is still Open/current;
4. validates the CV type and size;
5. stores the CV in private R2;
6. stores only application/CV metadata in D1.

CV file bytes are never stored as Base64 in D1.

### Staff access

Every `/api/admin/*` request requires:

1. a cryptographically verified Firebase ID token; and
2. a matching active `staff_users` row in D1.

A valid Firebase account by itself does not grant administration access.

## Recruitment statuses

Application statuses:

- Applied
- Screening
- Shortlisted
- Interview
- Offer
- Hired
- Rejected
- Withdrawn

Vacancy statuses:

- Draft
- Open
- Closed

Employer request statuses:

- New
- Contacted
- Engaged
- Closed

## Scope exclusions

This release intentionally does not include:

- generative AI or automated candidate scoring
- blog/Insights
- candidate accounts or candidate portal
- employer/client accounts or portal
- onboarding platform
- automated sourcing/job-board distribution
- advanced CRM or analytics
- email notification automation

Those can be added later if there is a demonstrated operational need.

## Important repository visibility note

If this repository is public, do not commit real environment secrets, Firebase service-account credentials, private keys, CVs, candidate data or production `.dev.vars`/`.env` files. The included `.gitignore` excludes common local secret/configuration files, but deployment credentials must still be managed through Cloudflare/Firebase rather than source control.
