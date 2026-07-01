import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const e2eEnvLocal = path.join(__dirname, '.env.local');
const frontendDir = path.join(__dirname, '..', 'frontend');
const frontendBaseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const frontendPort = new URL(frontendBaseURL).port || '3000';
const apiProxyTarget = process.env.E2E_API_URL || 'http://127.0.0.1:5000';

const viteE2eEnv = {
  VITE_USE_SAME_ORIGIN_API: 'true',
  VITE_PROXY_TARGET: apiProxyTarget,
  VITE_SOCKET_ORIGIN: apiProxyTarget,
};

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

/** L3 visual regression — desktop (chromium) + mobile (mobile-chrome) baselines. */
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './specs',
  testMatch: 'visual-snapshots.spec.ts',
  timeout: 90_000,
  workers: 1,
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.25,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: frontendBaseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      grep: /desktop$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'mobile-chrome',
      grep: /mobile$/,
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: `npx vite --host 127.0.0.1 --port ${frontendPort}`,
        cwd: frontendDir,
        url: frontendBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: viteE2eEnv,
      },
});
