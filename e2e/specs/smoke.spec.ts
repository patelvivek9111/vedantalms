import { test, expect } from '@playwright/test';

const frontendURL = process.env.E2E_BASE_URL || 'http://localhost:3001';

async function isFrontendReachable(request: import('@playwright/test').APIRequestContext) {
  try {
    const res = await request.get(frontendURL, { timeout: 5000 });
    return res.status() < 500;
  } catch {
    return false;
  }
}

test.describe('Institutional smoke', () => {
  test('login page loads', async ({ page, request }) => {
    test.skip(
      !(await isFrontendReachable(request)),
      `Frontend not running at ${frontendURL} (start: cd frontend && npm run dev)`
    );
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('health API when backend URL set', async ({ request }) => {
    const api = process.env.E2E_API_URL || 'http://localhost:5000';
    const res = await request.get(`${api}/health`);
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });
});
