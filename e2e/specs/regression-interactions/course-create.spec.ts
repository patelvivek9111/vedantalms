import { test, expect } from '@playwright/test';
import { apiURL, getAuthToken, admin, loginViaForm } from '../../helpers/live-auth';

/**
 * §21 deferral close — Admin "Create Course" (was: /admin/courses create button
 * had no handler; create-modal not UI-driven).
 *
 * Fix: the admin courses page "Create Course" button now navigates to the real
 * course form (`/courses/create`), which admins are allowed to use. This test
 * drives that path end-to-end and verifies the course persists via the API.
 *
 * The created course is owned by the admin, so it's deleted via the admin token
 * in afterAll (teacher cleanup can't remove an admin-owned course).
 */

test.describe.configure({ mode: 'serial' });

let adminToken: string;
const createdCourseIds: string[] = [];

test.beforeAll(async ({ request }) => {
  adminToken = await getAuthToken(request, admin);
});

test.afterAll(async ({ request }) => {
  for (const id of createdCourseIds) {
    await request
      .delete(`${apiURL}/api/courses/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      .catch(() => {});
  }
});

test.describe('§21 Admin — create course', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('admin Create Course button → form → submit persists via API', async ({ page, request }) => {
    const title = `§21 admin-created course ${Date.now()}`;

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/courses');

    // The button used to be inert; it now routes to the shared course form.
    await page.getByRole('button', { name: /create course/i }).click();
    await expect(page).toHaveURL(/\/courses\/create/, { timeout: 15_000 });

    await page.locator('#title').fill(title);
    await page
      .locator('#description')
      .fill('Course created through the admin UI for §21 regression coverage.');

    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/courses' && r.request().method() === 'POST',
        { timeout: 25_000 }
      ),
      page.getByRole('button', { name: /^create course$/i }).click(),
    ]);
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const createdId = (await createRes.json())?.data?._id;
    expect(createdId).toBeTruthy();
    createdCourseIds.push(String(createdId));

    // Verify persistence through the API.
    const verify = await request.get(`${apiURL}/api/courses/${createdId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();
    const body = await verify.json();
    expect((body.data || body).title).toBe(title);
  });
});
