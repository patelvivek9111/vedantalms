#!/usr/bin/env node
/**
 * Fails CI if getWeightedGradeForStudent is imported or called outside allowed paths.
 * Canonical calculator: calculateFinalGradeWithWeightedGroups
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEEDLE = 'getWeightedGradeForStudent';

/** May define, re-export, or reference in verification lists only. */
const ALLOWED_MENTION = new Set([
  'shared/grading/gradeCalculation.cjs',
  'shared/grading/gradeCalculation.mjs',
  'shared/grading/index.cjs',
  'shared/grading/index.d.ts',
  'utils/gradeCalculation.js',
  'frontend/src/utils/gradeUtils.ts',
  'scripts/verifySharedGrading.js',
  'scripts/checkDeprecatedGradingCalculator.js',
  'tests/grading/canonicalCalculatorUsage.policy.test.js',
]);

/** Legacy implementations that may define the deprecated calculator. */
const LEGACY_DEFINITION = new Set([
  'shared/grading/gradeCalculation.cjs',
  'shared/grading/gradeCalculation.mjs',
]);

/** May call the deprecated function (legacy regression tests only). */
const ALLOWED_CALLERS = new Set([
  'shared/grading/gradeCalculation.cjs',
  'shared/grading/gradeCalculation.mjs',
  'tests/grading/legacyCalculator.policy.test.js',
  'tests/grading/edgeCases.policy.test.js',
]);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'frontend/dist']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(js|cjs|mjs|ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function hasCall(content) {
  return new RegExp(`\\b${NEEDLE}\\s*\\(`).test(content);
}

function hasImport(content) {
  return new RegExp(`\\b${NEEDLE}\\b`).test(content) && /import|require/.test(content);
}

const violations = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(NEEDLE)) continue;

  if (ALLOWED_MENTION.has(rel)) {
    const isTypeDeclaration = rel.endsWith('.d.ts');
    if (hasCall(content) && !LEGACY_DEFINITION.has(rel) && !isTypeDeclaration) {
      violations.push(`${rel} (re-export/mention only — must not call)`);
    }
    continue;
  }

  if (ALLOWED_CALLERS.has(rel)) {
    continue;
  }

  if (hasCall(content) || hasImport(content)) {
    violations.push(rel);
  }
}

if (violations.length > 0) {
  console.error(
    `Deprecated grading calculator "${NEEDLE}" referenced outside allowed paths:\n` +
      violations.map((v) => `  - ${v}`).join('\n') +
      '\n\nUse calculateFinalGradeWithWeightedGroups instead.'
  );
  process.exit(1);
}

console.log(`Deprecated calculator guard OK — "${NEEDLE}" only in allowed locations.`);
