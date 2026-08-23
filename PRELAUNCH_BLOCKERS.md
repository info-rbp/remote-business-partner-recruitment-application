# Pre-Launch Blockers — Remote Business Partner

This document records the remaining production checks for the Remote Business
Partner recruitment application. The public site is deployed on Cloudflare
Pages, but real candidate/employer data should only be collected after the
items below are verified.

## 1. Privacy and business details

`privacy.html` now contains a recruitment-specific privacy policy covering:

- candidate applications and CVs
- candidate registrations / expressions of interest
- employer recruitment requests
- prospective-employer disclosure
- cloud service providers
- information security
- access, correction and deletion requests
- a general 24-month candidate retention practice
- human-led recruitment and no automated recruitment decisions

Before the final branded production launch, confirm that **Remote Business
Partner** is the correct public identity for the service. Add any legal entity
name, ABN, business address or telephone number that RBP chooses or is required
to publish. Review the policy whenever recruitment practices, service
providers, retention practices or applicable privacy requirements materially
change.

## 2. Cloudflare infrastructure to verify

- [ ] Production D1 database exists and `migrations/0001_initial.sql` has been applied
- [ ] Preview/testing uses a separate D1 database where practical
- [ ] Private R2 bucket (`rbp-recruitment-cvs`) exists
- [ ] R2 public access, public development URL and public custom domain are disabled
- [ ] Pages binding `DB` points to the production D1 database
- [ ] Pages binding `CV_BUCKET` points to the private CV bucket
- [ ] `BUSINESS_TIMEZONE=Australia/Perth`
- [ ] `TURNSTILE_SITE_KEY` is configured as a normal Pages environment variable
- [ ] `TURNSTILE_SECRET_KEY` is configured as a Pages secret
- [ ] `TURNSTILE_ALLOWED_HOSTNAMES` contains the approved production hostname(s)
- [ ] Turnstile widget uses Managed mode and is registered for the production hostname

## 3. Firebase staff authentication

- [ ] Create/configure the Firebase project
- [ ] Enable Email/Password sign-in
- [ ] Replace the `REPLACE_ME` values in `js/firebase-config.js`
- [ ] Set `FIREBASE_PROJECT_ID` in Cloudflare to the same Firebase project ID
- [ ] Add the Cloudflare production/custom domain to Firebase Authorized domains
- [ ] Manually create approved staff users
- [ ] Insert each approved Firebase UID into `staff_users`
- [ ] Test approved and unapproved account behaviour
- [ ] Test password reset and sign-out

## 4. Acceptance tests

- [ ] No-token admin API request returns 401
- [ ] Invalid Firebase token returns 401
- [ ] Valid Firebase account not listed in `staff_users` returns 403
- [ ] Approved staff user can load Admin
- [ ] Public vacancy API returns only Open and unexpired vacancies
- [ ] Draft, Closed and expired vacancies are not publicly accessible
- [ ] Public vacancy response does not expose `employer_name` or staff-only fields
- [ ] Job application requires a valid Turnstile `job_application` token
- [ ] Candidate registration requires a valid Turnstile `candidate_interest` token
- [ ] Employer request requires a valid Turnstile `recruitment_request` token
- [ ] Wrong Turnstile action is rejected
- [ ] Wrong Turnstile hostname is rejected when hostname allowlisting is configured
- [ ] CV upload rejects unsupported files and files larger than 5 MB
- [ ] CV objects are not publicly accessible from R2
- [ ] Approved staff can download a CV through the authenticated API
- [ ] Privacy acknowledgement is stored for all public submissions
- [ ] Full workflow passes: create Draft → publish → apply → review → close

## 5. Email notifications

This build still does **not** send email notifications when a new application,
candidate registration or employer recruitment request is submitted. This is
not required for the website to function, but it is recommended before active
recruitment so staff do not need to continuously check the dashboard.

## 6. Ongoing maintenance

New blockers discovered during production use should be recorded here rather
than silently worked around. Keep Cloudflare, Firebase and dependency settings
under review as the application evolves.
