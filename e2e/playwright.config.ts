import { defineConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const e2eEnvLocal = path.join(__dirname, '.env.local');
if (fs.existsSync(e2eEnvLocal)) {
  for (const line of fs.readFileSync(e2eEnvLocal, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        cwd: '../frontend',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
      },
});
