const Account = require('../../models/account.model');
const AccountBrand = require('../../models/accountBrand.model');
const SystemSettings = require('../../models/systemSettings.model');

/**
 * Canvas-style institution identity:
 * Account.name is canonical; brand.displayName + settings.general.siteName mirror it.
 */
async function syncInstitutionIdentity(rootAccountId, name) {
  if (!rootAccountId || name == null) return null;
  const next = String(name).trim();
  if (!next) return null;

  const account = await Account.findOneAndUpdate(
    { _id: rootAccountId, parentAccountId: null },
    { $set: { name: next } },
    { new: true }
  );
  if (!account) return null;

  const brand = await AccountBrand.getForRoot(rootAccountId);
  if (brand.displayName !== next) {
    brand.displayName = next;
    await brand.save();
  }

  const settings = await SystemSettings.getSettings(rootAccountId);
  const general = {
    ...(settings.general?.toObject?.() || settings.general || {}),
    siteName: next,
  };
  const email = {
    ...(settings.email?.toObject?.() || settings.email || {}),
  };
  if (!email.fromName || email.fromName === settings.general?.siteName) {
    email.fromName = next;
  }
  settings.general = general;
  settings.email = email;
  await settings.save();

  return account;
}

module.exports = { syncInstitutionIdentity };
