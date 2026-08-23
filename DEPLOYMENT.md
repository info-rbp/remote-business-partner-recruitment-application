# DEPLOYMENT — Remote Business Partner

The application is designed for **Cloudflare Pages + Pages Functions + D1 +
private R2 + Firebase Authentication + Cloudflare Turnstile**.

The public site can deploy before every backend service is configured, but the
public forms intentionally fail closed until Turnstile is configured, and staff
sign-in intentionally fails until Firebase is configured.

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

Apply the schema migration:

```bash
wrangler d1 migrations apply rbp-recruitment --remote
```

The migration creates:

- `vacancies`
- `applications`
- `recruitment_requests`
- `candidate_interest`
- `staff_users`

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
FIREBASE_PROJECT_ID=<firebase-project-id>
TURNSTILE_SITE_KEY=<public-turnstile-site-key>
TURNSTILE_ALLOWED_HOSTNAMES=remote-business-partner-recruitment-application.pages.dev
```

When a custom domain is added, include it in
`TURNSTILE_ALLOWED_HOSTNAMES` as a comma-separated hostname.

Example:

```text
TURNSTILE_ALLOWED_HOSTNAMES=remote-business-partner-recruitment-application.pages.dev,recruitment.remotebusinesspartner.com.au
```

## 5. Cloudflare Turnstile

Create a **Managed** Turnstile widget in the Cloudflare dashboard for the
production hostname.

The application protects three public actions:

| Form | Turnstile action |
|---|---|
| Job application | `job_application` |
| Candidate registration | `candidate_interest` |
| Employer recruitment request | `recruitment_request` |

The public **site key** is not hard-coded into GitHub. Set it as:

```text
TURNSTILE_SITE_KEY
```

The browser retrieves that safe public value through:

```text
GET /api/config
```

Store the Turnstile **secret key** only as a Cloudflare Pages secret:

```bash
wrangler pages secret put TURNSTILE_SECRET_KEY
```

Do not commit the secret key to GitHub.

`functions/_lib/turnstile.js` verifies the token server-side and also validates:

- expected action
- approved hostname(s), when `TURNSTILE_ALLOWED_HOSTNAMES` is configured

For local/testing work, use Cloudflare's official Turnstile testing keys rather
than bypassing verification in code.

## 6. Firebase Authentication

Firebase is used **only for staff authentication**. The application does not
require Firebase Hosting, Firestore or Firebase Storage.

1. Create/configure a Firebase project.
2. Enable Email/Password authentication.
3. Create a Firebase Web App.
4. Copy the public Firebase web configuration into `js/firebase-config.js`,
   replacing every `REPLACE_ME` value.
5. Set Cloudflare `FIREBASE_PROJECT_ID` to exactly the same project ID.
6. Add the Pages production/custom domain to Firebase Authorized domains.
7. Manually create staff accounts in Firebase Authentication.
8. Record each staff user's Firebase UID.
9. Insert each approved UID into the D1 `staff_users` table.

Example:

```sql
INSERT INTO staff_users (
  id, firebase_uid, email, display_name, role, active, created_at, updated_at
) VALUES (
  '<uuid>',
  '<firebase-uid>',
  '<staff-email>',
  '<staff-name>',
  'admin',
  1,
  '<iso-timestamp>',
  '<iso-timestamp>'
);
```

A valid Firebase user is not enough by itself. The backend also requires an
active matching `staff_users` record.

## 7. Privacy

`privacy.html` contains the recruitment privacy policy used by the application.
The public forms include short collection notices linking to that policy.

Before final production use, confirm that the published RBP identity and any
legal entity/business details are correct for the organisation operating the
service.

## 8. Testing before real candidate data

Run the repository's static check:

```bash
npm run prelaunch
```

Then complete the acceptance checklist in `PRELAUNCH_BLOCKERS.md`, including:

- public vacancy security
- staff authentication
- Turnstile action/hostname enforcement
- CV upload/storage/download
- privacy acknowledgement storage
- the full vacancy-to-application workflow

## 9. GitHub / Cloudflare workflow

Cloudflare Pages is connected to the GitHub `main` branch. Changes pushed to
`main` should trigger a Pages deployment.

Use GitHub as the source of truth for application code. Do not commit:

- Firebase service-account keys
- Turnstile secret keys
- Cloudflare API tokens
- candidate CVs
- real candidate or employer records
- `.env` or local secret files
