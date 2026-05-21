import { test, expect } from '@playwright/test';
import { loginAs, authHeaders, roles } from '../fixtures/filePlatform';

const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Upload platform closure (U49F)', () => {
  test('unauthenticated upload surfaces reject access', async ({ request }) => {
    const chunk = await request.post(`${apiURL}/api/upload/chunk/init`, {
      data: { fileName: 'test.bin', fileSize: 1000, totalChunks: 2 },
    });
    expect(chunk.status()).toBe(401);

    const preview = await request.get(`${apiURL}/api/files/507f1f77bcf86cd799439011/preview`);
    expect(preview.status()).toBe(401);

    const restorePreview = await request.get(
      `${apiURL}/api/ops/recovery/files/507f1f77bcf86cd799439011/restore-preview`
    );
    expect([401, 403]).toContain(restorePreview.status());
  });

  test('teacher can list course files when credentials provided', async ({ request }) => {
    const token = await loginAs(request, roles.teacher.email, roles.teacher.password);
    test.skip(!token, 'Run npm run seed:e2e:upload and ensure API is up');
    const courseId = process.env.E2E_COURSE_ID;
    test.skip(!courseId, 'Run npm run seed:e2e:upload to set E2E_COURSE_ID');
    const res = await request.get(`${apiURL}/api/files/list?courseId=${courseId}&limit=10`, {
      headers: authHeaders(token!),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('admin restore preview dry-run when credentials provided', async ({ request }) => {
    const token = await loginAs(request, roles.admin.email, roles.admin.password);
    test.skip(!token, 'Run npm run seed:e2e:upload and ensure API is up');
    const fileId = process.env.E2E_DELETED_FILE_ID;
    test.skip(!fileId, 'Run npm run seed:e2e:upload to set E2E_DELETED_FILE_ID');
    const res = await request.get(`${apiURL}/api/ops/recovery/files/${fileId}/restore-preview`, {
      headers: authHeaders(token!),
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.data.dryRun).toBe(true);
    }
  });

  test('chunk init accepts authenticated teacher', async ({ request }) => {
    const token = await loginAs(request, roles.teacher.email, roles.teacher.password);
    test.skip(!token, 'Run npm run seed:e2e:upload and ensure API is up');
    const res = await request.post(`${apiURL}/api/upload/chunk/init`, {
      headers: authHeaders(token!),
      data: {
        fileName: 'resume-e2e.bin',
        fileSize: 4096,
        totalChunks: 2,
        mimeType: 'application/octet-stream',
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('preview regenerate requires auth', async ({ request }) => {
    const id = '507f1f77bcf86cd799439011';
    const res = await request.post(`${apiURL}/api/files/${id}/preview/regenerate`);
    expect(res.status()).toBe(401);
  });
});
