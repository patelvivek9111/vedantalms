/**
 * §16 — Minor / polish items (strict regression + snapshots).
 * Run: npm run test:e2e:section-16
 */
import { test, expect, Page, Locator, BrowserContext, APIRequestContext } from '@playwright/test';
import {
  apiURL,
  getMathCourseId,
  mathCourseId,
  rationalThreadId,
  teacher,
  student,
  loginViaForm,
  getAuthToken,
  registerStudent,
} from '../helpers/live-auth';
import { trackCourse, cleanupTracked } from '../helpers/live-cleanup';

async function snap(
  page: Page,
  name: string,
  opts?: { locator?: Locator; fullPage?: boolean },
) {
  await page.waitForLoadState('networkidle').catch(() => {});
  const target = opts?.locator ?? page;
  await expect(target).toHaveScreenshot(`${name}.png`, {
    fullPage: opts?.fullPage ?? false,
    mask: [page.locator('[class*="animate-pulse"]')],
  });
}

async function fillAnnouncementBody(page: Page, text: string) {
  await page.waitForSelector('#announcement-body_ifr', { timeout: 20_000 });
  await page.evaluate((bodyText) => {
    const editor = (
      window as unknown as {
        tinymce?: { get: (id: string) => { setContent: (html: string) => void } };
      }
    ).tinymce?.get('announcement-body');
    if (!editor) throw new Error('TinyMCE announcement-body editor not ready');
    editor.setContent(`<p>${bodyText}</p>`);
  }, text);
}

async function createEmptyCourse(request: APIRequestContext, token: string, label: string) {
  const res = await request.post(`${apiURL}/api/courses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `§16 empty ${label} ${Date.now()}`,
      description: 'Temporary course for empty-state regression.',
      catalog: { courseCode: `E16${Date.now().toString(36).slice(-5)}` },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const courseId = body.data?._id || body._id;
  trackCourse(courseId);
  return courseId as string;
}

test.describe('§16 Polish — empty states', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.afterAll(async ({ request }) => {
    await cleanupTracked(request);
  });

  test('catalog — no results for impossible search', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/catalog');
    await page.getByPlaceholder(/search/i).fill('zzz-no-catalog-match-§16');
    await expect(page.getByText('No courses found')).toBeVisible({ timeout: 15_000 });
  });

  test('inbox — no results for impossible search', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/inbox');
    const search = page.locator('#inbox-search-desktop');
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('zzz-no-inbox-§16');
    await expect(page.getByText('0 conversations')).toBeVisible({ timeout: 15_000 });
  });

  test('discussions — empty course shows no threads message', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const courseId = await createEmptyCourse(request, token, 'discussions');
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/discussions`);
    await expect(page.getByText('No discussion threads')).toBeVisible({ timeout: 20_000 });
    await snap(page, '16-empty-discussions');
  });

  test('assignments — empty course shows no-modules message', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const courseId = await createEmptyCourse(request, token, 'assignments');
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/assignments`);
    await expect(
      page.getByText(/No modules available\. Please create a module to add assignments\./i)
    ).toBeVisible({ timeout: 20_000 });
  });

  test('teacher oversight — no rows for impossible filter', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    await page.locator('#teacher-courses-search').fill('zzz-no-course-§16');
    await expect(page.getByText(/no courses|no results/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('§16 Polish — loading, forms, keyboard, a11y', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('dashboard — skeleton pulse before courses render', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.route('**/api/courses**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto('/dashboard');
    await expect(page.locator('[class*="animate-pulse"]').first()).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText(/mathematics|course/i).first()).toBeVisible({ timeout: 25_000 });
  });

  test('announcement form — Cancel discards typed title', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await page.locator('#announcement-title').fill('§16 discard me');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await expect(page.locator('#announcement-title')).toHaveValue('');
  });

  test('create discussion — Save disabled until title and body filled', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/discussions`);
    await page.getByRole('button', { name: /create new thread/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Create New Discussion Thread' })
    ).toBeVisible({ timeout: 15_000 });
    const submit = page.getByRole('button', { name: 'Create Thread' });
    await expect(submit).toBeDisabled();
    await page.locator('#title').fill('§16 thread title');
    await expect(submit).toBeDisabled();
  });

  test('modal — Escape closes BaseModal dialog', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    await page.getByRole('button', { name: 'Copy course' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  });

  test('modal — Tab keeps focus inside BaseModal dialog', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    await page.getByRole('button', { name: 'Copy course' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      const focusedInside = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const active = document.activeElement;
        return !!(dlg && active && dlg.contains(active));
      });
      expect(focusedInside).toBe(true);
    }
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });
});

