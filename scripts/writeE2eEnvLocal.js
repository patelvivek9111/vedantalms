'use strict';

const fs = require('fs');
const path = require('path');

const E2E_ENV_PATH = path.join(__dirname, '..', 'e2e', '.env.local');

/**
 * Merge key/value pairs into e2e/.env.local without dropping unrelated keys
 * (e.g. upload seed IDs when visual seed runs after upload seed).
 */
function writeE2eEnvLocal(updates) {
  const existing = {};
  if (fs.existsSync(E2E_ENV_PATH)) {
    for (const line of fs.readFileSync(E2E_ENV_PATH, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      existing[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  const merged = { ...existing, ...updates };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(E2E_ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
  return E2E_ENV_PATH;
}

module.exports = { E2E_ENV_PATH, writeE2eEnvLocal };
