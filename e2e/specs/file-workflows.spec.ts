import { test, expect } from '@playwright/test';
import { roles, seedBrowserSession } from '../fixtures/filePlatform';

/**
 * U28F — institutional file workflow e2e (requires seeded users + running API).
 * Set E2E_BASE_URL, E2E_TEACHER_EMAIL, E2E_TEACHER_PASSWORD for full runs.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('File platform smoke', () => {
  test('health and upload API contract', async ({ request }) => {
    const health = await request.get(`${apiURL}/health`);
    expect(health.ok()).toBeTruthy();
    expect((await health.json()).status).toBe('ok');
  });

  test('chunked upload init requires auth', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/upload/chunk/init`, {
      data: { fileName: 'test.bin', fileSize: 1000, totalChunks: 1 },
    });
    expect(res.status()).toBe(401);
  });

  test('file ops metrics requires admin', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/ops/files`);
    expect([401, 403]).toContain(res.status());
  });

  test('recovery files list requires admin', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/ops/recovery/files`);
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Instructor file UX', () => {
  test.beforeEach(async ({ page, request }) => {
    const ok = await seedBrowserSession(page, request, roles.teacher.email, roles.teacher.password);
    test.skip(!ok, 'Run npm run seed:e2e:upload and ensure API is up on E2E_API_URL');
  });

  test('page edit shows attachment panel', async ({ page }) => {
    const editUrl = process.env.E2E_PAGE_EDIT_URL;
    test.skip(!editUrl, 'Run npm run seed:e2e:upload to set E2E_PAGE_EDIT_URL');
    await page.goto(editUrl!, { waitUntil: 'networkidle' });
    await expect(page.getByLabel(/Manage page attachments/i)).toBeVisible({ timeout: 20000 });
  });
});
