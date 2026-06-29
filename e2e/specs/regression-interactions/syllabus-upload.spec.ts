import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, loginViaForm } from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Teacher syllabus file upload + save.
 * Two-step real flow: the file uploads via POST /api/upload, then "Save syllabus"
 * PUTs the course with catalog.syllabusFileAssetIds. We verify the persisted
 * catalog.syllabusFiles via the course API.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;

async function syllabusFileCount(request: APIRequestContext): Promise<number> {
  const res = await request.get(`${apiURL}/api/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok()) return -1;
  const body = await res.json();
  const course = body.data || body;
  return (course.catalog?.syllabusFiles || []).length;
}

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  // Teacher owns the course → can edit its syllabus.
  courseId = await createCourse(request, teacherToken, { title: `§21 syllabus ${Date.now()}` });
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

test.describe('§21 Syllabus — file upload + save', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('upload a file then Save syllabus — persists to course catalog', async ({ page, request }) => {
    expect(await syllabusFileCount(request)).toBe(0);

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/syllabus`);

    await expect(page.getByRole('heading', { name: /course syllabus/i })).toBeVisible({ timeout: 30_000 });

    // Open the upload sub-panel.
    await page.getByRole('button', { name: /upload file/i }).first().click();

    // Drop a tiny file into the (hidden) dropzone input → multipart POST /api/upload.
    const fileName = `syllabus-${Date.now()}.png`;
    const fileInput = page.locator('input[type="file"]').first();
    const [uploadRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/upload') && r.request().method() === 'POST',
        { timeout: 30_000 }
      ),
      fileInput.setInputFiles({
        name: fileName,
        mimeType: 'image/png',
        // 1x1 transparent PNG — an allowed upload type.
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64'
        ),
      }),
    ]);
    expect(uploadRes.ok(), await uploadRes.text()).toBeTruthy();

    // The file is committed to the syllabus form only once it shows as done (a
    // "Preview <name>" control replaces the upload progress/cancel UI).
    await expect(page.getByRole('button', { name: `Preview ${fileName}` })).toBeVisible({
      timeout: 20_000,
    });

    const [putRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/courses/${courseId}` &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /save syllabus/i }).click(),
    ]);
    expect(putRes.ok(), await putRes.text()).toBeTruthy();

    await expect.poll(() => syllabusFileCount(request), { timeout: 15_000 }).toBeGreaterThan(0);
  });
});
