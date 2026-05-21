import { test, expect } from '@playwright/test';
import { loginAs, authHeaders, roles } from '../fixtures/filePlatform';
import { UPLOAD_SEED, CHAOS } from '../fixtures/uploadSeeds';
import { assertChunkGate, simulateExpiredChunkSession } from '../helpers/uploadChaos';

const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('Upload reliability (U54F)', () => {
  test('chunk gate requires authentication', async ({ request }) => {
    expect(await assertChunkGate(request, apiURL)).toBe(401);
  });

  test('chunk status without auth is rejected', async ({ request }) => {
    expect(await simulateExpiredChunkSession(request, apiURL, { authenticated: false })).toBe(401);
  });

  test('missing chunk session returns 404 when authenticated', async ({ request }) => {
    const token = await loginAs(request, roles.teacher.email, roles.teacher.password);
    test.skip(!token, 'Run npm run seed:e2e:upload and ensure API is up');
    expect(await simulateExpiredChunkSession(request, apiURL, { authenticated: true })).toBe(404);
  });

  test('student chunk init when seeded', async ({ request }) => {
    const token = await loginAs(request, roles.student.email, roles.student.password);
    expect(token).toBeTruthy();
    const res = await request.post(`${apiURL}/api/upload/chunk/init`, {
      headers: authHeaders(token!),
      data: {
        fileName: 'assignment-submission.pdf',
        fileSize: CHAOS.chunkStallMs * 100,
        totalChunks: 2,
        category: 'submission',
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.uploadId).toBeTruthy();
  });

  test('teacher storage zip queue when seeded', async ({ request }) => {
    const courseId = process.env.E2E_COURSE_ID;
    test.skip(!courseId, 'Run npm run seed:e2e:upload to set E2E_COURSE_ID');
    const token = await loginAs(request, roles.teacher.email, roles.teacher.password);
    const res = await request.post(`${apiURL}/api/courses/${courseId}/storage/zip`, {
      headers: authHeaders(token!),
      data: { type: 'course_resources' },
    });
    expect([200, 201, 403]).toContain(res.status());
  });

  test('admin restore preview dry-run', async ({ request }) => {
    const token = await loginAs(request, roles.admin.email, roles.admin.password);
    const fileId = process.env.E2E_DELETED_FILE_ID || '507f1f77bcf86cd799439011';
    const res = await request.get(`${apiURL}/api/ops/recovery/files/${fileId}/restore-preview`, {
      headers: authHeaders(token!),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('registrar governance requires auth', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/ops/governance`);
    expect([401, 403]).toContain(res.status());
  });

  test('upload recovery seeds documented', () => {
    expect(UPLOAD_SEED.student.email).toContain('@');
    expect(UPLOAD_SEED.teacher.email).toContain('@');
  });
});
