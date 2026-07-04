#!/usr/bin/env node
/**
 * OWASP ZAP baseline scan (Docker). Passive spider + passive rules; no destructive tests.
 *
 * Usage:
 *   npm run scan:zap
 *   ZAP_TARGET=https://vedantaed.com npm run scan:zap
 *
 * Requires Docker. Reports: zap-report.html, zap-report.json (gitignored).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const target = (process.env.ZAP_TARGET || 'https://vedantaed.com').replace(/\/$/, '');
const rulesFile = path.join(process.cwd(), '.zap', 'rules.tsv');
const image = process.env.ZAP_DOCKER_IMAGE || 'ghcr.io/zaproxy/zaproxy:stable';

const args = [
  'run',
  '--rm',
  '-v',
  `${process.cwd()}:/zap/wrk:rw`,
  image,
  'zap-baseline.py',
  '-t',
  target,
  '-I',
  '-r',
  'zap-report.html',
  '-J',
  'zap-report.json',
];

if (fs.existsSync(rulesFile)) {
  args.push('-c', '.zap/rules.tsv');
}

const extra = process.env.ZAP_CMD_OPTIONS;
if (extra) {
  args.push(...extra.split(/\s+/).filter(Boolean));
}

console.log(`ZAP baseline → ${target}`);
const result = spawnSync('docker', args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
