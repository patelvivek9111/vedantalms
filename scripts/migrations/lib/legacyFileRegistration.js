const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const FileAsset = require('../../../models/fileAsset.model');
const User = require('../../../models/user.model');
const Assignment = require('../../../models/Assignment');
const Submission = require('../../../models/Submission');
const Page = require('../../../models/page.model');
const Announcement = require('../../../models/announcement.model');
const Course = require('../../../models/course.model');
const Module = require('../../../models/module.model');
const {
  walkUploadsDir,
  sha256File,
  normalizeLegacyUrl,
  resolveLocalPathFromUrl,
  inferMimeFromName,
  storageKeyFromRelative,
} = require('../../../utils/fileBlobUtils');
const { writeReport } = require('../../../utils/fileReports');
const { resolveCourseForAssignment } = require('../../../services/fileLifecycle.service');

const CHECKPOINT_FILE = path.join(
  require('../../../config/paths').paths.migrationCheckpoints,
  'legacy-file-registration.json'
);

const DEFAULT_ADMIN_ID = () => new mongoose.Types.ObjectId('000000000000000000000001');

async function resolveDefaultUploader() {
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (admin) return admin._id;
  const any = await User.findOne().select('_id').lean();
  return any?._id || DEFAULT_ADMIN_ID();
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) return { processedUrls: [] };
  return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
}

