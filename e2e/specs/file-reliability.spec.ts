import { test, expect } from '@playwright/test';

const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';

test.describe('File platform reliability (U42F)', () => {
  test('chunk upload init requires auth', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/upload/chunk/init`, {
      data: { fileName: 'resume.bin', fileSize: 5000, totalChunks: 2 },
    });
    expect(res.status()).toBe(401);
  });

  test('file list cursor requires auth', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/files/list?courseId=507f1f77bcf86cd799439011`);
    expect(res.status()).toBe(401);
  });

  test('preview endpoint requires auth', async ({ request }) => {
    const id = '507f1f77bcf86cd799439011';
    const res = await request.get(`${apiURL}/api/files/${id}/preview`);
    expect(res.status()).toBe(401);
  });

  test('recovery restore requires admin auth', async ({ request }) => {
    const id = '507f1f77bcf86cd799439011';
    const res = await request.post(`${apiURL}/api/ops/recovery/files/${id}/restore`);
    expect([401, 403]).toContain(res.status());
  });

  test('governance endpoint requires admin', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/ops/governance`);
    expect([401, 403]).toContain(res.status());
  });
});
