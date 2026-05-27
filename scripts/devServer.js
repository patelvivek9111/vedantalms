/**
 * Dev entry for nodemon — prepares the port, then lets nodemon own restarts.
 * 1. Acquire cross-process dev lock (no overlapping nodemon restarts).
 * 2. Wait until the port can be bound (kill stale + bind probe + settle).
 * 3. Spawn server.js with LMS_DEV_MANAGED=1.
 * 4. On child exit: release the lock and exit; nodemon decides whether to restart.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const { waitForPortFree, killListenersOnPort, isPortAvailable } = require('./freePort');
const { acquireDevLock, releaseDevLock, defaultLockPath } = require('./devLock');

const port = Number(process.env.PORT || 5000);
const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const lockPath = defaultLockPath(root);

let child = null;
let exiting = false;
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startChild() {
  child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      LMS_DEV_MANAGED: '1',
    },
  });
  console.log(`Dev supervisor started server.js pid=${child.pid} port=${port}`);

  child.on('exit', (code, signal) => {
    child = null;

    if (exiting || shuttingDown) {
      return;
    }

    releaseDevLock(lockPath);
    if (signal) {
      console.error(`Dev server child exited from signal ${signal}; nodemon will handle restart.`);
      process.exit(1);
      return;
    }
    if (code && code !== 0) {
      console.error(`Dev server child exited with code ${code}; nodemon will handle restart.`);
    }
    process.exit(code ?? 0);
  });
}

async function stopChild() {
  if (!child?.pid) {
    return;
  }

  const pid = child.pid;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            /* gone */
          }
          resolve();
        }, 3000);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  } catch {
    /* process may already be gone */
  }

  await new Promise((resolve) => {
    if (!child) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 8000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  child = null;
  killListenersOnPort(port, { quiet: true });
  await sleep(400);
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  exiting = true;

  try {
    await stopChild();
    await waitForPortFree(port, { maxWaitMs: 20000, settleMs: 700, quiet: true });
  } catch (err) {
    console.error(`⚠️  Shutdown (${signal || 'exit'}): ${err.message}`);
    killListenersOnPort(port, { quiet: true });
  } finally {
    releaseDevLock(lockPath);
  }

  process.exit(0);
}

async function boot() {
  try {
    await acquireDevLock(lockPath, { maxWaitMs: 25000, staleKillMs: 12000 });
    killListenersOnPort(port, { quiet: true });
    await waitForPortFree(port, { maxWaitMs: 20000, settleMs: 600 });
    if (!(await isPortAvailable(port))) {
      throw new Error(`Port ${port} still in use after acquire`);
    }
    startChild();
  } catch (err) {
    releaseDevLock(lockPath);
    console.error(`❌ ${err.message}`);
    console.error('   Run: npm run stop:dev');
    console.error('   Then start a single terminal with: npm run dev');
    process.exit(1);
  }
}

boot().catch((err) => {
  releaseDevLock(lockPath);
  console.error(err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('exit', () => {
  releaseDevLock(lockPath);
});

process.on('unhandledRejection', (reason) => {
  console.error('Dev supervisor unhandled rejection:', reason);
  releaseDevLock(lockPath);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Dev supervisor uncaught exception:', err);
  releaseDevLock(lockPath);
  process.exit(1);
});
