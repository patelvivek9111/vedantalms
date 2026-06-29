/**
 * Seeds §14.14 file infrastructure fixtures into the demo math course DB.
 * Writes e2e/.env.local keys for Playwright regression.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const FileAsset = require('../models/fileAsset.model');
const { writeE2eEnvLocal } = require('./writeE2eEnvLocal');

const COURSE_CODE = process.env.E2E_MATH_COURSE_CODE || 'DEMO-MATH8-IN-2026';
const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL || 'teacher@vidyalms.com';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('[e2e] MONGODB_URI is not set — skipping §14.14 file seed');
    process.exit(0);
  }

  await mongoose.connect(uri);

  const teacher = await User.findOne({ email: TEACHER_EMAIL });
  const course = await Course.findOne({ 'catalog.courseCode': COURSE_CODE });
  if (!teacher || !course) {
    console.warn('[e2e] Demo teacher or math course not found — run seed:e2e:visual first');
    await mongoose.disconnect();
    process.exit(0);
  }

  const courseId = course._id.toString();
  const versionGroupId = `e2e_14_14_vg_${courseId}`;

  let priorVersion = await FileAsset.findOne({ storageKey: `e2e-14-14-v1-${courseId}` });
  if (!priorVersion) {
    priorVersion = await FileAsset.create({
      storageKey: `e2e-14-14-v1-${courseId}`,
      provider: 'local',
      path: `/uploads/e2e/14-14-v1-${courseId}.png`,
      originalName: 'regression-attachment-v1.png',
      mimeType: 'image/png',
      size: 2048,
      uploadedBy: teacher._id,
      courseId: course._id,
      category: 'page',
      versionGroupId,
      versionNumber: 1,
      isCurrentVersion: false,
      isDeleted: false,
    });
  } else {
    priorVersion.isCurrentVersion = false;
    priorVersion.isDeleted = false;
    priorVersion.versionGroupId = versionGroupId;
    priorVersion.versionNumber = 1;
    await priorVersion.save();
  }

  let currentVersion = await FileAsset.findOne({ storageKey: `e2e-14-14-v2-${courseId}` });
  if (!currentVersion) {
    currentVersion = await FileAsset.create({
      storageKey: `e2e-14-14-v2-${courseId}`,
      provider: 'local',
      path: `/uploads/e2e/14-14-v2-${courseId}.png`,
      originalName: 'regression-attachment-v2.png',
      mimeType: 'image/png',
      size: 3072,
      uploadedBy: teacher._id,
      courseId: course._id,
      category: 'page',
      versionGroupId,
      versionNumber: 2,
      isCurrentVersion: true,
      supersedes: priorVersion._id,
      isDeleted: false,
    });
  } else {
    currentVersion.isCurrentVersion = true;
    currentVersion.isDeleted = false;
    currentVersion.supersedes = priorVersion._id;
    currentVersion.versionGroupId = versionGroupId;
    currentVersion.versionNumber = 2;
    await currentVersion.save();
  }

  let deletedFile = await FileAsset.findOne({ storageKey: `e2e-14-14-deleted-${courseId}` });
  if (!deletedFile) {
    deletedFile = await FileAsset.create({
      storageKey: `e2e-14-14-deleted-${courseId}`,
      provider: 'local',
      path: `/uploads/e2e/14-14-deleted-${courseId}.pdf`,
      originalName: 'regression-14-14-deleted.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      uploadedBy: teacher._id,
      courseId: course._id,
      category: 'page',
      isDeleted: true,
      deletedAt: new Date(),
      cleanupState: 'SOFT_DELETED',
    });
  } else {
    deletedFile.isDeleted = true;
    deletedFile.deletedAt = deletedFile.deletedAt || new Date();
    deletedFile.cleanupState = 'SOFT_DELETED';
    await deletedFile.save();
  }

  const module = await Module.findOne({ course: course._id }).sort({ createdAt: 1 });
  let page = module
    ? await Page.findOne({ module: module._id }).sort({ createdAt: 1 })
    : null;

  if (page) {
    page.fileAssets = [currentVersion._id];
    page.attachments = [`/api/files/${currentVersion._id}/download`];
    await page.save();
  }

  writeE2eEnvLocal({
    E2E_REGRESSION_DELETED_FILE_ID: deletedFile._id.toString(),
    E2E_REGRESSION_VERSION_FILE_ID: currentVersion._id.toString(),
    E2E_REGRESSION_PAGE_ID: page ? page._id.toString() : '',
  });

  console.log(
    JSON.stringify({
      deletedFileId: deletedFile._id.toString(),
      versionFileId: currentVersion._id.toString(),
      pageId: page ? page._id.toString() : null,
    })
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[e2e] §14.14 file seed failed:', err);
  process.exit(1);
});
