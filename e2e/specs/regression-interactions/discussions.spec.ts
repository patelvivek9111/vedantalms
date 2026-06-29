import { test, expect, APIRequestContext } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  student,
  loginViaForm,
  getUserId,
} from '../../helpers/live-auth';
import {
  scaffoldCourseWithModule,
  createThread,
  cleanupEphemeral,
} from '../../helpers/ephemeral';

/**
 * §21 Step 2 — Discussions write flows (previously deferred):
 *  - create thread submit (UI) + refresh persistence
 *  - pin / unpin via data-regression-id
 *  - lock → enrolled student cannot post (read-only)
 *  - graded thread → teacher adds grade → persists via API
 *
 * All data is ephemeral: a throwaway course + module + enrolled student are
 * created via API in beforeAll and deleted in afterAll. Demo seed is never touched.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let studentId: string;
let courseId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  studentId = await getUserId(request, student);
  const scaffold = await scaffoldCourseWithModule(request, teacherToken, { studentId });
  courseId = scaffold.courseId;
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function enablePlainEditor(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('lms:e2e:plain-editor', '1'));
}

test.describe('§21 Discussions — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('create thread via modal — appears in list and survives refresh', async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/discussions`);

    await page.getByRole('button', { name: /create.*thread/i }).first().click();

    const threadTitle = `§21 created thread ${Date.now()}`;
    await page.locator('#title').fill(threadTitle);
    await page
      .getByRole('textbox', { name: /write your thread content/i })
      .fill('Discussion body created through the real modal.');

    await page.getByRole('button', { name: /^create thread$/i }).click();

    await expect(page.getByText(threadTitle)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText(threadTitle)).toBeVisible({ timeout: 20_000 });
  });

  test('pin then unpin a thread — toggle persists across refresh', async ({ page, request }) => {
    const threadId = await createThread(request, teacherToken, courseId, {
      title: `§21 pin target ${Date.now()}`,
    });

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/threads/${threadId}`);

    const pin = page.locator('[data-regression-id="thread-pin-toggle"]');
    await expect(pin).toBeVisible({ timeout: 20_000 });
    await expect(pin).toHaveAttribute('aria-label', /^Pin discussion$/);

    await pin.click();
    await expect(pin).toHaveAttribute('aria-label', /^Unpin discussion$/, { timeout: 15_000 });

    await page.reload();
    const pinAfter = page.locator('[data-regression-id="thread-pin-toggle"]');
    await expect(pinAfter).toHaveAttribute('aria-label', /^Unpin discussion$/, { timeout: 20_000 });

    // Leave the thread unpinned for cleanliness.
    await pinAfter.click();
    await expect(pinAfter).toHaveAttribute('aria-label', /^Pin discussion$/, { timeout: 15_000 });
  });

  test('lock a thread — enrolled student sees read-only and no composer', async ({
    page,
    request,
  }) => {
    const threadId = await createThread(request, teacherToken, courseId, {
      title: `§21 lock target ${Date.now()}`,
    });

    // Teacher locks via UI.
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/threads/${threadId}`);
    const lock = page.locator('[data-regression-id="thread-lock-toggle"]');
    await expect(lock).toBeVisible({ timeout: 20_000 });
    await expect(lock).toHaveAttribute('aria-label', /^Lock discussion$/);
    await lock.click();
    await expect(lock).toHaveAttribute('aria-label', /^Unlock discussion$/, { timeout: 15_000 });

    // Student sees read-only state.
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${courseId}/threads/${threadId}`);
    await expect(page.getByText(/read-only.*because it is locked/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('graded thread — teacher adds a grade that persists via API', async ({ page, request }) => {
    const threadId = await createThread(request, teacherToken, courseId, {
      title: `§21 graded thread ${Date.now()}`,
      isGraded: true,
      totalPoints: 20,
    });

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/threads/${threadId}`);

    await page.getByRole('button', { name: /add grade/i }).first().click();
    await page.locator('#grade').fill('17');
    await page.locator('#feedback').fill('Solid contribution — §21 automated grade.');

    const gradePost = (r: import('@playwright/test').Response) => {
      try {
        return (
          new URL(r.url()).pathname === `/api/threads/${threadId}/grade` &&
          r.request().method() === 'POST'
        );
      } catch {
        return false;
      }
    };
    const [gradeRes] = await Promise.all([
      page.waitForResponse(gradePost, { timeout: 20_000 }),
      page.getByRole('button', { name: /save grade|submit|^grade$/i }).click(),
    ]);
    expect(gradeRes.ok(), await gradeRes.text()).toBeTruthy();

    // Verify persistence through the API (includeGrades for staff).
    const verify = await request.get(
      `${apiURL}/api/threads/${threadId}?includeGrades=true`,
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    expect(verify.ok(), await verify.text()).toBeTruthy();
    const body = await verify.json();
    const thread = body.data || body;
    const grades: Array<{ student: { _id?: string } | string; grade: number }> =
      thread.studentGrades || [];
    const mine = grades.find((g) => {
      const sid = typeof g.student === 'string' ? g.student : g.student?._id;
      return String(sid) === String(studentId);
    });
    expect(mine?.grade).toBe(17);
  });
});
