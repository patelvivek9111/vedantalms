#!/usr/bin/env node
/**
 * Remove stale gradebook and institution export artifacts from uploads/.
 *
 * Usage:
 *   node scripts/cleanupExportArtifacts.js [--days=7] [--dry-run]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { paths } = require('../config/paths');

function parseArgs() {
  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const days = daysArg ? Math.max(0, parseInt(daysArg.split('=')[1], 10)) : 7;
  const dryRun = process.argv.includes('--dry-run');
  return { days, dryRun, cutoffMs: Date.now() - days * 24 * 60 * 60 * 1000 };
}

function collectStaleEntries(dirPath, cutoffMs, matcher) {
  if (!fs.existsSync(dirPath)) return [];

  const stale = [];
  for (const name of fs.readdirSync(dirPath)) {
    if (!matcher(name)) continue;
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);
    const mtime = stat.mtimeMs;
    if (mtime >= cutoffMs) continue;
    stale.push({
      path: fullPath,
      name,
      mtimeMs: mtime,
      bytes: stat.isDirectory() ? null : stat.size,
    });
  }
  return stale;
}

function removeEntry(entry, dryRun) {
  if (dryRun) return;
  fs.rmSync(entry.path, { recursive: true, force: true });
}

function dirSize(dirPath) {
  let total = 0;
  for (const name of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      total += dirSize(fullPath);
    } else {
      total += stat.size;
    }
  }
  return total;
}

function main() {
  const { days, dryRun, cutoffMs } = parseArgs();
  const targets = [
    {
      label: 'job-exports',
      dir: paths.jobExports,
      matcher: (name) => /^gradebook-.+\.xlsx$/i.test(name),
    },
    {
      label: 'institution-exports',
      dir: paths.institutionExports,
      matcher: (name) => /^export-\d+$/.test(name),
    },
  ];

  const report = {
    dryRun,
    olderThanDays: days,
    cutoff: new Date(cutoffMs).toISOString(),
    removed: [],
  };

  for (const target of targets) {
    const stale = collectStaleEntries(target.dir, cutoffMs, target.matcher);
    for (const entry of stale) {
      const bytes =
        entry.bytes == null && fs.statSync(entry.path).isDirectory()
          ? dirSize(entry.path)
          : entry.bytes || 0;
      report.removed.push({
        kind: target.label,
        name: entry.name,
        path: entry.path,
        mtime: new Date(entry.mtimeMs).toISOString(),
        bytes,
      });
      removeEntry(entry, dryRun);
    }
  }

  const totalBytes = report.removed.reduce((sum, item) => sum + (item.bytes || 0), 0);
  report.summary = {
    count: report.removed.length,
    totalBytes,
    totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  };

  console.log(JSON.stringify(report, null, 2));
  if (dryRun) {
    console.log(`Dry run: ${report.summary.count} item(s) would be removed.`);
  } else {
    console.log(`Removed ${report.summary.count} stale export artifact(s).`);
  }
}

main();
