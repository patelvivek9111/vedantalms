import { test, expect } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://localhost:5000';
const studentToken = process.env.E2E_STUDENT_TOKEN;
const staffToken = process.env.E2E_STAFF_TOKEN;
const unpublishedAssignmentId = process.env.E2E_UNPUBLISHED_ASSIGNMENT_ID;
const futureAssignmentId = process.env.E2E_FUTURE_ASSIGNMENT_ID;

test.describe('assignment access enforcement', () => {
  test('student direct URL access cannot reveal unpublished assignments', async ({ request }) => {
    test.skip(!studentToken || !unpublishedAssignmentId, 'Set E2E_STUDENT_TOKEN and E2E_UNPUBLISHED_ASSIGNMENT_ID');

    const res = await request.get(`${api}/api/assignments/${unpublishedAssignmentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect([403, 404]).toContain(res.status());
  });

  test('future availableFrom assignment returns a controlled not-available response', async ({ request }) => {
    test.skip(!studentToken || !futureAssignmentId, 'Set E2E_STUDENT_TOKEN and E2E_FUTURE_ASSIGNMENT_ID');

    const res = await request.get(`${api}/api/assignments/${futureAssignmentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status()).toBe(403);
    await expect(await res.json()).toEqual(expect.objectContaining({ code: 'ASSIGNMENT_NOT_AVAILABLE' }));
  });

  test('staff preview receives metadata for unpublished content', async ({ request }) => {
    test.skip(!staffToken || !unpublishedAssignmentId, 'Set E2E_STAFF_TOKEN and E2E_UNPUBLISHED_ASSIGNMENT_ID');

    const res = await request.get(`${api}/api/assignments/${unpublishedAssignmentId}?preview=true`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.access || body.previewMetadata || body.data?.previewMetadata).toEqual(expect.objectContaining({ preview: true }));
  });
});
