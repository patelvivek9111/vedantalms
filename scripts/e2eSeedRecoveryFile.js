/**
 * Ephemeral seed for §21 File Recovery Center regression.
 *
 * Creates ONE soft-deleted FileAsset (so it shows under the recovery center's
 * "deleted" filter) and prints `{ "id": ..., "originalName": ... }` as JSON.
 *
 *   node scripts/e2eSeedRecoveryFile.js              # create + print JSON
 *   node scripts/e2eSeedRecoveryFile.js --cleanup ID # hard-delete the asset
 *
 * Used by e2e/specs/regression-interactions/recovery-admin.spec.ts so the test
 * is self-contained and never depends on shared seed data.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const FileAsset = require('../models/fileAsset.model');

const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL || 'teacher@vidyalms.com';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('[e2e] MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const cleanupIdx = process.argv.indexOf('--cleanup');
  if (cleanupIdx !== -1) {
    const id = process.argv[cleanupIdx + 1];
    if (id) await FileAsset.deleteOne({ _id: id }).catch(() => {});
    await mongoose.disconnect();
    process.exit(0);
  }

  const teacher = await User.findOne({ email: TEACHER_EMAIL });
  if (!teacher) {
    console.error('[e2e] teacher not found:', TEACHER_EMAIL);
    await mongoose.disconnect();
    process.exit(1);
  }
  const course = await Course.findOne().sort({ createdAt: -1 });

  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const originalName = `s21-recover-${token}.pdf`;
  const asset = await FileAsset.create({
    storageKey: `e2e-s21-recovery-${token}`,
    provider: 'local',
    path: `/uploads/e2e/s21-recovery-${token}.pdf`,
    originalName,
    mimeType: 'application/pdf',
    size: 1024,
    uploadedBy: teacher._id,
    courseId: course ? course._id : undefined,
    category: 'page',
    isDeleted: true,
    deletedAt: new Date(),
    cleanupState: 'SOFT_DELETED',
  });

  console.log(JSON.stringify({ id: asset._id.toString(), originalName }));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[e2e] §21 recovery seed failed:', err);
  process.exit(1);
});
