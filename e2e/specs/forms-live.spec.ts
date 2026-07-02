import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { apiURL, mathCourseId, teacher, loginViaForm } from '../helpers/live-auth';

let createdAnnouncementId = '';
let createdPollId = '';
let createdModuleId = '';
let createdPageId = '';

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

function futureDateTimeLocal(hoursFromNow = 48) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe.serial('§5.4 Announcements & forms — live API journey', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, teacher.email, teacher.password);
  });

  test('announcement: empty save blocked by validation', async ({ page }) => {
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await expect(page.locator('#announcement-title')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('#announcement-title')).toHaveJSProperty('validity.valid', false);

    await page.locator('#announcement-title').fill('Title only');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Announcement content is required')).toBeVisible();
  });

  test('announcement: create persists after reload', async ({ page, request }) => {
    const title = `L4 §5.4 announcement ${Date.now()}`;
    const body = '§5.4 announcement body — persist after reload';

    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await page.locator('#announcement-title').fill(title);
    await page.locator('#announcement-body').fill(body);

    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/courses/${mathCourseId}/announcements`) &&
          r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    createdAnnouncementId = created._id || created.data?._id || '';

    await expect(page.getByRole('button', { name: title })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByRole('button', { name: title })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: title }).click();
    await expect(page.getByText(body)).toBeVisible();
  });

  test('poll: empty save blocked by validation', async ({ page }) => {
    await page.goto(`/courses/${mathCourseId}/polls`);
    await page.getByRole('button', { name: '+ Create Poll' }).click();
    await expect(page.getByRole('heading', { name: 'Create new poll' })).toBeVisible();
    await page.getByRole('button', { name: 'Create poll' }).click();
    await expect(page.locator('#title')).toHaveJSProperty('validity.valid', false);
  });

  test('poll: create persists after reload', async ({ page, request }) => {
    const title = `L4 §5.4 poll ${Date.now()}`;

    await page.goto(`/courses/${mathCourseId}/polls`);
    await page.getByRole('button', { name: '+ Create Poll' }).click();
    await page.locator('#title').fill(title);
    await page.locator('input[placeholder="Option 1"]').fill('Option A');
    await page.locator('input[placeholder="Option 2"]').fill('Option B');
    await page.locator('#endDate').fill(futureDateTimeLocal());

    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/polls/courses/${mathCourseId}`) &&
          r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Create poll' }).click(),
    ]);
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    createdPollId = created.data?._id || created._id || '';

    await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('module: empty title blocked; module + page persist after reload', async ({
    page,
    request,
  }) => {
    const moduleTitle = `L4 §5.4 module ${Date.now()}`;
    const pageTitle = `L4 §5.4 page ${Date.now()}`;
    const pageBody = '§5.4 page body — persist after reload';

    await page.goto(`/courses/${mathCourseId}/modules`);
    await page.getByRole('button', { name: '+ Add Module' }).click();
    await page.getByRole('button', { name: 'Create module' }).click();
    await expect(page.locator('form').filter({ has: page.getByRole('button', { name: 'Create module' }) }).locator('#title')).toHaveJSProperty('validity.valid', false);

    await page.locator('form').filter({ has: page.getByRole('button', { name: 'Create module' }) }).locator('#title').fill(moduleTitle);
    const [moduleRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/modules') && r.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Create module' }).click(),
    ]);
    expect(moduleRes.ok()).toBeTruthy();
    const moduleBody = await moduleRes.json();
    createdModuleId = moduleBody.data?._id || moduleBody._id || '';

    await expect(page.getByRole('heading', { name: moduleTitle, level: 3 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: moduleTitle, level: 3 })).toBeVisible();

    await page.getByRole('heading', { name: moduleTitle, level: 3 }).click();

    const moduleCard = page.locator('div.flex.cursor-pointer').filter({
      has: page.getByRole('heading', { name: moduleTitle, level: 3 }),
    });
    await moduleCard.getByRole('button', { name: 'Add Content' }).click();

    const pageForm = page.locator('form').filter({
      has: page.getByRole('button', { name: 'Create page' }),
    });
    await pageForm.locator('#title').fill(pageTitle);
    await pageForm.getByRole('textbox', { name: 'Discussion rich text editor' }).fill(pageBody);
    await pageForm.locator('#page-module').selectOption(createdModuleId);

    const [pageRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/pages') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Create page' }).click(),
    ]);
    expect(pageRes.ok()).toBeTruthy();
    const pageBodyJson = await pageRes.json();
    createdPageId = pageBodyJson.data?._id || pageBodyJson._id || '';

    await page.goto(`/courses/${mathCourseId}/pages/${createdPageId}`);
    await expect(page.getByText(pageBody)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(pageBody)).toBeVisible({ timeout: 20_000 });
  });

  test.afterAll(async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    const headers = { Authorization: `Bearer ${token}` };

    if (createdPageId) {
      await request.delete(`${apiURL}/api/pages/${createdPageId}`, { headers });
    }
    if (createdModuleId) {
      await request.delete(`${apiURL}/api/modules/${createdModuleId}`, { headers });
    }
    if (createdPollId) {
      await request.delete(`${apiURL}/api/polls/${createdPollId}`, { headers });
    }
    if (createdAnnouncementId) {
      await request.delete(`${apiURL}/api/announcements/${createdAnnouncementId}`, { headers });
    }
  });
});
