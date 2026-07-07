/**
 * Mongoose 8 Map fields serialize to {} via toObject() unless flattenMaps is true.
 * Use these helpers anywhere API responses or server-side logic read Map-backed fields.
 */

function mapFieldToObject(value) {
  if (value == null) return value;
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  return value;
}

/**
 * Read a value from a Mongoose Map, plain object, or lean document field.
 * Accepts numeric or string keys (e.g. 0 and "0").
 */
function readMapField(field, key) {
  if (field == null) return undefined;
  const strKey = String(key);

  if (field instanceof Map) {
    if (field.has(strKey)) return field.get(strKey);
    if (field.has(key)) return field.get(key);
    return undefined;
  }

  if (typeof field === 'object' && !Array.isArray(field)) {
    if (Object.prototype.hasOwnProperty.call(field, strKey)) return field[strKey];
    if (Object.prototype.hasOwnProperty.call(field, key)) return field[key];
  }

  return undefined;
}

function hasMapFieldValue(field, key) {
  const value = readMapField(field, key);
  return value !== undefined && value !== null && value !== '';
}

/**
 * Convert a mongoose document (or plain object) into a JSON-safe plain object.
 */
function serializeMongooseDoc(doc, { flattenMaps = true, extraMapFields = [] } = {}) {
  if (!doc) return doc;

  let plain;
  if (typeof doc.toObject === 'function') {
    plain = doc.toObject({ flattenMaps });
  } else {
    plain = { ...doc };
  }

  const mapFields = ['metadata', 'answers', 'questionGrades', 'autoQuestionGrades', ...extraMapFields];
  for (const field of mapFields) {
    if (plain[field] instanceof Map) {
      plain[field] = mapFieldToObject(plain[field]);
    }
  }

  return plain;
}

module.exports = {
  mapFieldToObject,
  readMapField,
  hasMapFieldValue,
  serializeMongooseDoc,
};
