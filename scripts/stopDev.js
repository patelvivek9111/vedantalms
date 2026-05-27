#!/usr/bin/env node
/**
 * Stop backend development supervisors for this workspace.
 *
 * `freePort.js` only kills active port listeners. This script also removes
 * lingering nodemon/devServer parents so old watchers cannot respawn server.js.
 */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { waitForPortFree, killPid } = require('./freePort');
const { defaultLockPath, forceReleaseDevLock, readDevLock } = require('./devLock');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || process.env.PORT || 5000);
const selfPid = process.pid;

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

function isBackendDevProcess(proc) {
  if (!proc || proc.pid === selfPid) return false;
  const cmd = normalize(proc.commandLine);
  const rootMarker = normalize(root);
  if (!cmd.includes(rootMarker)) return false;
  if (cmd.includes(`${rootMarker}/frontend/`)) return false;
  return (
    cmd.includes('/scripts/devserver.js') ||
    cmd.includes('/server.js') ||
    cmd.includes('/nodemon/bin/nodemon.js') ||
    cmd.includes('/node_modules/.bin/../nodemon')
  );
}

function shouldIncludeAncestor(proc) {
  if (!proc || proc.pid === selfPid) return false;
  const cmd = normalize(proc.commandLine);
  return cmd.includes('/npm-cli.js') && cmd.includes(' run dev') && !cmd.includes('/frontend/');
}

function collectTargetPids(processes, lock = null) {
  const byPid = new Map(processes.map((proc) => [proc.pid, proc]));
  const childrenByParent = new Map();
  for (const proc of processes) {
    if (!childrenByParent.has(proc.ppid)) childrenByParent.set(proc.ppid, []);
    childrenByParent.get(proc.ppid).push(proc);
  }

  const targets = new Set();
  for (const proc of processes) {
    if (!isBackendDevProcess(proc)) continue;
    targets.add(proc.pid);

    let parent = byPid.get(proc.ppid);
    while (parent && shouldIncludeAncestor(parent)) {
      targets.add(parent.pid);
      parent = byPid.get(parent.ppid);
    }
  }

  if (lock?.exists && lock.ownerAlive && lock.ownerPid && lock.ownerPid !== selfPid) {
    targets.add(lock.ownerPid);
  }

  const addDescendants = (pid) => {
    for (const child of childrenByParent.get(pid) || []) {
      if (child.pid === selfPid || targets.has(child.pid)) continue;
      targets.add(child.pid);
      addDescendants(child.pid);
    }
  };

  for (const pid of Array.from(targets)) {
    addDescendants(pid);
  }

  return Array.from(targets)
    .filter((pid) => pid && pid !== selfPid)
    .sort((a, b) => b - a);
}

async function main() {
  const lockPath = defaultLockPath(root);
  const beforeLock = readDevLock(lockPath);
  if (beforeLock.exists) {
    console.log(
      `Dev lock before cleanup: ownerPid=${beforeLock.ownerPid || 'unknown'} ownerAlive=${beforeLock.ownerAlive}`
    );
  }

  const targets = collectTargetPids(listProcesses(), beforeLock);
  for (const pid of targets) {
    if (killPid(pid)) {
      console.log(`Stopped backend dev supervisor PID ${pid}`);
    }
  }

  await waitForPortFree(port, { maxWaitMs: 20000, settleMs: 700 });

  const afterLock = readDevLock(lockPath);
  if (!afterLock.exists || !afterLock.ownerAlive) {
    forceReleaseDevLock(lockPath);
  }
  if (fs.existsSync(lockPath)) {
    const lock = readDevLock(lockPath);
    console.warn(`Dev lock remains: ownerPid=${lock.ownerPid || 'unknown'} ownerAlive=${lock.ownerAlive}`);
  } else {
    console.log('Dev lock cleared');
  }
}

main().catch((err) => {
  console.error(`stop:dev failed: ${err.message}`);
  process.exit(1);
});
