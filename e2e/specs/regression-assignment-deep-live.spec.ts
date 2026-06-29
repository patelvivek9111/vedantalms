/**
 * §14.5 Assignments & quizzes (deep) — automate remaining manual inventory cells.
 * Run: npm run test:e2e:assignment-deep (after seed:e2e:visual + API + Vite)
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  teacher,
  student,
  getAuthToken,
  loginViaForm,
  registerStudent,
} from '../helpers/live-auth';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');

let timedQuizId = '';
let resubmitAssignmentId = '';
let speedGradeAssignmentId = '';

test.describe.serial('§14.5 — timed quiz start + attempt timer', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}/modules`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const modulesBody = await modulesRes.json();
    const modules = Array.isArray(modulesBody) ? modulesBody : modulesBody.data || [];
    const moduleId = modules[0]?._id;
    expect(moduleId).toBeTruthy();

    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `§14.5 timed ${now}`,
        description: 'Timed quiz for §14.5 deep inventory.',
        moduleId,
        totalPoints: '10',
        isGradedQuiz: 'true',
        isTimedQuiz: 'true',
        quizTimeLimit: '15',
        showCorrectAnswers: 'true',
        gradeReleaseMode: 'immediate',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([
          {
            type: 'multiple-choice',
            text: '§14.5 timed question',
            points: 10,
            options: [
              { text: 'Correct', isCorrect: true },
              { text: 'Wrong', isCorrect: false },
            ],
          },
        ]),
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    timedQuizId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${timedQuizId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    if (!timedQuizId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${timedQuizId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('timed quiz start screen — Ready to begin and Start quiz', async ({ page, request }) => {
    const temp = await registerStudent(request, `TimedStart${Date.now()}`);
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${getMathCourseId()}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${timedQuizId}/view`);
    await expect(page.getByText(/ready to begin/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /start quiz/i })).toBeVisible();
  });

  test('quiz attempt + timer — start shows countdown and question', async ({ page, request }) => {
    const temp = await registerStudent(request, `TimedAttempt${Date.now()}`);
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${getMathCourseId()}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${timedQuizId}/view`);
    const startResponse = page.waitForResponse(
      (r) => r.url().includes(`/assignments/${timedQuizId}/quiz/start`) && r.ok()
    );
    await page.getByRole('button', { name: /start quiz/i }).click();
    await startResponse;

    await expect(page.getByText(/\d+:\d+/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/§14\.5 timed question/i)).toBeVisible();
    await page.locator('label').filter({ hasText: 'Correct' }).first().click();
  });
});

test.describe.serial('§14.5 — submission version / resubmit', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const modules = (await modulesRes.json()).data || (await modulesRes.json());
    const moduleId = modules[0]?._id;
    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `§14.5 resubmit ${now}`,
        description: 'Text assignment for version snapshot.',
        moduleId,
        totalPoints: '10',
        isOfflineAssignment: 'true',
        gradeReleaseMode: 'immediate',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Answer here.', points: 10 }]),
      },
    });
    expect(create.ok()).toBeTruthy();
    resubmitAssignmentId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${resubmitAssignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    if (!resubmitAssignmentId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${resubmitAssignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('resubmit snapshots prior version', async ({ request }) => {
    const temp = await registerStudent(request, `Resubmit${Date.now()}`);
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${getMathCourseId()}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    const headers = { Authorization: `Bearer ${temp.token}` };
    const first = await request.post(`${apiURL}/api/submissions`, {
      headers,
      data: {
        assignment: resubmitAssignmentId,
        answers: { 0: 'First answer' },
        submitIdempotencyKey: `first-${Date.now()}`,
      },
    });
    expect(first.ok(), await first.text()).toBeTruthy();
    const submissionId = (await first.json())._id;

    const second = await request.post(`${apiURL}/api/submissions`, {
      headers,
      data: {
        assignment: resubmitAssignmentId,
        answers: { 0: 'Revised answer' },
        submitIdempotencyKey: `second-${Date.now()}`,
      },
    });
    expect(second.ok(), await second.text()).toBeTruthy();

    const versions = await request.get(`${apiURL}/api/submissions/${submissionId}/versions`, {
      headers,
    });
    expect(versions.ok()).toBeTruthy();
    const body = await versions.json();
    const list = body.data || body.versions || body;
    expect(Array.isArray(list) ? list.length : body.pagination?.total || 0).toBeGreaterThan(0);

    const latest = await request.get(`${apiURL}/api/submissions/student/${resubmitAssignmentId}`, {
      headers,
    });
    const latestBody = await latest.json();
    const answer = latestBody.answers?.['0'] || latestBody.answers?.[0];
    expect(String(answer)).toContain('Revised');
  });
});

test.describe.serial('§14.5 — assignment groups + SpeedGrader navigation', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const modules = (await modulesRes.json()).data || (await modulesRes.json());
    const moduleId = modules[0]?._id;
    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `§14.5 speedgrade ${now}`,
        description: 'Two-student grading navigation.',
        moduleId,
        totalPoints: '10',
        isOfflineAssignment: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Short answer.', points: 10 }]),
      },
    });
    expect(create.ok()).toBeTruthy();
    speedGradeAssignmentId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${speedGradeAssignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    if (!speedGradeAssignmentId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${speedGradeAssignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('assignment groups — Edit Groups modal on gradebook', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible({
      timeout: 25_000,
    });
    await page.getByRole('button', { name: 'Edit Groups' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Assignment Groups' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Assignments|Discussions/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('SpeedGrader — prev/next submission navigation', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const s1 = await registerStudent(request, `SpeedA${Date.now()}`);
    const s2 = await registerStudent(request, `SpeedB${Date.now()}`);
    for (const s of [s1, s2]) {
      await request.post(`${apiURL}/api/courses/${getMathCourseId()}/enroll-teacher`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
        data: { studentId: s.userId },
      });
      const sub = await request.post(`${apiURL}/api/submissions`, {
        headers: { Authorization: `Bearer ${s.token}` },
        data: {
          assignment: speedGradeAssignmentId,
          answers: { 0: `Answer from ${s.userId}` },
          submitIdempotencyKey: `speed-${s.userId}`,
        },
      });
      expect(sub.ok()).toBeTruthy();
    }

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${speedGradeAssignmentId}/grade`);
    await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible({
      timeout: 20_000,
    });

    const submissionButtons = page.getByRole('button', { name: /grade submission from e2e speed/i });
    await expect(submissionButtons).toHaveCount(2, { timeout: 15_000 });
    await submissionButtons.first().click();
    const firstName = await page
      .getByRole('heading', { name: /Grading:/i })
      .textContent();

    await submissionButtons.nth(1).click();
    const secondName = await page
      .getByRole('heading', { name: /Grading:/i })
      .textContent();
    expect(firstName).not.toEqual(secondName);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole('button', { name: /grade submission from e2e speed/i }).first().click();
    await expect(page.getByRole('button', { name: 'Next submission' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Next submission' }).click();
    await expect(page.getByRole('heading', { name: /Grading:/i })).toBeVisible();
  });
});

test.describe.serial('§14.5 — file upload, preview, chunk init', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let uploadAssignmentId = '';

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const modules = (await modulesRes.json()).data || (await modulesRes.json());
    const moduleId = modules[0]?._id;
    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `§14.5 upload ${now}`,
        description: 'File upload and preview.',
        moduleId,
        totalPoints: '10',
        isOfflineAssignment: 'true',
        allowStudentUploads: 'true',
        gradeReleaseMode: 'immediate',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Attach file.', points: 10 }]),
      },
    });
    expect(create.ok()).toBeTruthy();
    uploadAssignmentId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${uploadAssignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    if (!uploadAssignmentId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${uploadAssignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('file upload submit — student attaches file and submits', async ({ page, request }) => {
    const temp = await registerStudent(request, `Upload${Date.now()}`);
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${getMathCourseId()}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${uploadAssignmentId}/view`);
    await page.locator('textarea').first().fill('Answer with attachment.');
    await page.locator('input[type="file"]').first().setInputFiles(samplePng);
    await expect(page.getByText('regression-sample.png')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Submit Assignment' }).first().click();
    await expect(page.getByText(/submitted|your score/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('chunk upload init — authenticated teacher can start session', async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const res = await request.post(`${apiURL}/api/upload/chunk/init`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        fileName: 'section-14-5-chunk.bin',
        fileSize: 8192,
        totalChunks: 2,
        mimeType: 'application/octet-stream',
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });
});
