# Remote Business Partner Recruitment Application

A lightweight recruitment website and staff administration application for **Remote Business Partner**.

The application provides the public recruitment journey, vacancy/application management, employer recruitment requests, candidate-interest registrations, secure staff administration and transactional recruitment email without adding AI-driven candidate decisions or public user accounts.

## Public application

- **Home** — recruitment proposition, employer/candidate pathways and current vacancy preview
- **Current Vacancies** — open/current roles with keyword, location and employment-type filters
- **Vacancy Detail** — full job advertisement and secure candidate application with CV upload
- **For Candidates** — candidate value proposition, recruitment process and Register Your Interest form
- **For Employers** — fixed-fee recruitment proposition and Start Recruitment form
- **Privacy Policy** — recruitment privacy information
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
- Soft deletion for employer requests and candidate-interest records

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
   |
   +--> Google Workspace Gmail API

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
| Transactional recruitment email | Google Workspace Gmail API |

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
│   │   ├── email.js
│   │   └── retention.js
│   └── api/
│       ├── vacancies/
│       ├── applications.js
│       ├── candidate-interest.js
│       ├── recruitment-requests.js
│       └── admin/
├── migrations/
│   ├── 0001_initial.sql
│   └── 0002_retention_soft_delete.sql
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

The `prelaunch` script intentionally fails if known prototype/security artefacts are reintroduced, including GenSpark `tables/*` calls, Base64 CV storage, placeholder phone numbers, service-account/private-key material, or obvious committed secrets such as the Gmail OAuth client secret or refresh token.

For Cloudflare-local development, create a real `wrangler.toml` from `wrangler.toml.example`, create/bind development D1/R2 resources and configure the required secrets, then use:

```bash
npm run dev
```

## Deployment

Read **[DEPLOYMENT.md](DEPLOYMENT.md)** before deployment. It contains the Cloudflare/Firebase provisioning sequence, D1 migration instructions, R2 privacy requirements, Turnstile setup, Google Workspace Gmail API setup and staff-account seeding process.

Production secrets belong in Cloudflare Pages environment secrets and must never be committed to GitHub.

## Production readiness

Before collecting real candidate or employer information, complete the remaining items in **[PRELAUNCH_BLOCKERS.md](PRELAUNCH_BLOCKERS.md)**, including:

- preview/production data isolation checks
- Firebase and staff-access acceptance testing
- Turnstile action/hostname testing
- private R2 CV upload/download testing
- Gmail API notification/confirmation delivery testing
- deletion/retention acceptance testing
- full Draft → publish → apply → review → close workflow testing

Do not claim production readiness solely because the HTML pages render. Humans have tried that approach before. It remains unconvincing.

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
6. stores application/CV metadata in D1;
7. schedules Gmail notification and confirmation messages after persistence succeeds.

CV file bytes are never stored as Base64 in D1 and are never attached to recruitment notification emails.

### Transactional email

`functions/_lib/email.js` uses the Google Workspace Gmail API. The Pages Function exchanges a stored Google OAuth refresh token for a short-lived access token and sends RFC 2822/MIME messages through `users.messages.send`.

The OAuth authorisation should be limited to:

```text
https://www.googleapis.com/auth/gmail.send
```

The configured sender and operational mailbox is:

```text
recruitment@remotebusinesspartner.com.au
```

Email failures are logged but do not roll back a recruitment form submission that has already been stored successfully.

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

Those can be added later if there is a demonstrated operational need.

## Important repository visibility note

If this repository is public, do not commit real environment secrets, Firebase service-account credentials, Google OAuth secrets/refresh tokens, private keys, CVs, candidate data or production `.dev.vars`/`.env` files. Deployment credentials must be managed through Cloudflare/Firebase/Google configuration rather than source control.
