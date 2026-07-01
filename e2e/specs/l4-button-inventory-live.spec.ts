import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  rationalThreadId,
  seededQuizId,
  teacher,
  student,
  getAuthToken,
  loginViaForm,
  registerStudent,
} from '../helpers/live-auth';
const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');

let moduleId = '';
let uploadAssignmentId = '';
let freshQuizId = '';
let draftAssignmentId = '';
let editAssignmentId = '';
let deleteGradeAssignmentId = '';
let showRepliesThreadId = '';
let parentReplyId = '';
let tempModuleId = '';
let tempDiscussionId = '';
let tempAssignmentCreateId = '';

function futureDateTimeLocal(hoursFromNow = 48) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pastDateTimeLocal(hoursAgo = 1) {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function enablePlainEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lms:e2e:plain-editor', '1'));
}

async function getFirstModuleId(request: APIRequestContext, token: string) {
  const res = await request.get(`${apiURL}/api/modules/${mathCourseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const modules = body.data || body;
  return modules[0]?._id as string;
}

test.describe.serial('§8.1 Discussion thread controls', () => {
  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    moduleId = await getFirstModuleId(request, teacherToken);

    const title = `L4 §8.1 show replies ${Date.now()}`;
    const create = await request.post(`${apiURL}/api/threads`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        title,
        content: '<p>Parent reply has lazy-loaded children.</p>',
        courseId: getMathCourseId(),
        settings: { allowLikes: true, allowComments: true, requirePostBeforeSee: false },
      },
    });
    expect(create.ok()).toBeTruthy();
    const thread = await create.json();
    showRepliesThreadId = thread.data?._id || thread._id;

    const classmate = await getAuthToken(request, {
      email: 'ananya.iyer@student.demo.vidyalms.com',
      password: 'VedantaDemo8!',
    });
    const parent = await request.post(`${apiURL}/api/threads/${showRepliesThreadId}/replies`, {
      headers: { Authorization: `Bearer ${classmate}` },
      data: {
        content: '<p>Parent main post for show replies.</p>',
        idempotencyKey: `e2e-parent-${Date.now()}`,
      },
    });
    expect(parent.ok()).toBeTruthy();
    const parentBody = await parent.json();
    parentReplyId =
      parentBody.createdReply?._id ||
      parentBody.data?.createdReply?._id ||
      parentBody.data?._id ||
      parentBody._id;
    expect(parentReplyId).toBeTruthy();

    const nested = await request.post(`${apiURL}/api/threads/${showRepliesThreadId}/replies`, {
      headers: { Authorization: `Bearer ${classmate}` },
      data: {
        content: '<p>Nested child for show replies button.</p>',
        parentReply: parentReplyId,
        idempotencyKey: `e2e-nested-${Date.now()}`,
      },
    });
    expect(nested.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (!showRepliesThreadId) return;
    const token = await getAuthToken(request, teacher);
    await request.delete(`${apiURL}/api/threads/${showRepliesThreadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('8.1 — Show replies expands nested children', async ({ page }) => {
    await enablePlainEditor(page);
    await page.route('**/api/replies/*/children', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${showRepliesThreadId}`);
    await expect(page.getByRole('heading', { name: /L4 §8\.1 show replies/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Parent main post for show replies.')).toBeVisible({ timeout: 15_000 });

    const showReplies = page.getByRole('button', { name: /Show replies|Load .* child replies/i }).first();
    await expect(showReplies).toBeVisible({ timeout: 15_000 });

    await page.unroute('**/api/replies/*/children');
    await showReplies.click();
    await expect(page.getByText('Nested child for show replies button.')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('8.1 — Mobile ⋮ menu opens and closes on outside click', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enablePlainEditor(page);
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${rationalThreadId}`);
    await expect(page.getByRole('heading', { name: /rational numbers/i })).toBeVisible({
      timeout: 20_000,
    });

    const ownReply = page.getByRole('article', { name: /Reply by arjun menon/i }).first();
    await ownReply.getByRole('button', { name: /more options/i }).click();
    await expect(ownReply.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await page.getByRole('heading', { name: /rational numbers/i }).click();
    await expect(ownReply.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
  });
});

test.describe.serial('§8.2 Assignment view controls', () => {
  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    moduleId = moduleId || (await getFirstModuleId(request, teacherToken));
    const now = Date.now();
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §8.2 upload ${now}`,
        description: 'Upload and remove file before submit.',
        moduleId,
        totalPoints: '10',
        isOfflineAssignment: 'true',
        allowStudentUploads: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Attach a file.', points: 10 }]),
      },
    });
    expect(create.ok()).toBeTruthy();
    uploadAssignmentId = (await create.json())._id;
    await request.patch(`${apiURL}/api/assignments/${uploadAssignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });

    const quiz = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §8.2 quiz ${now}`,
        description: 'Fresh quiz for start screen.',
        moduleId,
        totalPoints: '5',
        isGradedQuiz: 'true',
        isTimedQuiz: 'true',
        quizTimeLimit: '15',
        displayMode: 'scrollable',
        showCorrectAnswers: 'true',
        gradeReleaseMode: 'immediate',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([
          {
            type: 'multiple-choice',
            text: 'Pick one.',
            points: 5,
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: false },
            ],
          },
        ]),
      },
    });
    expect(quiz.ok()).toBeTruthy();
    freshQuizId = (await quiz.json())._id;
    await request.patch(`${apiURL}/api/assignments/${freshQuizId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    if (uploadAssignmentId) {
      await request.delete(`${apiURL}/api/assignments/${uploadAssignmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (freshQuizId) {
      await request.delete(`${apiURL}/api/assignments/${freshQuizId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('8.2 — Upload file and remove before submit', async ({ page, request }) => {
    const temp = await registerStudent(request, 'UploadRemove');
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });
    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${uploadAssignmentId}/view`);
    await page.locator('textarea').first().fill('Answer with attachment.');
    await page.locator('input[type="file"]').first().setInputFiles(samplePng);
    await expect(page.getByText('regression-sample.png')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Remove regression-sample\.png/i }).click();
    await expect(page.getByText('regression-sample.png')).toHaveCount(0);
  });

  test('8.2 — Start quiz, timer, and mobile question chrome', async ({ page, request }) => {
    const temp = await registerStudent(request, 'QuizChrome');
    const teacherToken = await getAuthToken(request, teacher);
    const enroll = await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });
    expect(enroll.ok()).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${freshQuizId}/view`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });

    const startResponse = page.waitForResponse(
      (r) => r.url().includes(`/assignments/${freshQuizId}/quiz/start`) && r.ok()
    );
    await page.getByRole('button', { name: /Start quiz/i }).click();
    await startResponse;

    await expect(page.getByText(/\d+:\d+/).first()).toBeVisible({ timeout: 10_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: /Submit Quiz/i })).toBeVisible({ timeout: 20_000 });
    const questionNav = page.getByRole('button', { name: /Go to question \d+/i }).first();
    if (await questionNav.isVisible().catch(() => false)) {
      await questionNav.click();
      await expect(page.getByRole('dialog', { name: 'Question list' })).toBeVisible();
      await page.getByRole('button', { name: 'Close question list' }).click();
    }
  });
});

test.describe.serial('§8.3–8.4 Assignment edit & grade controls', () => {
  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    moduleId = moduleId || (await getFirstModuleId(request, teacherToken));
    const now = Date.now();

    const draft = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §8.3 draft ${now}`,
        description: 'Unpublished draft for publish toggle.',
        moduleId,
        totalPoints: '5',
        isOfflineAssignment: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Draft question.', points: 5 }]),
      },
    });
    expect(draft.ok()).toBeTruthy();
    draftAssignmentId = (await draft.json())._id;

    const editable = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §8.3 edit ${now}`,
        description: 'Original description.',
        moduleId,
        totalPoints: '5',
        isOfflineAssignment: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Edit me.', points: 5 }]),
      },
    });
    expect(editable.ok()).toBeTruthy();
    editAssignmentId = (await editable.json())._id;
    await request.patch(`${apiURL}/api/assignments/${editAssignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });

    const gradeable = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      multipart: {
        title: `L4 §8.4 delete ${now}`,
        description: 'For delete submission confirm.',
        moduleId,
        totalPoints: '5',
        isOfflineAssignment: 'true',
        gradeReleaseMode: 'manual',
        availableFrom: new Date(now - 86_400_000).toISOString(),
        dueDate: new Date(now + 86_400_000 * 30).toISOString(),
        questions: JSON.stringify([{ type: 'text', text: 'Delete test.', points: 5 }]),
      },
    });
    expect(gradeable.ok()).toBeTruthy();
    deleteGradeAssignmentId = (await gradeable.json())._id;
    await request.patch(`${apiURL}/api/assignments/${deleteGradeAssignmentId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });

  test.afterAll(async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    for (const id of [draftAssignmentId, editAssignmentId, deleteGradeAssignmentId]) {
      if (id) {
        await request.delete(`${apiURL}/api/assignments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });

  test('8.3 — Publish from draft on assignment view', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${draftAssignmentId}/view`);
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible({ timeout: 20_000 });
    const publish = page.waitForResponse(
      (r) => r.url().includes('/publish') && r.request().method() === 'PATCH' && r.ok()
    );
    await page.getByRole('button', { name: 'Publish' }).click();
    await publish;
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible({ timeout: 10_000 });
  });

  test('8.3 — Live update assignment save', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${editAssignmentId}/edit`);
    await expect(page.locator('#assignment-title')).toBeVisible({ timeout: 20_000 });
    const updatedTitle = `L4 §8.3 updated ${Date.now()}`;
    await page.locator('#assignment-title').fill(updatedTitle);
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    const update = page.waitForResponse(
      (r) => r.url().includes(`/api/assignments/${editAssignmentId}`) && r.request().method() === 'PUT' && r.ok()
    );
    const leaveEditPage = page.waitForURL((url) => !url.pathname.endsWith('/edit'), { timeout: 15_000 });
    await page.getByRole('button', { name: 'Update assignment' }).click();
    await Promise.all([update, leaveEditPage]);
    await page.goto(`/assignments/${editAssignmentId}/edit`);
    await expect(page.locator('#assignment-title')).toHaveValue(updatedTitle);
  });

  test('8.4 — Save & Release and delete submission confirm', async ({ page, request }) => {
    const temp = await registerStudent(request, 'DeleteSub');
    const teacherToken = await getAuthToken(request, teacher);
    await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll-teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { studentId: temp.userId },
    });

    await loginViaForm(page, temp.email, temp.password);
    await page.goto(`/assignments/${deleteGradeAssignmentId}/view`);
    await page.locator('textarea').first().fill('Submission to delete.');
    await page.getByRole('button', { name: 'Submit Assignment' }).first().click();
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 30_000 });

    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/assignments/${deleteGradeAssignmentId}/grade`);
    await page.getByRole('button', { name: /grade submission from e2e deletesub/i }).click();
    await page.locator('#grade-0').fill('4');
    await page.getByRole('button', { name: 'Save & Release' }).click();
    await expect(page.getByText(/saved|released/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Delete submission' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Delete submission' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(/no submissions|0 submissions/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe.serial('§8.5 Gradebook controls', () => {
  test('8.5 — Filter periods, export, cell edit, open submission link', async ({ page, request }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible({ timeout: 25_000 });

    await page.getByRole('button', { name: /Needs grading/i }).click();
    await expect(page.getByText(/Showing \d+ of \d+ students/i)).toBeVisible();
    await page.getByRole('button', { name: 'All', exact: true }).click();

    const [exportRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/gradebook/export') && r.ok()),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    expect(exportRes.ok()).toBeTruthy();

    await page.getByRole('searchbox', { name: 'Search students in gradebook' }).fill('Priya');
    const row = page.getByRole('row').filter({ hasText: 'Priya Sharma' });
    const scoredCell = row.getByRole('cell').filter({ hasText: /^\d+$|^\d+\.\d+$/ }).first();
    await scoredCell.click();
    const gradeInput = page.locator('input[type="number"]:visible').first();
    if (await gradeInput.isVisible().catch(() => false)) {
      await gradeInput.fill('16');
      await gradeInput.press('Enter');
    }

    await page.getByRole('searchbox', { name: 'Search students in gradebook' }).fill('');
    const kabirRow = page.getByRole('row').filter({ hasText: 'Kabir Joshi' });
    const openCell = kabirRow.getByRole('cell').filter({ hasText: /No Submission|Not Graded|—/i }).first();
    await openCell.click();
    await expect(page).toHaveURL(new RegExp(`/assignments/|/threads/`), { timeout: 15_000 });
  });
});

test.describe.serial('§8.6 Course builder controls', () => {
  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    moduleId = moduleId || (await getFirstModuleId(request, teacherToken));
  });

  test.afterAll(async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    if (tempModuleId) {
      await request.delete(`${apiURL}/api/modules/${tempModuleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (tempDiscussionId) {
      await request.delete(`${apiURL}/api/threads/${tempDiscussionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (tempAssignmentCreateId) {
      await request.delete(`${apiURL}/api/assignments/${tempAssignmentCreateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('8.6 — Add module, publish toggle, delete confirm cancel', async ({ page, request }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/modules`);

    const moduleTitle = `L4 §8.6 module ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Module' }).click();
    await page.locator('form').filter({ has: page.getByRole('button', { name: 'Create module' }) }).locator('#title').fill(moduleTitle);
    const modRes = page.waitForResponse((r) => r.url().includes('/api/modules') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create module' }).click();
    const modBody = await (await modRes).json();
    tempModuleId = modBody.data?._id || modBody._id;

    const moduleHeading = page.getByRole('heading', { name: moduleTitle, level: 3 });
    await expect(moduleHeading).toBeVisible();
    await moduleHeading.click();

    const moduleRow = page.locator('div.flex.cursor-pointer').filter({ has: moduleHeading });
    const publishBtn = moduleRow.getByRole('button', { name: /Publish Module|Unpublish Module/i }).first();
    await publishBtn.click();
    await page.waitForTimeout(500);
    await publishBtn.click();

    await moduleRow.getByRole('button', { name: 'Delete Module' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: moduleTitle, level: 3 })).toBeVisible();
  });

  test('8.6 — Create assignment and discussion from course UI', async ({ page, request }) => {
    test.setTimeout(120_000);
    await enablePlainEditor(page);
    await loginViaForm(page, teacher.email, teacher.password);

    await page.goto(`/courses/${mathCourseId}/assignments`);
    await page.getByRole('button', { name: '+ Create Assignment' }).click();
    const assignmentTitle = `L4 §8.6 assignment ${Date.now()}`;
    await expect(page.locator('#assignment-title')).toBeVisible({ timeout: 20_000 });
    await page.locator('#assignment-title').fill(assignmentTitle);
    await page.getByRole('combobox', { name: /^Module/i }).selectOption({ label: 'Rational Numbers' });
    await page.locator('#isOfflineAssignment').check();
    await page.locator('[name="availableFrom"]').fill(pastDateTimeLocal());
    await page.locator('[name="dueDate"]').fill(futureDateTimeLocal());
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    await expect(page.locator('#assignment-description')).toBeVisible({ timeout: 10_000 });
    await page.locator('#assignment-description').fill('Created from course builder.');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#totalPoints').fill('5');
    const createRes = page.waitForResponse(
      (r) => r.url().includes('/api/assignments') && r.request().method() === 'POST' && r.ok()
    );
    await page.getByRole('button', { name: 'Create assignment' }).click();
    const created = await (await createRes).json();
    tempAssignmentCreateId = created._id || created.id;
    await expect(page).toHaveURL(new RegExp(`/courses/${mathCourseId}/modules\\?expand=`), {
      timeout: 20_000,
    });
    await page.goto(`/assignments/${tempAssignmentCreateId}/view`);
    await expect(page.getByRole('heading', { name: assignmentTitle })).toBeVisible({ timeout: 15_000 });

    await page.goto(`/courses/${mathCourseId}/discussions`);
    await page.getByRole('button', { name: '+ Create New Thread' }).click();
    await expect(page.locator('#create-thread-form')).toBeVisible({ timeout: 15_000 });
    const discussionTitle = `L4 §8.6 discussion ${Date.now()}`;
    await page.locator('#title').fill(discussionTitle);
    await page
      .getByRole('textbox', { name: /discussion rich text editor|Write your thread content/i })
      .fill('Discussion from §8.6.');
    const threadRes = page.waitForResponse(
      (r) => r.url().includes('/api/threads') && r.request().method() === 'POST' && r.ok()
    );
    await page.getByRole('button', { name: 'Create Thread' }).click();
    const threadBody = await (await threadRes).json();
    tempDiscussionId = threadBody.data?._id || threadBody._id;
    await expect(page.getByRole('heading', { name: discussionTitle })).toBeVisible({ timeout: 15_000 });
  });
});
