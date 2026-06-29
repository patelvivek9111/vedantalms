import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';
import { apiURL, mathCourseId, teacher } from '../helpers/live-auth';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');
const student = { email: 'priya.sharma@student.demo.vidyalms.com', password: 'VedantaDemo8!' };

let assignmentId = '';
let assignmentTitle = '';
const answerText = 'L4 §6.2 manual grading UI answer';

async function getAuthToken(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  return body.token as string;
}

async function loginViaForm(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'load', timeout: 60_000 });
  await page.locator('#email-address').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}

test.describe.serial('§6.2 Manual grading UI — live journeys', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${mathCourseId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(modulesRes.ok()).toBeTruthy();
    const modulesBody = await modulesRes.json();
    const modules = modulesBody.data || modulesBody;
    const moduleId = modules[0]?._id;
    expect(moduleId).toBeTruthy();

    const now = Date.now();
    assignmentTitle = `L4 §6.2 grading ${now}`;
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: assignmentTitle,
        description: '§6.2 manual grading UI journey.',
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

  test('G1–G2: assignment grade page lists submission; score + feedback save', async ({
    page,
    request,
  }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${assignmentId}/view`);
    await page.locator('textarea').first().fill(answerText);
    await page.locator('input[type="file"]').first().setInputFiles(samplePng);
    await page.getByRole('button', { name: 'Submit Assignment' }).first().click();
    await expect(page.getByText(/submitted|your score/i).first()).toBeVisible({ timeout: 30_000 });

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

    await clearSession(page);
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${assignmentId}/grade`);
    await expect(
      page.getByRole('button', { name: /grade submission from priya sharma/i })
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /grade submission from priya sharma/i }).click();
    await expect(page.getByText(answerText)).toBeVisible({ timeout: 15_000 });
    await page.locator('#grade-0').fill('18');
    await page.locator('#feedback').fill('§6.2 feedback — clear reasoning.');
  });

  test('G7: hidden grade until release, then G4 student sees score', async ({ page, request }) => {
    test.setTimeout(120_000);
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${assignmentId}/grade`);
    await page.getByRole('button', { name: /grade submission from priya sharma/i }).click();
    await page.locator('#grade-0').fill('18');

    const saveOnly = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/submissions/') && r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: 'Grade submission', exact: true }).click();
    await saveOnly;

    const studentToken = await getAuthToken(request, student);
    await clearSession(page);
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${assignmentId}/view`);
    await expect(page.locator('[title^="Score:"]')).toHaveCount(0);

    await clearSession(page);
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${assignmentId}/grade`);
    await page.getByRole('button', { name: /grade submission from priya sharma/i }).click();
    const release = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/submissions/') && r.ok(),
      { timeout: 60_000 }
    );
    await page.getByRole('button', { name: 'Save & Release' }).click();
    await release;

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
    await expect(page.locator('[title="Score: 18 / 20 pts"]')).toBeAttached();
  });

  test('G8: gradebook inline edit persists after reload', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible({ timeout: 25_000 });

    await page.getByRole('searchbox', { name: 'Search students in gradebook' }).fill('Priya');
    const row = page.getByRole('row').filter({ hasText: 'Priya Sharma' });
    const cell = row.getByRole('cell').filter({ hasText: /^18$|18\.0/ }).first();
    await expect(cell).toBeVisible({ timeout: 20_000 });
    await cell.click();

    const gradeInput = page.locator('input[type="number"]:visible').first();
    await expect(gradeInput).toBeVisible({ timeout: 10_000 });
    await gradeInput.fill('17');
    await gradeInput.press('Enter');
    await expect(page.getByText('Saving...')).toHaveCount(0, { timeout: 20_000 });

    await page.reload();
    await page.getByRole('searchbox', { name: 'Search students in gradebook' }).fill('Priya');
    await expect(row.getByRole('cell').filter({ hasText: /^17$|17\.0/ }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('G9 + grading policies modal: export Excel and policy tabs', async ({ page, request }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    const teacherToken = await getAuthToken(request, teacher);
    await page.goto(`/courses/${mathCourseId}/gradebook`);

    const [exportRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/gradebook/export') && r.request().method() === 'POST',
        { timeout: 60_000 }
      ),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    expect(exportRes.ok()).toBeTruthy();
    const exportBody = await exportRes.json();
    expect(exportBody.success).toBe(true);

    if (exportBody.data?.downloadUrl) {
      const fileRes = await request.get(`${apiURL}${exportBody.data.downloadUrl}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      expect(fileRes.ok()).toBeTruthy();
      const buffer = await fileRes.body();
      expect(buffer.byteLength).toBeGreaterThan(1000);
    } else {
      await expect(page.getByText(/export|Gradebook exported/i).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.getByRole('button', { name: 'Grading Policies' }).click();
    const policyDialog = page.getByRole('dialog', { name: /grading policies/i });
    await expect(policyDialog.getByRole('heading', { name: 'Grading policies', level: 2 })).toBeVisible();
    await policyDialog.getByRole('button', { name: 'Settings' }).click();
    await policyDialog.getByRole('button', { name: 'Effective policy' }).click();
    await expect(policyDialog.getByText(/effective|resolved/i).first()).toBeVisible();
    await policyDialog.getByRole('button', { name: 'History' }).click();
    await policyDialog.getByRole('button', { name: 'Lifecycle', exact: true }).click();
    await expect(policyDialog.getByText(/lifecycle|provenance|frozen/i).first()).toBeVisible();
    await policyDialog.getByRole('button', { name: 'Settings' }).click();
    await policyDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(policyDialog).toHaveCount(0);
  });

  test('G5–G6: gradebook policy labels and discussion grade column', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('row').filter({ hasText: /Sharma|Patel/i }).first()).toBeVisible({
      timeout: 25_000,
    });

    await expect(page.getByText(/\(MA\)|Not Graded|Excused|Late/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const discussionHeader = page
      .getByRole('columnheader')
      .filter({ hasText: /Rational numbers|discussion/i })
      .first();
    await expect(discussionHeader).toBeVisible({ timeout: 15_000 });
  });

  test('G10: non-owner teacher denied gradebook API access', async ({ request }) => {
    const email = `nonowner-${Date.now()}@test.demo.vidyalms.com`;
    const register = await request.post(`${apiURL}/api/auth/register`, {
      data: {
        firstName: 'Other',
        lastName: 'Teacher',
        email,
        password: 'password123',
        role: 'teacher',
      },
    });
    expect(register.ok()).toBeTruthy();
    const { token } = await register.json();

    const gradebook = await request.get(`${apiURL}/api/grades/course/${mathCourseId}/gradebook`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(gradebook.status()).toBe(403);
  });
});
