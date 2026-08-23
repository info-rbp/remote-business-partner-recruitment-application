/* ===========================================================
   Staff login page logic (Firebase Authentication, email/password only).
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

RbpApi.onAuthStateChanged((user) => {
  if (user) window.location.href = 'admin.html';
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
  const btn = loginSubmitBtn;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

  try {
    await RbpApi.signIn(email, password);
    window.location.href = 'admin.html';
  } catch (err) {
    console.error('Firebase sign-in failed:', err);
    loginError.textContent = authErrorMessage(err);
    loginError.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
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
