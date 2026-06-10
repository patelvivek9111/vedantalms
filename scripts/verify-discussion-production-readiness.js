#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const runBenchmark = process.argv.includes('--run-benchmark');
const snapshotPath = path.join(process.cwd(), 'docs', 'operations', 'discussion-benchmark-snapshot.json');

function runCheck(name, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  });
  const passed = result.status === 0 || options.warningOnly === true;
  return {
    name,
    command: [command, ...args].join(' '),
    status: result.status,
    passed: result.status === 0,
    warningOnly: options.warningOnly === true,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
    remediation: options.remediation || null,
  };
}

function parseJsonFromOutput(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    return null;
  }
}

function validateBenchmarkSnapshot() {
  if (!fs.existsSync(snapshotPath)) {
    return {
      name: 'benchmark_snapshot',
      passed: true,
      warnings: ['No benchmark snapshot on disk; use --run-benchmark to execute live certification.'],
      remediation: 'Run: node scripts/verify-discussion-production-readiness.js --run-benchmark',
    };
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8').replace(/^\uFEFF/, ''));
  const scenarios = Array.isArray(snapshot.scenarios) ? snapshot.scenarios : [];
  const validations = scenarios.length
    ? Object.fromEntries(scenarios.map((scenario) => [scenario.scenario, scenario.validations]))
    : snapshot.validations || {};
  const passed = snapshot.pass === true && (
    scenarios.length
      ? scenarios.every((scenario) => scenario.pass === true && Object.values(scenario.validations || {}).every(Boolean))
      : Object.values(validations).every(Boolean)
  );
  return {
    name: 'benchmark_snapshot',
    passed,
    snapshot: {
      targets: snapshot.targets,
      scenarios: scenarios.map((scenario) => scenario.scenario),
      timings: snapshot.timings,
      memory: snapshot.memory,
      payloadBytes: snapshot.payloadBytes,
      validations,
    },
    remediation: passed ? null : 'Benchmark snapshot does not meet thresholds. Re-run benchmark and inspect failing validations.',
  };
}

function environmentChecks() {
  const warnings = [];
  if (!process.env.MONGODB_URI) warnings.push('MONGODB_URI is not set; default localhost Mongo will be used.');
  if (process.env.NODE_ENV !== 'production') warnings.push(`NODE_ENV is '${process.env.NODE_ENV || 'unset'}'; production readiness was run outside production mode.`);
  return {
    name: 'environment_configuration',
    passed: true,
    warnings,
  };
}

async function main() {
  const checks = [];
  checks.push(environmentChecks());
  checks.push(runCheck('integrity', 'node', ['scripts/verify-discussion-integrity.js']));
  checks.push(runCheck('final_migration_state', 'node', ['scripts/verify-discussion-final-migration-state.js', '--strict']));
  checks.push(runCheck('participation_read_state', 'node', ['scripts/ops/repair-discussion-read-state.js']));
  checks.push(runCheck('index_certification', 'node', ['scripts/verify-discussion-indexes.js']));
  checks.push(runCheck('group_integrity', 'node', ['scripts/verify-group-discussion-integrity.js'], {
    warningOnly: true,
    remediation: 'Run repair:group-discussion-partitions, then manually map any remaining multi-group legacy discussions.',
  }));
  if (runBenchmark) {
    checks.push(runCheck('institutional_benchmark', 'node', ['scripts/bench/discussionLargeCourseBench.js', '--apply']));
  } else {
    checks.push(validateBenchmarkSnapshot());
  }

  const blockingIssues = [];
  const warnings = [];
  for (const check of checks) {
    if (check.warningOnly && check.passed === false) {
      warnings.push({
        check: check.name,
        remediation: check.remediation,
        details: parseJsonFromOutput(check.stdout) || check.stderr || check.stdout,
      });
      continue;
    }
    if (check.passed === false) {
      blockingIssues.push({
        check: check.name,
        remediation: check.remediation,
        details: parseJsonFromOutput(check.stdout) || check.stderr || check.stdout,
      });
    }
    if (check.warnings?.length) {
      warnings.push(...check.warnings.map((warning) => ({ check: check.name, warning })));
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: blockingIssues.length === 0 ? 'PASS' : 'FAIL',
    blockingIssues,
    warnings,
    checks: checks.map((check) => ({
      name: check.name,
      passed: check.passed,
      warningOnly: check.warningOnly || false,
      command: check.command || null,
      status: check.status ?? null,
      remediation: check.remediation || null,
    })),
  };
  console.log(JSON.stringify(report, null, 2));
  if (blockingIssues.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
