# Pre-Launch Blockers — Remote Business Partner

This document lists everything that must be resolved by Remote Business
Partner and/or a developer with Cloudflare + Firebase access **before** this
application can truthfully be called production-ready.

## 1. Business/legal information not yet supplied

The Privacy Policy (`privacy.html`) intentionally does **not** invent any of
the following. Until they are supplied by Remote Business Partner (with
legal review as appropriate), the policy contains explicit "Deployment gap"
callouts instead of guessing:

- [ ] Legal entity name
- [ ] ABN (Australian Business Number)
- [ ] Registered postal/business address
- [ ] Telephone number if one is to be published
- [ ] Confirmed data retention period for candidate/employer records
- [ ] Any international data-transfer disclosures, if applicable

**Until these are supplied, the Privacy Policy is not final and this site
must not be used to collect real candidate or employer personal data.**

## 2. Cloudflare infrastructure not yet provisioned

- [ ] Create the production D1 database (`rbp-recruitment`) and a separate
      preview database; apply `migrations/0001_initial.sql` to both
- [ ] Create the private R2 bucket (`rbp-recruitment-cvs`); confirm public
      access, public development URL, and public custom domain are all disabled
- [ ] Bind `DB` and `CV_BUCKET` in the real `wrangler.toml`
- [ ] Create a Cloudflare Turnstile widget; set the public site key and
      `TURNSTILE_SECRET_KEY` as a Cloudflare Pages secret
- [ ] Set `FIREBASE_PROJECT_ID` and `BUSINESS_TIMEZONE`
- [ ] Deploy via Git-connected Pages project or Wrangler

## 3. Firebase project not yet configured

- [ ] Create/configure the Firebase project
- [ ] Enable Email/Password sign-in only
- [ ] Add production and preview Cloudflare domains to Authorized domains
- [ ] Manually create approved staff users
- [ ] Record each Firebase UID
- [ ] Insert a matching row into `staff_users` for each approved UID
- [ ] Test approved and unapproved account behaviour
- [ ] Test password reset and sign-out

## 4. Acceptance tests not yet run against a real deployment

- [ ] Authentication acceptance tests: no token / garbage token / unapproved
      Firebase user / inactive staff / valid approved staff
- [ ] Public vacancy security tests: only Open+current vacancies returned;
      Draft/Closed/expired all 404 on direct access; no internal fields leak
- [ ] Application security tests: Turnstile, vacancy state/deadline, CV type
      and size, consent, D1 row and R2 object
- [ ] CV security tests: private R2, authenticated download only, no CV bytes
      in list responses
- [ ] Public form tests for Candidate Interest and Recruitment Request
- [ ] Full admin end-to-end workflow from draft vacancy through close

## 5. Scope note: email notifications

This build does **not** send email notifications on submission. If RBP wants
candidate/staff email notifications, that is a new feature request to be
scoped and approved separately.

## 6. This list is not exhaustive by design

New blockers discovered during real deployment should be added here as they're
found, not silently worked around.
