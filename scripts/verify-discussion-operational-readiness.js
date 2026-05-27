#!/usr/bin/env node
/**
 * Phase F operational readiness orchestrator: integrity, final migration, dashboard,
 * historical sampling, rollback playbook, and repair scripts in dry-run.
 */
require('dotenv').config();
const { spawnSync } = require('child_process');

function run(name, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  });
  return {
    name,
    command: [command, ...args].join(' '),
    status: result.status,
    passed: result.status === 0,
    warningOnly: options.warningOnly === true,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

async function main() {
  const checks = [];
  checks.push(run('final_migration_state', process.execPath, ['scripts/verify-discussion-final-migration-state.js', '--strict']));
  checks.push(run('discussion_integrity', process.execPath, ['scripts/verify-discussion-integrity.js']));
  checks.push(run('indexes', process.execPath, ['scripts/verify-discussion-indexes.js']));
  checks.push(
    run('group_integrity', process.execPath, ['scripts/verify-group-discussion-integrity.js'], { warningOnly: true })
  );
  checks.push(run('dashboard', process.execPath, ['scripts/ops/discussionIntegrityDashboard.js', '--strict']));
  checks.push(run('read_state_repair_dry_run', process.execPath, ['scripts/ops/repair-discussion-read-state.js']));
  checks.push(run('counters_repair_dry_run', process.execPath, ['scripts/ops/rebuild-discussion-counters.js']));
  checks.push(run('participation_repair_dry_run', process.execPath, ['scripts/ops/recalculate-discussion-participation.js']));
  checks.push(
    run('group_partitions_dry_run', process.execPath, ['scripts/ops/repair-group-discussion-partitions.js'], {
      warningOnly: true,
    })
  );
  checks.push(run('orphan_replies_dry_run', process.execPath, ['scripts/ops/repair-orphaned-discussion-replies.js']));
  checks.push(run('moderation_repair_dry_run', process.execPath, ['scripts/ops/repair-discussion-moderation-transitions.js']));
  checks.push(run('duplicate_participation_dry_run', process.execPath, ['scripts/ops/repair-duplicate-discussion-participation.js']));
  checks.push(run('historical_validation', process.execPath, ['scripts/verify-discussion-historical-validation.js']));
  checks.push(run('rollback_playbook', process.execPath, ['scripts/ops/audit-discussion-migration-rollback.js']));

  const blocking = [];
  const warnings = [];
  for (const c of checks) {
    if (c.warningOnly && !c.passed) {
      warnings.push({ name: c.name, command: c.command, status: c.status });
      continue;
    }
    if (!c.warningOnly && !c.passed) {
      blocking.push({ name: c.name, command: c.command, status: c.status, stderr: c.stderr, stdoutTail: c.stdout.slice(-2000) });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: blocking.length ? 'FAIL' : 'PASS',
    blocking,
    warnings,
    checks: checks.map((c) => ({
      name: c.name,
      passed: c.passed,
      warningOnly: Boolean(c.warningOnly),
      command: c.command,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
  if (blocking.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
