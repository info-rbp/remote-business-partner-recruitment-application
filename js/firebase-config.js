/* ===========================================================
   Firebase Web SDK configuration — STAFF AUTHENTICATION ONLY.

   These values come from the Firebase Console (Project settings > General >
   Your apps > Web app). They are NOT secret — the Firebase Web API key is
   safe to ship in client-side code; access is enforced by Firebase Auth
   rules and, on this project, by the staff_users table check performed
   server-side in functions/_lib/auth.js. Do not put any server secret
   (service-account private key, etc.) in this file or anywhere in the
   frontend.

   DEPLOYMENT BLOCKER: the values below are placeholders. Replace every
   "REPLACE_ME" with the real values from your Firebase project before
   going live — see DEPLOYMENT.md ("Firebase setup") and
   PRELAUNCH_BLOCKERS.md. Until replaced, sign-in on login.html will fail
   with a Firebase configuration error, which is the correct, honest
   behaviour rather than pretending to work.
   =========================================================== */

const FIREBASE_CONFIG = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME'
};

// The FIREBASE_PROJECT_ID Cloudflare Pages environment variable (used by
// functions/_lib/auth.js to verify tokens server-side) MUST match
// FIREBASE_CONFIG.projectId above exactly.