function saveCheckpoint(cp) {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

async function collectLegacyReferences() {
  const refs = [];

  const pushRef = (ref) => {
    const url = normalizeLegacyUrl(ref.url);
    if (!url) return;
    refs.push({ ...ref, url });
  };

  const assignments = await Assignment.find({ attachments: { $exists: true, $ne: [] } }).lean();
  for (const a of assignments) {
    const course = await resolveCourseForAssignment(a._id);
    for (const url of a.attachments || []) {
      pushRef({
        url,
        category: 'assignment',
        assignmentId: a._id,
        courseId: course?._id,
        uploadedBy: a.createdBy,
        createdAt: a.createdAt,
      });
    }
  }

  const submissions = await Submission.find({ files: { $exists: true, $ne: [] } }).lean();
  for (const s of submissions) {
    const asn = await Assignment.findById(s.assignment).lean();
    const course = asn ? await resolveCourseForAssignment(asn._id) : null;
    for (const url of s.files || []) {
      const u = typeof url === 'string' ? url : url?.url || url?.path;
      pushRef({
        url: u,
        category: 'submission',
        submissionId: s._id,
        assignmentId: s.assignment,
        courseId: course?._id,
        uploadedBy: s.submittedBy || s.student,
        createdAt: s.submittedAt || s.createdAt,
      });
    }
  }

  const pages = await Page.find({ attachments: { $exists: true, $ne: [] } }).lean();
  for (const p of pages) {
    let courseId = null;
    if (p.module) {
      const mod = await Module.findById(p.module).select('course').lean();
      courseId = mod?.course;
    }
    for (const url of p.attachments || []) {
      pushRef({
        url,
        category: 'page',
        pageId: p._id,
        courseId,
        uploadedBy: null,
        createdAt: p.createdAt,
      });
    }
  }

  const announcements = await Announcement.find({ attachments: { $exists: true, $ne: [] } }).lean();
  for (const ann of announcements) {
    for (const url of ann.attachments || []) {
      pushRef({
        url,
        category: 'announcement',
        announcementId: ann._id,
        courseId: ann.course,
        uploadedBy: ann.author,
        createdAt: ann.createdAt,
      });
    }
  }

  const courses = await Course.find({ 'catalog.syllabusFiles.0': { $exists: true } }).lean();
  for (const c of courses) {
    for (const f of c.catalog?.syllabusFiles || []) {
      pushRef({
        url: f.url,
        category: 'syllabus',
        courseId: c._id,
        uploadedBy: c.instructor,
        createdAt: f.uploadedAt || c.createdAt,
        originalName: f.name,
        size: f.size,
      });
    }
  }

  const users = await User.find({
    profilePicture: { $exists: true, $ne: '' },
  }).lean();
  for (const u of users) {
    if (!u.profilePicture || u.profilePicture.includes('/api/files/')) continue;
    pushRef({
      url: u.profilePicture,
      category: 'profile',
      uploadedBy: u._id,
      createdAt: u.createdAt,
      visibility: 'public',
    });
  }

  for (const disk of walkUploadsDir()) {
    pushRef({
      url: `/uploads/${disk.relativePath}`,
      category: 'system',
      source: 'disk_scan',
      originalName: path.basename(disk.relativePath),
    });
  }

  return refs;
}

async function registerOne(ref, defaultUploader, { dryRun }) {
  const legacyUrl = ref.url;
  if (!legacyUrl || legacyUrl.includes('/api/files/')) {
    return { status: 'skipped', reason: 'already_canonical' };
  }

  const existing = await FileAsset.findOne({ 'migrationMeta.legacyUrl': legacyUrl }).lean();
  if (existing) return { status: 'skipped', reason: 'already_registered', fileAssetId: String(existing._id) };

  const isCloudinary = legacyUrl.includes('cloudinary.com');
  let checksumSha256 = '';
  let size = ref.size || 0;
  let storageKey = '';
  let provider = 'local';
  let filePath = legacyUrl;

  if (isCloudinary) {
    provider = 'cloudinary';
    storageKey = `legacy/cloudinary/${cryptoHash(legacyUrl)}`;
    filePath = legacyUrl;
  } else {
    const local = resolveLocalPathFromUrl(legacyUrl);
    if (!local) return { status: 'skipped', reason: 'blob_not_found', legacyUrl };
    const rel = path.relative(require('../../../config/paths').paths.uploads, local).replace(/\\/g, '/');
    storageKey = storageKeyFromRelative(rel.startsWith('academic/') || rel.startsWith('public/') ? rel : `legacy/${rel}`);
    try {
      const hash = sha256File(local);
      checksumSha256 = hash.checksum;
      size = hash.size;
    } catch {
      return { status: 'skipped', reason: 'checksum_failed', legacyUrl };
    }
    filePath = `/uploads/${rel}`;
  }

  const dup = checksumSha256
    ? await FileAsset.findOne({ checksumSha256, category: ref.category }).lean()
    : null;

  const payload = {
    storageKey: dup ? `${storageKey}-${Date.now()}` : storageKey,
    provider,
    path: filePath,
    originalName: ref.originalName || path.basename(legacyUrl),
    mimeType: inferMimeFromName(ref.originalName || legacyUrl),
    extension: path.extname(ref.originalName || legacyUrl).toLowerCase(),
    size,
    checksumSha256,
    uploadedBy: ref.uploadedBy || defaultUploader,
    courseId: ref.courseId,
    assignmentId: ref.assignmentId,
    submissionId: ref.submissionId,
    pageId: ref.pageId,
    announcementId: ref.announcementId,
    category: ref.category || 'system',
    visibility: ref.visibility || (ref.category === 'profile' ? 'public' : 'course'),
    accessScope: { enrolledOnly: ref.category !== 'profile', ownerOnly: ref.category === 'profile' },
    schemaVersion: 1,
    versionNumber: 1,
    isCurrentVersion: true,
    versionGroupId: `legacy_${cryptoHash(legacyUrl).slice(0, 16)}`,
    migrationMeta: {
      legacyUrl,
      source: ref.source || 'legacy_registration',
      registeredAt: new Date().toISOString(),
      duplicateOf: dup ? String(dup._id) : undefined,
    },
    metadata: isCloudinary ? { providerUrl: legacyUrl } : {},
    createdAt: ref.createdAt,
    updatedAt: ref.createdAt,
  };

  if (!ref.uploadedBy) {
    return { status: 'skipped', reason: 'unresolved_ownership', legacyUrl, wouldCreate: payload };
  }

  if (dryRun) {
    return { status: 'would_register', legacyUrl, checksumSha256, duplicate: Boolean(dup) };
  }

  try {
    const doc = await FileAsset.create(payload);
    return { status: 'registered', fileAssetId: String(doc._id), legacyUrl, duplicate: Boolean(dup) };
  } catch (e) {
    if (e.code === 11000) {
      return { status: 'skipped', reason: 'duplicate_storage_key', legacyUrl };
    }
    throw e;
  }
}

function cryptoHash(str) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function runLegacyFileRegistration(options = {}) {
  const dryRun = options.apply !== true && options.dryRun !== false;
  const checkpoint = options.resume !== false ? loadCheckpoint() : { processedUrls: [] };
  const processed = new Set(checkpoint.processedUrls || []);
  const defaultUploader = await resolveDefaultUploader();

  const refs = await collectLegacyReferences();
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    registered: 0,
    skipped: 0,
    orphanedFiles: [],
    unresolvedOwnership: [],
    duplicateChecksums: [],
    errors: [],
  };

  const checksumSeen = new Map();

  for (const ref of refs) {
    if (processed.has(ref.url)) continue;
    const result = await registerOne(ref, defaultUploader, { dryRun });
    processed.add(ref.url);

    if (result.status === 'registered' || result.status === 'would_register') {
      report.registered++;
      if (result.duplicate) report.duplicateChecksums.push({ legacyUrl: ref.url, fileAssetId: result.fileAssetId });
      if (result.checksumSha256) {
        const list = checksumSeen.get(result.checksumSha256) || [];
        list.push(ref.url);
        checksumSeen.set(result.checksumSha256, list);
      }
    } else if (result.reason === 'unresolved_ownership') {
      report.unresolvedOwnership.push({ url: ref.url, category: ref.category });
      report.skipped++;
    } else if (result.reason === 'blob_not_found') {
      report.orphanedFiles.push({ url: ref.url, category: ref.category });
      report.skipped++;
    } else {
      report.skipped++;
    }

    if (!dryRun && processed.size % 50 === 0) {
      saveCheckpoint({ processedUrls: [...processed], updatedAt: new Date().toISOString() });
    }
  }

  report.duplicateChecksumGroups = [...checksumSeen.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([checksum, urls]) => ({ checksum, urls }));

  if (!dryRun) {
    saveCheckpoint({ processedUrls: [...processed], completedAt: new Date().toISOString() });
  }

  const reportPath = writeReport('legacy-file-registration-report.json', report);
  return { report, reportPath, dryRun };
}

module.exports = {
  runLegacyFileRegistration,
  collectLegacyReferences,
};
