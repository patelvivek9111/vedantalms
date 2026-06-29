import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, admin, loginViaForm } from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Course management write flows (Copy / Archive / Restore /
 * Delete), previously "buttons visible; modals not opened (destructive)".
 *
 * Copy / Archive / Restore run against an ephemeral teacher-owned course at
 * /teacher/courses; Delete is admin-only, so it runs at /admin/courses:
 *  - Copy: sync copy creates a new course → verified via API (copy is tracked + deleted).
 *  - Archive → Restore: confirm modals; operationalStatus verified via API.
 *  - Delete: confirm modal on the admin oversight page; course is gone (API 404).
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let adminToken: string;
let courseId: string;
let courseTitle: string;
const extraCleanupIds: string[] = [];

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  adminToken = await getAuthToken(request, admin);
  courseTitle = `§21 ops course ${Date.now()}`;
  courseId = await createCourse(request, teacherToken, { title: courseTitle });
});

test.afterAll(async ({ request }) => {
  // Course delete is admin-only.
  for (const id of extraCleanupIds) {
    await request
      .delete(`${apiURL}/api/courses/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      .catch(() => {});
  }
  await cleanupEphemeral(request);
});

async function gotoCoursesAndFilter(page: import('@playwright/test').Page, term: string) {
  await page.goto('/teacher/courses');
  await page.getByPlaceholder('Search…').fill(term);
}

async function operationalStatus(request: APIRequestContext, id: string): Promise<string> {
  const res = await request.get(`${apiURL}/api/courses/${id}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok()) return `<http ${res.status()}>`;
  const body = await res.json();
  const course = body.data || body;
  return course.operationalStatus || course.status || '<none>';
}

test.describe('§21 Course — management write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('copy course (sync) — creates a new course persisted via API', async ({ page, request }) => {
    // Must NOT contain courseTitle, or later searches for the original match both rows.
    const copyTitle = `§21 duplicate ${Date.now()}`;

    await loginViaForm(page, teacher.email, teacher.password);
    await gotoCoursesAndFilter(page, courseTitle);

    await page.getByRole('button', { name: 'Copy course' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // Force a synchronous copy so we can assert immediately (default is async job).
    await dialog.getByLabel(/run as background job/i).uncheck();
    // The title input has no explicit type attr; it's the first (non-checkbox) input.
    await dialog.locator('input:not([type="checkbox"])').first().fill(copyTitle);

    const [copyRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/courses/${courseId}/copy` &&
          r.request().method() === 'POST',
        { timeout: 30_000 }
      ),
      dialog.getByRole('button', { name: 'Copy course' }).click(),
    ]);
    expect(copyRes.ok(), await copyRes.text()).toBeTruthy();
    const newId = (await copyRes.json())?.data?.course?._id;
    expect(newId, 'sync copy should return the new course id').toBeTruthy();
    extraCleanupIds.push(String(newId));

    const verify = await request.get(`${apiURL}/api/courses/${newId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(verify.ok(), await verify.text()).toBeTruthy();
    expect((await verify.json()).data.title).toBe(copyTitle);
  });

  test('archive then restore — confirm modals persist via API', async ({ page, request }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await gotoCoursesAndFilter(page, courseTitle);

    // Archive. (Confirm buttons are unique by exact name — "Archive" / "Restore" /
    // "Delete" — vs the row buttons "Archive course" etc., so no dialog scoping is
    // needed; several ConfirmationModals share markup and linger during animation.)
    await page.getByRole('button', { name: 'Archive course' }).click();
    const archiveConfirm = page.getByRole('button', { name: /^archive$/i });
    await expect(archiveConfirm).toBeVisible({ timeout: 15_000 });
    await archiveConfirm.click();
    await expect.poll(() => operationalStatus(request, courseId), { timeout: 15_000 }).toBe('archived');

    // Reload to read server truth (avoids racing the optimistic row toggle under load);
    // the archived row now offers Restore.
    await gotoCoursesAndFilter(page, courseTitle);
    const restoreBtn = page.getByRole('button', { name: 'Restore course' });
    await expect(restoreBtn).toBeVisible({ timeout: 15_000 });
    await restoreBtn.click();
    const restoreConfirm = page.getByRole('button', { name: /^restore$/i });
    await expect(restoreConfirm).toBeVisible({ timeout: 10_000 });
    await restoreConfirm.click();
    await expect.poll(() => operationalStatus(request, courseId), { timeout: 15_000 }).toBe('active');
  });

  test('delete course (admin) — confirm modal removes it (API 404)', async ({ page, request }) => {
    // Delete is admin-only; the admin oversight page is the only UI with a working
    // delete control, so this leg runs as admin at /admin/courses.
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/courses');
    await page.getByPlaceholder('Search courses...').fill(courseTitle);

    await page.getByRole('button', { name: 'Delete course' }).click();
    const deleteConfirm = page.getByRole('button', { name: /^delete$/i });
    await expect(deleteConfirm).toBeVisible({ timeout: 15_000 });

    const [delRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/courses/${courseId}` &&
          r.request().method() === 'DELETE',
        { timeout: 20_000 }
      ),
      deleteConfirm.click(),
    ]);
    expect(delRes.ok(), await delRes.text()).toBeTruthy();

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          return res.status();
        },
        { timeout: 15_000 }
      )
      .toBe(404);
  });
});
