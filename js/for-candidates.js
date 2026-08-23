/* ===========================================================
   For Candidates page: mobile menu + register interest form

   Submits to POST /api/candidate-interest (RbpApi.submitCandidateInterest),
   including the Turnstile token. No GenSpark Table API usage.
   =========================================================== */

document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
  const isHidden = mobileMenu.classList.toggle('hidden');
  mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
});

if (window.RbpApi) RbpApi.renderTurnstile('riTurnstile');

const registerForm = document.getElementById('registerInterestForm');
const registerSuccess = document.getElementById('registerSuccess');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!document.getElementById('riConsent').checked) {
    RBP.toast('Please acknowledge the Privacy Policy before submitting.', 'error');
    return;
  }

  if (!RbpApi.isTurnstileConfigured('riTurnstile')) {
    RBP.toast('This form cannot be submitted until deployment configuration is complete. Please contact us directly.', 'error');
    return;
  }
  const turnstileToken = RbpApi.getTurnstileToken('riTurnstile');
  if (!turnstileToken) {
    RBP.toast('Please complete the verification challenge before submitting.', 'error');
    return;
  }

  const btn = document.getElementById('riSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

  const payload = {
    name: document.getElementById('riFullName').value.trim(),
    email: document.getElementById('riEmail').value.trim(),
    phone: document.getElementById('riPhone').value.trim(),
    linkedin_url: document.getElementById('riLinkedin') ? document.getElementById('riLinkedin').value.trim() : '',
    preferred_roles: document.getElementById('riPreferredRoles') ? document.getElementById('riPreferredRoles').value.trim() : '',
    preferred_location: document.getElementById('riPreferredLocation') ? document.getElementById('riPreferredLocation').value.trim() : '',
    message: document.getElementById('riNotes').value.trim(),
    privacy_acknowledged: true,
    'cf-turnstile-response': turnstileToken
  };

  try {
    await RbpApi.submitCandidateInterest(payload);
    registerForm.classList.add('hidden');
    registerSuccess.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    RBP.toast(err.message || "We couldn't submit your registration. Please check your connection and try again.", 'error');
    RbpApi.resetTurnstile('riTurnstile');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Register Interest';
  }
});
