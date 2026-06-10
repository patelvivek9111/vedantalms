const mongoose = require('mongoose');

const FILE_CATEGORIES = [
  'submission',
  'assignment',
  'profile',
  'page',
  'announcement',
  'discussion',
  'grade-export',
  'transcript',
  'syllabus',
  'system',
  'temporary',
  'message',
];

const FILE_VISIBILITY = ['private', 'course', 'institution', 'public'];

const CLEANUP_STATES = [
  'ACTIVE',
  'ORPHAN_CANDIDATE',
  'PENDING_DELETE',
  'SOFT_DELETED',
  'HARD_DELETED',
];

const SCAN_STATUSES = ['pending', 'clean', 'unsafe', 'skipped'];

const accessScopeSchema = new mongoose.Schema(
  {
    enrolledOnly: { type: Boolean, default: false },
    instructorOnly: { type: Boolean, default: false },
    ownerOnly: { type: Boolean, default: false },
  },
  { _id: false }
);

const fileAssetSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    provider: { type: String, required: true },
    bucket: { type: String, default: '' },
    path: { type: String, required: true },

    originalName: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    extension: { type: String, default: '' },
    size: { type: Number, default: 0 },
    checksumSha256: { type: String, default: '' },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    institutionId: { type: String, default: 'default' },

    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
    pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
    announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement' },
    discussionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' },

    category: {
      type: String,
      enum: FILE_CATEGORIES,
      required: true,
    },
    visibility: {
      type: String,
      enum: FILE_VISIBILITY,
      default: 'private',
    },
    accessScope: {
      type: accessScopeSchema,
      default: () => ({}),
    },

    lifecycleLocked: { type: Boolean, default: false },

    cleanupState: {
      type: String,
      enum: CLEANUP_STATES,
      default: 'ACTIVE',
    },

    versionNumber: { type: Number, default: 1 },
    versionGroupId: { type: String, default: '' },
    supersedes: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' },
    isCurrentVersion: { type: Boolean, default: true },

    scanStatus: {
      type: String,
      enum: SCAN_STATUSES,
      default: 'skipped',
    },
    scanMeta: { type: mongoose.Schema.Types.Mixed },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    schemaVersion: { type: Number, default: 1 },
    migrationMeta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

fileAssetSchema.index({ courseId: 1, createdAt: -1 });
fileAssetSchema.index({ uploadedBy: 1, createdAt: -1 });
fileAssetSchema.index({ category: 1, createdAt: -1 });
fileAssetSchema.index({ submissionId: 1 });
fileAssetSchema.index({ assignmentId: 1 });
fileAssetSchema.index({ storageKey: 1 }, { unique: true });
fileAssetSchema.index({ isDeleted: 1, category: 1 });
fileAssetSchema.index({ cleanupState: 1, category: 1 });
fileAssetSchema.index({ versionGroupId: 1, isCurrentVersion: 1 });
fileAssetSchema.index({ 'migrationMeta.legacyUrl': 1 }, { sparse: true });
fileAssetSchema.index({ checksumSha256: 1 }, { sparse: true });

const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
fileAssetSchema.plugin(portabilityMetadataPlugin);

module.exports = mongoose.model('FileAsset', fileAssetSchema);
module.exports.FILE_CATEGORIES = FILE_CATEGORIES;
module.exports.FILE_VISIBILITY = FILE_VISIBILITY;
module.exports.CLEANUP_STATES = CLEANUP_STATES;
module.exports.SCAN_STATUSES = SCAN_STATUSES;
