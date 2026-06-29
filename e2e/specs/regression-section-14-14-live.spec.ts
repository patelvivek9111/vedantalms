/**
 * §14.14 — Files & infrastructure (strict journeys + visual snapshots).
 * Run: npm run test:e2e:section-14-14
 */
import { test, expect, Page, Locator, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  apiURL,
  mathCourseId,
  teacher,
  admin,
  regressionDeletedFileId,
  regressionPageId,
  loginViaForm,
  getAuthToken,
} from '../helpers/live-auth';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');

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

async function snap(
  page: Page,
  name: string,
  opts?: { skipNetworkIdle?: boolean; fullPage?: boolean; locator?: Locator },
) {
  if (!opts?.skipNetworkIdle) {
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  const target = opts?.locator ?? page;
  await expect(target).toHaveScreenshot(`${name}.png`, {
    fullPage: opts?.fullPage ?? true,
    mask: [
      page.locator('img[src*="profile"], img[alt*="avatar" i]'),
      page.locator('[class*="animate-pulse"]'),
    ],
  });
}

async function uploadChunkedFile(
  request: APIRequestContext,
  token: string,
  courseId: string,
  fileName: string,
  filePath: string
) {
  const buffer = fs.readFileSync(filePath);
  const init = await request.post(`${apiURL}/api/upload/chunk/init`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      fileName,
      fileSize: buffer.length,
      totalChunks: 1,
      mimeType: 'image/png',
      category: 'page',
      courseId,
    },
  });
  expect(init.ok(), await init.text()).toBeTruthy();
  const initBody = await init.json();
  const uploadId = initBody.uploadId as string;
  expect(uploadId).toBeTruthy();

  const chunk = await request.post(`${apiURL}/api/upload/chunk/${uploadId}/0`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    data: buffer,
  });
  expect(chunk.ok(), await chunk.text()).toBeTruthy();

  const complete = await request.post(`${apiURL}/api/upload/chunk/${uploadId}/complete`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(complete.ok(), await complete.text()).toBeTruthy();
  const body = await complete.json();
  expect(body.success).toBe(true);
  expect(body.files?.[0]?.fileAssetId).toBeTruthy();
  return body.files[0].fileAssetId as string;
}

