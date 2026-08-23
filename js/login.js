/* ===========================================================
   Staff login page logic (Firebase Authentication, email/password only).
   Firebase authentication and RBP staff authorisation are deliberately
   separate checks. A valid Firebase account must also be approved in D1.
   =========================================================== */

// Firebase Authorized Domains should use the stable production hostname, not
// Cloudflare's per-deployment hash hostnames. If a staff member opens a
// deployment URL from the Cloudflare dashboard, move them to production before
// authentication begins. Custom domains are left untouched.
(() => {
  const productionHost = 'remote-business-partner-recruitment-application.pages.dev';
  const deploymentSuffix = `.${productionHost}`;
  if (window.location.hostname.endsWith(deploymentSuffix)) {
    const target = `https://${productionHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }
})();

document.getElementById('year').textContent = new Date().getFullYear();

const configWarning = document.getElementById('configWarning');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
let staffVerificationInProgress = false;

if (!RbpApi.isFirebaseConfigured()) {
  configWarning.classList.remove('hidden');
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.classList.add('opacity-50', 'cursor-not-allowed');
}

function authErrorMessage(err) {
  const code = err && err.code ? String(err.code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email address or password is incorrect.';
    case 'auth/unauthorized-domain':
      return 'This address is not authorised for staff authentication. Open the staff login from the main RBP recruitment site.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this Firebase project.';
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return 'The Firebase web configuration is invalid or not authorised for this application.';
    case 'auth/network-request-failed':
      return 'Firebase could not be reached. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Firebase has temporarily blocked further attempts. Wait a short time and try again.';
    case 'auth/user-disabled':
      return 'This staff account has been disabled in Firebase.';
    default:
      return code
        ? `Sign-in failed (${code}). Check the Firebase Authentication settings and try again.`
        : 'Sign-in failed. Check the Firebase Authentication settings and try again.';
  }
}

function resetSubmitButton() {
  loginSubmitBtn.disabled = false;
  loginSubmitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
}

async function verifyStaffAccess(user) {
  if (!user || staffVerificationInProgress) return;
  staffVerificationInProgress = true;
  loginError.classList.add('hidden');
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying staff access...';

  try {
    await RbpApi.adminGetSession();
    window.location.href = 'admin.html';
  } catch (err) {
    console.error('RBP staff authorisation failed:', err);
    const uid = user.uid || '(UID unavailable)';

    // Remove the valid Firebase session after an RBP authorisation failure so
    // returning to the login page does not immediately send the user back into
    // the same redirect cycle.
    await RbpApi.signOutStaff();

    if (err && err.status === 403) {
      loginError.textContent = `Your Firebase login was accepted, but this account is not yet approved for RBP Recruitment Administration. Firebase UID: ${uid}`;
    } else if (err && err.status === 401) {
      loginError.textContent = 'Your Firebase login was accepted, but the server could not verify the Firebase token. Confirm Cloudflare FIREBASE_PROJECT_ID is set to business-plan-applicatio-17047 and redeploy the Pages project.';
    } else {
      loginError.textContent = `Firebase login succeeded, but RBP staff access could not be verified. ${err && err.message ? err.message : 'Please try again.'}`;
    }

    loginError.classList.remove('hidden');
    resetSubmitButton();
  } finally {
    staffVerificationInProgress = false;
  }
}

// Existing Firebase sessions must be authorised by the RBP server before the
// browser is allowed into the administration interface.
RbpApi.onAuthStateChanged((user) => {
  if (user) verifyStaffAccess(user);
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  if (!RbpApi.isFirebaseConfigured()) {
    configWarning.classList.remove('hidden');
    return;
  }

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

  try {
    const user = await RbpApi.signIn(email, password);
    await verifyStaffAccess(user);
  } catch (err) {
    // If verifyStaffAccess handled a server-side authorisation failure it has
    // already displayed the useful error message.
    if (loginError.classList.contains('hidden')) {
      console.error('Firebase sign-in failed:', err);
      loginError.textContent = authErrorMessage(err);
      loginError.classList.remove('hidden');
      resetSubmitButton();
    }
  }
});

document.getElementById('forgotPasswordBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const resetMessage = document.getElementById('resetMessage');
  if (!email) {
    loginError.textContent = 'Enter your email address above first, then click "Forgot your password?".';
    loginError.classList.remove('hidden');
    return;
  }
  try {
    await RbpApi.sendPasswordReset(email);
    resetMessage.textContent = 'If an account exists for that email, a password reset link has been sent.';
    resetMessage.classList.remove('hidden');
  } catch (err) {
    console.error('Firebase password reset failed:', err);
    resetMessage.textContent = 'If an account exists for that email, a password reset link has been sent.';
    resetMessage.classList.remove('hidden');
  }
});
