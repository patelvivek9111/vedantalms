import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { apiURL, mathCourseId, getMathCourseId, teacher, student, loginViaForm, clearSession } from '../helpers/live-auth';
const classmate = { email: 'ananya.iyer@student.demo.vidyalms.com', password: 'VedantaDemo8!' };

const MAIN_REPLY = 'L4 §5.1 main reply from Arjun';
const NESTED_REPLY = 'L4 §5.1 nested reply to classmate';
const MAIN_EDITED = `${MAIN_REPLY} [edited §5.1]`;
const NESTED_EDITED = `${NESTED_REPLY} [edited §5.1]`;

let threadId = '';
let classmateReplyId = '';
let nestedReplyId = '';

async function getAuthToken(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  return body.token as string;
}

async function enablePlainEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lms:e2e:plain-editor', '1'));
}

async function gotoThread(page: Page) {
  await page.goto(`/courses/${mathCourseId}/threads/${threadId}`);
  await expect(page.getByRole('heading', { name: /L4 §5\.1/i })).toBeVisible({ timeout: 20_000 });
}

async function openComposer(page: Page) {
  const start = page.getByRole('button', { name: /start the discussion/i });
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  }
}

async function fillComposer(page: Page, text: string) {
  const editor = page.getByRole('textbox', {
    name: /discussion rich text editor|share your thoughts|edit your reply/i,
  });
  await editor.fill(text);
}

async function saveOpenEditForm(page: Page, text: string) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save Changes' }) });
  await form.getByRole('textbox', { name: /edit your reply/i }).fill(text);
  await form.getByRole('button', { name: 'Save Changes' }).click();
  await expect(form).toHaveCount(0, { timeout: 15_000 });
}

async function postReply(page: Page) {
  await page.getByRole('button', { name: /post reply/i }).click();
}

