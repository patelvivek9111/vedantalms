import { test, expect } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://localhost:5000';
const studentToken = process.env.E2E_STUDENT_TOKEN;
const otherStudentToken = process.env.E2E_OTHER_STUDENT_TOKEN;
const staffToken = process.env.E2E_STAFF_TOKEN;
const unpublishedDiscussionId = process.env.E2E_UNPUBLISHED_DISCUSSION_ID;
const hiddenGradeDiscussionId = process.env.E2E_HIDDEN_GRADE_DISCUSSION_ID;
const groupDiscussionId = process.env.E2E_GROUP_DISCUSSION_ID;
const lockedDiscussionId = process.env.E2E_LOCKED_DISCUSSION_ID;

test.describe('discussion institutional hardening', () => {
  test('student direct API access cannot reveal unpublished discussions', async ({ request }) => {
    test.skip(!studentToken || !unpublishedDiscussionId, 'Set E2E_STUDENT_TOKEN and E2E_UNPUBLISHED_DISCUSSION_ID');

    const res = await request.get(`${api}/api/threads/${unpublishedDiscussionId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect([403, 404]).toContain(res.status());
  });

  test('student cannot inspect other students discussion grades', async ({ request }) => {
    test.skip(!studentToken || !hiddenGradeDiscussionId, 'Set E2E_STUDENT_TOKEN and E2E_HIDDEN_GRADE_DISCUSSION_ID');

    const res = await request.get(`${api}/api/threads/${hiddenGradeDiscussionId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.studentGrades.length).toBeLessThanOrEqual(1);
    expect(body.data.studentGrades[0]?.gradeVisibility?.scoreVisible).not.toBe(true);
  });

  test('student outside group cannot open group discussion', async ({ request }) => {
    test.skip(!otherStudentToken || !groupDiscussionId, 'Set E2E_OTHER_STUDENT_TOKEN and E2E_GROUP_DISCUSSION_ID');

    const res = await request.get(`${api}/api/threads/${groupDiscussionId}`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('locked discussion denies reply posting', async ({ request }) => {
    test.skip(!studentToken || !lockedDiscussionId, 'Set E2E_STUDENT_TOKEN and E2E_LOCKED_DISCUSSION_ID');

    const res = await request.post(`${api}/api/threads/${lockedDiscussionId}/replies`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { content: '<p>late reply</p>', idempotencyKey: 'discussion-e2e-lock-check' },
    });
    expect(res.status()).toBe(403);
  });

  test('course staff can view unpublished discussion through staff path', async ({ request }) => {
    test.skip(!staffToken || !unpublishedDiscussionId, 'Set E2E_STAFF_TOKEN and E2E_UNPUBLISHED_DISCUSSION_ID');

    const res = await request.get(`${api}/api/threads/${unpublishedDiscussionId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(res.status()).toBe(200);
  });
});
