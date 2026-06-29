import { test, expect } from '@playwright/test';
import { apiURL, getAuthToken, teacher, loginViaForm } from '../../helpers/live-auth';
import {
  scaffoldCourseWithModule,
  createAssignment,
  cleanupEphemeral,
} from '../../helpers/ephemeral';

/**
 * §21 Step 3 — Assignment write flows (previously deferred):
 *  - update assignment save (edit wizard, 3 steps)
 *  - unpublish toggle (bulk toolbar) → persists via API
 *  - delete assignment (bulk toolbar + confirm) → API 404
 *
 * Ephemeral course/module; demo seed untouched.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
let moduleId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  const scaffold = await scaffoldCourseWithModule(request, teacherToken);
  courseId = scaffold.courseId;
  moduleId = scaffold.moduleId;
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

test.describe('§21 Assignments — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('edit wizard — update title saves through API', async ({ page, request }) => {
    const assignmentId = await createAssignment(request, teacherToken, moduleId, {
      title: `§21 edit-me ${Date.now()}`,
    });
    const newTitle = `§21 edited ${Date.now()}`;

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${assignmentId}/edit`);

    const titleInput = page.locator('#assignment-title');
    await expect(titleInput).toBeVisible({ timeout: 25_000 });
    await titleInput.fill(newTitle);

    // Step 1 → 2 → 3, then submit.
    await page.getByRole('button', { name: /save & continue/i }).click();
    await page.getByRole('button', { name: /^continue$/i }).click();

    const put = (r: import('@playwright/test').Response) => {
      try {
        return (
          new URL(r.url()).pathname === `/api/assignments/${assignmentId}` &&
          r.request().method() === 'PUT'
        );
      } catch {
        return false;
      }
    };
    const [putRes] = await Promise.all([
      page.waitForResponse(put, { timeout: 25_000 }),
      page.getByRole('button', { name: /update assignment|update quiz/i }).click(),
    ]);
    expect(putRes.status()).toBeLessThan(400);

    const verify = await request.get(`${apiURL}/api/assignments/${assignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const body = await verify.json();
    expect((body.data || body).title).toBe(newTitle);
  });

  test('bulk toolbar — unpublish persists via API', async ({ page, request }) => {
    const title = `§21 unpublish ${Date.now()}`;
    const assignmentId = await createAssignment(request, teacherToken, moduleId, { title });

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/assignments`);

    const checkbox = page.getByRole('checkbox', { name: `Select ${title}` });
    await expect(checkbox).toBeVisible({ timeout: 25_000 });
    await checkbox.check();

    await page.getByRole('button', { name: /^unpublish$/i }).click();

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/assignments/${assignmentId}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          const body = await res.json();
          return (body.data || body).published;
        },
        { timeout: 15_000 }
      )
      .toBe(false);
  });

  test('bulk toolbar — delete with confirm removes assignment (API 404)', async ({
    page,
    request,
  }) => {
    const title = `§21 delete ${Date.now()}`;
    const assignmentId = await createAssignment(request, teacherToken, moduleId, { title });

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/assignments`);

    const checkbox = page.getByRole('checkbox', { name: `Select ${title}` });
    await expect(checkbox).toBeVisible({ timeout: 25_000 });
    await checkbox.check();

    await page.getByRole('button', { name: /^delete$/i }).click();

    // Confirmation modal.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/assignments/${assignmentId}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          return res.status();
        },
        { timeout: 15_000 }
      )
      .toBe(404);
  });
});
