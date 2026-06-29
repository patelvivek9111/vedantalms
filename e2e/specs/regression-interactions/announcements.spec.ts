import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, loginViaForm } from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 Step 5 — Announcement write flows not covered by forms-live (which covers
 * create + validation). Here: edit via UI + delete via UI (item 23 deferred).
 * Inbox compose send + reply is already covered by regression-inbox-compose.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 announce course ${Date.now()}` });
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function createAnnouncement(
  request: APIRequestContext,
  title: string,
  body: string
): Promise<string> {
  const res = await request.post(`${apiURL}/api/courses/${courseId}/announcements`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    multipart: { title, body, postTo: 'all' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const created = await res.json();
  return created._id || created.data?._id;
}

test.describe('§21 Announcements — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lms:e2e:plain-editor', '1'));
  });

  test('edit announcement — title change persists via UI', async ({ page, request }) => {
    const original = `§21 edit-me announce ${Date.now()}`;
    const updated = `§21 edited announce ${Date.now()}`;
    await createAnnouncement(request, original, 'Original announcement body.');

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/announcements`);

    await page.getByRole('button', { name: original }).click();
    await page.getByRole('button', { name: /^edit$/i }).click();

    await page.locator('#announcement-title').fill(updated);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText(updated).first()).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText(updated).first()).toBeVisible({ timeout: 20_000 });
  });

  test('delete announcement — confirm modal removes it', async ({ page, request }) => {
    const title = `§21 delete-me announce ${Date.now()}`;
    await createAnnouncement(request, title, 'Body to be deleted.');

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/announcements`);

    await page.getByRole('button', { name: title }).click();
    await page.getByRole('button', { name: /^delete$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect(page.getByRole('button', { name: title })).toHaveCount(0, { timeout: 20_000 });
  });
});
