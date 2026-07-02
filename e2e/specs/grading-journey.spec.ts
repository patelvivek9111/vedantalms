import { test, expect, APIRequestContext } from '@playwright/test';
import path from 'path';
import { apiURL, mathCourseId, teacher, loginViaForm, clearSession } from '../helpers/live-auth';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');
const student = { email: 'priya.sharma@student.demo.vidyalms.com', password: 'VedantaDemo8!' };

let assignmentId = '';
const answerText = 'L4 §5.2 regression answer with reasoning.';

async function getAuthToken(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  return body.token as string;
}

test.describe.serial('§5.2 Assignment — manual grading journey', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/courses/${mathCourseId}/modules`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(modulesRes.ok()).toBeTruthy();
    const modulesBody = await modulesRes.json();
    const modules = Array.isArray(modulesBody) ? modulesBody : modulesBody.data || [];
    const moduleId = modules[0]?._id;
    expect(moduleId).toBeTruthy();

    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §5.2 grading ${now}`,
        description: 'Submit text and an attachment for manual grading.',
        moduleId,
        totalPoints: '20',
        isOfflineAssignment: 'true',
        allowStudentUploads: 'true',
        gradeReleaseMode: 'manual',
        defaultGradeHidden: 'true',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([
          { type: 'text', text: 'Show your work for the practice problem.', points: 20 },
        ]),
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    assignmentId = created._id || created.id;

    const publish = await request.patch(`${apiURL}/api/assignments/${assignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(publish.ok(), await publish.text()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (!assignmentId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${assignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('student submits text and file', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${assignmentId}/view`);
    await expect(page.getByRole('heading', { name: /L4 §5\.2 grading/i })).toBeVisible({
      timeout: 20_000,
    });

    const answerField = page.locator('textarea').first();
    await answerField.fill(answerText);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(samplePng);
    await expect(page.getByText(/regression-sample|attached|uploaded/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Submit Assignment' }).first().click();
    await expect(page.getByText(/submitted|your score/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('teacher grades, releases, and student sees score', async ({ page, request }) => {
    test.setTimeout(120_000);
    const teacherToken = await getAuthToken(request, teacher);
    const subsRes = await request.get(`${apiURL}/api/submissions/assignment/${assignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(subsRes.ok()).toBeTruthy();
    const subs = await subsRes.json();
    const submission = (Array.isArray(subs) ? subs : subs.data || []).find(
      (s: { student?: { firstName?: string } }) => s.student?.firstName === 'Priya'
    );
    expect(submission).toBeTruthy();
    expect(submission.answers && Object.values(submission.answers).some((v) => String(v).includes('§5.2'))).toBeTruthy();

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${assignmentId}/grade`);
    await expect(page.getByRole('button', { name: /grade submission from priya sharma/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /grade submission from priya sharma/i }).click();

    await expect(page.getByText(answerText)).toBeVisible({ timeout: 15_000 });
    const scoreInput = page.locator('#grade-0');
    await expect(scoreInput).toBeVisible({ timeout: 15_000 });
    await scoreInput.fill('18');
    await page.locator('#feedback').fill('Strong work — clear steps.');

    const releaseResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' &&
        r.url().includes('/submissions/') &&
        r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: 'Save & Release' }).click();
    await releaseResponse;

    const studentToken = await getAuthToken(request, student);
    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/submissions/student/${assignmentId}`, {
            headers: { Authorization: `Bearer ${studentToken}` },
          });
          if (!res.ok()) return null;
          const body = await res.json();
          return body.grade ?? body.finalGrade;
        },
        { timeout: 30_000 }
      )
      .toBe(18);

    await clearSession(page);
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${assignmentId}/view`);
    await expect(page.getByText(answerText)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[title="Score: 18 / 20 pts"]')).toBeAttached();
  });
});
