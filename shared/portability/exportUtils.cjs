const crypto = require('crypto');

/** Fields stripped from all exports (secrets / credentials). */
const GLOBAL_SENSITIVE_FIELDS = new Set([
  'password',
  'refreshToken',
  'accessToken',
  'token',
  'apiKey',
  'apiSecret',
  'smtpPassword',
  'downloadToken',
  'enrollmentQrToken',
  'enrollmentJoinCode',
  '__v',
]);

const SECTION_SENSITIVE_FIELDS = {
  users: new Set(['password']),
  asyncJobs: new Set(['downloadToken']),
  systemSettings: new Set(['smtpPassword']),
  zohoConnections: new Set(['accessToken', 'refreshToken']),
};

function hashContent(content) {
  const payload = typeof content === 'string' ? content : JSON.stringify(content);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function compareIds(a, b) {
  const sa = a == null ? '' : String(a);
  const sb = b == null ? '' : String(b);
  return sa.localeCompare(sb);
}

/** Deterministic ordering for reproducible exports. */
function sortById(docs) {
  if (!Array.isArray(docs)) return docs;
  return [...docs].sort((a, b) => {
    const idA = a._id ?? a.id ?? '';
    const idB = b._id ?? b.id ?? '';
    return compareIds(idA, idB);
  });
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof Date || Buffer.isBuffer(value)) return false;
  if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function stripSensitive(doc, sectionName, seen = new WeakSet()) {
  if (doc == null || typeof doc !== 'object') return doc;
  if (doc instanceof Date) return doc;
  if (doc._bsontype === 'ObjectID' || doc._bsontype === 'ObjectId') return String(doc);
  if (Array.isArray(doc)) return doc.map((d) => stripSensitive(d, sectionName, seen));
  if (seen.has(doc)) return null;
  if (!isPlainObject(doc)) return doc;
  seen.add(doc);

  const extra = SECTION_SENSITIVE_FIELDS[sectionName] || new Set();
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (GLOBAL_SENSITIVE_FIELDS.has(key) || extra.has(key)) continue;
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        out[key] = value.map((v) => stripSensitive(v, sectionName, seen));
      } else {
        out[key] = stripSensitive(value, sectionName, seen);
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

function leanExportDocs(docs, sectionName) {
  return sortById(docs).map((d) => stripSensitive(d, sectionName));
}

module.exports = {
  GLOBAL_SENSITIVE_FIELDS,
  SECTION_SENSITIVE_FIELDS,
  hashContent,
  sortById,
  stripSensitive,
  leanExportDocs,
  compareIds,
};
