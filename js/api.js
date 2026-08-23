/* ===========================================================
   RbpApi — the ONLY module that talks to the network on behalf of the
   frontend. Talks exclusively to same-origin /api/* Cloudflare Pages
   Functions. There is NO GenSpark Table API fallback anywhere in this
   file, and none must ever be added (see PRELAUNCH_BLOCKERS.md and
   scripts/prelaunch-check.mjs, which fails the build if tables/* calls
   are reintroduced).
   =========================================================== */

const RbpApi = (() => {
  async function request(path, options = {}) {
    const res = await fetch(path, options);
    let body = null;
    try { body = await res.json(); } catch (e) { }
    if (!res.ok) {
      const err = new Error((body && body.message) || `Request failed with status ${res.status}.`);
      err.status = res.status;
      err.code = body && body.error;
      throw err;
    }
    return body;
  }

  function toQuery(params = {}) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') usp.set(k, v);
    });
    const s = usp.toString();
    return s ? `?${s}` : '';
  }

  async function getVacancies(params = {}) {
    const json = await request(`api/vacancies${toQuery(params)}`);
    return json.data || [];
  }

  async function getVacancy(id) {
    const json = await request(`api/vacancies/${encodeURIComponent(id)}`);
    return json.data;
  }

  async function submitApplication(formData) {
    const json = await request('api/applications', { method: 'POST', body: formData });
    return json.data;
  }

  async function submitCandidateInterest(payload) {
    const json = await request('api/candidate-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return json.data;
  }

  async function submitRecruitmentRequest(payload) {
    const json = await request('api/recruitment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return json.data;
  }

  const turnstileWidgetIds = {};

  function renderTurnstile(containerId) {
    const siteKey = (typeof TURNSTILE_SITE_KEY !== 'undefined') ? TURNSTILE_SITE_KEY : null;
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!siteKey || siteKey === 'REPLACE_ME') {
      container.innerHTML = '<p class="text-xs text-red-500">Form protection is not yet configured for this site (missing Turnstile site key). This form cannot be submitted until deployment configuration is complete.</p>';
      container.dataset.turnstileUnconfigured = '1';
      return;
    }
    const tryRender = () => {
      if (window.turnstile && window.turnstile.render) {
        const id = window.turnstile.render(`#${containerId}`, { sitekey: siteKey });
        turnstileWidgetIds[containerId] = id;
      } else {
        setTimeout(tryRender, 150);
      }
    };
    tryRender();
  }

  function isTurnstileConfigured(containerId) {
    const container = document.getElementById(containerId);
    return !(container && container.dataset.turnstileUnconfigured === '1');
  }

  function getTurnstileToken(containerId) {
    if (window.turnstile && turnstileWidgetIds[containerId] !== undefined) {
      try { return window.turnstile.getResponse(turnstileWidgetIds[containerId]) || ''; } catch (e) { }
    }
    const input = document.querySelector(`#${containerId} input[name="cf-turnstile-response"]`);
    return input ? input.value : '';
  }

  function resetTurnstile(containerId) {
    if (window.turnstile && turnstileWidgetIds[containerId] !== undefined) {
      try { window.turnstile.reset(turnstileWidgetIds[containerId]); } catch (e) { }
    }
  }

  let firebaseInitialized = false;

  function initFirebaseAuth() {
    if (firebaseInitialized) return;
    if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') {
      console.error('Firebase SDK or FIREBASE_CONFIG not loaded.');
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    firebaseInitialized = true;
  }

  function isFirebaseConfigured() {
    return typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'REPLACE_ME';
  }

  function onAuthStateChanged(callback) {
    initFirebaseAuth();
    if (typeof firebase === 'undefined') { callback(null); return; }
    firebase.auth().onAuthStateChanged(callback);
  }

  async function signIn(email, password) {
    initFirebaseAuth();
    if (typeof firebase === 'undefined') throw new Error('Authentication is not available (Firebase SDK not loaded).');
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function signOutStaff() {
    if (typeof firebase === 'undefined') return;
    await firebase.auth().signOut();
  }

  async function sendPasswordReset(email) {
    initFirebaseAuth();
    if (typeof firebase === 'undefined') throw new Error('Authentication is not available (Firebase SDK not loaded).');
    await firebase.auth().sendPasswordResetEmail(email);
  }

  async function getIdToken(forceRefresh = false) {
    if (typeof firebase === 'undefined') return null;
    const user = firebase.auth().currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  }

  async function adminFetch(path, options = {}) {
    const token = await getIdToken();
    if (!token) {
      const err = new Error('You are not signed in. Please sign in again.');
      err.status = 401;
      throw err;
    }
    const headers = Object.assign({}, options.headers, { Authorization: `Bearer ${token}` });
    return request(path, Object.assign({}, options, { headers }));
  }

  async function adminGetSession() {
    const json = await adminFetch('api/admin/session');
    return json.data;
  }

  async function adminGetVacancies() {
    const json = await adminFetch('api/admin/vacancies');
    return json.data || [];
  }
  async function adminCreateVacancy(data) {
    const json = await adminFetch('api/admin/vacancies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return json.data;
  }
  async function adminUpdateVacancy(id, data) {
    const json = await adminFetch(`api/admin/vacancies/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return json.data;
  }
  async function adminDeleteVacancy(id) {
    await adminFetch(`api/admin/vacancies/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  }

  async function adminGetApplications(params = {}) {
    return adminFetch(`api/admin/applications${toQuery(params)}`);
  }
  async function adminGetApplication(id) {
    const json = await adminFetch(`api/admin/applications/${encodeURIComponent(id)}`);
    return json.data;
  }
  async function adminUpdateApplication(id, data) {
    const json = await adminFetch(`api/admin/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return json.data;
  }
  async function adminDeleteApplication(id) {
    await adminFetch(`api/admin/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  }
  async function adminDownloadCv(id, filename) {
    const token = await getIdToken();
    if (!token) throw new Error('You are not signed in. Please sign in again.');
    const res = await fetch(`api/admin/applications/${encodeURIComponent(id)}/cv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to download CV.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'cv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function adminGetRecruitmentRequests(params = {}) {
    return adminFetch(`api/admin/recruitment-requests${toQuery(params)}`);
  }
  async function adminUpdateRecruitmentRequest(id, status) {
    const json = await adminFetch(`api/admin/recruitment-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    return json.data;
  }

  async function adminGetCandidateInterest(params = {}) {
    return adminFetch(`api/admin/candidate-interest${toQuery(params)}`);
  }
  async function adminUpdateCandidateInterest(id, status) {
    const json = await adminFetch(`api/admin/candidate-interest/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    return json.data;
  }

  return {
    getVacancies, getVacancy,
    submitApplication, submitCandidateInterest, submitRecruitmentRequest,
    renderTurnstile, getTurnstileToken, resetTurnstile, isTurnstileConfigured,
    initFirebaseAuth, isFirebaseConfigured, onAuthStateChanged, signIn, signOutStaff, sendPasswordReset, getIdToken,
    adminFetch, adminGetSession,
    adminGetVacancies, adminCreateVacancy, adminUpdateVacancy, adminDeleteVacancy,
    adminGetApplications, adminGetApplication, adminUpdateApplication, adminDeleteApplication, adminDownloadCv,
    adminGetRecruitmentRequests, adminUpdateRecruitmentRequest,
    adminGetCandidateInterest, adminUpdateCandidateInterest
  };
})();
