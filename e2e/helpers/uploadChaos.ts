import type { APIRequestContext } from '@playwright/test';
import { authHeaders, loginAs } from '../fixtures/filePlatform';

/** 32-char hex shape matching chunked upload session ids. */
export const MISSING_CHUNK_UPLOAD_ID = 'deadbeefdeadbeefdeadbeefdeadbeef';

/** Simulate worker unavailable by hitting chunk status for a non-existent session. */
export async function simulateExpiredChunkSession(
  request: APIRequestContext,
  apiURL: string,
  options: { authenticated?: boolean } = {}
) {
  const url = `${apiURL}/api/upload/chunk/${MISSING_CHUNK_UPLOAD_ID}/status`;
  const wantAuth = options.authenticated !== false;
  const email = process.env.E2E_TEACHER_EMAIL || process.env.E2E_STUDENT_EMAIL;
  const password = process.env.E2E_TEACHER_PASSWORD || process.env.E2E_STUDENT_PASSWORD;

  if (wantAuth && email && password) {
    const token = await loginAs(request, email, password);
    if (token) {
      const res = await request.get(url, { headers: authHeaders(token) });
      return res.status();
    }
  }

  const res = await request.get(url);
  return res.status();
}

/** Chaos: rapid chunk init without auth should always 401. */
export async function assertChunkGate(request: APIRequestContext, apiURL: string) {
  const res = await request.post(`${apiURL}/api/upload/chunk/init`, {
    data: { fileName: 'chaos.bin', fileSize: 1024, totalChunks: 1 },
  });
  return res.status();
}
