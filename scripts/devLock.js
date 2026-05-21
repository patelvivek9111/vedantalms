/**
 * Cross-process lock so only one devServer.js owns port lifecycle at a time.
 * Prevents overlapping nodemon restarts from racing on port 5000.
 */
const fs = require('fs');
const path = require('path');
const { killPid } = require('./freePort');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  const n = Number(pid);
  if (!n || n === process.pid) {
    return false;
  }
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function defaultLockPath(rootDir) {
  return path.join(rootDir, 'tmp', '.dev-port-5000.lock');
}

/**
 * @param {string} lockPath
 * @param {{ maxWaitMs?: number, staleKillMs?: number }} [options]
 */
async function acquireDevLock(lockPath, options = {}) {
  const maxWaitMs = options.maxWaitMs ?? 25000;
  const staleKillMs = options.staleKillMs ?? 10000;
  const dir = path.dirname(lockPath);
  fs.mkdirSync(dir, { recursive: true });

  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }

    let ownerPid = NaN;
    try {
      ownerPid = Number(fs.readFileSync(lockPath, 'utf8').trim());
    } catch {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* race */
      }
      await sleep(80);
      continue;
    }

    if (!ownerPid || ownerPid === process.pid) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* race */
      }
      await sleep(80);
      continue;
    }

    if (!isProcessAlive(ownerPid)) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* race */
      }
      await sleep(80);
      continue;
    }

    if (Date.now() - start >= staleKillMs) {
      killPid(ownerPid);
      await sleep(250);
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* race */
      }
      continue;
    }

    await sleep(150);
  }

  throw new Error(`Timed out waiting for dev lock (${lockPath})`);
}

function releaseDevLock(lockPath) {
  try {
    const owner = Number(fs.readFileSync(lockPath, 'utf8').trim());
    if (owner === process.pid) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    /* already released */
  }
}

module.exports = {
  acquireDevLock,
  releaseDevLock,
  defaultLockPath,
  isProcessAlive,
};
