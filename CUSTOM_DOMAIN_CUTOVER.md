# Production custom-domain cutover

Primary production hostname:

```text
recruitment.remotebusinesspartner.com.au
```

Cloudflare Pages fallback hostname:

```text
remote-business-partner-recruitment-application.pages.dev
```

The pages.dev hostname is intentionally retained as a platform fallback. Public canonical URLs and production links should use the custom hostname.

## Cloudflare Pages

1. Open Cloudflare Dashboard -> Workers & Pages -> `remote-business-partner-recruitment-application`.
2. Open **Custom domains** -> **Set up a domain**.
3. Add `recruitment.remotebusinesspartner.com.au` and activate it.
4. If `remotebusinesspartner.com.au` is already a Cloudflare zone, Cloudflare should create the required DNS record automatically. Otherwise create the CNAME requested by Cloudflare, pointing the `recruitment` host to `remote-business-partner-recruitment-application.pages.dev`.
5. Wait for the custom domain to show **Active** before treating it as production.

Do not manually create only a CNAME without also associating the hostname under Pages -> Custom domains.

## Production Pages variables

Set/update these Production values:

```text
PUBLIC_SITE_URL=https://recruitment.remotebusinesspartner.com.au
TURNSTILE_ALLOWED_HOSTNAMES=remote-business-partner-recruitment-application.pages.dev,recruitment.remotebusinesspartner.com.au
BUSINESS_TIMEZONE=Australia/Perth
```

Keep the existing Turnstile, Firebase and Gmail secrets unchanged.

## Firebase Authentication

Firebase Console -> Authentication -> Settings -> Authorized domains:

```text
recruitment.remotebusinesspartner.com.au
```

Keep the pages.dev hostname authorised as a fallback.

## Cloudflare Turnstile

The production Turnstile widget must allow both:

```text
recruitment.remotebusinesspartner.com.au
remote-business-partner-recruitment-application.pages.dev
```

The `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` must continue to belong to that same widget.

## Gmail diagnostics

The authenticated Gmail diagnostics page is intentionally retained:

```text
https://recruitment.remotebusinesspartner.com.au/email-test.html
```

It remains `noindex,nofollow`, is excluded in `robots.txt`, and its API is protected by the existing admin Firebase/D1 middleware.

## Cutover acceptance test

After the domain is Active and Pages has been redeployed:

1. Open `https://recruitment.remotebusinesspartner.com.au/`.
2. Confirm vacancies load.
3. Open Staff Login and confirm Firebase authentication succeeds.
4. Submit a controlled test application and confirm Turnstile succeeds.
5. Confirm the application appears in Admin and its CV can be downloaded.
6. Confirm the RBP notification and candidate confirmation are sent by Gmail.
7. Open `/email-test.html` while signed in and run one Gmail transport test.
8. Confirm `https://remote-business-partner-recruitment-application.pages.dev/` still works as the fallback hostname.
