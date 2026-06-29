import { test, expect } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  teacher,
  student,
  getAuthToken,
  loginViaForm,
} from '../helpers/live-auth';

let assignmentId = '';
const answerText = 'L4 §10 student submit — persists after refresh.';

test.describe.serial('§10 Student — login → submit → refresh', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/courses/${mathCourseId}/modules`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const modulesBody = await modulesRes.json();
    const modules = Array.isArray(modulesBody) ? modulesBody : modulesBody.data || [];
    const moduleId = modules[0]?._id;

    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §10 submit refresh ${now}`,
        description: 'Text-only assignment for submit persistence check.',
        moduleId,
        totalPoints: '10',
        isOfflineAssignment: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Answer in complete sentences.', points: 10 }]),
      },
    });
    expect(create.ok()).toBeTruthy();
    assignmentId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${assignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    if (!assignmentId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${assignmentId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('student submits assignment and state persists after reload', async ({ page, request }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${assignmentId}/view`);
    await expect(page.getByRole('heading', { name: /L4 §10 submit refresh/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator('textarea').first().fill(answerText);
    const submitResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/submissions') && r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: 'Submit Assignment' }).first().click();
    await submitResponse;
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(answerText)).toBeVisible();

    const studentToken = await getAuthToken(request, student);
    const subRes = await request.get(`${apiURL}/api/submissions/student/${assignmentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(subRes.ok()).toBeTruthy();
    const sub = await subRes.json();
    expect(Object.values(sub.answers || {}).some((v) => String(v).includes('§10 student submit'))).toBeTruthy();
  });
});
