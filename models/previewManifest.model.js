const mongoose = require('mongoose');

const previewManifestSchema = new mongoose.Schema(
  {
    fileAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FileAsset',
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed', 'unsupported'],
      default: 'pending',
    },
    previewKind: {
      type: String,
      enum: ['image', 'pdf', 'text', 'video', 'audio', 'office', 'unsupported'],
      default: 'unsupported',
    },
    thumbnailPath: { type: String },
    previewPath: { type: String },
    posterPath: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number, default: 0 },
    error: { type: String },
    generatedAt: { type: Date },
    expiresAt: { type: Date },
    checksumSha256: { type: String },
    previewLastGeneratedAt: { type: Date },
    previewCorrupted: { type: Boolean, default: false },
    previewRegenerationAttempts: { type: Number, default: 0 },
    clientRendered: { type: Boolean, default: false },
    officeMetadata: {
      slideCount: Number,
      sheetCount: Number,
      wordCount: Number,
      title: String,
      clientRendered: Boolean,
    },
    waveformMetadata: {
      durationSec: Number,
      sampleCount: Number,
    },
  },
  { timestamps: true }
);

previewManifestSchema.index({ status: 1, updatedAt: -1 });
previewManifestSchema.index({ fileAssetId: 1 });

module.exports = mongoose.model('PreviewManifest', previewManifestSchema);
