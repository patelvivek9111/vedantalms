import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const e2eEnvLocal = path.join(__dirname, '.env.local');
const frontendDir = path.join(__dirname, '..', 'frontend');
const frontendBaseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const frontendPort = new URL(frontendBaseURL).port || '5173';
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
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ...(process.env.E2E_INCLUDE_EDGE
      ? [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }]
      : []),
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: `npx vite --host 127.0.0.1 --port ${frontendPort}`,
        cwd: frontendDir,
        url: frontendBaseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
