/* ===========================================================
   Staff login page logic (Firebase Authentication, email/password only).
   =========================================================== */

document.getElementById('year').textContent = new Date().getFullYear();

if (!RbpApi.isFirebaseConfigured()) {
  document.getElementById('configWarning').classList.remove('hidden');
}

RbpApi.onAuthStateChanged((user) => {
  if (user) window.location.href = 'admin.html';
});

const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

  try {
    await RbpApi.signIn(email, password);
    window.location.href = 'admin.html';
  } catch (err) {
    console.error(err);
    loginError.textContent = 'Sign-in failed. Please check your email and password and try again.';
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
    console.error(err);
    resetMessage.textContent = 'If an account exists for that email, a password reset link has been sent.';
    resetMessage.classList.remove('hidden');
  }
});
