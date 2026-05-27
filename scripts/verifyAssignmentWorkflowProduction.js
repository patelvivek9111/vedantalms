#!/usr/bin/env node
/**
 * Final institutional assignment workflow production verification orchestrator.
 */
const { spawnSync } = require('child_process');

const checks = [
  {
    name: 'assignment workflow regression tests',
    command: 'npx',
    args: [
      'jest',
      'tests/assignment-workflow',
      'tests/grading/student-grade-visibility.integration.test.js',
      '--runInBand',
    ],
  },
  {
    name: 'assignment group migration verifier',
    command: 'npm',
    args: ['run', 'verify:assignment-group-migration'],
    optional: process.env.SKIP_DB_CHECKS === '1',
  },
];

let failed = false;
for (const check of checks) {
  if (check.optional) {
    console.log(JSON.stringify({ check: check.name, skipped: true, reason: 'SKIP_DB_CHECKS=1' }));
    continue;
  }
  const startedAt = Date.now();
  const result = spawnSync(check.command, check.args, { stdio: 'inherit', shell: process.platform === 'win32' });
  const durationMs = Date.now() - startedAt;
  console.log(JSON.stringify({ check: check.name, exitCode: result.status, durationMs }));
  if (result.status !== 0) failed = true;
}

if (failed) process.exitCode = 1;
