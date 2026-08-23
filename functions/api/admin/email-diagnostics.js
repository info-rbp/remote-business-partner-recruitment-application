import { ok, fail } from '../../_lib/responses.js';
import { isRecruitmentEmailConfigured, sendRecruitmentEmail } from '../../_lib/email.js';

const DEFAULT_EMAIL = 'recruitment@remotebusinesspartner.com.au';

function configStatus(env) {
  const from = String(env.RECRUITMENT_EMAIL_FROM || DEFAULT_EMAIL).trim();
  const notificationsTo = String(env.RECRUITMENT_NOTIFICATION_EMAIL || DEFAULT_EMAIL).trim();
  const required = {
    GOOGLE_GMAIL_CLIENT_ID: Boolean(String(env.GOOGLE_GMAIL_CLIENT_ID || '').trim()),
    GOOGLE_GMAIL_CLIENT_SECRET: Boolean(String(env.GOOGLE_GMAIL_CLIENT_SECRET || '').trim()),
    GOOGLE_GMAIL_REFRESH_TOKEN: Boolean(String(env.GOOGLE_GMAIL_REFRESH_TOKEN || '').trim())
  };
  const missing = Object.entries(required).filter(([, present]) => !present).map(([name]) => name);

  return {
    provider: 'Google Workspace Gmail API',
    configured: isRecruitmentEmailConfigured(env),
    required,
    missing,
    from,
    notificationsTo
  };
}

export function onRequestGet({ env }) {
  return ok(configStatus(env));
}

export async function onRequestPost(context) {
  const { env, data } = context;
  const status = configStatus(env);

  if (!status.configured) {
    return fail(
      'email_not_configured',
      `Google Workspace email is not configured in this Pages environment. Missing: ${status.missing.join(', ') || 'required values'}.`,
      503
    );
  }

  const testedBy = data && data.staffUser && data.staffUser.email
    ? data.staffUser.email
    : 'authorised RBP staff';
  const timestamp = new Date().toISOString();

  try {
    const result = await sendRecruitmentEmail(env, {
      to: status.notificationsTo,
      subject: 'RBP Recruitment email delivery test',
      text: [
        'This is a transactional email test from the Remote Business Partner recruitment application.',
        '',
        `Sent at: ${timestamp}`,
        `Requested by: ${testedBy}`,
        '',
        'If you received this message, the Cloudflare Pages to Google Workspace Gmail API transport is working.'
      ].join('\n'),
      html: `<p>This is a transactional email test from the <strong>Remote Business Partner recruitment application</strong>.</p><p><strong>Sent at:</strong> ${timestamp}<br><strong>Requested by:</strong> ${testedBy}</p><p>If you received this message, the Cloudflare Pages to Google Workspace Gmail API transport is working.</p>`,
      replyTo: status.notificationsTo
    });

    if (result && result.skipped) {
      return fail('email_skipped', 'The Gmail transport skipped the message because its OAuth configuration is incomplete.', 503);
    }

    return ok({
      ...status,
      test: {
        sent: true,
        recipient: status.notificationsTo,
        gmailMessageId: result && result.id ? result.id : null,
        gmailThreadId: result && result.threadId ? result.threadId : null,
        sentAt: timestamp
      }
    });
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown Gmail API error.';
    console.error('Gmail diagnostics test failed:', message);
    return fail('gmail_test_failed', message, 502);
  }
}
