import { test, expect } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  teacher,
  student,
  getAuthToken,
  loginViaForm,
  clearSession,
  registerStudent,
} from '../helpers/live-auth';

let quizId = '';

const matchingQuestion = {
  type: 'matching',
  text: 'L4 §6.3 Match capitals',
  points: 10,
  leftItems: [
    { id: 'L1', text: 'France' },
    { id: 'L2', text: 'Japan' },
  ],
  rightItems: [
    { id: 'L1', text: 'Paris' },
    { id: 'L2', text: 'Tokyo' },
    { id: 'L3', text: 'London' },
  ],
};

test.describe.serial('§6.3 Automated quiz grading UI — live journeys', () => {
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
        title: `L4 §6.3 quiz UI ${now}`,
        description: 'MCQ + matching for §6.3 regression.',
        moduleId,
        totalPoints: '21',
        isGradedQuiz: 'true',
        isTimedQuiz: 'false',
        showCorrectAnswers: 'true',
        gradeReleaseMode: 'immediate',
        defaultGradeHidden: 'false',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([
          {
            type: 'multiple-choice',
            text: 'L4 §6.3 What is 2+2?',
            points: 10,
            options: [
              { text: '3', isCorrect: false },
              { text: '4', isCorrect: true },
              { text: '5', isCorrect: false },
            ],
          },
          matchingQuestion,
          { type: 'text', text: 'L4 §6.3 One sentence reflection.', points: 1 },
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

  test('Q1 + Q2: MCQ and matching auto-grade with partial credit', async ({ page, request }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${quizId}/view`);
    await expect(page.getByRole('heading', { name: /L4 §6\.3 quiz UI/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator('label[for="question-0-option-1"]').click();
    await page.getByRole('button', { name: 'Next Question' }).click();
    await expect(page.getByText('France')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('combobox').nth(0).selectOption('Paris');
    await page.getByRole('combobox').nth(1).selectOption('London');

    await page.getByRole('button', { name: 'Next Question' }).click();
    await page.locator('textarea').first().fill('Partial credit matching test.');

    const submitResponse = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/submissions') && r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: /Submit Assignment/i }).last().click();
    await submitResponse;

    await expect(page.getByText('✓ Correct!').first()).toBeVisible({ timeout: 20_000 });

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
      .toBe(15);
  });

  test('Q4: review after submit persists after reload', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${quizId}/view`);
    await expect(page.getByText('✓ Correct!').first()).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText('✓ Correct!').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/incorrect/i).first()).toBeVisible();
  });

  test('Q5: teacher regrade updates student view after refresh', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const subsRes = await request.get(`${apiURL}/api/submissions/assignment/${quizId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(subsRes.ok()).toBeTruthy();
    const subs = await subsRes.json();
    const submission = (Array.isArray(subs) ? subs : subs.data || []).find(
      (s: { student?: { firstName?: string } }) => s.student?.firstName === 'Arjun'
    );
    expect(submission).toBeTruthy();

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${quizId}/grade`);
    await page.getByRole('button', { name: /grade submission from arjun menon/i }).click();

    await page.getByRole('spinbutton', { name: 'Grade (0-10)' }).fill('10');
    await page.getByRole('spinbutton', { name: 'Grade (0-1)' }).fill('1');

    const saveResponse = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/submissions/') && r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: 'Grade with Edits' }).click();
    await saveResponse;

    await clearSession(page);
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${quizId}/view`);
    await page.reload();
    await expect(page.locator('[title^="Score:"]')).toBeAttached({ timeout: 20_000 });
    const scoreTitle = await page.locator('[title^="Score:"]').first().getAttribute('title');
    expect(scoreTitle).toMatch(/21|20/);
  });
});

test.describe.serial('§6.3 Q3 — timed quiz auto-submit on expiry', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let timedQuizId = '';

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
        title: `L4 §6.3 timed ${now}`,
        description: 'One-minute timed quiz for auto-submit.',
        moduleId,
        totalPoints: '10',
        isGradedQuiz: 'true',
        isTimedQuiz: 'true',
        quizTimeLimit: '1',
        showCorrectAnswers: 'true',
        gradeReleaseMode: 'immediate',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([
          {
            type: 'multiple-choice',
            text: 'L4 §6.3 timed: pick any',
            points: 10,
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: false },
            ],
          },
        ]),
      },
    });
    expect(create.ok()).toBeTruthy();
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

  test('Q3: timer expiry auto-submits quiz', async ({ page, request }) => {
    test.setTimeout(120_000);
    const temp = await registerStudent(request, `TimedQuiz${Date.now()}`);
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    await page.clock.install({ time: new Date() });
    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${timedQuizId}/view`);
    await expect(page.getByText('Ready to begin?')).toBeVisible({ timeout: 15_000 });

    const startResponse = page.waitForResponse(
      (r) => r.url().includes(`/assignments/${timedQuizId}/quiz/start`) && r.ok()
    );
    await page.getByRole('button', { name: /start quiz/i }).click();
    await startResponse;
    await expect(page.getByText(/Time Remaining/i)).toBeVisible({ timeout: 15_000 });

    await page.clock.fastForward(61_000);

    await expect
      .poll(
        async () => {
          const subRes = await request.get(`${apiURL}/api/submissions/student/${timedQuizId}`, {
            headers: { Authorization: `Bearer ${temp.token}` },
          });
          if (!subRes.ok()) return null;
          const sub = await subRes.json();
          return sub.submittedAt || sub._id;
        },
        { timeout: 30_000 }
      )
      .toBeTruthy();
  });
});
