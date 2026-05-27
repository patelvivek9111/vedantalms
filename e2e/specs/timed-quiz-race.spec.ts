import { test, expect } from '@playwright/test';

const api = process.env.E2E_API_URL || 'http://localhost:5000';
const token = process.env.E2E_STUDENT_TOKEN;
const quizId = process.env.E2E_TIMED_QUIZ_ASSIGNMENT_ID;

test.describe('timed quiz race and reconnect behavior', () => {
  test('start is idempotent and reconnect restores server remaining time', async ({ request }) => {
    test.skip(!token || !quizId, 'Set E2E_STUDENT_TOKEN and E2E_TIMED_QUIZ_ASSIGNMENT_ID');

    const headers = { Authorization: `Bearer ${token}` };
    const first = await request.post(`${api}/api/assignments/${quizId}/quiz/start`, { headers });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();

    const second = await request.post(`${api}/api/assignments/${quizId}/quiz/start`, { headers });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();

    const firstAttempt = firstBody.data || firstBody;
    const secondAttempt = secondBody.data || secondBody;
    expect(secondAttempt.attemptDeadlineAt).toBe(firstAttempt.attemptDeadlineAt);
    expect(secondAttempt.remainingSeconds).toBeLessThanOrEqual(firstAttempt.remainingSeconds);
  });

  test('simultaneous submit attempts produce one terminal success', async ({ request }) => {
    test.skip(!token || !quizId, 'Set E2E_STUDENT_TOKEN and E2E_TIMED_QUIZ_ASSIGNMENT_ID');

    const headers = { Authorization: `Bearer ${token}` };
    await request.post(`${api}/api/assignments/${quizId}/quiz/start`, { headers });

    const attempts = await Promise.all([
      request.post(`${api}/api/submissions`, { headers, data: { assignment: quizId, answers: {} } }),
      request.post(`${api}/api/submissions`, { headers, data: { assignment: quizId, answers: {} } }),
    ]);
    const statuses = attempts.map((res) => res.status()).sort();
    expect(statuses.filter((status) => status >= 200 && status < 300)).toHaveLength(1);
    expect(statuses.some((status) => status === 409)).toBe(true);
  });
});
