/**
 * HTML + plain-text bodies for account invite / student activation emails.
 * Escapes user-controlled strings; CTA uses a button + plain-text URL fallback.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(expiresAt) {
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return 'soon';
  try {
    return (
      new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(d) + ' UTC'
    );
  } catch {
    return d.toISOString();
  }
}

function wrapInstitutionEmail({ siteName, title, bodyHtml, footerNote }) {
  const safeSite = escapeHtml(siteName);
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0f172a;padding:22px 28px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;font-weight:600;">${safeSite}</div>
              <div style="margin-top:6px;font-size:22px;line-height:1.3;font-weight:600;color:#ffffff;">${safeTitle}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.6;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;">
              ${footerNote || `This message was sent by ${safeSite}. If you did not expect it, you can ignore this email.`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href, label) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:8px;background:#0284c7;">
      <a href="${safeHref}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Student self-service activation invite (sent to personal email).
 */
function buildStudentActivationInviteEmail({
  accountName,
  schoolEmail,
  inviteUrl,
  expiresAt,
}) {
  const site = String(accountName || 'MySL8TE').trim() || 'MySL8TE';
  const login = String(schoolEmail || '').trim();
  const url = String(inviteUrl || '').trim();
  const expiresLabel = formatExpiry(expiresAt);

  const subject = `Finish setting up your ${site} account`;

  const text = `Your student account is ready to activate on ${site}.

Your school login email will be: ${login}

Set your password using this link (expires ${expiresLabel}):
${url}

If you did not request this, contact your registrar.`;

  const bodyHtml = `
<p style="margin:0 0 16px;">Your student account is ready to activate on <strong>${escapeHtml(site)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <tr>
    <td style="padding:14px 16px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">School login email</div>
      <div style="margin-top:4px;font-size:16px;font-weight:600;color:#0f172a;word-break:break-all;">${escapeHtml(login)}</div>
    </td>
  </tr>
</table>
<p style="margin:16px 0 0;">Use the button below to set your password and finish activation.</p>
<p style="margin:8px 0 0;font-size:13px;color:#64748b;">This link expires <strong>${escapeHtml(expiresLabel)}</strong>.</p>
${ctaButton(url, 'Set your password')}
<p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">Or paste this link into your browser:<br /><a href="${escapeHtml(url)}" style="color:#0284c7;">${escapeHtml(url)}</a></p>
<p style="margin:20px 0 0;">If you did not request this, contact your registrar.</p>`;

  const html = wrapInstitutionEmail({
    siteName: site,
    title: 'Activate your account',
    bodyHtml,
    footerNote: `Automated message from ${escapeHtml(site)}. Do not reply to this email.`,
  });

  return { subject, html, text };
}

/**
 * Admin-created account invite.
 */
function buildAccountInviteEmail({ accountName, role, inviteUrl, expiresAt }) {
  const site = String(accountName || 'MySL8TE').trim() || 'MySL8TE';
  const inviteRole = String(role || 'member').trim();
  const url = String(inviteUrl || '').trim();
  const expiresLabel = formatExpiry(expiresAt);

  const subject = `You're invited to join ${site}`;

  const text = `You have been invited as ${inviteRole} on ${site}.

Accept this invitation (link expires ${expiresLabel}):
${url}

If you did not expect this email, you can ignore it.`;

  const bodyHtml = `
<p style="margin:0 0 16px;">You have been invited to join <strong>${escapeHtml(site)}</strong> as <strong>${escapeHtml(inviteRole)}</strong>.</p>
<p style="margin:0;font-size:13px;color:#64748b;">This invitation expires <strong>${escapeHtml(expiresLabel)}</strong>.</p>
${ctaButton(url, 'Accept invitation')}
<p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">Or paste this link into your browser:<br /><a href="${escapeHtml(url)}" style="color:#0284c7;">${escapeHtml(url)}</a></p>
<p style="margin:20px 0 0;">If you did not expect this email, you can ignore it.</p>`;

  const html = wrapInstitutionEmail({
    siteName: site,
    title: 'You are invited',
    bodyHtml,
    footerNote: `Automated message from ${escapeHtml(site)}. Do not reply to this email.`,
  });

  return { subject, html, text };
}

module.exports = {
  escapeHtml,
  formatExpiry,
  buildStudentActivationInviteEmail,
  buildAccountInviteEmail,
};
