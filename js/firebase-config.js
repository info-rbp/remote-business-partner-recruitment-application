/* ===========================================================
   Firebase Web SDK configuration — STAFF AUTHENTICATION ONLY.

   These values come from the Firebase Console (Project settings > General >
   Your apps > Web app). They are public client configuration values, not
   server secrets. Access is enforced by Firebase Authentication and by the
   staff_users authorisation check in functions/_lib/auth.js.

   Do not put any Firebase service-account private key or other server secret
   in this file or anywhere in the frontend.
   =========================================================== */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBYFNFUy4Sa4dQUJNUEJ3yeLHBwhxf2UJ8',
  authDomain: 'business-plan-applicatio-17047.firebaseapp.com',
  projectId: 'business-plan-applicatio-17047',
  storageBucket: 'business-plan-applicatio-17047.firebasestorage.app',
  messagingSenderId: '696236368989',
  appId: '1:696236368989:web:6334ef173b11e7456919b4'
};

// The FIREBASE_PROJECT_ID Cloudflare Pages environment variable (used by
// functions/_lib/auth.js to verify tokens server-side) MUST match
// FIREBASE_CONFIG.projectId above exactly.
