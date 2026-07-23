const nodemailer = require('nodemailer');

const DEFAULT_RECIPIENT = 'patelvivek9111@gmail.com';

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
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.CONTACT_SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
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
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword,
      },
      tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
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
  await transporter.sendMail({
    from: `"MySl8te contact" <${from}>`,
    to,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
  });
  return { ok: true };
}

/**
 * Send a public landing-page inquiry to CONTACT_INQUIRY_RECIPIENT
 * (default patelvivek9111@gmail.com).
 *
 * Uses CONTACT_SMTP_* when set; otherwise falls back to admin SystemSettings SMTP.
 * Requires a Gmail App Password (or other SMTP credentials) for delivery.
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

  const envTransporter = getEnvTransporter();
  const envFrom = (process.env.CONTACT_SMTP_FROM || process.env.CONTACT_SMTP_USER || '').trim();
  if (envTransporter && envFrom) {
    try {
      return await sendWithNodemailer({
        transporter: envTransporter,
        from: envFrom,
        to,
        replyTo: email,
        subject,
        text,
        html,
      });
    } catch (err) {
      console.error('Contact inquiry SMTP (env) failed:', err.message);
      return { ok: false, code: 'SEND_FAILED', message: 'Could not send your message. Please try again later.' };
    }
  }

  const systemMail = await getSystemSettingsMail();
  if (systemMail) {
    try {
      return await sendWithNodemailer({
        transporter: systemMail.transporter,
        from: systemMail.from,
        to,
        replyTo: email,
        subject,
        text,
        html,
      });
    } catch (err) {
      console.error('Contact inquiry SMTP (SystemSettings) failed:', err.message);
      return { ok: false, code: 'SEND_FAILED', message: 'Could not send your message. Please try again later.' };
    }
  }

  return {
    ok: false,
    code: 'SMTP_NOT_CONFIGURED',
    message:
      'Contact email is not configured on the server. Set CONTACT_SMTP_HOST, CONTACT_SMTP_USER, and CONTACT_SMTP_PASS (Gmail App Password).',
  };
}

module.exports = { sendContactInquiry, DEFAULT_RECIPIENT };
