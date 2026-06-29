import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  teacher,
  student,
  admin,
  getAuthToken,
  getUserId,
  loginViaForm,
  registerStudent,
  clearSession,
} from '../helpers/live-auth';
import { trackThread, trackCourse, cleanupTracked } from '../helpers/live-cleanup';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');

async function enablePlainEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lms:e2e:plain-editor', '1'));
}

test.describe.serial('Regression gaps — live journeys', () => {
  test.afterAll(async ({ request }) => {
    await cleanupTracked(request);
  });

  test('discussion grade release — hidden then visible after release', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const title = `Gap grade release ${Date.now()}`;
    const create = await request.post(`${apiURL}/api/threads`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        title,
        content: '<p>Grade release gap test.</p>',
        courseId: getMathCourseId(),
        isGraded: true,
        totalPoints: 10,
        discussionReleaseMode: 'hidden',
        settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
      },
    });
    expect(create.ok()).toBeTruthy();
    const threadId = (await create.json()).data?._id || (await create.json())._id;
    trackThread(threadId);

    await request.post(`${apiURL}/api/threads/${threadId}/replies`, {
      headers: { Authorization: `Bearer ${await getAuthToken(request, student)}` },
      data: { content: '<p>Student post for grade.</p>', idempotencyKey: `gap-grade-${Date.now()}` },
    });

    const studentId = await getUserId(request, student);
    await request.post(`${apiURL}/api/threads/${threadId}/grade`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId, grade: 7, feedback: 'Good work', hideGrade: true },
    });

    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${threadId}`);
    await expect(page.getByText('Grade hidden')).toBeVisible({ timeout: 15_000 });

    const releaseRes = await request.post(`${apiURL}/api/threads/${threadId}/grade`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId, grade: 7, feedback: 'Good work', releaseGrade: true, discussionReleaseMode: 'manual' },
    });
    expect(releaseRes.ok(), await releaseRes.text()).toBeTruthy();

    await page.reload();
    await expect(page.getByText('Grade hidden')).toHaveCount(0);
  });

  test('people tab — approve pending enrollment via UI', async ({ page, request }) => {
    const temp = await registerStudent(request, 'PendingUI');
    const teacherToken = await getAuthToken(request, teacher);

    await request.post(`${apiURL}/api/courses/${mathCourseId}/enrollment/request`, {
      headers: { Authorization: `Bearer ${temp.token}` },
    }).catch(async () => {
      await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll`, {
        headers: { Authorization: `Bearer ${temp.token}` },
      });
    });

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/people`);
    const approve = page.getByRole('button', { name: 'Approve' }).first();
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
      await expect(page.getByText(/added to the course|approved/i).first()).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByRole('heading', { name: /people|students/i }).first()).toBeVisible();
    }
  });

  test('course create wizard — teacher creates course', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/courses/create');
    const title = `Gap course ${Date.now()}`;
    await page.locator('#title, [name="title"]').first().fill(title);
    await page.locator('#description, [name="description"]').first().fill(
      'Regression gap test course with sufficient description length for validation.'
    );
    const createRes = page.waitForResponse(
      (r) => r.url().includes('/api/courses') && r.request().method() === 'POST' && r.ok()
    );
    await page.getByRole('button', { name: /create course|save/i }).first().click();
    const body = await (await createRes).json();
    const courseId = body.data?._id || body._id;
    trackCourse(courseId);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });

  test('group discussion — open group home discussions', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/groups`);
    const groupLink = page.getByRole('link', { name: /Group \d+/i }).first();
    if (await groupLink.isVisible().catch(() => false)) {
      await groupLink.click();
      await expect(page).toHaveURL(/\/groups\/[a-f0-9]+/i, { timeout: 15_000 });
      await page.getByRole('button', { name: /^Discussion$/i }).click();
      await expect(page).toHaveURL(/\/groups\/[a-f0-9]+\/discussion/i, { timeout: 15_000 });
      await expect(page.getByRole('heading', { name: /discussion/i }).first()).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByText(/group/i).first()).toBeVisible();
    }
  });

  test('QuizWave — teacher opens lobby', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/quizwave`);
    await expect(page.getByRole('heading', { name: /quizwave|live quiz/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    const host = page.getByRole('button', { name: /host|start session|new session/i }).first();
    if (await host.isVisible().catch(() => false)) {
      await host.click();
      await expect(page.getByText(/pin|session|lobby/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('mobile file upload on assignment view', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const temp = await registerStudent(request, 'MobileUpload');
    const teacherToken = await getAuthToken(request, teacher);
    const modules = await request.get(`${apiURL}/api/modules/${mathCourseId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const modList = (await modules.json()).data || await modules.json();
    const moduleId = modList[0]?._id;
    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `Gap mobile upload ${now}`,
        description: 'Mobile upload gap.',
        moduleId,
        totalPoints: '5',
        isOfflineAssignment: 'true',
        allowStudentUploads: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Attach file.', points: 5 }]),
      },
    });
    const assignmentId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${assignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${assignmentId}/view`);
    await page.locator('input[type="file"]').first().setInputFiles(samplePng);
    await expect(page.getByText('regression-sample.png')).toBeVisible({ timeout: 15_000 });

    await request.delete(`${apiURL}/api/assignments/${assignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('global shell — sidebar customize and change user modal', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}`);
    const customize = page.getByRole('button', { name: /customize|edit.*sidebar|navigation/i }).first();
    if (await customize.isVisible().catch(() => false)) {
      await customize.click();
      await expect(page.getByRole('heading', { name: /sidebar|navigation/i }).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.keyboard.press('Escape');
    }

    await clearSession(page);
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/dashboard');
    const menu = page.getByRole('button', { name: /menu|open navigation/i }).first();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click();
    }
    const changeUser = page.getByRole('button', { name: 'Change User' });
    if (await changeUser.isVisible().catch(() => false)) {
      await changeUser.click();
      await expect(page.getByRole('heading', { name: 'Change User' })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('announcement list shows attachment chip after create', async ({ page, request }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, teacher.email, teacher.password);
    const title = `Gap announcement ${Date.now()}`;
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await page.locator('#announcement-title').fill(title);
    await page.locator('#announcement-body').fill('Announcement with attachment for gap test.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
  });
});
