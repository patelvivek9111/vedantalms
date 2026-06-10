const mongoose = require('mongoose');

const ALLOWED_FIELDS = new Set([
  'type',
  'title',
  'message',
  'link',
  'read',
  'readAt',
  'relatedId',
  'relatedType',
  'metadata',
  'priority',
  'expiresAt',
]);

const METADATA_ALIASES = [
  'course',
  'assignment',
  'courseId',
  'assignmentId',
  'eventKey',
  'tone',
  'source',
];

function toMetadataMap(input) {
  if (!input) return new Map();
  if (input instanceof Map) return new Map(input);
  if (typeof input === 'object') {
    return new Map(Object.entries(input));
  }
  return new Map();
}

function normalizeObjectId(value) {
  if (value == null) return null;
  const id = value._id || value;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Splits producer payload into schema-safe notification fields + metadata extras.
 * Unsupported top-level keys (e.g. course, assignment) are preserved in metadata.
 */
function normalizeNotificationPayload(notificationData = {}) {
  const doc = {};
  const metadata = toMetadataMap(notificationData.metadata);

  for (const [key, value] of Object.entries(notificationData)) {
    if (key === 'metadata') continue;
    if (ALLOWED_FIELDS.has(key)) {
      doc[key] = value;
      continue;
    }
    if (METADATA_ALIASES.includes(key) || !ALLOWED_FIELDS.has(key)) {
      metadata.set(key, value?._id != null ? String(value._id || value) : value);
    }
  }

  if (notificationData.course != null && !metadata.has('courseId')) {
    metadata.set('courseId', String(notificationData.course._id || notificationData.course));
  }
  if (notificationData.assignment != null && !metadata.has('assignmentId')) {
    metadata.set(
      'assignmentId',
      String(notificationData.assignment._id || notificationData.assignment)
    );
  }

  if (doc.relatedId != null) {
    doc.relatedId = normalizeObjectId(doc.relatedId);
  }

  if (metadata.size > 0) {
    doc.metadata = metadata;
  }

  return doc;
}

module.exports = {
  normalizeNotificationPayload,
  ALLOWED_FIELDS,
};