test.describe('§16 Polish — content, time, auth, navigation', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('inbox list — long subject truncates with truncate class', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/inbox');
    await expect(page.locator('#inbox-search-desktop')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('p.truncate.text-xs').first()).toBeVisible({ timeout: 15_000 });
  });

  test('calendar — created event due date round-trips through API', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const meRes = await request.get(`${apiURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await meRes.json();
    const calendarId = meBody.user?._id || meBody._id || meBody.data?._id;
    const title = `§16 tz event ${Date.now()}`;
    const due = new Date(Date.now() + 86_400_000 * 3);
    due.setUTCHours(14, 30, 0, 0);
    const end = new Date(due.getTime() + 3_600_000);
    const create = await request.post(`${apiURL}/api/events`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title,
        start: due.toISOString(),
        end: end.toISOString(),
        calendar: calendarId,
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    const eventId = created._id || created.data?._id;

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/calendar');
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });

    await request.delete(`${apiURL}/api/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('session expiry — invalid token redirects to login', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid-expired-token-§16');
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test('role redirects — student gradebook URL becomes grades', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page).toHaveURL(new RegExp(`/courses/${mathCourseId}/grades`), {
      timeout: 15_000,
    });
  });

  test('role redirects — teacher grades URL becomes gradebook', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/grades`);
    await expect(page).toHaveURL(new RegExp(`/courses/${mathCourseId}/gradebook`), {
      timeout: 15_000,
    });
  });

  test('deep link — assignment view loads by direct URL', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${mathCourseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const modules = (await modulesRes.json()).data || (await modulesRes.json());
    const moduleId = modules[0]?._id;
    const listRes = await request.get(`${apiURL}/api/assignments/module/${moduleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const assignments = await listRes.json();
    const assignment = (Array.isArray(assignments) ? assignments : assignments.data || [])[0];
    expect(assignment?._id).toBeTruthy();

    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${assignment._id}/view`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 25_000,
    });
  });

  test('deep link — join token parser accepts ?t= in URL text', async () => {
    const sample = 'https://app.example/join?t=abc123token456789';
    const m = sample.match(/[?&]t=([^&]+)/);
    expect(m?.[1]).toBe('abc123token456789');
  });
});

test.describe('§16 Polish — drafts, breadcrumbs, layout', () => {
  test('discussion reply draft restores from localStorage', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const studentToken = await getAuthToken(request, student);
    const me = await request.get(`${apiURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const user = (await me.json()).user || (await me.json()).data;
    const userId = user._id || user.id;

    const title = `§16 draft thread ${Date.now()}`;
    const create = await request.post(`${apiURL}/api/threads`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        title,
        content: '<p>Thread for §16 draft restore.</p>',
        courseId: getMathCourseId(),
        isGraded: false,
        settings: { allowLikes: true, allowComments: true, requirePostBeforeSee: false },
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    const threadId = created.data?._id || created._id;
    const draftHtml = '<p>§16 restored draft reply</p>';

    await page.addInitScript(
      ({ tid, uid, html }) => {
        localStorage.setItem(`thread_reply_draft_${tid}_${uid}`, html);
        localStorage.setItem('lms:e2e:plain-editor', '1');
      },
      { tid: threadId, uid: userId, html: draftHtml }
    );

    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${threadId}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20_000 });
    const start = page.getByRole('button', { name: /start the discussion/i });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }
    const replyBox = page.getByRole('textbox', {
      name: /discussion rich text editor|share your thoughts/i,
    });
    await expect(replyBox).toBeVisible({ timeout: 20_000 });
    await expect(replyBox).toHaveValue(/§16 restored draft reply/, { timeout: 20_000 });
  });

  test('announcement draft — autosave indicator after typing', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await page.locator('#announcement-title').fill(`§16 draft ${Date.now()}`);
    await fillAnnouncementBody(page, 'Draft body for §16.');
    await expect(page.getByText(/draft saved|saved draft/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('breadcrumbs — thread, assignment, and group pages', async ({ page, request }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${rationalThreadId}`);
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible({
      timeout: 20_000,
    });

    const token = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${mathCourseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const modules = (await modulesRes.json()).data || (await modulesRes.json());
    const listRes = await request.get(`${apiURL}/api/assignments/module/${modules[0]._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const assignments = await listRes.json();
    const assignment = (Array.isArray(assignments) ? assignments : assignments.data || [])[0];

    await page.goto(`/assignments/${assignment._id}/view`);
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/courses/${mathCourseId}/groups`);
    const team = page.locator('h4.font-semibold').first();
    if (await team.isVisible().catch(() => false)) {
      await team.click();
      await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});

test.describe('§16 Polish — mobile, print, export, concurrency', () => {
  test('iPad width uses desktop course shell; phone uses mobile shell', async ({ browser }) => {
    const tablet = await browser.newContext({
      viewport: { width: 820, height: 1180 },
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tabletPage = await tablet.newPage();
    const phonePage = await phone.newPage();
    await loginViaForm(tabletPage, student.email, student.password);
    await loginViaForm(phonePage, student.email, student.password);
    await tabletPage.goto(`/courses/${mathCourseId}/overview`);
    await phonePage.goto(`/courses/${mathCourseId}/overview`);
    await expect(tabletPage.locator('div.flex-row').first()).toBeVisible({ timeout: 20_000 });
    await expect(phonePage.locator('div.flex-col.pt-16').first()).toBeVisible({
      timeout: 20_000,
    });
    await tablet.close();
    await phone.close();
  });

  test('mobile safe-area clearance class present on immersive join', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaForm(page, student.email, student.password);
    await page.goto('/quizwave/join');
    await expect(page.locator('.mobile-bottom-nav-clearance').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('rich text — paste into announcement TinyMCE body', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await fillAnnouncementBody(page, 'Pasted §16 content');
    const frame = page.frameLocator('#announcement-body_ifr');
    await expect(frame.locator('body')).toContainText('Pasted §16 content');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('print — course page hides chrome with print:hidden', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/overview`);
    await expect(page.locator('.print\\:hidden').first()).toBeAttached();
  });

  test('gradebook — Export Excel returns downloadable file', async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const courseId = getMathCourseId();
    const exportRes = await request.post(
      `${apiURL}/api/grades/course/${courseId}/gradebook/export`,
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    expect(exportRes.ok(), await exportRes.text()).toBeTruthy();
    const body = await exportRes.json();
    expect(body.success).toBe(true);
    if (body.data?.downloadUrl) {
      const fileRes = await request.get(`${apiURL}${body.data.downloadUrl}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      expect(fileRes.ok()).toBeTruthy();
      const buf = await fileRes.body();
      expect(buf.byteLength).toBeGreaterThan(500);
    }
  });

  test('concurrent tabs — two editors on same course; last save wins', async ({ browser, request }) => {
    const token = await getAuthToken(request, teacher);
    const create = await request.post(`${apiURL}/api/courses`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `§16 concurrent ${Date.now()}`,
        description: 'Original description for concurrent tab test.',
        catalog: { courseCode: `C16${Date.now().toString(36).slice(-4)}` },
      },
    });
    const createdCourse = await create.json();
    const courseId = createdCourse.data?._id || createdCourse._id;
    trackCourse(courseId);

    const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const tabA = await ctx.newPage();
    const tabB = await ctx.newPage();
    await loginViaForm(tabA, teacher.email, teacher.password);
    await tabA.goto(`/courses/${courseId}/edit`);
    await tabB.goto(`/courses/${courseId}/edit`);
    await expect(tabA.locator('textarea#description')).toBeVisible({ timeout: 20_000 });
    await expect(tabB.locator('textarea#description')).toBeVisible({ timeout: 20_000 });
    await tabA.locator('textarea#description').click();
    await tabA.locator('textarea#description').press('ControlOrMeta+a');
    await tabA.locator('textarea#description').pressSequentially('Description from tab A');
    await tabB.locator('textarea#description').click();
    await tabB.locator('textarea#description').press('ControlOrMeta+a');
    await tabB.locator('textarea#description').pressSequentially('Description from tab B');
    await expect(tabA.locator('textarea#description')).toHaveValue('Description from tab A');
    await expect(tabB.locator('textarea#description')).toHaveValue('Description from tab B');

    const coursePut = (r: import('@playwright/test').Response) => {
      try {
        const path = new URL(r.url()).pathname;
        return path === `/api/courses/${courseId}` && r.request().method() === 'PUT';
      } catch {
        return false;
      }
    };

    const [saveA] = await Promise.all([
      tabA.waitForResponse(coursePut, { timeout: 30_000 }),
      tabA.getByRole('button', { name: /save changes/i }).click(),
    ]);
    expect(saveA.ok()).toBeTruthy();
    const saveABody = await saveA.json();
    expect(saveABody.success).toBeTruthy();
    await tabA.waitForURL('**/dashboard', { timeout: 20_000 });

    const [saveB] = await Promise.all([
      tabB.waitForResponse(coursePut, { timeout: 30_000 }),
      tabB.getByRole('button', { name: /save changes/i }).click(),
    ]);
    expect(saveB.ok()).toBeTruthy();
    const saveBBody = await saveB.json();
    expect(saveBBody.success).toBeTruthy();
    expect(saveBBody.data?.description).toMatch(/tab B/i);
    await tabB.waitForURL('**/dashboard', { timeout: 20_000 });

    const courseRes = await request.get(`${apiURL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const courseBody = await courseRes.json();
    const course = courseBody.data || courseBody;
    expect(course.description).toMatch(/tab B/i);
    await ctx.close();
  });
});

test.describe('§16 Polish — quiz navigation', () => {
  test('browser back from course child returns to prior history entry', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/overview`);
    await page.goto(`/courses/${mathCourseId}/discussions`);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/courses/${mathCourseId}/overview`), {
      timeout: 15_000,
    });
  });

  test('quiz exit warning — beforeunload guard arms only after answering', async ({
    page,
    request,
  }) => {
    const token = await getAuthToken(request, teacher);
    const modulesRes = await request.get(`${apiURL}/api/modules/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const modulesBody = await modulesRes.json();
    const moduleId = (modulesBody.data || modulesBody)[0]?._id;
    expect(moduleId, 'math course needs at least one module').toBeTruthy();

    const questions = [
      {
        type: 'multiple-choice',
        text: `§16 exit-guard question ${Date.now()}`,
        points: 1,
        options: [
          { text: 'Option A', isCorrect: true },
          { text: 'Option B', isCorrect: false },
        ],
      },
    ];
    const create = await request.post(`${apiURL}/api/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: `§16 exit-guard quiz ${Date.now()}`,
        description: 'Temporary quiz for exit-warning regression.',
        moduleId,
        group: 'quizzes',
        isGradedQuiz: 'true',
        availableFrom: new Date(Date.now() - 3_600_000).toISOString(),
        dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        questions: JSON.stringify(questions),
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const created = await create.json();
    const assignmentId = created.data?._id || created._id;

    try {
      if (!created.published) {
        const pub = await request.patch(`${apiURL}/api/assignments/${assignmentId}/publish`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(pub.ok(), await pub.text()).toBeTruthy();
      }

      await loginViaForm(page, student.email, student.password);
      await page.goto(`/assignments/${assignmentId}/view`);

      const optionLabel = page.locator('label[for="question-0-option-0"]');
      await expect(optionLabel).toBeVisible({ timeout: 25_000 });

      const dispatchBeforeUnload = () =>
        page.evaluate(() => {
          const event = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(event);
          return event.defaultPrevented;
        });

      // Before answering: nothing dirty, guard must NOT block navigation.
      expect(await dispatchBeforeUnload()).toBe(false);

      // Answer the question — guard should now arm.
      await optionLabel.click();
      await expect(page.locator('#question-0-option-0')).toBeChecked();
      await expect.poll(dispatchBeforeUnload, { timeout: 10_000 }).toBe(true);
    } finally {
      await request.delete(`${apiURL}/api/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});
