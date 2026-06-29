import { test, expect } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  teacher,
  getAuthToken,
  loginViaForm,
  registerStudent,
} from '../helpers/live-auth';

let originalMaxStudents: number | null | undefined;
let addedStudentId = '';
let pendingStudentId = '';
let waitlistStudentId = '';

test.describe.serial('§10 Teacher — roster add / waitlist / unenroll', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const courseRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(courseRes.ok()).toBeTruthy();
    const courseJson = await courseRes.json();
    const courseData = courseJson.data || courseJson;
    const enrolledCount = (courseData.students || []).length;
    originalMaxStudents = courseData.catalog?.maxStudents ?? null;

    await request.put(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        catalog: {
          ...courseData.catalog,
          maxStudents: Math.max(enrolledCount + 10, 100),
        },
      },
    });
  });

  test.afterAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    if (originalMaxStudents !== undefined) {
      const courseRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (courseRes.ok()) {
        const course = await courseRes.json();
        const courseData = course.data || course;
        await request.put(`${apiURL}/api/courses/${getMathCourseId()}`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
          data: {
            catalog: {
              ...courseData.catalog,
              maxStudents: originalMaxStudents,
            },
          },
        });
      }
    }
    for (const id of [addedStudentId, pendingStudentId, waitlistStudentId]) {
      if (!id) continue;
      await request
        .post(`${apiURL}/api/courses/${getMathCourseId()}/unenroll`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
          data: { studentId: id },
        })
        .catch(() => {});
    }
  });

  test('teacher approves QR pending enrollment', async ({ page, request }) => {
    const suffix = String(Date.now());
    const temp = await registerStudent(request, `RosterPending${suffix}`);
    pendingStudentId = temp.userId;

    const joinInfo = await request.get(`${apiURL}/api/courses/${getMathCourseId()}/enrollment-join-info`, {
      headers: { Authorization: `Bearer ${await getAuthToken(request, teacher)}` },
    });
    expect(joinInfo.ok()).toBeTruthy();
    const { joinCode } = await joinInfo.json();

    const enroll = await request.post(`${apiURL}/api/courses/enroll-by-qr`, {
      headers: { Authorization: `Bearer ${temp.token}` },
      data: { joinCode },
    });
    expect(enroll.ok()).toBeTruthy();
    const enrollBody = await enroll.json();
    expect(enrollBody.awaitingTeacherApproval).toBeTruthy();

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/students`);
    const pendingSection = page.locator('section[aria-labelledby="pending-approval-heading"]');
    await expect(pendingSection).toBeVisible({ timeout: 20_000 });
    await pendingSection.getByRole('button', { name: 'Approve' }).click();
    await expect(
      page.getByRole('region', { name: /Enrolled students/i }).getByText(`E2E RosterPending${suffix}`)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('teacher approves waitlisted student', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const courseRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const courseJson = await courseRes.json();
    const courseData = courseJson.data || courseJson;
    const enrolledCount = (courseData.students || []).length;
    await request.put(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { catalog: { ...courseData.catalog, maxStudents: enrolledCount } },
    });

    const suffix = String(Date.now());
    const temp = await registerStudent(request, `RosterWait${suffix}`);
    waitlistStudentId = temp.userId;

    const joinInfo = await request.get(`${apiURL}/api/courses/${getMathCourseId()}/enrollment-join-info`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const { joinCode } = await joinInfo.json();

    const enroll = await request.post(`${apiURL}/api/courses/enroll-by-qr`, {
      headers: { Authorization: `Bearer ${temp.token}` },
      data: { joinCode },
    });
    expect(enroll.ok()).toBeTruthy();
    const enrollBody = await enroll.json();
    expect(enrollBody.waitlisted).toBeTruthy();

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/students`);
    const waitlistSection = page.locator('section[aria-labelledby="waitlist-heading"]');
    await expect(waitlistSection).toBeVisible({ timeout: 20_000 });
    await waitlistSection.getByRole('button', { name: 'Approve' }).last().click();
    await expect(
      page.getByRole('region', { name: /Enrolled students/i }).getByText(`E2E RosterWait${suffix}`)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('teacher adds student via search', async ({ page, request }) => {
    const suffix = String(Date.now());
    const temp = await registerStudent(request, `RosterAdd${suffix}`);
    addedStudentId = temp.userId;

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/students`);
    await expect(page.getByText(/Manage enrollment/i)).toBeVisible({ timeout: 25_000 });

    const search = page.getByPlaceholder('Search by name or email…');
    await search.fill(temp.email);
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(`E2E RosterAdd${suffix}`)).toBeVisible({ timeout: 15_000 });
  });

  test('teacher unenrolls added student', async ({ page, request }) => {
    test.skip(!addedStudentId, 'Add student test did not run');

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/students`);
    const removeBtn = page.getByRole('button', { name: /Remove E2E RosterAdd/i });
    await removeBtn.first().click();
    await expect(page.getByRole('button', { name: /Remove E2E RosterAdd/i })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
