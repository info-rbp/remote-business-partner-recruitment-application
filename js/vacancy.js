document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
  const isHidden = mobileMenu.classList.toggle('hidden');
  mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
});

const vacancyId = RBP.qs('id');
let currentVacancy = null;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function renderRich(el, html, wrapEl) {
  if (!html || !html.trim()) {
    if (wrapEl) wrapEl.classList.add('hidden');
    return;
  }
  el.innerHTML = RBP.nl2br(html);
}

async function loadVacancy() {
  if (!vacancyId) {
    showNotFound();
    return;
  }
  try {
    const v = await RbpApi.getVacancy(vacancyId);
    currentVacancy = v;

    document.getElementById('vTitle').textContent = v.title || 'Untitled Position';
    document.title = `${v.title || 'Vacancy'} | Remote Business Partner`;
    const descMeta = document.querySelector('meta[name="description"]');
    const shortDesc = (v.summary || v.description || '').replace(/<[^>]*>/g, '').slice(0, 155);
    if (descMeta) descMeta.setAttribute('content', shortDesc || `${v.title} vacancy at Remote Business Partner.`);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = shortDesc || `${v.title} vacancy at Remote Business Partner.`;
      document.head.appendChild(m);
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `vacancy.html?id=${encodeURIComponent(v.id)}`;

    const statusEl = document.getElementById('vStatus');
    statusEl.textContent = 'Open';
    statusEl.className = 'badge badge-open';

    if (v.is_featured) document.getElementById('vFeatured').classList.remove('hidden');

    document.getElementById('vDepartment').innerHTML = `<i class="fa-solid fa-layer-group"></i> ${RBP.escapeHtml(v.department || '—')}`;
    document.getElementById('vJobType').innerHTML = `<i class="fa-solid fa-briefcase"></i> ${RBP.escapeHtml(v.job_type || '—')}`;
    document.getElementById('vLocation').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${RBP.escapeHtml(v.location || '—')}`;
    document.getElementById('vLevel').innerHTML = `<i class="fa-solid fa-signal"></i> ${RBP.escapeHtml(v.experience_level || '—')}`;

    if (v.summary) renderRich(document.getElementById('vDescription'), v.summary + (v.description ? '\n\n' + v.description : ''));
    else renderRich(document.getElementById('vDescription'), v.description);
    renderRich(document.getElementById('vResponsibilities'), v.responsibilities, document.getElementById('vResponsibilitiesWrap'));
    renderRich(document.getElementById('vRequirements'), v.requirements, document.getElementById('vRequirementsWrap'));
    renderRich(document.getElementById('vBenefits'), v.benefits, document.getElementById('vBenefitsWrap'));

    document.getElementById('vSalary').textContent = v.salary_range || 'Negotiable';
    document.getElementById('vPosted').textContent = RBP.formatDate(v.posted_at);
    document.getElementById('vDeadline').textContent = v.deadline_date ? RBP.formatDate(v.deadline_date) : 'Open until filled';

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('vacancyContent').classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('notFoundState').classList.remove('hidden');
}

const applyModal = document.getElementById('applyModal');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeSuccessBtn = document.getElementById('closeSuccessBtn');
const applicationForm = document.getElementById('applicationForm');
const applySuccess = document.getElementById('applySuccess');
const submitBtn = document.getElementById('submitAppBtn');

let lastFocusedEl = null;
let applicationTurnstileRendered = false;

function setVerificationPending(label = 'Verifying...') {
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
  submitBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${label}`;
}

function setVerificationReady() {
  submitBtn.disabled = false;
  submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
  submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
}

async function prepareApplicationVerification() {
  setVerificationPending();
  try {
    if (applicationTurnstileRendered) {
      RbpApi.resetTurnstile('applyTurnstile');
      return;
    }

    await RbpApi.renderTurnstile('applyTurnstile', 'job_application', {
      onSuccess: token => {
        if (token) setVerificationReady();
      },
      onExpired: () => setVerificationPending('Verification expired'),
      onTimeout: () => setVerificationPending('Retry verification'),
      onError: code => {
        setVerificationPending('Retry verification');
        console.error('Application verification error:', code);
      }
    });
    applicationTurnstileRendered = true;

    if (RbpApi.getTurnstileToken('applyTurnstile')) setVerificationReady();
  } catch (err) {
    console.error('Application verification could not be prepared:', err);
    setVerificationPending('Verification unavailable');
    RBP.toast('Verification could not be loaded. Please refresh the page and try again.', 'error');
  }
}

function openModal() {
  lastFocusedEl = document.activeElement;
  document.getElementById('appVacancyId').value = currentVacancy.id;
  applicationForm.classList.remove('hidden');
  applySuccess.classList.add('hidden');
  setVerificationPending();
  applyModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const firstField = document.getElementById('fullName');
  if (firstField) firstField.focus();

  // Turnstile must render only after the modal is visible so the managed
  // challenge can complete and issue a token reliably.
  requestAnimationFrame(() => prepareApplicationVerification());
}
function closeModal() {
  applyModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
}

document.getElementById('applyBtn').addEventListener('click', () => {
  if (currentVacancy) openModal();
});
modalOverlay.addEventListener('click', closeModal);
closeModalBtn.addEventListener('click', closeModal);
closeSuccessBtn.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !applyModal.classList.contains('hidden')) closeModal();
});

applicationForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('resumeFile');
  const fileErrorEl = document.getElementById('resumeFileError');
  fileErrorEl.classList.add('hidden');

  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    fileErrorEl.textContent = 'Please upload your CV.';
    fileErrorEl.classList.remove('hidden');
    return;
  }
  if (file.size > MAX_RESUME_BYTES) {
    fileErrorEl.textContent = 'File is too large. Please upload a file under 5MB.';
    fileErrorEl.classList.remove('hidden');
    return;
  }
  const typeOk = ALLOWED_RESUME_TYPES.includes(file.type) || /\.(pdf|doc|docx)$/i.test(file.name);
  if (!typeOk) {
    fileErrorEl.textContent = 'Please upload a PDF or Word document.';
    fileErrorEl.classList.remove('hidden');
    return;
  }

  if (!document.getElementById('consentCheckbox').checked) {
    RBP.toast('Please acknowledge the Privacy Policy before submitting.', 'error');
    return;
  }

  if (!RbpApi.isTurnstileConfigured('applyTurnstile')) {
    RBP.toast('This form cannot be submitted until deployment configuration is complete. Please contact us directly.', 'error');
    return;
  }
  const turnstileToken = RbpApi.getTurnstileToken('applyTurnstile');
  if (!turnstileToken) {
    setVerificationPending('Complete verification');
    RbpApi.resetTurnstile('applyTurnstile');
    RBP.toast('Verification is still required. Complete the verification shown above, then submit again.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

  try {
    const formData = new FormData();
    formData.set('vacancy_id', document.getElementById('appVacancyId').value);
    formData.set('candidate_name', document.getElementById('fullName').value.trim());
    formData.set('email', document.getElementById('email').value.trim());
    formData.set('phone', document.getElementById('phone').value.trim());
    formData.set('linkedin_url', document.getElementById('linkedinUrl').value.trim());
    formData.set('cover_note', document.getElementById('coverLetter').value.trim());
    formData.set('privacy_acknowledged', 'true');
    formData.set('cf-turnstile-response', turnstileToken);
    formData.set('resume', file, file.name);

    await RbpApi.submitApplication(formData);
    applicationForm.classList.add('hidden');
    applySuccess.classList.remove('hidden');
    applicationForm.reset();
    RbpApi.resetTurnstile('applyTurnstile');
  } catch (err) {
    console.error(err);
    RBP.toast(err.message || "We couldn't submit your application. Please check your connection and try again.", 'error');
    RbpApi.resetTurnstile('applyTurnstile');
    setVerificationPending();
  } finally {
    if (!applicationForm.classList.contains('hidden') && RbpApi.getTurnstileToken('applyTurnstile')) {
      setVerificationReady();
    }
  }
});

loadVacancy();
