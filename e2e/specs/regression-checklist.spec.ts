import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { apiURL, mathCourseId, student, teacher, loginViaForm } from '../helpers/live-auth';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');

async function getAuthToken(
  request: import('@playwright/test').APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  return token as string;
}

/** CDP touch swipe — synthetic TouchEvent does not satisfy PullToRefresh's passive listeners reliably. */
async function simulatePullToRefresh(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const container = page.locator('.touch-pan-y').first();
  await container.waitFor({ state: 'visible' });
  const box = await container.boundingBox();
  if (!box) throw new Error('Pull-to-refresh container has no layout box');

  const x = box.x + box.width / 2;
  const startY = box.y + 30;
  const endY = startY + 200; // deltaY 200 × 0.5 resistance ≥ 80px threshold

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: endY }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

test.describe('Regression checklist — calendar', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
  });

  test('full calendar: views, filters, create event', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: 'Today' }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page.locator('.rbc-time-view, .rbc-month-view, .rbc-agenda-view').first()).toBeVisible();

    await page.getByRole('button', { name: 'Agenda', exact: true }).click();
    await page.getByRole('button', { name: 'Month', exact: true }).click();

    const title = `Regression calendar ${Date.now()}`;
    await page.locator('.rbc-toolbar button').filter({ hasText: '+' }).click();
    await expect(page.getByRole('heading', { name: 'Create Event' })).toBeVisible();
    await page.locator('#event-title').fill(title);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Create Event' })).not.toBeVisible({ timeout: 15_000 });

    const token = await getAuthToken(request, student);
    let createdId: string | undefined;
    await expect
      .poll(async () => {
        const res = await request.get(`${apiURL}/api/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok()) return false;
        const body = await res.json();
        const events = Array.isArray(body) ? body : body.data || body.events || [];
        const match = events.find((e: { title?: string }) => e.title === title);
        createdId = match?._id || match?.id;
        return Boolean(match);
      })
      .toBeTruthy();

    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(page.locator('.rbc-event').filter({ hasText: title }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('.rbc-event').filter({ hasText: title }).first().click();
    await expect(page.getByRole('heading', { name: 'Edit Event' })).toBeVisible({ timeout: 10_000 });

    const editedTitle = `${title} edited`;
    await page.locator('#event-title').fill(editedTitle);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Event' })).not.toBeVisible({
      timeout: 15_000,
    });

    await expect
      .poll(async () => {
        const res = await request.get(`${apiURL}/api/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok()) return false;
        const body = await res.json();
        const events = Array.isArray(body) ? body : body.data || body.events || [];
        const match = events.find((e: { title?: string }) => e.title === editedTitle);
        createdId = match?._id || match?.id;
        return Boolean(match);
      })
      .toBeTruthy();

    await page.locator('.rbc-event').filter({ hasText: editedTitle }).first().click();
    await expect(page.getByRole('heading', { name: 'Edit Event' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Event' })).not.toBeVisible({
      timeout: 15_000,
    });

    if (createdId) {
      await expect
        .poll(async () => {
          const res = await request.get(`${apiURL}/api/events/${createdId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return res.status() === 404;
        })
        .toBeTruthy();
      createdId = undefined;
    }

    const courseId = mathCourseId;
    const courseCheckbox = page.locator(`#calendar-checkbox-${courseId}`);
    await expect(courseCheckbox).toBeVisible({ timeout: 15_000 });
    await courseCheckbox.uncheck();
    await expect(courseCheckbox).not.toBeChecked();
    await courseCheckbox.check();
    await expect(courseCheckbox).toBeChecked();
  });
});

test.describe('Regression checklist — QR join', () => {
  test('camera scanner UI initializes on dashboard', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['camera'],
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await loginViaForm(page, student.email, student.password);
    await page.getByRole('button', { name: 'Join with QR' }).click();
    await expect(page.getByRole('heading', { name: 'Scan course QR' })).toBeVisible();
    await expect(page.locator('#course-qr-reader')).toBeVisible();
    await expect(page.locator('#course-qr-reader')).not.toBeEmpty({ timeout: 20_000 });
    await context.close();
  });

  test('QR join URL from instructor info enrolls or shows already enrolled', async ({
    page,
    request,
  }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const info = await request.get(
      `${apiURL}/api/courses/${mathCourseId}/enrollment-join-info`,
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    expect(info.ok()).toBeTruthy();
    const { joinPath, joinUrl } = await info.json();
    expect(joinPath).toMatch(/^\/join-course\?t=/);

    await loginViaForm(page, student.email, student.password);
    const pathOnly = joinPath.startsWith('/')
      ? joinPath
      : new URL(joinUrl).pathname + new URL(joinUrl).search;
    await page.goto(pathOnly);
    await expect(
      page.getByText(/already enrolled|waitlist|pending|joined|enrolled/i)
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Regression checklist — pull to refresh', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
  });

  test('inbox pull gesture triggers refresh UI', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await simulatePullToRefresh(page);
    await expect(page.getByText(/Refreshing|Pull down to refresh|Release to refresh/)).toBeVisible({
      timeout: 10_000,
    });
  });
});

async function fillAnnouncementBody(page: Page, text: string) {
  await page.waitForSelector('#announcement-body_ifr', { timeout: 20_000 });
  await page.evaluate((bodyText) => {
    const editor = (window as unknown as { tinymce?: { get: (id: string) => { setContent: (html: string) => void } } })
      .tinymce?.get('announcement-body');
    if (!editor) throw new Error('TinyMCE announcement-body editor not ready');
    editor.setContent(`<p>${bodyText}</p>`);
  }, text);
}

test.describe('Regression checklist — file upload and preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
  });

  test('announcement: file picker, upload, in-form preview, and save with attachment', async ({
    page,
    request,
  }) => {
    const announcementTitle = `Regression upload ${Date.now()}`;

    await page.goto(`/courses/${mathCourseId}/announcements`);
    await expect(page.getByRole('button', { name: 'Create announcement' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await expect(page.locator('#announcement-title')).toBeVisible({ timeout: 20_000 });
    await page.locator('#announcement-title').fill(announcementTitle);
    await fillAnnouncementBody(page, 'Regression browser upload verification body.');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(samplePng);
    await expect(
      page.getByRole('button', { name: /Preview regression-sample/i })
    ).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: /Preview regression-sample/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');

    await expect(
      page.getByRole('button', { name: /Remove regression-sample/i })
    ).toBeVisible({ timeout: 10_000 });

    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/courses/${mathCourseId}/announcements`) &&
          r.request().method() === 'POST',
        { timeout: 30_000 }
      ),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const createBody = await createRes.json();
    expect(createBody.data?.fileAssets?.length).toBeGreaterThan(0);

    await expect(page.getByRole('button', { name: announcementTitle })).toBeVisible({
      timeout: 20_000,
    });

    const token = await getAuthToken(request, teacher);
    const list = await request.get(`${apiURL}/api/courses/${mathCourseId}/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const announcements = await list.json();
    const created = (Array.isArray(announcements) ? announcements : announcements.data || []).find(
      (a: { title?: string }) => a.title === announcementTitle
    );
    if (created?._id) {
      await request.delete(`${apiURL}/api/announcements/${created._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});
