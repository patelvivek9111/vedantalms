/**
 * Dev port lifecycle: detect listeners, stop stale processes, verify bindability.
 * Used by devServer.js (single owner) and CLI (predev / stop:dev).
 */
const net = require('net');
const { execSync } = require('child_process');

const DEFAULT_PORT = Number(process.env.PORT || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getListeningPids(targetPort) {
  const pids = new Set();
  const port = String(targetPort);
  const portSuffix = `:${port}`;

  if (process.platform === 'win32') {
    try {
      const out = execSync('netstat -ano -p tcp', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const trimmed = line.trim();
        if (!trimmed.includes(portSuffix)) continue;
        const localAddress = trimmed.split(/\s+/)[1] || '';
        if (!localAddress.endsWith(portSuffix)) continue;
        const parts = trimmed.split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
    } catch {
      /* none */
    }
    return pids;
  }

  try {
    const out = execSync(`lsof -ti tcp:${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    for (const pid of out.split(/\s+/).filter(Boolean)) pids.add(pid);
  } catch {
    /* none */
  }
  return pids;
}

function killPid(pid) {
  if (!pid || String(pid) === String(process.pid)) return false;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop processes netstat reports as listening on the port.
 * @returns {number} count of PIDs signalled
 */
function killListenersOnPort(targetPort = DEFAULT_PORT, options = {}) {
  const { quiet = false } = options;
  const pids = getListeningPids(targetPort);
  let killed = 0;

  for (const pid of pids) {
    if (killPid(pid)) {
      killed += 1;
      if (!quiet) {
        console.log(`Freed port ${targetPort} (stopped PID ${pid})`);
      }
    }
  }

  return killed;
}

/** Authoritative check: try binding the port (same as server.listen would). */
function canBindPort(targetPort = DEFAULT_PORT, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(targetPort, host);
  });
}

async function isPortAvailable(targetPort = DEFAULT_PORT) {
  if (!(await canBindPort(targetPort, '0.0.0.0'))) {
    return false;
  }
  if (!(await canBindPort(targetPort, '127.0.0.1'))) {
    return false;
  }
  if (process.platform === 'win32') {
    try {
      if (!(await canBindPort(targetPort, '::'))) {
        return false;
      }
    } catch {
      /* IPv6 optional on some Windows hosts */
    }
  }
  return true;
}

function isPortInUse(targetPort = DEFAULT_PORT) {
  return getListeningPids(targetPort).size > 0;
}

/**
 * Kill stale listeners and block until the port can actually be bound.
 */
async function waitForPortFree(targetPort = DEFAULT_PORT, options = {}) {
  const maxWaitMs = options.maxWaitMs ?? 15000;
  const intervalMs = options.intervalMs ?? 200;
  const settleMs = options.settleMs ?? 450;
  const quiet = options.quiet ?? false;
  const start = Date.now();

  const tryReady = async () => {
    killListenersOnPort(targetPort, { quiet: true });
    if (!(await isPortAvailable(targetPort))) {
      return false;
    }
    if (settleMs > 0) {
      await sleep(settleMs);
      killListenersOnPort(targetPort, { quiet: true });
    }
    return isPortAvailable(targetPort);
  };

  while (Date.now() - start < maxWaitMs) {
    if (await tryReady()) {
      if (!quiet) {
        console.log(`Port ${targetPort} is ready`);
      }
      return true;
    }
    await sleep(intervalMs);
  }

  if (await tryReady()) {
    if (!quiet) {
      console.log(`Port ${targetPort} is ready`);
    }
    return true;
  }

  const err = new Error(`Port ${targetPort} still in use after ${maxWaitMs}ms`);
  err.code = 'EPORTINUSE';
  throw err;
}

/** CLI / predev: one-shot kill (no wait). Prefer waitForPortFree for reliability. */
function freePort(targetPort = DEFAULT_PORT) {
  const killed = killListenersOnPort(targetPort);
  if (!killed) {
    console.log(`Port ${targetPort} is already free`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const port = Number(args[0] || process.env.PORT || DEFAULT_PORT);
  const wait = process.argv.includes('--wait') || !process.argv.includes('--kill-only');

  if (wait) {
    waitForPortFree(port)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(`❌ ${err.message}. Run: npm run stop:dev`);
        process.exit(1);
      });
  } else {
    freePort(port);
  }
}

module.exports = {
  freePort,
  killPid,
  killListenersOnPort,
  waitForPortFree,
  isPortAvailable,
  isPortInUse,
  getListeningPids,
  canBindPort,
};
