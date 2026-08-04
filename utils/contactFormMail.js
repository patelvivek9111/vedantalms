const nodemailer = require('nodemailer');
const {
  smtpTransportTimeouts,
  SMTP_ATTEMPT_TIMEOUT_MS,
} = require('./smtpTransportTimeouts');

const DEFAULT_RECIPIENT = 'info@mysl8te.com';
/** Resend free tier uses HTTPS (port 443) — works on Render free where SMTP 25/465/587 are blocked. */
const RESEND_API_URL = 'https://api.resend.com/emails';

let cachedEnvTransporter = null;

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inquiryRecipient() {
  return (process.env.CONTACT_INQUIRY_RECIPIENT || DEFAULT_RECIPIENT).trim();
}

function resendApiKey() {
  return (process.env.RESEND_API_KEY || process.env.CONTACT_RESEND_API_KEY || '').trim();
}

function resendFromAddress() {
  return (
    process.env.CONTACT_RESEND_FROM ||
    process.env.RESEND_FROM ||
    process.env.CONTACT_SMTP_FROM ||
    ''
  ).trim();
}

function getEnvTransporter() {
  if (cachedEnvTransporter) return cachedEnvTransporter;
  const host = process.env.CONTACT_SMTP_HOST;
  const port = parseInt(process.env.CONTACT_SMTP_PORT || '587', 10);
  const user = process.env.CONTACT_SMTP_USER;
  const pass = process.env.CONTACT_SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  cachedEnvTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.CONTACT_SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
    ...smtpTransportTimeouts(),
  });
  return cachedEnvTransporter;
}

async function getSystemSettingsMail() {
  try {
    const SystemSettings = require('../models/systemSettings.model');
    const settings = await SystemSettings.getSettings();
    const emailConfig = settings?.email;
    if (!emailConfig?.smtpHost || !emailConfig?.smtpUser || !emailConfig?.smtpPassword) {
      return null;
    }
    const port = emailConfig.smtpPort || 587;
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword,
      },
      tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
      ...smtpTransportTimeouts(),
    });
    const from = (emailConfig.fromEmail || emailConfig.smtpUser || '').trim();
    if (!from) return null;
    return { transporter, from };
  } catch (err) {
    console.error('Contact inquiry: SystemSettings SMTP unavailable:', err.message);
    return null;
  }
}

function buildBodies({ name, email, organization, jobTitle, userCount, extra }) {
  const subject = `[MySl8te inquiry] ${organization} — ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Job title: ${jobTitle}`,
    `Organization: ${organization}`,
    `Users / scale: ${userCount}`,
    '',
    'Additional details:',
    extra || '(none)',
  ].join('\n');

  const rows = [
    ['Name', name],
    ['Email', email],
    ['Job title', jobTitle],
    ['Organization', organization],
    ['Users / scale', userCount],
    ['Additional', extra || '—'],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;width:160px;background:#f8fafc">${escapeHtml(
          k
        )}</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(v)}</td></tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;font-size:15px;color:#0f172a">
