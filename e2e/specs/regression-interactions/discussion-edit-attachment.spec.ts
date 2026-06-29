import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, loginViaForm } from '../../helpers/live-auth';
import {
  createCourse,
  createModule,
  createThread,
  cleanupEphemeral,
} from '../../helpers/ephemeral';

/**
 * §21 deferral close — Discussion attachment added on *edit*.
 * Create flow already covers attaching on first post; this covers the edit path:
 * a reply seeded without files is edited via the UI to attach one, which PUTs
 * /api/threads/:threadId/replies/:replyId with fileAssetIds. We verify the
 * persisted reply.fileAssets through the replies API.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
let threadId: string;
let replyId: string;

async function replyFileAssetCount(request: APIRequestContext): Promise<number> {
  const res = await request.get(`${apiURL}/api/threads/${threadId}/replies`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok()) return -1;
  const body = await res.json();
  const replies = body.data || body.replies || [];
  const mine = replies.find((r: { _id: string }) => String(r._id) === String(replyId));
  return (mine?.fileAssets || []).length;
}

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 disc-edit ${Date.now()}` });
  const moduleId = await createModule(request, teacherToken, courseId);
  threadId = await createThread(request, teacherToken, courseId, { moduleId });

  // Seed a reply with no attachment, authored by the teacher (who may edit it).
  const res = await request.post(`${apiURL}/api/threads/${threadId}/replies`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { content: '<p>Reply awaiting an attachment.</p>' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  replyId = String(body.createdReply?._id || body.data?.replies?.[0]?._id || '');
  expect(replyId, `reply id from: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

test.describe('§21 Discussion — attachment on edit', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('editing a reply to attach a file persists fileAssets', async ({ page, request }) => {
    expect(await replyFileAssetCount(request)).toBe(0);

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/threads/${threadId}`);

    // Open the reply's "More options" menu, then choose Edit.
    const optionsBtn = page.getByRole('button', { name: /More options for reply/i }).first();
    await expect(optionsBtn).toBeVisible({ timeout: 30_000 });
    await optionsBtn.click();
    await page.getByRole('menuitem', { name: /^edit$/i }).click();

    // The reply edit form is the only one currently exposing "Save Changes".
    const editForm = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Save Changes' }) })
      .first();
    await expect(editForm).toBeVisible();

    // Drop a tiny file into the edit form's attachment dropzone → POST /api/upload.
    const fileName = `disc-edit-${Date.now()}.png`;
    const fileInput = editForm.locator('input[type="file"]');
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

    // Upload is committed to the form once it shows the "Preview <name>" control.
    await expect(editForm.getByRole('button', { name: `Preview ${fileName}` })).toBeVisible({
      timeout: 20_000,
    });

    const [putRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/threads/${threadId}/replies/${replyId}` &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      ),
      editForm.getByRole('button', { name: 'Save Changes' }).click(),
    ]);
    expect(putRes.ok(), await putRes.text()).toBeTruthy();

    await expect.poll(() => replyFileAssetCount(request), { timeout: 15_000 }).toBeGreaterThan(0);
  });
});
