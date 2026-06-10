#!/usr/bin/env node
/**
 * Bring up docker-compose.load.yml and optionally run capacity bench.
 *
 * Usage:
 *   node scripts/load/runCapacityLoadStack.js up
 *   node scripts/load/runCapacityLoadStack.js bench
 *   node scripts/load/runCapacityLoadStack.js full
 *   node scripts/load/runCapacityLoadStack.js down
 */
require('dotenv').config();
const { spawnSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const COMPOSE_FILE = 'docker-compose.load.yml';
const BASE_URL = process.env.LOAD_BASE_URL || 'http://127.0.0.1:5001';
const API_REPLICAS = parseInt(process.env.LOAD_API_REPLICAS || '8', 10);

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with code ${result.status}`);
  }
  return result;
}

function dockerComposeArgs(extra) {
  return ['compose', '-f', COMPOSE_FILE, ...extra];
}

async function waitForHealth(url, attempts = 60, delayMs = 5000) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(4000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) {
      console.error(`[load-stack] healthy: ${url}`);
      return;
    }
    console.error(`[load-stack] waiting for ${url} (${i + 1}/${attempts})...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function up() {
  console.error('[load-stack] stopping local dev server on port 5000...');
  run('node', ['scripts/stopDev.js', '5000']);

  // Avoid 6379 bind conflict with standalone dev Redis container
  spawnSync('docker', ['rm', '-f', 'lms-redis-dev'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });

  console.error(`[load-stack] starting redis + nginx + ${API_REPLICAS} api replicas...`);
  run('docker', dockerComposeArgs(['up', '--build', '-d', '--scale', `api=${API_REPLICAS}`]));

  await waitForHealth(`${BASE_URL}/health/live`);
  const ops = await new Promise((resolve, reject) => {
    http
      .get(`${BASE_URL}/health/ops`, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
  console.error(
    `[load-stack] ops: redis=${ops?.dependencies?.redisAdapterEnabled} mongo=${ops?.dependencies?.mongoConnected}`
  );
}

function down() {
  run('docker', dockerComposeArgs(['down']));
}

function bench() {
  process.env.LOAD_BASE_URL = process.env.LOAD_BASE_URL || BASE_URL;
  if (!process.env.LOAD_CONCURRENCY_LEVELS) {
    process.env.LOAD_CONCURRENCY_LEVELS = '100,250,500';
  }
  if (!process.env.LOAD_PHASE_DURATION_MS) {
    process.env.LOAD_PHASE_DURATION_MS = '20000';
  }
  if (!process.env.LOAD_COOLDOWN_MS) {
    process.env.LOAD_COOLDOWN_MS = '10000';
  }
  run('node', ['scripts/load/seedCapacityFixtures.js']);
  run('node', ['scripts/load/capacityLoadBench.js']);
}

async function main() {
  const cmd = process.argv[2] || 'full';
  if (cmd === 'up') {
    await up();
    return;
  }
  if (cmd === 'down') {
    down();
    return;
  }
  if (cmd === 'bench') {
    bench();
    return;
  }
  if (cmd === 'full') {
    await up();
    try {
      bench();
    } finally {
      console.error('[load-stack] leaving stack running (npm run load:stack:down to tear down)');
    }
    return;
  }
  throw new Error(`Unknown command: ${cmd}. Use up|down|bench|full`);
}

main().catch((err) => {
  console.error('[load-stack]', err.message);
  process.exit(1);
});
