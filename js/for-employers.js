/* ===========================================================
   For Employers page: mobile menu + recruitment request form

   Submits to POST /api/recruitment-requests (RbpApi.submitRecruitmentRequest),
   including the Turnstile token. No GenSpark Table API usage.
   =========================================================== */

document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
  const isHidden = mobileMenu.classList.toggle('hidden');
  mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
});

if (window.RbpApi) RbpApi.renderTurnstile('auTurnstile');

const appointUsForm = document.getElementById('appointUsForm');
const appointUsSuccess = document.getElementById('appointUsSuccess');

appointUsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!document.getElementById('auConsent').checked) {
    RBP.toast('Please acknowledge the Privacy Policy before submitting.', 'error');
    return;
  }

  if (!RbpApi.isTurnstileConfigured('auTurnstile')) {
    RBP.toast('This form cannot be submitted until deployment configuration is complete. Please contact us directly.', 'error');
    return;
  }
  const turnstileToken = RbpApi.getTurnstileToken('auTurnstile');
  if (!turnstileToken) {
    RBP.toast('Please complete the verification challenge before submitting.', 'error');
    return;
  }

  const btn = document.getElementById('auSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

  const startDateVal = document.getElementById('auStartDate').value;

  const payload = {
    company_name: document.getElementById('auBusinessName').value.trim(),
    contact_name: document.getElementById('auContactName').value.trim(),
    email: document.getElementById('auEmail').value.trim(),
    phone: document.getElementById('auPhone').value.trim(),
    position_title: document.getElementById('auPositionTitle').value.trim(),
    employment_type: document.getElementById('auEmploymentType').value,
    location: document.getElementById('auLocation').value.trim(),
    remuneration: document.getElementById('auSalaryRate').value.trim(),
    preferred_start_date: startDateVal || '',
    requirements: document.getElementById('auRequirements').value.trim(),
    privacy_acknowledged: true,
    'cf-turnstile-response': turnstileToken
  };

  try {
    await RbpApi.submitRecruitmentRequest(payload);
    appointUsForm.classList.add('hidden');
    appointUsSuccess.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    RBP.toast(err.message || "We couldn't submit your recruitment request. Please check your connection and try again.", 'error');
    RbpApi.resetTurnstile('auTurnstile');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Recruitment Request';
  }
});
