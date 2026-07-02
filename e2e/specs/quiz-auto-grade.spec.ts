import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, mathCourseId, teacher, student, loginViaForm } from '../helpers/live-auth';

const Q1_CORRECT = '4';
const Q1_WRONG = '3';
const Q2_CORRECT = '6';
const Q2_WRONG = '5';

let quizId = '';

async function getAuthToken(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  return body.token as string;
}

test.describe.serial('§5.3 Quiz — automated grading journey', () => {
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
        title: `L4 §5.3 auto quiz ${now}`,
        description: 'Timed MCQ quiz for automated grading regression.',
        moduleId,
        totalPoints: '20',
        isGradedQuiz: 'true',
        isTimedQuiz: 'true',
        quizTimeLimit: '15',
        displayMode: 'scrollable',
        showCorrectAnswers: 'true',
        gradeReleaseMode: 'immediate',
        defaultGradeHidden: 'false',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([
          {
            type: 'multiple-choice',
            text: 'L4 §5.3 What is 2+2?',
            points: 10,
            options: [
              { text: Q1_WRONG, isCorrect: false },
              { text: Q1_CORRECT, isCorrect: true },
              { text: '5', isCorrect: false },
            ],
          },
          {
            type: 'multiple-choice',
            text: 'L4 §5.3 What is 3+3?',
            points: 10,
            options: [
              { text: Q2_WRONG, isCorrect: false },
              { text: Q2_CORRECT, isCorrect: true },
              { text: '7', isCorrect: false },
            ],
          },
        ]),
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    quizId = created._id || created.id;

    const publish = await request.patch(`${apiURL}/api/assignments/${quizId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(publish.ok(), await publish.text()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (!quizId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/assignments/${quizId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('teacher sees published timed quiz', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const res = await request.get(`${apiURL}/api/assignments/${quizId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.published ?? body.data?.published).toBeTruthy();
    expect(body.isGradedQuiz ?? body.data?.isGradedQuiz).toBeTruthy();

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${quizId}/view`);
    await expect(page.getByRole('heading', { name: /L4 §5\.3 auto quiz/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/timed quiz|15 min/i).first()).toBeVisible();
  });

  test('student takes timed quiz, auto score, and review feedback', async ({ page, request }) => {
    test.setTimeout(120_000);
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${quizId}/view`);
    await expect(page.getByRole('heading', { name: /L4 §5\.3 auto quiz/i })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText('Ready to begin?')).toBeVisible({ timeout: 15_000 });
    const startResponse = page.waitForResponse(
      (r) => r.url().includes(`/assignments/${quizId}/quiz/start`) && r.ok()
    );
    await page.getByRole('button', { name: /start quiz/i }).click();
    await startResponse;

    await expect(page.getByText(/Time Remaining/i)).toBeVisible({ timeout: 15_000 });

    await page.locator('label[for="question-0-option-1"]').click();
    await page.locator('label[for="question-1-option-0"]').click();

    const submitResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/submissions') && r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: /Submit Assignment/i }).last().click();
    await submitResponse;

    await expect(page.getByText('✓ Correct!').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('✗ Incorrect').first()).toBeVisible({ timeout: 15_000 });

    const studentToken = await getAuthToken(request, student);
    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/submissions/student/${quizId}`, {
            headers: { Authorization: `Bearer ${studentToken}` },
          });
          if (!res.ok()) return null;
          const body = await res.json();
          return body.autoGrade ?? body.grade ?? body.finalGrade;
        },
        { timeout: 30_000 }
      )
      .toBe(10);

    await page.reload();
    await expect(page.getByText('✓ Correct!').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('✗ Incorrect').first()).toBeVisible();
  });
});
