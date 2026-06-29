import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { apiURL, student } from '../helpers/live-auth';

let seededNotificationId = '';

async function getAuthToken(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  return body.token as string;
}

async function loginViaForm(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'load', timeout: 60_000 });
  await page.locator('#email-address').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe.serial('§5.6 Real-time & notifications — live API + UI', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('API: notification preferences load and update', async ({ request }) => {
    const token = await getAuthToken(request, student);
    const headers = { Authorization: `Bearer ${token}` };

    const getRes = await request.get(`${apiURL}/api/notifications/preferences`, { headers });
    expect(getRes.ok()).toBeTruthy();
    const prefs = await getRes.json();
    expect(prefs.success).toBe(true);
    expect(prefs.data.inApp).toBeDefined();

    const putRes = await request.put(`${apiURL}/api/notifications/preferences`, {
      headers,
      data: {
        ...prefs.data,
        inApp: { ...prefs.data.inApp, messages: false },
      },
    });
    expect(putRes.ok()).toBeTruthy();

    const verify = await request.get(`${apiURL}/api/notifications/preferences`, { headers });
    const verified = await verify.json();
    expect(verified.data.inApp.messages).toBe(false);

    await request.put(`${apiURL}/api/notifications/preferences`, {
      headers,
      data: {
        ...verified.data,
        inApp: { ...verified.data.inApp, messages: true },
      },
    });
  });

  test('API: assignment_due notifications listable by type', async ({ request }) => {
    const token = await getAuthToken(request, student);
    const res = await request.get(`${apiURL}/api/notifications?type=assignment_due&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data.every((n: { type: string }) => n.type === 'assignment_due')).toBe(true);
    }
  });

  test('UI: notification panel renders plain text (no raw HTML)', async ({ page, request }) => {
    const token = await getAuthToken(request, student);
    const headers = { Authorization: `Bearer ${token}` };
    const htmlMessage = '<strong>Due soon</strong> &amp; review chapter 3';
    const title = `L4 §5.6 ${Date.now()}`;

    const create = await request.post(`${apiURL}/api/notifications/test-create`, {
      headers,
      data: { title, message: htmlMessage },
    });
    expect(create.ok()).toBeTruthy();
    const created = await create.json();
    seededNotificationId = created.notification?._id || '';

    await loginViaForm(page, student.email, student.password);
    await page.getByRole('button', { name: /Notifications/i }).click();
    await expect(page.getByRole('heading', { name: 'Notifications', level: 2 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('Due soon & review chapter 3').first()).toBeVisible();
    await expect(page.locator('text=<strong>')).toHaveCount(0);
    await expect(page.locator('text=&amp;')).toHaveCount(0);
  });

  test.afterAll(async ({ request }) => {
    if (!seededNotificationId) return;
    const token = await getAuthToken(request, student);
    await request.delete(`${apiURL}/api/notifications/${seededNotificationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});
