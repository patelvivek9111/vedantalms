import { test, expect } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  loginViaForm,
  registerStudent,
} from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 Step 6 — People / enrollment write flow gap.
 * roster-live already covers add / remove / approve-pending / approve-waitlist via UI.
 * The remaining deferred item is **deny** an enrollment request — covered here.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 people course ${Date.now()}` });
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

test.describe('§21 People — enrollment write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('teacher denies a pending QR enrollment request', async ({ page, request }) => {
    const suffix = String(Date.now());
    const temp = await registerStudent(request, `PeopleDeny${suffix}`);

    const joinInfo = await request.get(
      `${apiURL}/api/courses/${courseId}/enrollment-join-info`,
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    expect(joinInfo.ok(), await joinInfo.text()).toBeTruthy();
    const { joinCode } = await joinInfo.json();

    const enroll = await request.post(`${apiURL}/api/courses/enroll-by-qr`, {
      headers: { Authorization: `Bearer ${temp.token}` },
      data: { joinCode },
    });
    expect(enroll.ok(), await enroll.text()).toBeTruthy();
    const enrollBody = await enroll.json();
    expect(enrollBody.awaitingTeacherApproval).toBeTruthy();

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/students`);

    const pendingSection = page.locator('section[aria-labelledby="pending-approval-heading"]');
    await expect(pendingSection).toBeVisible({ timeout: 20_000 });
    await expect(pendingSection.getByText(`E2E PeopleDeny${suffix}`)).toBeVisible();

    await pendingSection.getByRole('button', { name: /^deny$/i }).first().click();

    // Request cleared: student no longer pending, and not enrolled.
    await expect(pendingSection.getByText(`E2E PeopleDeny${suffix}`)).toHaveCount(0, {
      timeout: 15_000,
    });

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          const body = await res.json();
          const course = body.data || body;
          const req = (course.enrollmentRequests || []).find(
            (r: { student: string | { _id?: string }; status: string }) => {
              const sid = typeof r.student === 'string' ? r.student : r.student?._id;
              return String(sid) === String(temp.userId);
            }
          );
          return req?.status || 'none';
        },
        { timeout: 15_000 }
      )
      .toMatch(/denied|rejected|none/i);
  });
});
