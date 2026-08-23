// Transactional recruitment email helper using Google Workspace Gmail API.
//
// Required Cloudflare Pages secrets:
//   GOOGLE_GMAIL_CLIENT_ID
//   GOOGLE_GMAIL_CLIENT_SECRET
//   GOOGLE_GMAIL_REFRESH_TOKEN
// Optional normal environment variables:
//   RECRUITMENT_EMAIL_FROM           defaults to recruitment@remotebusinesspartner.com.au
//   RECRUITMENT_NOTIFICATION_EMAIL   defaults to recruitment@remotebusinesspartner.com.au
//   PUBLIC_SITE_URL                  defaults to the production pages.dev hostname
//
// The refresh token must belong to the Google Workspace mailbox that is allowed
// to send as RECRUITMENT_EMAIL_FROM and should have only the gmail.send scope.
// Email delivery must never determine whether a recruitment form submission is
// accepted. Call the notify* helpers only after the D1/R2 write has succeeded.

const DEFAULT_EMAIL = 'recruitment@remotebusinesspartner.com.au';
const DEFAULT_SITE_URL = 'https://remote-business-partner-recruitment-application.pages.dev';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function config(env) {
  return {
    clientId: String(env.GOOGLE_GMAIL_CLIENT_ID || '').trim(),
    clientSecret: String(env.GOOGLE_GMAIL_CLIENT_SECRET || '').trim(),
    refreshToken: String(env.GOOGLE_GMAIL_REFRESH_TOKEN || '').trim(),
    from: String(env.RECRUITMENT_EMAIL_FROM || DEFAULT_EMAIL).trim(),
    notificationsTo: String(env.RECRUITMENT_NOTIFICATION_EMAIL || DEFAULT_EMAIL).trim(),
    siteUrl: String(env.PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
  };
}

export function isRecruitmentEmailConfigured(env) {
  const cfg = config(env);
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.refreshToken && cfg.from && cfg.notificationsTo);
}

function cleanHeader(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
  }
  return btoa(binary);
}

function base64UrlEncodeUtf8(value) {
  return bytesToBase64(new TextEncoder().encode(String(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodeMimeHeader(value) {
  const clean = cleanHeader(value);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(clean))}?=`;
}

function normaliseBody(value) {
  return String(value ?? '').replace(/\r?\n/g, '\r\n');
}

function buildRawMessage({ from, to, subject, text, html, replyTo }) {
  const boundary = `rbp_${crypto.randomUUID().replace(/-/g, '')}`;
  const headers = [
    `From: Remote Business Partner <${cleanHeader(from)}>`,
    `To: ${cleanHeader(to)}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  if (replyTo) headers.splice(2, 0, `Reply-To: ${cleanHeader(replyTo)}`);

  const message = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    normaliseBody(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    normaliseBody(html),
    `--${boundary}--`,
    ''
  ].join('\r\n');

  return base64UrlEncodeUtf8(message);
}

async function getGmailAccessToken(env, forceRefresh = false) {
  const cfg = config(env);
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
    return null;
  }

  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < cachedAccessTokenExpiry - 60_000) {
    return cachedAccessToken;
  }

  const form = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  let body = null;
  try { body = await response.json(); } catch { /* ignore malformed upstream body */ }

  if (!response.ok || !body || !body.access_token) {
    const detail = body && (body.error_description || body.error)
      ? `${body.error || 'oauth_error'}: ${body.error_description || ''}`.trim()
      : `HTTP ${response.status}`;
    throw new Error(`Google OAuth token refresh failed: ${detail}`);
  }

  cachedAccessToken = body.access_token;
  const expiresInSeconds = Number(body.expires_in) > 0 ? Number(body.expires_in) : 3600;
  cachedAccessTokenExpiry = now + expiresInSeconds * 1000;
  return cachedAccessToken;
}

async function gmailSend(env, raw, retry = true) {
  const token = await getGmailAccessToken(env, !retry);
  if (!token) {
    console.warn('Recruitment email skipped: Google Workspace Gmail OAuth secrets are not configured.');
    return { skipped: true };
  }

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (response.status === 401 && retry) {
    cachedAccessToken = null;
    cachedAccessTokenExpiry = 0;
    return gmailSend(env, raw, false);
  }

  let body = null;
  try { body = await response.json(); } catch { /* ignore malformed upstream body */ }

  if (!response.ok) {
    const detail = body && body.error && body.error.message
      ? body.error.message
      : `HTTP ${response.status}`;
    throw new Error(`Gmail API rejected the message: ${detail}`);
  }

  return body || { sent: true };
}