test.describe.serial('§5.1 Discussion — live API journey', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const classmateToken = await getAuthToken(request, classmate);
    const title = `L4 §5.1 ${Date.now()}`;

    const create = await request.post(`${apiURL}/api/threads`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        title,
        content: '<p>Post one worked example, then comment on a classmate.</p>',
        courseId: getMathCourseId(),
        isGraded: true,
        totalPoints: 10,
        discussionReleaseMode: 'hidden',
        settings: { allowLikes: true, allowComments: true, requirePostBeforeSee: false },
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    threadId = created.data?._id || created.data?.id || created._id;

    const anchor = await request.post(`${apiURL}/api/threads/${threadId}/replies`, {
      headers: { Authorization: `Bearer ${classmateToken}` },
      data: {
        content: '<p>Classmate anchor main post for nesting.</p>',
        idempotencyKey: `e2e-anchor-${Date.now()}`,
      },
    });
    expect(anchor.ok(), await anchor.text()).toBeTruthy();
    const anchorBody = await anchor.json();
    classmateReplyId =
      anchorBody.createdReply?._id ||
      anchorBody.data?.replies?.find((r: { author?: { email?: string } }) =>
        r.author?.email?.includes('ananya')
      )?._id;
  });

  test.afterAll(async ({ request }) => {
    if (!threadId) return;
    const teacherToken = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test('student: post main reply and persist after refresh', async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, student.email, student.password);
    await gotoThread(page);
    await openComposer(page);
    await fillComposer(page, MAIN_REPLY);
    await postReply(page);
    await expect(page.getByText(MAIN_REPLY)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(MAIN_REPLY)).toBeVisible({ timeout: 15_000 });
  });

  test('student: nested reply to classmate main post', async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, student.email, student.password);
    await gotoThread(page);
    await page.getByRole('button', { name: /reply to ananya/i }).click();
    await fillComposer(page, NESTED_REPLY);
    await postReply(page);
    await expect(page.getByText(NESTED_REPLY)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(NESTED_REPLY)).toBeVisible({ timeout: 15_000 });
  });

  test('student: edit main and nested replies', async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, student.email, student.password);
    await gotoThread(page);

    const mainReply = page.getByRole('article', {
      name: /^Reply by arjun menon, level 1$/i,
    });
    await mainReply.getByRole('button', { name: /more options/i }).click();
    await mainReply.getByRole('menuitem', { name: 'Edit' }).click();
    await saveOpenEditForm(page, MAIN_EDITED);
    await expect(page.getByText(MAIN_EDITED)).toBeVisible({ timeout: 15_000 });
    await expect(mainReply.getByText('(edited)')).toBeVisible({ timeout: 10_000 });

    const nestedReply = page.getByRole('article', {
      name: /^Reply by arjun menon, level 2$/i,
    });
    await nestedReply.getByRole('button', { name: /more options/i }).click();
    await nestedReply.getByRole('menuitem', { name: 'Edit' }).click();
    await saveOpenEditForm(page, NESTED_EDITED);
    await expect(page.getByText(NESTED_EDITED)).toBeVisible({ timeout: 15_000 });
    await expect(nestedReply.getByText('(edited)')).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(mainReply.getByText(MAIN_EDITED)).toBeVisible();
    await expect(nestedReply.getByText(NESTED_EDITED)).toBeVisible();
  });

  test('student: delete nested only; main delete blocked; like rules', async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, student.email, student.password);
    await gotoThread(page);

    const mainReply = page.getByRole('article', {
      name: /^Reply by arjun menon, level 1$/i,
    });
    await mainReply.getByRole('button', { name: /more options/i }).click();
    await expect(mainReply.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const nestedReply = page.getByRole('article', {
      name: /^Reply by arjun menon, level 2$/i,
    });
    await nestedReply.getByRole('button', { name: /more options/i }).click();
    await nestedReply.getByRole('menuitem', { name: 'Delete' }).click();
    const deleteDialog = page.getByRole('dialog', { name: /delete reply/i });
    await expect(deleteDialog).toBeVisible();
    const deleteResponse = page.waitForResponse(
      (resp) =>
        resp.request().method() === 'DELETE' &&
        resp.url().includes('/replies/') &&
        resp.ok()
    );
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await deleteResponse;
    await expect(nestedReply).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await expect(nestedReply).toHaveCount(0);
    await expect(mainReply.getByText(MAIN_EDITED)).toBeVisible();

    const likeClassmate = page.getByRole('button', {
      name: /like reply by ananya iyer/i,
    });
    await likeClassmate.click();
    await expect(likeClassmate).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(likeClassmate).toHaveAttribute('aria-pressed', 'true');

    await expect(
      page.getByRole('button', { name: /like reply by arjun menon/i })
    ).toHaveCount(0);
  });

  test('teacher: pin, lock, hide/restore, and grade discussion', async ({ page, request }) => {
    test.setTimeout(120_000);
    await loginViaForm(page, teacher.email, teacher.password);
    await gotoThread(page);

    const pinBtn = page.getByRole('button', { name: /pin discussion/i });
    await pinBtn.click();
    await expect(page.getByText('Pinned')).toBeVisible({ timeout: 10_000 });

    const lockBtn = page.getByRole('button', { name: /lock discussion/i });
    await lockBtn.click();
    await expect(page.locator('span.text-xs.font-medium', { hasText: 'Locked' })).toBeVisible({
      timeout: 10_000,
    });

    const teacherToken = await getAuthToken(request, teacher);
    const locked = await request.get(`${apiURL}/api/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(locked.ok()).toBeTruthy();
    const lockedBody = await locked.json();
    expect(lockedBody.data?.locked ?? lockedBody.data?.workflowState?.locked).toBeTruthy();

    await enablePlainEditor(page);
    await clearSession(page);
    await loginViaForm(page, student.email, student.password);
    await gotoThread(page);
    await expect(
      page.getByText('This discussion is read-only because it is locked.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /start the discussion/i })).toHaveCount(0);

    await clearSession(page);
    await loginViaForm(page, teacher.email, teacher.password);
    await gotoThread(page);
    await page.getByRole('button', { name: /unlock discussion/i }).click();
    await expect(page.locator('span.text-xs.font-medium', { hasText: 'Locked' })).toHaveCount(0);

    await page
      .getByRole('button', { name: /more options for reply by ananya iyer/i })
      .click();
    await page.getByRole('menuitem', { name: 'Hide' }).click();
    await expect(page.getByText(/hidden|moderated/i).first()).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole('button', { name: /more options for reply by ananya iyer/i })
      .click();
    await page.getByRole('menuitem', { name: 'Restore' }).click();

    await page.getByRole('heading', { name: 'Student Grades' }).scrollIntoViewIfNeeded();
    const arjunRow = page.getByRole('row').filter({ hasText: 'Arjun Menon' });
    await arjunRow.getByRole('button', { name: /edit grade|add grade/i }).click();
    await page.locator('#grade').fill('8');
    const gradeResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes(`/threads/${threadId}/grade`) &&
        r.ok()
    );
    await page.getByRole('button', { name: /submit grade/i }).click();
    const gradeRes = await gradeResponse;
    const gradeBody = await gradeRes.json();
    expect(gradeBody.success).toBeTruthy();

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/threads/${threadId}?includeGrades=true`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          if (!res.ok()) return null;
          const data = (await res.json()).data;
          const arjunGrade = data?.studentGrades?.find(
            (g: { student?: { firstName?: string } }) => g.student?.firstName === 'Arjun'
          );
          return arjunGrade?.grade;
        },
        { timeout: 15_000 }
      )
      .toBe(8);
  });
});
