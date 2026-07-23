/**
 * Phase 1 tenancy backfill:
 * - Ensure default root Account + domains
 * - Assign rootAccountId on User, Course, FileAsset, SystemSettings, InstitutionGradingPolicy
 * - Drop legacy global unique index on users.email when present
 *
 * Usage: node scripts/backfillRootAccountId.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');

async function dropLegacyEmailUniqueIndex() {
  try {
    const indexes = await mongoose.connection.collection('users').indexes();
    const emailUnique = indexes.find(
      (idx) => idx.unique && idx.key && Object.keys(idx.key).length === 1 && idx.key.email === 1
    );
    if (emailUnique) {
      await mongoose.connection.collection('users').dropIndex(emailUnique.name);
      console.log(`Dropped legacy index ${emailUnique.name}`);
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('dropLegacyEmailUniqueIndex:', err.message);
    }
  }

  try {
    const indexes = await mongoose.connection.collection('institutiongradingpolicies').indexes();
    const keyUnique = indexes.find(
      (idx) => idx.unique && idx.key && Object.keys(idx.key).length === 1 && idx.key.key === 1
    );
    if (keyUnique) {
      await mongoose.connection.collection('institutiongradingpolicies').dropIndex(keyUnique.name);
      console.log(`Dropped legacy index ${keyUnique.name}`);
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('dropLegacyPolicyKeyIndex:', err.message);
    }
  }
}

async function backfillCollection(modelName, rootId) {
  const Model = mongoose.model(modelName);
  const filter = {
    $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
  };
  const result = await Model.updateMany(filter, {
    $set: { rootAccountId: rootId, accountId: rootId },
  });
  console.log(
    `${modelName}: matched=${result.matchedCount ?? result.n} modified=${result.modifiedCount ?? result.nModified}`
  );
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  console.log('Connected');

  await dropLegacyEmailUniqueIndex();

  const root = await ensureDefaultRootAccount();
  console.log(`Default root account ${root.code} id=${root._id}`);

  // Register models
  require('../models/user.model');
  require('../models/course.model');
  require('../models/fileAsset.model');
  require('../models/systemSettings.model');
  require('../models/institutionGradingPolicy.model');

  for (const name of ['User', 'Course', 'FileAsset', 'SystemSettings', 'InstitutionGradingPolicy']) {
    await backfillCollection(name, root._id);
  }

  // Align FileAsset.institutionId string for export tools
  const FileAsset = mongoose.model('FileAsset');
  await FileAsset.updateMany(
    { rootAccountId: root._id },
    { $set: { institutionId: String(root._id) } }
  );

  console.log('Backfill complete');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