<p>New inquiry from the MySl8te landing page.</p>
<table style="border-collapse:collapse;max-width:640px">${rows}</table>
</body></html>`;

  return { subject, text, html };
}

async function sendWithNodemailer({ transporter, from, to, replyTo, subject, text, html }) {
  const info = await transporter.sendMail({
    from: `"MySl8te contact" <${from}>`,
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
  console.log(
    `Contact inquiry SMTP accepted messageId=${info.messageId || '(none)'} response=${info.response || '(none)'}`
  );
  return { ok: true, messageId: info.messageId || null };
}

/**
 * Send via Resend HTTPS API (port 443). Preferred on Render free tier.
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
async function sendWithResend({ apiKey, from, to, replyTo, subject, text, html }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from.includes('<') ? from : `MySl8te contact <${from}>`,
      to: [to],
      reply_to: replyTo || undefined,
      subject,
      text,
      html,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.message || body?.error || res.statusText || `HTTP ${res.status}`;
    throw new Error(`Resend API ${res.status}: ${detail}`);
  }

  const messageId = body?.id || null;
  console.log(`Contact inquiry Resend accepted id=${messageId || '(none)'}`);
  return { ok: true, messageId };
}

function withAttemptTimeout(promise, label) {
  let timeoutId;
  return Promise.race([
    promise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`${label} timed out after ${SMTP_ATTEMPT_TIMEOUT_MS}ms`)),
        SMTP_ATTEMPT_TIMEOUT_MS
      );
    }),
  ]);
}

function isTimeoutError(err) {
  return /timed?\s*out|timeout/i.test(String(err?.message || ''));
}

/**
 * Send a public landing-page inquiry to CONTACT_INQUIRY_RECIPIENT
 * (default info@mysl8te.com).
 *
 * Prefer RESEND_API_KEY (HTTPS) on Render free — SMTP ports are blocked there.
 * SMTP (CONTACT_SMTP_* / System Settings) is only used when Resend is unset,
 * so a blocked SMTP path cannot hang the request after a successful HTTPS setup.
 */
async function sendContactInquiry({ name, email, organization, jobTitle, userCount, extra }) {
  const to = inquiryRecipient();
  const { subject, text, html } = buildBodies({
    name,
    email,
    organization,
    jobTitle,
    userCount,
    extra,
  });
  console.log(`Contact inquiry → to=${to} replyTo=${email} org=${organization}`);

  const attempts = [];
  const apiKey = resendApiKey();
  const resendFrom = resendFromAddress();

  if (apiKey && resendFrom) {
    attempts.push({
      label: 'Resend',
      run: () =>
        sendWithResend({
          apiKey,
          from: resendFrom,
          to,
          replyTo: email,
          subject,
          text,
          html,
        }),
    });
  } else if (apiKey && !resendFrom) {
    console.warn(
      'Contact inquiry: RESEND_API_KEY is set but CONTACT_RESEND_FROM (or RESEND_FROM) is missing'
    );
  }

  // Skip SMTP when Resend is configured — on Render free, SMTP hangs ~15–30s per attempt.
  const useSmtp = !apiKey || process.env.CONTACT_SMTP_FALLBACK === 'true';

  if (useSmtp) {
    const envTransporter = getEnvTransporter();
    const envFrom = (process.env.CONTACT_SMTP_FROM || process.env.CONTACT_SMTP_USER || '').trim();
    if (envTransporter && envFrom) {
      attempts.push({
        label: 'CONTACT_SMTP_*',
        run: () =>
          sendWithNodemailer({
            transporter: envTransporter,
            from: envFrom,
            to,
            replyTo: email,
            subject,
            text,
            html,
          }),
      });
    }

    const systemMail = await getSystemSettingsMail();
    if (systemMail) {
      attempts.push({
        label: 'SystemSettings',
        run: () =>
          sendWithNodemailer({
            transporter: systemMail.transporter,
            from: systemMail.from,
            to,
            replyTo: email,
            subject,
            text,
            html,
          }),
      });
    }
  }

  if (attempts.length === 0) {
    return {
      ok: false,
      code: 'SMTP_NOT_CONFIGURED',
      message:
        'Contact email is not configured. Set RESEND_API_KEY + CONTACT_RESEND_FROM (recommended on Render free), or CONTACT_SMTP_* / Admin → System Settings email.',
    };
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const sent = await withAttemptTimeout(attempt.run(), attempt.label);
      console.log(`Contact inquiry sent via ${attempt.label} to ${to}`);
      return sent;
    } catch (err) {
      lastError = err;
      console.error(`Contact inquiry (${attempt.label}) failed:`, err.message);
    }
  }

  const timedOut = isTimeoutError(lastError);
  return {
    ok: false,
    code: timedOut ? 'TIMEOUT' : 'SEND_FAILED',
    message: timedOut
      ? 'Email delivery timed out.'
      : 'Could not send your message. Please try again later.',
  };
}

module.exports = {
  sendContactInquiry,
  sendWithResend,
  DEFAULT_RECIPIENT,
  SMTP_ATTEMPT_TIMEOUT_MS,
  RESEND_API_URL,
};
