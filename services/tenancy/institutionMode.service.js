const Account = require('../../models/account.model');
const SystemSettings = require('../../models/systemSettings.model');

const MODES = new Set(['school', 'college', 'mixed']);

function normalizeMode(mode, fallback = 'mixed') {
  const m = String(mode || fallback).toLowerCase();
  return MODES.has(m) ? m : fallback;
}

/**
 * Single source of truth: Account.institutionMode.
 * SystemSettings.academic.institutionMode is kept in sync for registrar / calendar UI.
 */
async function setInstitutionMode(rootAccountId, mode) {
  if (!rootAccountId) return null;
  const next = normalizeMode(mode);
  const account = await Account.findOneAndUpdate(
    { _id: rootAccountId, parentAccountId: null },
    { $set: { institutionMode: next } },
    { new: true }
  );
  if (!account) return null;

  const settings = await SystemSettings.getSettings(rootAccountId);
  const academic = {
    ...(settings.academic?.toObject?.() || settings.academic || {}),
    institutionMode: next,
  };
  settings.academic = academic;
  await settings.save();
  return next;
}

/**
 * Heal drift: if one side is mixed and the other is school/college, prefer the specific mode.
 * Otherwise Account wins.
 */
async function reconcileInstitutionMode(rootAccountId) {
  if (!rootAccountId) return 'mixed';
  const account = await Account.findById(rootAccountId).select('institutionMode parentAccountId');
  if (!account || account.parentAccountId) return 'mixed';

  const settings = await SystemSettings.getSettings(rootAccountId);
  const aMode = normalizeMode(account.institutionMode);
  const sMode = normalizeMode(settings.academic?.institutionMode);
  if (aMode === sMode) return aMode;

  const chosen =
    aMode !== 'mixed' ? aMode : sMode !== 'mixed' ? sMode : aMode;
  await setInstitutionMode(rootAccountId, chosen);
  return chosen;
}

async function getInstitutionMode(rootAccountId) {
  if (!rootAccountId) return 'mixed';
  const account = await Account.findById(rootAccountId).select('institutionMode').lean();
  return normalizeMode(account?.institutionMode);
}

module.exports = {
  normalizeMode,
  setInstitutionMode,
  reconcileInstitutionMode,
  getInstitutionMode,
};
