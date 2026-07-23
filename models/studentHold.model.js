const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Student registration / grade / transcript holds (Canvas + registrar).
 */
const HOLD_TYPES = [
  'registration',
  'transcript',
  'grade',
  'financial',
  'disciplinary',
  'other',
];

const studentHoldSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    holdType: {
      type: String,
      enum: HOLD_TYPES,
      required: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    source: { type: String, default: 'manual', trim: true },
    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    placedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    blocksRegistration: { type: Boolean, default: true },
    blocksTranscript: { type: Boolean, default: false },
    blocksGrades: { type: Boolean, default: false },
    externalHoldId: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

studentHoldSchema.plugin(tenantScopePlugin);

studentHoldSchema.index({ rootAccountId: 1, studentId: 1, isActive: 1 });
studentHoldSchema.index({ rootAccountId: 1, holdType: 1, isActive: 1 });
studentHoldSchema.index(
  { rootAccountId: 1, externalHoldId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rootAccountId: { $type: 'objectId' },
      externalHoldId: { $type: 'string', $gt: '' },
    },
  }
);

studentHoldSchema.statics.HOLD_TYPES = HOLD_TYPES;

studentHoldSchema.statics.hasBlockingHold = async function hasBlockingHold(
  rootAccountId,
  studentId,
  { registration = false, transcript = false, grades = false } = {}
) {
  const filter = {
    rootAccountId,
    studentId,
    isActive: true,
  };
  const or = [];
  if (registration) or.push({ blocksRegistration: true });
  if (transcript) or.push({ blocksTranscript: true });
  if (grades) or.push({ blocksGrades: true });
  if (!or.length) return null;
  filter.$or = or;
  return this.findOne(filter).lean();
};

module.exports = mongoose.model('StudentHold', studentHoldSchema);
