import { stableStringifyPolicy } from './policySnapshot.browser.mjs';

function valuesEqual(a, b) {
  return stableStringifyPolicy(a) === stableStringifyPolicy(b);
}

export function diffPolicies(oldPolicy, newPolicy) {
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

    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      if (!(key in before)) {
        added.push({ path: nextPath, after: after[key] });
      } else if (!(key in after)) {
        removed.push({ path: nextPath, before: before[key] });
      } else {
        walk(nextPath, before[key], after[key]);
      }
    }
  }

  walk('', oldPolicy || {}, newPolicy || {});
  return { changed, added, removed };
}

export function summarizePolicyDiff(diff) {
  const parts = [];
  if (diff.changed?.length) parts.push(`${diff.changed.length} changed`);
  if (diff.added?.length) parts.push(`${diff.added.length} added`);
  if (diff.removed?.length) parts.push(`${diff.removed.length} removed`);
  return parts.join(', ') || 'No changes';
}