export async function sendRecruitmentEmail(env, { to, subject, text, html, replyTo }) {
  const cfg = config(env);
  if (!isRecruitmentEmailConfigured(env)) {
    console.warn('Recruitment email skipped: GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET or GOOGLE_GMAIL_REFRESH_TOKEN is not configured.');
    return { skipped: true };
  }

  const raw = buildRawMessage({
    from: cfg.from,
    to,
    subject,
    text,
    html,
    replyTo
  });

  return gmailSend(env, raw);
}

async function settle(label, jobs) {
  const results = await Promise.allSettled(jobs);
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`${label} email ${index + 1} failed:`, result.reason && result.reason.message ? result.reason.message : result.reason);
    }
  });
  return results;
}

export function notifyNewApplication(env, { application, vacancy }) {
  const cfg = config(env);
  const adminUrl = `${cfg.siteUrl}/admin.html#applications`;
  const candidateName = application.candidate_name;
  const vacancyTitle = vacancy.title;

  const staffText = [
    `New application received for ${vacancyTitle}.`,
    '',
    `Candidate: ${candidateName}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `Application ID: ${application.id}`,
    '',
    `Review the application securely in RBP Recruitment Administration: ${adminUrl}`,
    'The candidate CV is not attached to this email and remains in private R2 storage.'
  ].join('\n');

  const staffHtml = `<h2>New application received</h2>
    <p><strong>Role:</strong> ${esc(vacancyTitle)}</p>
    <p><strong>Candidate:</strong> ${esc(candidateName)}<br>
    <strong>Email:</strong> ${esc(application.email)}<br>
    <strong>Phone:</strong> ${esc(application.phone)}</p>
    <p><a href="${esc(adminUrl)}">Open RBP Recruitment Administration</a></p>
    <p><small>The CV is deliberately not attached. Download it through the authenticated Admin area.</small></p>`;

  const candidateText = [
    `Hi ${candidateName},`,
    '',
    `Thank you for applying for ${vacancyTitle} through Remote Business Partner.`,
    'We have received your application and CV. Our recruitment team will review your application and contact you if further information or next steps are required.',
    '',
    `If you need to contact us, email ${cfg.notificationsTo}.`,
    '',
    'Remote Business Partner',
    'ABN 76 098 718 150'
  ].join('\n');

  const candidateHtml = `<p>Hi ${esc(candidateName)},</p>
    <p>Thank you for applying for <strong>${esc(vacancyTitle)}</strong> through Remote Business Partner.</p>
    <p>We have received your application and CV. Our recruitment team will review your application and contact you if further information or next steps are required.</p>
    <p>If you need to contact us, email <a href="mailto:${esc(cfg.notificationsTo)}">${esc(cfg.notificationsTo)}</a>.</p>
    <p>Remote Business Partner<br><small>ABN 76 098 718 150</small></p>`;

  return settle('New application', [
    sendRecruitmentEmail(env, {
      to: cfg.notificationsTo,
      subject: `New application: ${vacancyTitle} - ${candidateName}`,
      text: staffText,
      html: staffHtml,
      replyTo: application.email
    }),
    sendRecruitmentEmail(env, {
      to: application.email,
      subject: `Application received - ${vacancyTitle}`,
      text: candidateText,
      html: candidateHtml,
      replyTo: cfg.notificationsTo
    })
  ]);
}

export function notifyCandidateInterest(env, record) {
  const cfg = config(env);
  const adminUrl = `${cfg.siteUrl}/admin.html#enquiries`;

  return settle('Candidate interest', [
    sendRecruitmentEmail(env, {
      to: cfg.notificationsTo,
      subject: `New candidate registration: ${record.name}`,
      text: `A candidate has registered interest with Remote Business Partner.\n\nName: ${record.name}\nEmail: ${record.email}\nPhone: ${record.phone || 'Not provided'}\nPreferred roles: ${record.preferred_roles || 'Not provided'}\nPreferred location: ${record.preferred_location || 'Not provided'}\n\nReview: ${adminUrl}`,
      html: `<h2>New candidate registration</h2><p><strong>${esc(record.name)}</strong><br>${esc(record.email)}<br>${esc(record.phone || 'Phone not provided')}</p><p><strong>Preferred roles:</strong> ${esc(record.preferred_roles || 'Not provided')}<br><strong>Preferred location:</strong> ${esc(record.preferred_location || 'Not provided')}</p><p><a href="${esc(adminUrl)}">Open RBP Recruitment Administration</a></p>`,
      replyTo: record.email
    }),
    sendRecruitmentEmail(env, {
      to: record.email,
      subject: 'Your candidate registration has been received',
      text: `Hi ${record.name},\n\nThank you for registering your interest with Remote Business Partner. We have received your details and may contact you where a suitable opportunity arises.\n\nQuestions can be sent to ${cfg.notificationsTo}.\n\nRemote Business Partner\nABN 76 098 718 150`,
      html: `<p>Hi ${esc(record.name)},</p><p>Thank you for registering your interest with Remote Business Partner. We have received your details and may contact you where a suitable opportunity arises.</p><p>Questions can be sent to <a href="mailto:${esc(cfg.notificationsTo)}">${esc(cfg.notificationsTo)}</a>.</p><p>Remote Business Partner<br><small>ABN 76 098 718 150</small></p>`,
      replyTo: cfg.notificationsTo
    })
  ]);
}

export function notifyRecruitmentRequest(env, record) {
  const cfg = config(env);
  const adminUrl = `${cfg.siteUrl}/admin.html#enquiries`;

  return settle('Recruitment request', [
    sendRecruitmentEmail(env, {
      to: cfg.notificationsTo,
      subject: `New recruitment request: ${record.company_name} - ${record.position_title}`,
      text: `A new employer recruitment request has been received.\n\nBusiness: ${record.company_name}\nContact: ${record.contact_name}\nEmail: ${record.email}\nPhone: ${record.phone || 'Not provided'}\nPosition: ${record.position_title}\nEmployment type: ${record.employment_type}\nLocation: ${record.location || 'Not provided'}\nRemuneration: ${record.remuneration || 'Not provided'}\n\nReview: ${adminUrl}`,
      html: `<h2>New employer recruitment request</h2><p><strong>${esc(record.company_name)}</strong><br>${esc(record.contact_name)}<br>${esc(record.email)}<br>${esc(record.phone || 'Phone not provided')}</p><p><strong>Position:</strong> ${esc(record.position_title)}<br><strong>Employment type:</strong> ${esc(record.employment_type)}<br><strong>Location:</strong> ${esc(record.location || 'Not provided')}<br><strong>Remuneration:</strong> ${esc(record.remuneration || 'Not provided')}</p><p><a href="${esc(adminUrl)}">Open RBP Recruitment Administration</a></p>`,
      replyTo: record.email
    }),
    sendRecruitmentEmail(env, {
      to: record.email,
      subject: `Recruitment request received - ${record.position_title}`,
      text: `Hi ${record.contact_name},\n\nThank you for contacting Remote Business Partner about recruitment for ${record.position_title}. We have received your request and will contact you to confirm the role, scope, applicable fee and engagement terms before recruitment work commences.\n\nQuestions can be sent to ${cfg.notificationsTo}.\n\nRemote Business Partner\nABN 76 098 718 150`,
      html: `<p>Hi ${esc(record.contact_name)},</p><p>Thank you for contacting Remote Business Partner about recruitment for <strong>${esc(record.position_title)}</strong>.</p><p>We have received your request and will contact you to confirm the role, scope, applicable fee and engagement terms before recruitment work commences.</p><p>Questions can be sent to <a href="mailto:${esc(cfg.notificationsTo)}">${esc(cfg.notificationsTo)}</a>.</p><p>Remote Business Partner<br><small>ABN 76 098 718 150</small></p>`,
      replyTo: cfg.notificationsTo
    })
  ]);
}

export function deferEmail(context, promise) {
  if (context && typeof context.waitUntil === 'function') {
    context.waitUntil(promise);
  } else {
    promise.catch(err => console.error('Deferred recruitment email failed:', err && err.message));
  }
}
