// Transactional recruitment email helper using Cloudflare Email Service REST API.
//
// Required Cloudflare Pages configuration:
//   CLOUDFLARE_ACCOUNT_ID            normal environment variable
//   CLOUDFLARE_EMAIL_API_TOKEN       secret with Email Sending: Edit permission
// Optional overrides:
//   RECRUITMENT_EMAIL_FROM           defaults to recruitment@remotebusinesspartner.com.au
//   RECRUITMENT_NOTIFICATION_EMAIL   defaults to recruitment@remotebusinesspartner.com.au
//   PUBLIC_SITE_URL                  defaults to the production pages.dev hostname
//
// Email delivery must never determine whether a recruitment form submission is
// accepted. Call the notify* helpers after the D1/R2 write has succeeded and
// schedule them with context.waitUntil where available.

const DEFAULT_EMAIL = 'recruitment@remotebusinesspartner.com.au';
const DEFAULT_SITE_URL = 'https://remote-business-partner-recruitment-application.pages.dev';

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
    accountId: String(env.CLOUDFLARE_ACCOUNT_ID || '').trim(),
    apiToken: String(env.CLOUDFLARE_EMAIL_API_TOKEN || '').trim(),
    from: String(env.RECRUITMENT_EMAIL_FROM || DEFAULT_EMAIL).trim(),
    notificationsTo: String(env.RECRUITMENT_NOTIFICATION_EMAIL || DEFAULT_EMAIL).trim(),
    siteUrl: String(env.PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
  };
}

export function isRecruitmentEmailConfigured(env) {
  const cfg = config(env);
  return Boolean(cfg.accountId && cfg.apiToken && cfg.from && cfg.notificationsTo);
}

export async function sendRecruitmentEmail(env, { to, subject, text, html, replyTo }) {
  const cfg = config(env);
  if (!cfg.accountId || !cfg.apiToken) {
    console.warn('Recruitment email skipped: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_EMAIL_API_TOKEN is not configured.');
    return { skipped: true };
  }

  const payload = {
    to,
    from: cfg.from,
    subject,
    text,
    html
  };
  // Cloudflare Email Service REST API uses reply_to. The Workers binding uses replyTo.
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  let body = null;
  try { body = await response.json(); } catch { /* ignore malformed upstream body */ }

  if (!response.ok || (body && body.success === false)) {
    const upstream = body && body.errors && body.errors.length
      ? body.errors.map(e => e.message || e.code).join('; ')
      : `HTTP ${response.status}`;
    throw new Error(`Cloudflare Email Service rejected the message: ${upstream}`);
  }

  return body && body.result ? body.result : { sent: true };
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
