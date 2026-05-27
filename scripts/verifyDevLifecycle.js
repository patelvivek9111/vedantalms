#!/usr/bin/env node
/**
 * Read-only development lifecycle diagnostic.
 *
 * Reports backend nodemon/devServer/server.js processes, port ownership, and
 * dev lock ownership so restart storms can be diagnosed without killing tasks.
 */
const { execFileSync, execSync } = require('child_process');
const path = require('path');
const { getListeningPids } = require('./freePort');
const { defaultLockPath, readDevLock } = require('./devLock');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || process.env.PORT || 5000);

function normalize(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function listProcesses() {
  if (process.platform === 'win32') {
    try {
      const json = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      if (!json) return [];
      const parsed = JSON.parse(json);
      return (Array.isArray(parsed) ? parsed : [parsed]).map((proc) => ({
        pid: Number(proc.ProcessId),
        ppid: Number(proc.ParentProcessId),
        name: proc.Name,
        commandLine: proc.CommandLine || '',
      }));
    } catch {
      return [];
    }
  }

  try {
    const out = execSync('ps -eo pid=,ppid=,comm=,args=', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
        if (!match) return null;
        return {
          pid: Number(match[1]),
          ppid: Number(match[2]),
          name: match[3],
          commandLine: match[4],
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function classify(proc, lock) {
  const cmd = normalize(proc.commandLine);
  const rootMarker = normalize(root);
  if (lock?.exists && proc.pid === lock.ownerPid) return 'devServer';
  if (cmd.includes('/scripts/devserver.js')) return 'devServer';
  if (!cmd.includes(rootMarker) || cmd.includes(`${rootMarker}/frontend/`)) return null;
  if (cmd.includes('/server.js')) return 'server';
  if (cmd.includes('/nodemon/bin/nodemon.js') || cmd.includes('/node_modules/.bin/../nodemon')) {
    return 'nodemon';
  }
  return null;
}

const processes = listProcesses();
const lock = readDevLock(defaultLockPath(root));
const backend = processes
  .map((proc) => ({ ...proc, role: classify(proc, lock) }))
  .filter((proc) => proc.role);
const listeningPids = Array.from(getListeningPids(port)).map(Number);

const roleCounts = backend.reduce((acc, proc) => {
  acc[proc.role] = (acc[proc.role] || 0) + 1;
  return acc;
}, {});

const report = {
  ok: true,
  port,
  roleCounts,
  listeningPids,
  lock,
  backendProcesses: backend.map((proc) => ({
    pid: proc.pid,
    ppid: proc.ppid,
    role: proc.role,
    commandLine: proc.commandLine,
  })),
  checks: [],
};

function fail(name, details) {
  report.ok = false;
  report.checks.push({ name, ok: false, details });
}

function pass(name, details) {
  report.checks.push({ name, ok: true, details });
}

if ((roleCounts.devServer || 0) > 1) {
  fail('single-devServer', `expected <=1 devServer process, found ${roleCounts.devServer}`);
} else {
  pass('single-devServer', `found ${roleCounts.devServer || 0}`);
}

if ((roleCounts.nodemon || 0) > 1) {
  fail('single-nodemon', `expected <=1 nodemon process, found ${roleCounts.nodemon}`);
} else {
  pass('single-nodemon', `found ${roleCounts.nodemon || 0}`);
}

if (listeningPids.length > 1) {
  fail('single-port-listener', `expected <=1 listener on ${port}, found ${listeningPids.join(', ')}`);
} else {
  pass('single-port-listener', listeningPids.length ? `listener ${listeningPids[0]}` : 'no listener');
}

if (lock.exists && !lock.ownerAlive) {
  fail('dev-lock-owner-alive', `stale lock owner ${lock.ownerPid}`);
} else {
  pass('dev-lock-owner-alive', lock.exists ? `owner ${lock.ownerPid}` : 'no lock');
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  process.exitCode = 1;
}
