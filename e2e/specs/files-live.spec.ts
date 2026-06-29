import { test, expect, Page, APIRequestContext } from '@playwright/test';
import path from 'path';
import { apiURL, mathCourseId, getMathCourseId, student, admin } from '../helpers/live-auth';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');

let threadId = '';
const replyText = 'L4 §5.5 discussion reply with attachment';

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

async function loginViaForm(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'load', timeout: 60_000 });
  await page.locator('#email-address').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe.serial('§5.5 Files & uploads — live journeys', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, {
      email: 'teacher@vidyalms.com',
      password: 'password123',
    });
    const title = `L4 §5.5 files ${Date.now()}`;
    const create = await request.post(`${apiURL}/api/threads`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        title,
        content: '<p>Upload an attachment with your reply.</p>',
        courseId: getMathCourseId(),
        settings: { allowLikes: true, allowComments: true, requirePostBeforeSee: false },
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const body = await create.json();
    threadId = body.data?._id || body.data?.id || body._id;
    expect(threadId).toBeTruthy();
  });

  test.beforeEach(async ({ page }) => {
    await enablePlainEditor(page);
  });

  test('discussion: reply with attachment persists after reload', async ({ page, request }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${threadId}`);
    await expect(page.getByRole('heading', { name: /L4 §5\.5 files/i })).toBeVisible({
      timeout: 20_000,
    });

    const start = page.getByRole('button', { name: /start the discussion/i });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }

    const editor = page.getByRole('textbox', {
      name: /discussion rich text editor|share your thoughts/i,
    });
    await editor.fill(replyText);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(samplePng);
    await expect(
      page.getByRole('button', { name: /Preview regression-sample/i })
    ).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /post reply/i }).click();
    const replyArticle = page.getByRole('article').filter({ hasText: replyText });
    await expect(replyArticle).toBeVisible({ timeout: 20_000 });
    await expect(
      replyArticle.getByRole('button', { name: /Preview regression-sample/i })
    ).toBeVisible({ timeout: 20_000 });

    const token = await getAuthToken(request, student);
    const assertReplyHasAttachment = async () => {
      const threadRes = await request.get(`${apiURL}/api/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(threadRes.ok()).toBeTruthy();
      const threadBody = await threadRes.json();
      const replies = threadBody.data?.replies || threadBody.replies || [];
      const reply = replies.find((r: { content?: string }) =>
        (r.content || '').includes(replyText)
      );
      expect(reply).toBeTruthy();
      const assets = reply.fileAssets || [];
      expect(assets.length).toBeGreaterThan(0);
    };

    await assertReplyHasAttachment();
    await page.reload();
    await expect(replyArticle).toBeVisible({ timeout: 20_000 });
    await assertReplyHasAttachment();
    await expect(
      replyArticle.getByRole('button', { name: /Preview regression-sample/i })
    ).toBeVisible({ timeout: 20_000 });
  });

  test('admin: file recovery center loads in operations settings', async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/settings');
    await page.getByRole('button', { name: 'Operations' }).click();
    await expect(page.getByRole('heading', { name: 'File Recovery Center' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('searchbox', { name: 'Search recoverable files' })).toBeVisible();
    await expect(page.getByText('Maintenance tools')).toBeVisible();
  });

  test.afterAll(async ({ request }) => {
    if (!threadId) return;
    const teacherToken = await getAuthToken(request, {
      email: 'teacher@vidyalms.com',
      password: 'password123',
    });
    await request.delete(`${apiURL}/api/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
  });
});
