/* ===========================================================
   Cloudflare Turnstile site key (public, safe to ship client-side).

   DEPLOYMENT BLOCKER: replace REPLACE_ME with the real Turnstile site key
   from the Cloudflare dashboard (Turnstile > your widget > Site Key) before
   going live — see DEPLOYMENT.md. The matching TURNSTILE_SECRET_KEY (a real
   secret) is configured server-side only, via `wrangler pages secret put`,
   and must never appear in this file or anywhere in the frontend.

   Until this is a real site key, the Turnstile widget will fail to render
   or fail verification, and the corresponding public form will correctly
   be unable to submit — this is intended fail-closed behaviour, not a bug.
   =========================================================== */

const TURNSTILE_SITE_KEY = 'REPLACE_ME';
