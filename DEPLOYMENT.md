# DEPLOYMENT — Remote Business Partner

The application is designed for **Cloudflare Pages + Pages Functions + D1 +
private R2 + Firebase Authentication + Cloudflare Turnstile + Cloudflare Email Service**.

The public site can deploy before every backend service is configured. Public
forms fail closed until Turnstile is configured, staff sign-in fails until
Firebase is configured, and transactional email delivery is skipped safely when
Email Service credentials are absent so a successful form submission is never
lost because an email could not be sent.

## 1. Cloudflare Pages

Connect the GitHub repository to a Cloudflare Pages project.

Recommended settings:

- Production branch: `main`
- Framework preset: None
- Root directory: repository root
- Build command: install dependencies as required by the Pages build environment
- Functions directory: `/functions` (detected automatically by Pages)

The repository contains Pages Functions under `/functions/api/*`.

## 2. D1

Create the production database:

```bash
wrangler d1 create rbp-recruitment
```

Optionally create a separate preview/testing database:

```bash
wrangler d1 create rbp-recruitment-preview
```

Apply the schema migrations:

```bash
wrangler d1 migrations apply rbp-recruitment --remote
```

The schema contains:

- `vacancies`
- `applications`
- `recruitment_requests`
- `candidate_interest`
- `staff_users`
- `deleted_records` (soft-delete audit/grace-period markers)
- `rbp_schema_migrations`

The runtime bootstrap in `functions/_lib/schema.js` also applies missing schema
versions automatically on the first D1 access.

Bind the production D1 database to the Pages project with the binding name:

```text
DB
```

## 3. Private R2 CV storage

Create the bucket:

```bash
wrangler r2 bucket create rbp-recruitment-cvs
```

Bind it to Pages with:

```text
CV_BUCKET
```

The bucket must remain private:

- Public access: OFF
- Public development URL: OFF
- Public custom domain: none

CVs are downloaded only through the authenticated endpoint:

```text
GET /api/admin/applications/:id/cv
```

## 4. Cloudflare environment variables

Configure these normal Pages environment variables:

```text
BUSINESS_TIMEZONE=Australia/Perth
FIREBASE_PROJECT_ID=business-plan-applicatio-17047
TURNSTILE_SITE_KEY=<public-turnstile-site-key>
TURNSTILE_ALLOWED_HOSTNAMES=remote-business-partner-recruitment-application.pages.dev
CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
RECRUITMENT_EMAIL_FROM=recruitment@remotebusinesspartner.com.au
RECRUITMENT_NOTIFICATION_EMAIL=recruitment@remotebusinesspartner.com.au
PUBLIC_SITE_URL=https://remote-business-partner-recruitment-application.pages.dev
```

`RECRUITMENT_EMAIL_FROM`, `RECRUITMENT_NOTIFICATION_EMAIL` and
`PUBLIC_SITE_URL` have the values above as application defaults, but explicitly
setting them in production makes future domain changes easier to manage.

When a custom domain is added, update both `PUBLIC_SITE_URL` and
`TURNSTILE_ALLOWED_HOSTNAMES`.

Example:

```text
TURNSTILE_ALLOWED_HOSTNAMES=remote-business-partner-recruitment-application.pages.dev,recruitment.remotebusinesspartner.com.au
PUBLIC_SITE_URL=https://recruitment.remotebusinesspartner.com.au
```

## 5. Cloudflare secrets

Store these only as Pages secrets, never in GitHub:

```text
TURNSTILE_SECRET_KEY
CLOUDFLARE_EMAIL_API_TOKEN
```

The email token should be narrowly scoped to **Email Sending: Edit** for the
relevant Cloudflare account.

## 6. Cloudflare Turnstile

Create a **Managed** Turnstile widget in the Cloudflare dashboard for the
production hostname.

The application protects three public actions:

