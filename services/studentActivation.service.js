const crypto = require('crypto');
const Account = require('../models/account.model');
const AccountInvite = require('../models/accountInvite.model');
const PendingStudentRoster = require('../models/pendingStudentRoster.model');
const StudentActivationAttempt = require('../models/studentActivationAttempt.model');
const User = require('../models/user.model');
const { withTenantFilter } = require('../utils/tenantContext');
const { ensureAccountMembership } = require('./tenancy/accountMembership.service');
const { assertSeatAvailable } = require('./tenancy/accountQuota.service');
const { sendEmail } = require('../utils/emailService');
const { buildStudentActivationInviteEmail } = require('../utils/inviteEmailTemplate');

const GENERIC_VERIFY_ERROR =
  "We couldn't verify your information. Please contact your registrar.";
const GENERIC_SUCCESS =
  "If your information matches our records, you'll receive an email shortly.";

const STUDENT_ID_LOCK_WINDOW_MS = parseInt(
  process.env.STUDENT_ACTIVATION_LOCK_WINDOW_MS || `${15 * 60 * 1000}`,
  10
);
const STUDENT_ID_LOCK_MAX = parseInt(process.env.STUDENT_ACTIVATION_LOCK_MAX || '5', 10);

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeStudentId(value) {
  return String(value || '').trim();
}

function firstLetter(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const ch = s[0];
  return /[a-zA-Z]/.test(ch) ? ch.toLowerCase() : '';
}

