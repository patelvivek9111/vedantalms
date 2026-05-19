const crypto = require('crypto');

const IMMUTABLE_ALLOWED_UPDATES = new Set([
  'isCurrent',
  'supersededAt',
  'supersededBy',
  'updatedAt',
]);

function checksumDoc(doc) {
  const payload = JSON.stringify({
    student: doc.student,
    course: doc.course,
    term: doc.term,
    year: doc.year,
    finalPercent: doc.finalPercent,
    letterGrade: doc.letterGrade,
    gradingPolicyHash: doc.gradingPolicyHash,
    gradingPolicyVersion: doc.gradingPolicyVersion,
    frozen: doc.frozen,
    amendmentSequence: doc.amendmentSequence,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Append-only / immutability guards for academic record collections.
 * @param {object} schema - Mongoose schema
 * @param {object} options
 * @param {'snapshot'|'amendment'|'transcript_issue'} options.mode
 */
function immutableAppendOnlyPlugin(schema, options = {}) {
  const mode = options.mode || 'snapshot';

  if (mode === 'snapshot') {
    schema.pre('save', function enforceSnapshotImmutability(next) {
      if (!this.isNew && this.frozen) {
        const modified = Object.keys(this.modifiedPaths?.() || this.getChanges?.() || {});
        const onlyAllowed = modified.every((k) => IMMUTABLE_ALLOWED_UPDATES.has(k));
        if (!onlyAllowed) {
          return next(new Error('Frozen grade snapshots cannot be modified in place'));
        }
      }
      if (this.isNew && this.frozen !== false) {
        this.recordChecksum = checksumDoc(this);
      }
      next();
    });
  }

  const blockMutation = function blockMutation(next) {
    return next(new Error(`Append-only record (${mode}) cannot be updated or deleted`));
  };

  if (mode === 'amendment' || mode === 'transcript_issue') {
    schema.pre('updateOne', blockMutation);
    schema.pre('updateMany', blockMutation);
    schema.pre('findOneAndUpdate', blockMutation);
    schema.pre('deleteOne', blockMutation);
    schema.pre('deleteMany', blockMutation);
    schema.pre('findOneAndDelete', blockMutation);
    schema.pre('remove', blockMutation);
  }
}

module.exports = { immutableAppendOnlyPlugin, checksumDoc };
