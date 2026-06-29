import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, loginViaForm } from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 Step 8 — QuizWave write flows (item 38 deferred Save Quiz / Edit / Delete).
 * Live multiplayer session end + final leaderboard remains a justified manual
 * deferral (requires concurrent student sockets). Zoho meeting create requires a
 * connected Zoho OAuth account → external-integration deferral.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 quizwave course ${Date.now()}` });
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function listQuizTitles(request: APIRequestContext): Promise<string[]> {
  const res = await request.get(`${apiURL}/api/quizwave/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok()) return [];
  const body = await res.json();
  const list = body.data || body;
  return (Array.isArray(list) ? list : []).map((q: { title?: string }) => q.title || '');
}

async function seedQuiz(request: APIRequestContext, title: string): Promise<string> {
  const res = await request.post(`${apiURL}/api/quizwave/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      title,
      questions: [
        {
          questionText: 'Capital of France?',
          questionType: 'multiple-choice',
          options: [
            { text: 'Paris', isCorrect: true },
            { text: 'Berlin', isCorrect: false },
          ],
          timeLimit: 30,
          order: 0,
        },
      ],
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.data?._id || body._id;
}

test.describe('§21 QuizWave — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Save Quiz — create new quiz from builder persists via API', async ({ page, request }) => {
    const title = `§21 builder quiz ${Date.now()}`;

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/quizwave`);

    await page.getByRole('button', { name: /create quiz/i }).first().click();

    await page.getByPlaceholder('Enter quiz title').fill(title);
    await page.getByRole('button', { name: /multiple choice/i }).click();
    await page.getByPlaceholder('Enter question text').fill('2 + 2 = ?');
    await page.getByPlaceholder('Option 1').fill('4');
    await page.getByPlaceholder('Option 2').fill('3');
    await page.getByPlaceholder('Option 3').fill('5');
    await page.getByPlaceholder('Option 4').fill('22');

    // Mark Option 1 correct: click the wrapping option button in its top padding
    // (clicking the input itself stops propagation and won't toggle correctness).
    const option1Button = page.getByPlaceholder('Option 1').locator('xpath=ancestor::button[1]');
    await option1Button.click({ position: { x: 20, y: 3 } });
    await expect(page.getByText('✓ Correct').first()).toBeVisible({ timeout: 10_000 });

    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/quizwave/courses/${courseId}`) &&
          r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /save quiz/i }).click(),
    ]);
    expect(createRes.ok()).toBeTruthy();

    await expect.poll(() => listQuizTitles(request), { timeout: 15_000 }).toContain(title);
  });

  test('Delete quiz — confirm modal removes it via API', async ({ page, request }) => {
    const title = `§21 delete quiz ${Date.now()}`;
    await seedQuiz(request, title);

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/quizwave`);

    await page.getByRole('button', { name: `Delete ${title}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect.poll(() => listQuizTitles(request), { timeout: 15_000 }).not.toContain(title);
  });
});
