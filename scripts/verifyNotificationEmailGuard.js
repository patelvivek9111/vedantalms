#!/usr/bin/env node
/**
 * P0 guard: sendNotificationEmail must not be wired to production call paths.
 * Prevents accidental 1:1 email fanout on notification creation.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFINITION_FILE = path.join(ROOT, 'utils', 'emailService.js');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'uploads',
  'docs',
  'e2e',
  'frontend/node_modules',
  'frontend/dist',
]);

const SKIP_FILE_PATTERNS = [
  /\.md$/,
  /\.json$/,
  /verifyNotificationEmailGuard\.js$/,
];

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name);
}

function shouldSkipFile(relPath) {
  if (!/\.(js|jsx|ts|tsx)$/.test(relPath)) return true;
  if (relPath.includes(`${path.sep}tests${path.sep}`)) return true;
  if (relPath.includes(`${path.sep}frontend${path.sep}tests${path.sep}`)) return true;
  return SKIP_FILE_PATTERNS.some((re) => re.test(relPath));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
      continue;
    }
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs);
    if (!shouldSkipFile(rel)) files.push(abs);
  }
  return files;
}

function findCallSites() {
  const callSites = [];
  const pattern = /\bsendNotificationEmail\s*\(/g;

  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file);
    const normalized = rel.split(path.sep).join('/');
    if (normalized === 'utils/emailService.js') continue;

    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      callSites.push({ file: rel, line });
    }
  }

  return callSites;
}

function main() {
  if (!fs.existsSync(DEFINITION_FILE)) {
    console.error('verify:notification-email-guard — emailService.js missing');
    process.exit(1);
  }

  const callSites = findCallSites();
  if (callSites.length > 0) {
    console.error('verify:notification-email-guard FAILED');
    console.error('sendNotificationEmail must not be called outside utils/emailService.js');
    for (const site of callSites) {
      console.error(`  ${site.file}:${site.line}`);
    }
    console.error('Use a digest queue before wiring notification email fanout.');
    process.exit(1);
  }

  console.log('verify:notification-email-guard OK — no production call sites');
}

main();
