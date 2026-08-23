# DEPLOYMENT — Remote Business Partner (Cloudflare Pages + Functions + D1 + R2 + Firebase)

**Status: this code has never been run.** This GenSpark editor cannot create
a Cloudflare account, a Firebase project, a D1 database, an R2 bucket, or a
Turnstile widget, and cannot run `npm install` / `wrangler`. Everything below
must be carried out by a developer with real Cloudflare + Firebase account
access. See `PRELAUNCH_BLOCKERS.md` for the checklist of what is still
outstanding, and do not skip the acceptance tests in that document.

## 1. Cloudflare

### 1.1 Create D1 databases

```
wrangler d1 create rbp-recruitment
wrangler d1 create rbp-recruitment-preview
```

Note the `database_id` values returned and put them into your real
`wrangler.toml` (copied from `wrangler.toml.example` in this repo).

### 1.2 Apply the migration

```
wrangler d1 migrations apply rbp-recruitment --remote
wrangler d1 migrations apply rbp-recruitment-preview --remote
```

This runs `migrations/0001_initial.sql`, creating `vacancies`, `applications`,
`recruitment_requests`, `candidate_interest`, `staff_users`, and all required
indexes.

### 1.3 Create the private R2 bucket

```
wrangler r2 bucket create rbp-recruitment-cvs
```

Confirm in the Cloudflare dashboard that:
- Public access is **disabled**
- No public development URL has been enabled
- No public custom domain is attached to this bucket

CVs are only ever retrieved through the authenticated
`GET /api/admin/applications/:id/cv` endpoint (see `functions/api/admin/applications/[id]/cv.js`),
which streams the object server-side after verifying the caller is an
approved staff user. No R2 credentials are ever exposed to the browser.

### 1.4 Bind D1 and R2 to the Pages project

In `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "rbp-recruitment"
database_id = "<from step 1.1>"

[[r2_buckets]]
binding = "CV_BUCKET"
bucket_name = "rbp-recruitment-cvs"
```

...and the matching `[env.preview.*]` sections pointing at the preview
database, per `wrangler.toml.example`. Pages Functions access these
exclusively through `context.env.DB` / `context.env.CV_BUCKET` — never
through public credentials embedded anywhere in this codebase.

### 1.5 Configure environment variables and secrets

Plain vars (`[vars]` in `wrangler.toml`):
- `FIREBASE_PROJECT_ID` — your Firebase project ID
- `BUSINESS_TIMEZONE` — `Australia/Perth` for this deployment (used by
  `getCurrentBusinessDate()` in `functions/_lib/database.js` to determine
  vacancy deadlines using RBP's business timezone, never the visitor's
  browser clock)

Secrets (never in a file — set via CLI):
```
wrangler pages secret put TURNSTILE_SECRET_KEY
wrangler pages secret put TURNSTILE_SECRET_KEY --env preview
```

### 1.6 Configure Cloudflare Turnstile

1. Create a Turnstile widget in the Cloudflare dashboard for your production
   (and preview) domain(s).
2. Put the **site key** (public) into the three public forms — job
   application, Register Your Interest, Start Recruitment — where the
   frontend renders the Turnstile widget (see `js/api.js` / the relevant
   page scripts, marked `TURNSTILE_SITE_KEY`).
3. Set the **secret key** as `TURNSTILE_SECRET_KEY` per step 1.5. Never put
   it in any file that ships to the browser.
4. For local/dev testing, use Cloudflare's published Turnstile testing keys
   rather than disabling verification in code — there is no
   environment-conditional bypass anywhere in `functions/_lib/turnstile.js`,
   and none should be added.

### 1.7 Deploy Pages + Functions

Pages Functions require a Git-connected Pages project or a Wrangler-based
deploy — a plain dashboard "Direct Upload" does not support Functions.

```
npm install
npm run prelaunch     # must pass before deploying — see scripts/prelaunch-check.mjs
npm run deploy        # wrangler pages deploy .
```

or connect this repository to a Cloudflare Pages project via Git and let
Cloudflare build/deploy on push, with the same bindings/secrets configured
in the Pages dashboard.

## 2. Firebase (staff authentication only)

Firebase is used **only** for staff Email/Password authentication. Do not
introduce Firestore, Firebase Storage, or Firebase Hosting for this project.

1. Create a Firebase project (console.firebase.google.com).
2. Authentication → Sign-in method → enable **Email/Password** only. Do not
   enable any other sign-in provider for V1 (no Google Sign-In, no
   candidate/employer login).
3. Authentication → Settings → Authorized domains → add your Cloudflare
   Pages production and preview domains.
4. Authentication → Users → manually create one account per staff member.
   There is no public registration UI anywhere in this codebase — accounts
   are created here, by an administrator, only.
5. For each staff account, note the Firebase UID shown in the console, then
   insert a matching row into `staff_users`:

   ```sql
   INSERT INTO staff_users (
       id, firebase_uid, email, display_name, role, active, created_at, updated_at
   ) VALUES (
       '<generated-uuid>',
       '<actual-firebase-uid>',
       '<actual-staff-email>',
       '<actual-name>',
       'admin',
       1,
       '<current-iso-timestamp>',
       '<current-iso-timestamp>'
   );
   ```

6. Project Settings → General → Web app config (`apiKey`, `authDomain`,
   `projectId`, `appId`) — paste the public values into `login.html` and
   `admin.html` where marked `FIREBASE_CONFIG`. These are public by design.
7. Project Settings → Service accounts → do **not** download or commit the
   service-account JSON. `functions/_lib/auth.js` verifies ID tokens using
   Firebase's publicly published signing keys.
8. Test sign-in with approved and unapproved accounts, password reset, and sign-out.

## 3. Testing

1. Run the pre-launch static check:
   ```
   npm run prelaunch
   ```
2. Execute every acceptance test listed in `PRELAUNCH_BLOCKERS.md` §4
   against the real deployed instance.
3. Verify preview deployments do not use production D1/R2 resources.

## 4. What "done" looks like

Do not describe this application as production-ready until every box in the
Definition of Done can be truthfully checked, including that the acceptance
tests above have actually been run against a real deployment.
