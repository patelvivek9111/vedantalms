/**
 * Strip NoSQL operator / path-injection keys from request payloads.
 * Equivalent to express-mongo-sanitize: removes keys that start with `$`
 * or contain `.` (recursively) on body, query, and params.
 */

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = sanitizeValue(value[i]);
    }
    return value;
  }
  if (!isPlainObject(value)) {
    return value;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      continue;
    }
    value[key] = sanitizeValue(value[key]);
  }
  return value;
}

function sanitizeRequestObject(target) {
  if (!target || typeof target !== 'object') {
    return target;
  }
  return sanitizeValue(target);
}

function mongoSanitize(req, _res, next) {
  if (req.body) {
    req.body = sanitizeRequestObject(req.body);
  }
  if (req.query) {
    sanitizeRequestObject(req.query);
  }
  if (req.params) {
    sanitizeRequestObject(req.params);
  }
  next();
}

module.exports = {
  mongoSanitize,
  sanitizeValue,
};
