const { stableStringifyPolicy } = require('./policySnapshot.cjs');

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function valuesEqual(a, b) {
  return stableStringifyPolicy(a) === stableStringifyPolicy(b);
}

/**
 * Walk nested policy objects and collect field-level changes.
 * @param {object} oldPolicy
 * @param {object} newPolicy
 * @returns {{ changed: Array<{ path: string, before: unknown, after: unknown }>, added: string[], removed: string[] }}
 */
function diffPolicies(oldPolicy, newPolicy) {
  const changed = [];
  const added = [];
  const removed = [];

  function walk(path, before, after) {
    const beforeIsObj = before !== null && typeof before === 'object' && !Array.isArray(before);
    const afterIsObj = after !== null && typeof after === 'object' && !Array.isArray(after);

    if (Array.isArray(before) || Array.isArray(after)) {
      if (!valuesEqual(before, after)) {
        changed.push({ path: path || '(root)', before, after });
      }
      return;
    }

    if (!beforeIsObj || !afterIsObj) {
      if (!valuesEqual(before, after)) {
        changed.push({ path: path || '(root)', before, after });
      }
      return;
    }

    const beforeKeys = new Set(Object.keys(before || {}));
    const afterKeys = new Set(Object.keys(after || {}));

    for (const key of afterKeys) {
      if (!beforeKeys.has(key)) {
        added.push(path ? `${path}.${key}` : key);
      }
    }
    for (const key of beforeKeys) {
      if (!afterKeys.has(key)) {
        removed.push(path ? `${path}.${key}` : key);
      }
    }

    for (const key of [...beforeKeys].filter((k) => afterKeys.has(k)).sort()) {
      walk(path ? `${path}.${key}` : key, before[key], after[key]);
    }
  }

  walk('', oldPolicy || {}, newPolicy || {});
  return { changed, added, removed };
}

/**
 * Human-readable summary lines for audit logs.
 * @param {{ changed: object[], added: string[], removed: string[] }} diff
 * @returns {string[]}
 */
function summarizePolicyDiff(diff) {
  const lines = [];
  for (const c of diff.changed || []) {
    lines.push(`${c.path}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`);
  }
  for (const a of diff.added || []) {
    lines.push(`+ ${a}`);
  }
  for (const r of diff.remed || []) {
    lines.push(`- ${r}`);
  }
  return lines;
}

module.exports = {
  diffPolicies,
  summarizePolicyDiff,
};
