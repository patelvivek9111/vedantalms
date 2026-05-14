const nodemailer = require('nodemailer');

const DEFAULT_RECIPIENT = 'rbmsv123@gmail.com';

let cachedTransporter = null;

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.CONTACT_SMTP_HOST;
  const port = parseInt(process.env.CONTACT_SMTP_PORT || '587', 10);
  const user = process.env.CONTACT_SMTP_USER;
  const pass = process.env.CONTACT_SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
  return cachedTransporter;
}

/**
 * Send a public landing-page inquiry to CONTACT_INQUIRY_RECIPIENT (default rbmsv123@gmail.com).
 * Requires CONTACT_SMTP_HOST, CONTACT_SMTP_USER, CONTACT_SMTP_PASS (e.g. Gmail app password).
 */
async function sendContactInquiry({ name, organization, jobTitle, userCount, extra }) {
  const to = (process.env.CONTACT_INQUIRY_RECIPIENT || DEFAULT_RECIPIENT).trim();
  const from = (process.env.CONTACT_SMTP_FROM || process.env.CONTACT_SMTP_USER || '').trim();
  const transporter = getTransporter();
  if (!transporter || !from) {
    return {
      ok: false,
      code: 'SMTP_NOT_CONFIGURED',
      message:
        'Contact email is not configured on the server. Set CONTACT_SMTP_HOST, CONTACT_SMTP_USER, and CONTACT_SMTP_PASS.',
    };
  }

  const subject = `[Vedanta inquiry] ${organization} — ${name}`;
  const text = [
    `Name: ${name}`,
    `Job title: ${jobTitle}`,
    `Organization: ${organization}`,
    `Users / scale: ${userCount}`,
    '',
    'Additional details:',
    extra || '(none)',
  ].join('\n');

  const rows = [
    ['Name', name],
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
<p>New inquiry from the Vedanta landing page.</p>
<table style="border-collapse:collapse;max-width:640px">${rows}</table>
</body></html>`;

  try {
    await transporter.sendMail({
      from: `"Vedanta contact" <${from}>`,
      to,
      replyTo: undefined,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Contact inquiry send failed:', err.message);
    return { ok: false, code: 'SEND_FAILED', message: 'Could not send your message. Please try again later.' };
  }
}

module.exports = { sendContactInquiry };