function firstFourDigits(studentId) {
  const digits = String(studentId || '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(0, 4);
  return digits.padStart(4, '0');
}

function hashIp(ip) {
  if (!ip) return '';
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

async function logAttempt({
  rootAccountId,
  studentId,
  result,
  ip,
  middleNameMismatch = false,
}) {
  try {
    await StudentActivationAttempt.create({
      rootAccountId,
      studentId: normalizeStudentId(studentId) || '(none)',
      result,
      ipHash: hashIp(ip),
      middleNameMismatch,
    });
  } catch (err) {
    console.warn('student activation attempt log failed:', err.message);
  }
}

/**
 * Returns true if this studentId is locked due to too many failed attempts.
 */
async function isStudentIdLocked(rootAccountId, studentId) {
  const sid = normalizeStudentId(studentId);
  if (!sid) return false;
  const since = new Date(Date.now() - STUDENT_ID_LOCK_WINDOW_MS);
  const failed = await StudentActivationAttempt.countDocuments({
    rootAccountId,
    studentId: sid,
    createdAt: { $gte: since },
    result: { $in: ['not_found', 'already_claimed', 'name_mismatch', 'locked'] },
  });
  return failed >= STUDENT_ID_LOCK_MAX;
}

/**
 * Generate school email: firstInitial + middleInitial? + lastInitial + first4Digits + @domain
 * Appends numeric suffix on collision within the tenant.
 */
async function generateSchoolEmail({
  rootAccountId,
  firstName,
  middleName,
  lastName,
  studentId,
  domain,
}) {
  const localBase =
    `${firstLetter(firstName)}${firstLetter(middleName)}${firstLetter(lastName)}${firstFourDigits(studentId)}`.toLowerCase();
  if (!localBase || !domain) {
    throw new Error('Cannot generate school email without name initials and domain');
  }

  const normalizedDomain = String(domain).toLowerCase().replace(/^@/, '').trim();
  let candidate = `${localBase}@${normalizedDomain}`;
  let suffix = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await User.findOne(withTenantFilter({ email: candidate }, rootAccountId))
      .select('_id')
      .lean();
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${localBase}${suffix}@${normalizedDomain}`;
    if (suffix > 999) {
      throw new Error('Unable to allocate unique school email');
    }
  }
}

function namesMatch(roster, input) {
  return (
    normalizeName(roster.firstName) === normalizeName(input.firstName) &&
    normalizeName(roster.lastName) === normalizeName(input.lastName)
  );
}

function middleNameDiffers(roster, input) {
  const provided = normalizeName(input.middleName);
  if (!provided) return false;
  const rosterMiddle = normalizeName(roster.middleName);
  if (!rosterMiddle) return false;
  return provided !== rosterMiddle;
}

/**
 * Claim a pre-provisioned roster slot and send setup invite to personal email.
 * Always returns a shape suitable for a generic public response (no account details).
 */
async function claimStudentActivation({
  rootAccountId,
  firstName,
  middleName,
  lastName,
  studentId,
  personalEmail,
  ip,
  honeypot,
}) {
  const sid = normalizeStudentId(studentId);

  // Honeypot: pretend success, do nothing.
  if (honeypot && String(honeypot).trim() !== '') {
    await logAttempt({ rootAccountId, studentId: sid, result: 'honeypot', ip });
    return { ok: true, message: GENERIC_SUCCESS };
  }

  const account = await Account.findById(rootAccountId).lean();
  if (!account || account.studentEmailMode !== 'auto-generate' || !account.domain) {
    await logAttempt({ rootAccountId, studentId: sid, result: 'mode_disabled', ip });
    return { ok: false, message: GENERIC_VERIFY_ERROR };
  }

  if (await isStudentIdLocked(rootAccountId, sid)) {
    await logAttempt({ rootAccountId, studentId: sid, result: 'locked', ip });
    return { ok: false, message: GENERIC_VERIFY_ERROR, locked: true };
  }

  const roster = await PendingStudentRoster.findOne(
    withTenantFilter({ studentId: sid }, rootAccountId)
  );

  if (!roster) {
    await logAttempt({ rootAccountId, studentId: sid, result: 'not_found', ip });
    return { ok: false, message: GENERIC_VERIFY_ERROR };
  }

  if (roster.status === 'claimed') {
    await logAttempt({ rootAccountId, studentId: sid, result: 'already_claimed', ip });
    return { ok: false, message: GENERIC_VERIFY_ERROR };
  }

  if (!namesMatch(roster, { firstName, lastName })) {
    await logAttempt({ rootAccountId, studentId: sid, result: 'name_mismatch', ip });
    return { ok: false, message: GENERIC_VERIFY_ERROR };
  }

  const middleMismatch = middleNameDiffers(roster, { middleName });

  // Atomically claim before creating the user (one student ID, once).
  const locked = await PendingStudentRoster.findOneAndUpdate(
    withTenantFilter({ _id: roster._id, status: 'pending' }, rootAccountId),
    {
      $set: {
        status: 'claimed',
        claimedAt: new Date(),
        middleNameMismatch: middleMismatch,
      },
    },
    { new: true }
  );

  if (!locked) {
    await logAttempt({ rootAccountId, studentId: sid, result: 'already_claimed', ip });
    return { ok: false, message: GENERIC_VERIFY_ERROR };
  }

  let user = null;
  try {
    await assertSeatAvailable(rootAccountId, { additional: 1 });

    const schoolEmail = await generateSchoolEmail({
      rootAccountId,
      firstName: roster.firstName,
      middleName: roster.middleName || middleName,
      lastName: roster.lastName,
      studentId: sid,
      domain: account.domain,
    });

    const randomPassword = `Act${crypto.randomBytes(12).toString('hex')}!`;
    user = await User.create({
      firstName: String(firstName).trim(),
      middleName: String(middleName || roster.middleName || '').trim(),
      lastName: String(lastName).trim(),
      email: schoolEmail,
      personalEmail: String(personalEmail).toLowerCase().trim(),
      password: randomPassword,
      role: 'student',
      pendingPasswordSetup: true,
      rootAccountId,
      accountId: rootAccountId,
      studentProfile: {
        studentId: sid,
      },
      privacyConsentAt: new Date(),
    });

    await ensureAccountMembership({
      user,
      rootAccountId,
      accountId: rootAccountId,
      role: 'student',
    });

    locked.claimedByUserId = user._id;
    await locked.save();

    const { invite, rawToken } = await AccountInvite.createInvite({
      rootAccountId,
      accountId: rootAccountId,
      email: schoolEmail,
      role: 'student',
      invitedBy: null,
    });

    const frontendBase = (
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_URL ||
      process.env.APP_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const inviteUrl = `${frontendBase}/accept-invite?token=${encodeURIComponent(rawToken)}`;
    const accountName = account.name || 'MySl8te';
    const mail = buildStudentActivationInviteEmail({
      accountName,
      schoolEmail,
      inviteUrl,
      expiresAt: invite.expiresAt,
    });

    try {
      const mailResult = await sendEmail(
        String(personalEmail).toLowerCase().trim(),
        mail.subject,
        mail.html,
        mail.text,
        { rootAccountId }
      );
      if (!mailResult?.success) {
        console.warn(
          'Student activation invite email not sent:',
          mailResult?.error || 'unknown',
          { personalEmail: String(personalEmail).toLowerCase().trim(), schoolEmail }
        );
      }
    } catch (mailErr) {
      console.warn('Student activation invite email failed:', mailErr.message);
    }

    await logAttempt({
      rootAccountId,
      studentId: sid,
      result: 'success',
      ip,
      middleNameMismatch: middleMismatch,
    });

    return { ok: true, message: GENERIC_SUCCESS };
  } catch (err) {
    // Roll back claim so the student can retry after ops fix.
    try {
      await PendingStudentRoster.updateOne(
        { _id: locked._id },
        { $set: { status: 'pending', claimedAt: null, claimedByUserId: null, middleNameMismatch: false } }
      );
    } catch (revertErr) {
      console.warn('Failed to revert roster claim:', revertErr.message);
    }
    if (user?._id) {
      try {
        await User.deleteOne({ _id: user._id });
      } catch (delErr) {
        console.warn('Failed to delete partial activation user:', delErr.message);
      }
    }
    await logAttempt({ rootAccountId, studentId: sid, result: 'error', ip });
    throw err;
  }
}

module.exports = {
  GENERIC_VERIFY_ERROR,
  GENERIC_SUCCESS,
  STUDENT_ID_LOCK_MAX,
  STUDENT_ID_LOCK_WINDOW_MS,
  normalizeName,
  normalizeStudentId,
  generateSchoolEmail,
  isStudentIdLocked,
  claimStudentActivation,
  logAttempt,
};
