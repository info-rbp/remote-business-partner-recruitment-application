# Pre-Launch Blockers — Remote Business Partner

This document records the remaining production checks for the Remote Business
Partner recruitment application.

## 1. Privacy and business details

The published recruitment identity is now:

```text
Remote Business Partner
ABN 76 098 718 150
recruitment@remotebusinesspartner.com.au
```

`privacy.html` contains a recruitment-specific privacy policy covering candidate
applications/CVs, candidate registrations, employer recruitment requests,
prospective-employer disclosure, cloud services, security, access/correction,
retention/deletion and human-led recruitment.

- [x] RBP public identity confirmed
- [x] ABN published
- [x] Recruitment/privacy contact email confirmed
- [ ] Review the policy if recruitment practices, service providers or retention
      requirements materially change

## 2. Cloudflare infrastructure

The following production components have been implemented/configured during the
current deployment work. They should still be included in acceptance testing:

- [x] Production D1 database configured and bound as `DB`
- [x] Runtime D1 schema bootstrap configured
- [x] Private R2 bucket configured and bound as `CV_BUCKET`
- [x] Firebase staff authentication configured
- [x] Approved admin user inserted in `staff_users`
- [x] Turnstile code/configuration implemented
- [ ] Confirm preview/testing deployments cannot access genuine production D1/R2 data
- [ ] Confirm `BUSINESS_TIMEZONE=Australia/Perth`

## 3. Cloudflare Email Service

Application code now sends, when Cloudflare Email Service is configured:

- RBP notification + candidate confirmation for job applications
- RBP notification + candidate confirmation for candidate-interest registrations
- RBP notification + employer confirmation for recruitment requests

No CV is attached to email.

Remaining Cloudflare account setup/verification:

- [ ] Onboard `remotebusinesspartner.com.au` under Email Service > Email Sending
- [ ] Verify the sending-domain DNS records
- [ ] Create an API token scoped to **Email Sending: Edit**
- [ ] Set `CLOUDFLARE_ACCOUNT_ID`
- [ ] Set `CLOUDFLARE_EMAIL_API_TOKEN` as a Pages secret
- [ ] Redeploy after adding the email configuration
- [ ] Confirm email delivery to `recruitment@remotebusinesspartner.com.au`
- [ ] Confirm candidate confirmation delivery to an external test address
- [ ] Confirm employer confirmation delivery to an external test address

Email failures do not roll back or reject a form submission after its D1/R2
write has succeeded.

## 4. Retention and deletion controls

Employer recruitment requests and candidate-interest registrations now support
soft deletion from Admin:

- deleted records disappear from normal Admin lists immediately
- a marker is stored in `deleted_records`
- records remain for a 30-day operational grace period
- expired soft-deleted records are permanently purged during later authorised
  Admin list requests

Acceptance checks:

- [ ] Delete a test employer recruitment request and confirm it disappears
- [ ] Delete a test candidate-interest record and confirm it disappears
- [ ] Confirm `deleted_records` contains the correct deletion marker and staff email
- [ ] Confirm a soft-deleted record cannot be fetched from its normal Admin endpoint
- [ ] Verify the 30-day purge path in a non-production/test record scenario

## 5. Authentication acceptance tests

- [ ] No-token admin API request returns 401
- [ ] Invalid Firebase token returns 401
- [x] Valid Firebase account not listed in `staff_users` returns 403
- [x] Approved staff user can load Admin
- [ ] Password reset works
- [ ] Sign-out works and protected APIs remain unavailable afterward

## 6. Recruitment workflow acceptance tests

- [ ] Public vacancy API returns only Open and unexpired vacancies
- [ ] Draft, Closed and expired vacancies are not publicly accessible
- [ ] Public vacancy response does not expose `employer_name` or staff-only fields
- [ ] Job application requires valid Turnstile `job_application` token
- [ ] Candidate registration requires valid Turnstile `candidate_interest` token
- [ ] Employer request requires valid Turnstile `recruitment_request` token
- [ ] Wrong Turnstile action is rejected
- [ ] Wrong Turnstile hostname is rejected when hostname allowlisting is configured
- [ ] CV upload rejects unsupported files and files larger than 5 MB
- [ ] CV objects are not publicly accessible from R2
- [ ] Approved staff can download a CV through the authenticated API
- [ ] Privacy acknowledgement is stored for all public submissions
- [ ] Full workflow passes: create Draft → publish → apply → review → close

## 7. Ongoing maintenance

New blockers discovered during production use should be recorded here rather
than silently worked around. Keep Cloudflare, Firebase, Email Service and
application dependencies under review as the platform evolves.
