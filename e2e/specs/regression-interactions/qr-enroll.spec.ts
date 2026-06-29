import { test, expect } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  loginViaForm,
  registerStudent,
} from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral, stubGetUserMedia } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Camera / QR enrollment.
 *
 *  1. Manual join-code flow at /join-course (the camera-free fallback that drives
 *     the SAME POST /api/courses/enroll-by-qr enrollment logic a scan would).
 *  2. The camera scanner modal itself ("Join with QR") renders with getUserMedia
 *     stubbed — no real hardware — proving the camera path mounts cleanly.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
let joinCode: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 qr course ${Date.now()}` });
  const info = await request.get(`${apiURL}/api/courses/${courseId}/enrollment-join-info`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  expect(info.ok(), await info.text()).toBeTruthy();
  joinCode = (await info.json()).joinCode;
  expect(joinCode, 'course should expose a join code').toBeTruthy();
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

test.describe('§21 Enrollment — QR / join-code', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('manual join-code submit enrolls (or requests approval) via enroll-by-qr', async ({
    page,
    request,
  }) => {
    const studentInfo = await registerStudent(request, `QrJoin${Date.now()}`);

    await loginViaForm(page, studentInfo.email, studentInfo.password);
    await page.goto('/join-course');

    await page.locator('#join-course-credential').fill(joinCode);

    const [enrollRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/courses/enroll-by-qr' &&
          r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /^join course$/i }).click(),
    ]);
    expect(enrollRes.ok(), await enrollRes.text()).toBeTruthy();

    // Terminal state: either "Request received" (needs approval) or "You're enrolled".
    await expect(
      page.getByText(/request received|you'?re enrolled/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // Verify the join really registered on the course (pending request or enrolled).
    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          if (!res.ok()) return 'none';
          const course = (await res.json()).data || {};
          const inRequests = (course.enrollmentRequests || []).some(
            (r: { student: string | { _id?: string } }) => {
              const sid = typeof r.student === 'string' ? r.student : r.student?._id;
              return String(sid) === String(studentInfo.userId);
            }
          );
          const inStudents = (course.students || []).some(
            (s: string | { _id?: string }) =>
              String(typeof s === 'string' ? s : s?._id) === String(studentInfo.userId)
          );
          return inRequests || inStudents ? 'present' : 'absent';
        },
        { timeout: 15_000 }
      )
      .toBe('present');
  });

  test('camera scanner modal renders with getUserMedia stubbed', async ({ page, request }) => {
    const studentInfo = await registerStudent(request, `QrScan${Date.now()}`);
    await stubGetUserMedia(page);

    await loginViaForm(page, studentInfo.email, studentInfo.password);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /join with qr/i }).first().click();

    await expect(page.getByRole('heading', { name: /scan course qr/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('#course-qr-reader')).toBeVisible({ timeout: 15_000 });
  });
});
