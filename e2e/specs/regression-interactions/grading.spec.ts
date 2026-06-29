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
  createAssignment,
  cleanupEphemeral,
} from '../../helpers/ephemeral';

/**
 * §21 Step 4 — Grading write flows NOT already covered by grading-ui-live.
 * (grading-ui-live already covers cell-edit G8, Save & Release G7, policy modal G9.)
 *
 *  - delete submission confirm flow (item 19 deferred)
 *
 * Ephemeral course/module/assignment + a seeded student submission.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let studentToken: string;
let studentId: string;
let moduleId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  studentToken = await getAuthToken(request, student);
  studentId = await getUserId(request, student);
  const scaffold = await scaffoldCourseWithModule(request, teacherToken, { studentId });
  moduleId = scaffold.moduleId;
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function seedSubmission(
  request: APIRequestContext,
  assignmentId: string,
  answer: string
): Promise<string> {
  const res = await request.post(`${apiURL}/api/submissions`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { assignment: assignmentId, answers: { 0: answer } },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.data?._id || body._id;
}

test.describe('§21 Grading — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('delete submission — confirm modal removes it (API gone)', async ({ page, request }) => {
    const assignmentId = await createAssignment(request, teacherToken, moduleId, {
      title: `§21 grade-delete ${Date.now()}`,
      questions: [{ type: 'text', text: 'Show your work.', points: 20 }],
    });
    await seedSubmission(request, assignmentId, '§21 answer to be deleted');

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${assignmentId}/grade`);

    await page
      .getByRole('button', { name: /grade submission from arjun menon/i })
      .click();

    await page.getByRole('button', { name: /^delete submission$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${apiURL}/api/submissions/assignment/${assignmentId}`,
            { headers: { Authorization: `Bearer ${teacherToken}` } }
          );
          if (!res.ok()) return -1;
          const body = await res.json();
          const list = Array.isArray(body) ? body : body.data || [];
          return list.length;
        },
        { timeout: 15_000 }
      )
      .toBe(0);
  });
});
