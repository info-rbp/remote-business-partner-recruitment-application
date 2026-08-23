/* ===========================================================
   RbpApi — the ONLY module that talks to the network on behalf of the
   frontend. Talks exclusively to same-origin /api/* Cloudflare Pages
   Functions. There is NO GenSpark Table API fallback anywhere in this
   file, and none must ever be added (see PRELAUNCH_BLOCKERS.md and
   scripts/prelaunch-check.mjs, which fails the build if tables/* calls
   are reintroduced).

   Depends on (loaded before this file, where needed):
     - js/firebase-config.js  (FIREBASE_CONFIG)         — admin/login pages only
     - /api/config runtime response (TURNSTILE_SITE_KEY from Cloudflare) — public form pages only
     - Firebase compat SDK (firebase-app-compat.js, firebase-auth-compat.js) — admin/login pages only
     - Cloudflare Turnstile script (challenges.cloudflare.com/turnstile/v0/api.js) — public form pages only
   =========================================================== */

const RbpApi = (() => {

  // ---------- Low-level request helpers ----------

  async function request(path, options = {}) {
    const res = await fetch(path, options);
    let body = null;
    try { body = await res.json(); } catch (e) { /* no JSON body, e.g. 204 */ }
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

  // ---------- Public: vacancies ----------

  async function getVacancies(params = {}) {
    const json = await request(`api/vacancies${toQuery(params)}`);
    return json.data || [];
  }

  async function getVacancy(id) {
    const json = await request(`api/vacancies/${encodeURIComponent(id)}`);
    return json.data;
  }

  // ---------- Public: applications (multipart) ----------

  async function submitApplication(formData) {
    const json = await request('api/applications', { method: 'POST', body: formData });
    return json.data;
  }

  // ---------- Public: candidate interest / recruitment requests (JSON) ----------

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

  // ---------- Cloudflare Turnstile ----------

  const turnstileWidgetIds = {};
  const turnstileWidgetTokens = {};
  const turnstileRenderPromises = {};
  let publicConfigPromise = null;

  async function getPublicConfig() {
    if (!publicConfigPromise) {
      publicConfigPromise = request('api/config').then(json => json.data || {}).catch(err => {
        publicConfigPromise = null;
        throw err;
      });
    }
    return publicConfigPromise;
  }

  function renderTurnstile(containerId, action, handlers = {}) {
    const container = document.getElementById(containerId);
    const defaultActions = {
      applyTurnstile: 'job_application',
      riTurnstile: 'candidate_interest',
      auTurnstile: 'recruitment_request'
    };
    action = action || defaultActions[containerId] || undefined;
    if (!container) return Promise.resolve(null);

    delete container.dataset.turnstileUnconfigured;
    delete container.dataset.turnstileError;

    if (turnstileWidgetIds[containerId] !== undefined) {
      const token = getTurnstileToken(containerId);
      if (token && typeof handlers.onSuccess === 'function') {
        queueMicrotask(() => handlers.onSuccess(token));
      }
      return Promise.resolve(turnstileWidgetIds[containerId]);
    }

    if (turnstileRenderPromises[containerId]) return turnstileRenderPromises[containerId];

    const renderPromise = getPublicConfig().then(config => {
      const siteKey = config.turnstileSiteKey || null;
      if (!siteKey) {
        container.innerHTML = '<p class="text-xs text-red-500">Form protection is temporarily unavailable. Please contact Remote Business Partner if you need assistance.</p>';
        container.dataset.turnstileUnconfigured = '1';
        throw new Error('Turnstile site key is not configured.');
      }

      return new Promise((resolve, reject) => {
        let attempts = 0;
        const tryRender = () => {
          if (window.turnstile && window.turnstile.render) {
            try {
              const options = {
                sitekey: siteKey,
                theme: 'auto',
                size: 'flexible',
                retry: 'auto',
                'refresh-expired': 'auto',
                callback: token => {
                  turnstileWidgetTokens[containerId] = token || '';
                  delete container.dataset.turnstileError;
                  if (typeof handlers.onSuccess === 'function') handlers.onSuccess(token || '');
                },
                'expired-callback': () => {
                  turnstileWidgetTokens[containerId] = '';
                  if (typeof handlers.onExpired === 'function') handlers.onExpired();
                },
                'timeout-callback': () => {
                  turnstileWidgetTokens[containerId] = '';
                  if (typeof handlers.onTimeout === 'function') handlers.onTimeout();
                },
                'error-callback': code => {
                  turnstileWidgetTokens[containerId] = '';
                  container.dataset.turnstileError = String(code || 'unknown');
                  console.error(`Turnstile error in ${containerId}:`, code);
                  if (typeof handlers.onError === 'function') handlers.onError(code);
                }
              };
              if (action) options.action = action;
              const id = window.turnstile.render(`#${containerId}`, options);
              turnstileWidgetIds[containerId] = id;
              resolve(id);
            } catch (err) {
              container.dataset.turnstileError = 'render_failed';
              reject(err);
            }
            return;
          }

          attempts += 1;
          if (attempts >= 100) {
            container.dataset.turnstileError = 'script_unavailable';
            reject(new Error('Turnstile script did not become available.'));
            return;
          }
          setTimeout(tryRender, 100);
        };
        tryRender();
      });
    }).catch(err => {
      console.error('Unable to load or render Turnstile:', err);
      if (!container.dataset.turnstileUnconfigured) {
        container.innerHTML = '<p class="text-xs text-red-500">Verification could not be loaded. Please refresh the page and try again.</p>';
      }
      throw err;
    });

    turnstileRenderPromises[containerId] = renderPromise;
    return renderPromise;
  }

  function isTurnstileConfigured(containerId) {
    const container = document.getElementById(containerId);
    return !(container && container.dataset.turnstileUnconfigured === '1');
  }

  function getTurnstileToken(containerId) {
    if (turnstileWidgetTokens[containerId]) return turnstileWidgetTokens[containerId];
    if (window.turnstile && turnstileWidgetIds[containerId] !== undefined) {
      try {
        const token = window.turnstile.getResponse(turnstileWidgetIds[containerId]) || '';
        if (token) turnstileWidgetTokens[containerId] = token;
        return token;
      } catch (e) { /* fall through */ }
    }
    const input = document.querySelector(`#${containerId} input[name="cf-turnstile-response"]`);
    return input ? input.value : '';
  }

  function resetTurnstile(containerId) {
    turnstileWidgetTokens[containerId] = '';
    const container = document.getElementById(containerId);
    if (container) delete container.dataset.turnstileError;
    if (window.turnstile && turnstileWidgetIds[containerId] !== undefined) {
      try { window.turnstile.reset(turnstileWidgetIds[containerId]); } catch (e) { /* ignore */ }
    }
  }

  // ---------- Firebase Authentication (staff only) ----------

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

  // ---------- Admin: authenticated fetch helper ----------

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

  // ---------- Admin: vacancies ----------

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

  // ---------- Admin: applications ----------

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

  // ---------- Admin: recruitment requests ----------

  async function adminGetRecruitmentRequests(params = {}) {
    return adminFetch(`api/admin/recruitment-requests${toQuery(params)}`);
  }
  async function adminUpdateRecruitmentRequest(id, status) {
    const json = await adminFetch(`api/admin/recruitment-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    return json.data;
  }

  // ---------- Admin: candidate interest ----------

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