| Form | Turnstile action |
|---|---|
| Job application | `job_application` |
| Candidate registration | `candidate_interest` |
| Employer recruitment request | `recruitment_request` |

The public site key is retrieved through:

```text
GET /api/config
```

`functions/_lib/turnstile.js` verifies each token server-side and validates the
expected action and approved hostname(s).

## 7. Firebase Authentication

Firebase is used **only for staff authentication**. The application does not
require Firebase Hosting, Firestore or Firebase Storage.

1. Enable Email/Password authentication.
2. Keep the public Firebase web configuration in `js/firebase-config.js`.
3. Set Cloudflare `FIREBASE_PROJECT_ID` to the same project ID.
4. Add the Pages production/custom domain to Firebase Authorized domains.
5. Create staff accounts in Firebase Authentication.
6. Insert each approved Firebase UID into D1 `staff_users`.

A valid Firebase user is not enough by itself. The backend also requires an
active matching `staff_users` record.

## 8. Cloudflare Email Service

Transactional email is sent through the Cloudflare Email Service REST API from
Pages Functions. The integration sends:

- new application notification to `recruitment@remotebusinesspartner.com.au`
- candidate application receipt confirmation
- candidate-interest notification and confirmation
- employer recruitment-request notification and confirmation

Candidate CVs are **never attached** to notification emails. Staff must retrieve
CVs through the authenticated Admin area.

Cloudflare setup:

1. In Cloudflare, go to **Compute > Email Service > Email Sending**.
2. Onboard `remotebusinesspartner.com.au` for Email Sending and allow Cloudflare
   to add/verify the required SPF/DKIM/bounce records.
3. Confirm the sender `recruitment@remotebusinesspartner.com.au` is permitted.
4. Create a Cloudflare API token with **Email Sending: Edit** permission scoped
   to the relevant account.
5. Add the account ID as `CLOUDFLARE_ACCOUNT_ID`.
6. Add the token as the Pages secret `CLOUDFLARE_EMAIL_API_TOKEN`.
7. Redeploy the Pages project.
8. Submit a controlled test form and confirm both the RBP notification and the
   submitter confirmation are delivered.

Cloudflare Email Sending for arbitrary external recipients requires the account
to be entitled to Email Sending. If Email Service is not enabled or the token is
missing, the application logs the email failure but still preserves the
successfully submitted recruitment record.

## 9. Retention and deletion controls

Admin can remove employer recruitment requests and candidate-interest
registrations from the active dashboard.

The deletion model is deliberately two-stage:

1. The record is immediately hidden and a marker is written to `deleted_records`.
2. The original record remains for a **30-day operational grace period**.
3. When an authorised Admin list request runs after that grace period, eligible
   soft-deleted records are permanently purged from D1.

This applies to employer recruitment requests and candidate-interest
registrations. Application/CV deletion remains governed by the dedicated
application delete workflow so D1 and R2 can be cleaned together.

## 10. Privacy and legal identity

The recruitment service is published as:

```text
Remote Business Partner
ABN 76 098 718 150
recruitment@remotebusinesspartner.com.au
```

`privacy.html` contains the recruitment privacy policy and the public forms link
to it.

## 11. Testing before real candidate data

Run the repository's static check:

```bash
npm run prelaunch
```

Then complete the acceptance checklist in `PRELAUNCH_BLOCKERS.md`, including:

- public vacancy security
- staff authentication
- Turnstile action/hostname enforcement
- CV upload/storage/download
- transactional email delivery
- soft-delete and 30-day purge behaviour
- privacy acknowledgement storage
- the full vacancy-to-application workflow

## 12. GitHub / Cloudflare workflow

Cloudflare Pages is connected to the GitHub `main` branch. Changes pushed to
`main` should trigger a Pages deployment.

Use GitHub as the source of truth for application code. Do not commit:

- Firebase service-account keys
- Turnstile secret keys
- Cloudflare API tokens
- candidate CVs
- real candidate or employer records
- `.env` or local secret files