test.describe('§14.14 Files — upload metadata & preview', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('announcement attachment upload shows preview chip and metadata API', async ({
    page,
    request,
  }) => {
    const title = `§14.14 upload ${Date.now()}`;
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await expect(page.locator('#announcement-title')).toBeVisible({ timeout: 20_000 });
    await page.locator('#announcement-title').fill(title);
    await fillAnnouncementBody(page, '§14.14 file upload metadata regression body.');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(samplePng);
    await expect(
      page.getByRole('button', { name: /Preview regression-sample/i })
    ).toBeVisible({ timeout: 60_000 });
    await snap(page, '14-14-announcement-upload-preview', { fullPage: false });

    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/courses/${mathCourseId}/announcements`) &&
          r.request().method() === 'POST',
        { timeout: 60_000 }
      ),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(createRes.ok()).toBeTruthy();
    const createBody = await createRes.json();
    expect(createBody.data?.fileAssets?.length).toBeGreaterThan(0);

    const token = await getAuthToken(request, teacher);
    const meta = await request.get(
      `${apiURL}/api/files/${createBody.data.fileAssets[0]}/metadata`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(meta.ok()).toBeTruthy();
    const metaBody = await meta.json();
    expect(metaBody.data?.originalName || metaBody.originalName).toMatch(/regression-sample/i);

    const announcementId = createBody.data._id || createBody.data.id;
    if (announcementId) {
      await request.delete(`${apiURL}/api/announcements/${announcementId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('file preview modal opens from announcement attachment', async ({ page, request }) => {
    const title = `§14.14 preview ${Date.now()}`;
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await page.getByRole('button', { name: 'Create announcement' }).click();
    await page.locator('#announcement-title').fill(title);
    await fillAnnouncementBody(page, '§14.14 preview modal regression body.');
    await page.locator('input[type="file"]').first().setInputFiles(samplePng);
    await expect(
      page.getByRole('button', { name: /Preview regression-sample/i })
    ).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /Preview regression-sample/i }).click();
    const modal = page.getByRole('dialog').filter({ hasText: /preview|regression-sample/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await snap(page, '14-14-file-preview-modal', { fullPage: false, locator: modal });

    const token = await getAuthToken(request, teacher);
    await page.keyboard.press('Escape');
    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/courses/${mathCourseId}/announcements`) &&
          r.request().method() === 'POST',
        { timeout: 60_000 }
      ),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    const createBody = await createRes.json();
    const announcementId = createBody.data?._id || createBody.data?.id;
    if (announcementId) {
      await request.delete(`${apiURL}/api/announcements/${announcementId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});

test.describe('§14.14 Files — versioning UI', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('page edit shows version history for seeded attachment', async ({ page, request }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/pages/${regressionPageId}/edit`);
    await expect(page.getByLabel(/Manage page attachments/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/regression-attachment-v2/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Version history' }).click();
    await expect(page.getByText('Current')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/regression-attachment-v1/i)).toBeVisible();
    await snap(page, '14-14-version-history-desktop', { fullPage: false });

    const token = await getAuthToken(request, teacher);
    const versions = await request.get(
      `${apiURL}/api/files/${process.env.E2E_REGRESSION_VERSION_FILE_ID}/versions`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(versions.ok()).toBeTruthy();
    const body = await versions.json();
    expect(body.data?.current).toBeTruthy();
    expect(Array.isArray(body.data?.versions)).toBe(true);
    expect(body.data.versions.length).toBeGreaterThan(0);
  });
});

test.describe('§14.14 Files — recovery center', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('admin recovery center — search, select, preview restore', async ({ page, request }) => {
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/settings');
    await page.getByRole('button', { name: 'Operations' }).click();
    await expect(page.getByRole('heading', { name: 'File Recovery Center' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('searchbox', { name: 'Search recoverable files' }).fill('regression-14-14-deleted');
    const fileRow = page.getByRole('option', { name: /regression-14-14-deleted\.pdf/i });
    await expect(fileRow).toBeVisible({ timeout: 15_000 });
    await fileRow.click();
    await page.getByRole('button', { name: 'Preview restore' }).click();
    await expect(page.locator('pre').filter({ hasText: /dryRun|eligible|restore/i })).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '14-14-recovery-center-desktop', { fullPage: false });

    const token = await getAuthToken(request, admin);
    const preview = await request.get(
      `${apiURL}/api/ops/recovery/files/${regressionDeletedFileId}/restore-preview`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(preview.ok()).toBeTruthy();
    const previewBody = await preview.json();
    expect(previewBody.data?.dryRun).toBe(true);
  });
});

test.describe('§14.14 Files — API infrastructure smoke', () => {
  test('chunk upload init + complete returns fileAssetId', async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    const fileAssetId = await uploadChunkedFile(
      request,
      token,
      String(mathCourseId),
      `chunk-${Date.now()}.png`,
      samplePng
    );
    expect(fileAssetId).toMatch(/^[a-f0-9]{24}$/i);

    const meta = await request.get(`${apiURL}/api/files/${fileAssetId}/metadata`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meta.ok()).toBeTruthy();
  });

  test('preview endpoint requires auth', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/files/507f1f77bcf86cd799439011/preview`);
    expect([401, 403]).toContain(res.status());
  });

  test('recovery list requires admin', async ({ request }) => {
    const studentToken = await getAuthToken(request, {
      email: 'arjun.menon@student.demo.vidyalms.com',
      password: 'VedantaDemo8!',
    });
    const res = await request.get(`${apiURL}/api/ops/recovery/files`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect([401, 403]).toContain(res.status());
  });
});
