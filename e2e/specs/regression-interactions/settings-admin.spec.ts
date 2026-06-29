import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, admin, loginViaForm } from '../../helpers/live-auth';

/**
 * §21 deferral close — Admin "Save Settings" (was: "mutates global config;
 * intentionally not automated").
 *
 * We mutate a single low-risk field (General → Site Name) through the real UI,
 * assert the success banner + API persistence, then restore the original value
 * so the shared environment is left untouched.
 */

let adminToken: string;
let originalSiteName: string;

async function getSiteName(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${apiURL}/api/admin/settings`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return (body.data || body).general?.siteName ?? '';
}

test.beforeAll(async ({ request }) => {
  adminToken = await getAuthToken(request, admin);
  originalSiteName = await getSiteName(request);
});

test.afterAll(async ({ request }) => {
  // Belt-and-suspenders restore in case the in-test restore didn't run.
  await request
    .put(`${apiURL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { general: { siteName: originalSiteName } },
    })
    .catch(() => {});
});

test.describe('§21 Admin — system settings save', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('edit Site Name → Save Changes persists, then restore', async ({ page, request }) => {
    const newName = `§21 LMS ${Date.now()}`;

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/settings');

    // General tab is the default. Site Name input is the sibling of its label.
    const siteName = page.locator('label:text-is("Site Name") ~ input').first();
    await expect(siteName).toBeVisible({ timeout: 20_000 });
    await expect(siteName).toHaveValue(originalSiteName);

    await siteName.fill(newName);
    const [saveRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/settings' &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /^save changes$/i }).click(),
    ]);
    expect(saveRes.ok()).toBeTruthy();
    await expect(page.getByText('Settings saved successfully!')).toBeVisible({ timeout: 10_000 });

    // Verify persistence through the API, then confirm it survives a reload in the UI.
    await expect.poll(() => getSiteName(request), { timeout: 15_000 }).toBe(newName);
    await page.reload();
    await expect(page.locator('label:text-is("Site Name") ~ input').first()).toHaveValue(newName, {
      timeout: 20_000,
    });

    // Restore the original value (API restore is deterministic; afterAll also guards).
    const restore = await request.put(`${apiURL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { general: { siteName: originalSiteName } },
    });
    expect(restore.ok(), await restore.text()).toBeTruthy();
    await expect.poll(() => getSiteName(request), { timeout: 15_000 }).toBe(originalSiteName);
  });
});
