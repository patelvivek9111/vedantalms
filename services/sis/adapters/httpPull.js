const { applyFieldMappings } = require('./fieldMap');

/**
 * Shared HTTP pull helper for REST-style SIS partners.
 * Expects JSON: array of rows, or { users|sections|enrollments|data|rows: [...] }.
 */
async function fetchJson(url, { token, headers = {} } = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(`SIS pull failed (${res.status}): ${typeof body === 'string' ? body.slice(0, 200) : 'error'}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function extractRows(body, entityType) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body[entityType])) return body[entityType];
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.rows)) return body.rows;
  if (Array.isArray(body.results)) return body.results;
  return [];
}

/**
 * Pull users/sections/enrollments from base URL.
 * credentialsRef may be base URL; entity paths append /users|/sections|/enrollments
 * or use query ?entity=users.
 */
async function pullEntities({
  baseUrl,
  token,
  fieldMappings = {},
  entityTypes = ['users', 'sections', 'enrollments'],
  headers,
}) {
  const url = String(baseUrl || '').replace(/\/$/, '');
  if (!url) {
    return {
      ok: false,
      message: 'No credentialsRef / base URL configured for pull',
      users: [],
      sections: [],
      enrollments: [],
    };
  }

  const out = { ok: true, users: [], sections: [], enrollments: [] };
  const mapKey = { users: 'users', sections: 'sections', enrollments: 'enrollments' };

  for (const entity of entityTypes) {
    const singular = entity.replace(/s$/, '');
    let body;
    try {
      // Prefer /users style; fall back to ?entity=
      try {
        body = await fetchJson(`${url}/${entity}`, { token, headers });
      } catch (firstErr) {
        if (firstErr.status === 404) {
          body = await fetchJson(`${url}?entity=${entity}`, { token, headers });
        } else {
          throw firstErr;
        }
      }
    } catch (err) {
      out.ok = false;
      out.message = (out.message ? `${out.message}; ` : '') + `${entity}: ${err.message}`;
      continue;
    }

    const rows = extractRows(body, entity) || extractRows(body, singular);
    const mapped = applyFieldMappings(rows, fieldMappings[mapKey[entity]] || fieldMappings[singular] || {});
    out[entity] = mapped;
  }

  return out;
}

module.exports = { fetchJson, extractRows, pullEntities };
