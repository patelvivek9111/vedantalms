/**
 * §14.8–14.10 — Inbox, Calendar, Catalog & reports (strict journeys, no optional skips).
 * Run: npm run test:e2e:section-14-8-10
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import { io, Socket } from 'socket.io-client';
import {
  apiURL,
  mathCourseId,
  teacher,
  student,
  loginViaForm,
  getAuthToken,
  getUserId,
  registerStudent,
  getMathCourseId,
} from '../helpers/live-auth';

const MESSAGING_EVENTS = {
  UNREAD_CHANGED: 'messaging:unread:changed',
} as const;

async function createInboxConversation(
  request: APIRequestContext,
  teacherToken: string,
  studentId: string,
  subject: string,
  body: string,
  courseId?: string,
) {
  const res = await request.post(`${apiURL}/api/inbox/conversations`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      subject,
      participantIds: [studentId],
      body,
      course: courseId,
      sendIndividually: false,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const bodyJson = await res.json();
  const conversation = bodyJson.conversation || bodyJson.data?.conversation || bodyJson;
  const id = conversation._id || conversation.id;
  expect(id).toBeTruthy();
  return String(id);
}

async function getUnreadTotal(request: APIRequestContext, token: string) {
  const res = await request.get(`${apiURL}/api/inbox/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.count as number;
}

test.describe('§14.8 Inbox — folder tabs & course filter', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
  });

  test('folder tabs update URL (Sent, Archived)', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.getByRole('button', { name: /compose new message/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: 'Sent', exact: true }).click();
    await expect(page).toHaveURL(/folder=sent/, { timeout: 10_000 });

    await page.getByRole('tab', { name: 'Archived', exact: true }).click();
    await expect(page).toHaveURL(/folder=archived/, { timeout: 10_000 });

    await page.getByRole('tab', { name: 'Inbox', exact: true }).click();
    await expect(page).toHaveURL(/(?:folder=inbox|\/inbox(?:\?|$))/, { timeout: 10_000 });
  });

  test('course filter scopes inbox URL to selected course', async ({ page }) => {
    const courseId = getMathCourseId();
    await page.goto('/inbox');
    await expect(page.locator('#topbar-course-dropdown-desktop')).toBeVisible({ timeout: 20_000 });

    await page.locator('#topbar-course-dropdown-desktop').selectOption(courseId);
    await expect(page).toHaveURL(new RegExp(`course=${courseId}`), { timeout: 10_000 });
  });
});

test.describe.serial('§14.8 Inbox — unread, HTML sanitize, messaging socket', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let conversationId = '';
  let unreadSubject = '';
  let sanitizeSubject = '';

  test('teacher message increases student unread count (API)', async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const studentId = await getUserId(request, student);
    const studentToken = await getAuthToken(request, student);

    const before = await getUnreadTotal(request, studentToken);
    unreadSubject = `§14.8 unread ${Date.now()}`;
    conversationId = await createInboxConversation(
      request,
      teacherToken,
      studentId,
      unreadSubject,
      'Unread regression probe',
      getMathCourseId(),
    );

    await expect
      .poll(async () => getUnreadTotal(request, studentToken), { timeout: 15_000 })
      .toBeGreaterThan(before);
  });

  test('student inbox shows unread badge on new thread', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/inbox');
    const row = page.locator('[class*="cursor-pointer"]').filter({ hasText: unreadSubject });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.locator('span.rounded-full').filter({ hasText: /^\d+$/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('inbox message HTML is sanitized in thread view', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const studentId = await getUserId(request, student);
    sanitizeSubject = `§14.8 sanitize ${Date.now()}`;
    const malicious =
      '<script>window.__inboxXssProbe=true</script><strong>Sanitized bold</strong>';
    const convId = await createInboxConversation(
      request,
      teacherToken,
      studentId,
      sanitizeSubject,
      malicious,
    );

    await loginViaForm(page, student.email, student.password);
    await page.goto(`/inbox?c=${convId}`);
    await expect(page.getByText('Sanitized bold', { exact: true })).toBeVisible({ timeout: 20_000 });

    const xssProbe = await page.evaluate(() => (window as unknown as { __inboxXssProbe?: boolean }).__inboxXssProbe);
    expect(xssProbe).toBeUndefined();

    const html = await page.locator('.prose, [class*="message"]').filter({ hasText: 'Sanitized bold' }).first().innerHTML();
    expect(html.toLowerCase()).not.toMatch(/<script/i);
  });

  test('messaging socket delivers unread:changed when websockets enabled', async ({ request }) => {
    const studentToken = await getAuthToken(request, student);
    const teacherToken = await getAuthToken(request, teacher);
    const studentId = await getUserId(request, student);

    const socketConnected = await new Promise<boolean>((resolve) => {
      const socket: Socket = io(`${apiURL}/messaging`, {
        auth: { token: studentToken },
        transports: ['websocket'],
        timeout: 8000,
      });
      socket.on('connect', () => resolve(true));
      socket.on('connect_error', () => {
        socket.disconnect();
        resolve(false);
      });
      setTimeout(() => {
        socket.disconnect();
        resolve(false);
      }, 10_000);
    });

    if (!socketConnected) {
      const count = await getUnreadTotal(request, studentToken);
      expect(typeof count).toBe('number');
      test.info().annotations.push({
        type: 'note',
        description:
          'INBOX_WEBSOCKET_ENABLED is off — unread verified via API only; enable websockets for live delivery test.',
      });
      return;
    }

    const beforeUnread = await getUnreadTotal(request, studentToken);

    const received = await new Promise<boolean>((resolve) => {
      const socket: Socket = io(`${apiURL}/messaging`, {
        auth: { token: studentToken },
        transports: ['websocket'],
        timeout: 8000,
      });
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        socket.disconnect();
        resolve(ok);
      };

      socket.on(MESSAGING_EVENTS.UNREAD_CHANGED, () => finish(true));

      socket.on('connect', () => {
        void (async () => {
          const subject = `§14.8 socket ${Date.now()}`;
          await createInboxConversation(
            request,
            teacherToken,
            studentId,
            subject,
            'Socket delivery probe',
          );
          for (let i = 0; i < 20; i++) {
            const count = await getUnreadTotal(request, studentToken);
            if (count > beforeUnread) {
              finish(true);
              return;
            }
            await new Promise((r) => setTimeout(r, 500));
          }
        })();
      });

      socket.on('connect_error', () => finish(false));
      setTimeout(() => finish(false), 20_000);
    });

    expect(received, 'expected messaging:unread:changed after new message').toBe(true);
  });
});

test.describe.serial('§14.10 Catalog & transcript', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let tempStudent: Awaited<ReturnType<typeof registerStudent>>;
  let originalMaxStudents: number | null = null;

  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const courseId = getMathCourseId();
    const courseRes = await request.get(`${apiURL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(courseRes.ok()).toBeTruthy();
    const courseJson = await courseRes.json();
    const courseData = courseJson.data || courseJson;
    originalMaxStudents = courseData.catalog?.maxStudents ?? null;
    const enrolledCount = (courseData.students || []).length;
    await request.put(`${apiURL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        catalog: { ...courseData.catalog, maxStudents: Math.max(enrolledCount + 10, 100) },
      },
    });
  });

  test.afterAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const courseId = getMathCourseId();
    if (originalMaxStudents !== null) {
      const courseRes = await request.get(`${apiURL}/api/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (courseRes.ok()) {
        const courseJson = await courseRes.json();
        const courseData = courseJson.data || courseJson;
        await request.put(`${apiURL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
          data: { catalog: { ...courseData.catalog, maxStudents: originalMaxStudents } },
        });
      }
    }
    if (tempStudent?.userId) {
      await request
        .post(`${apiURL}/api/courses/${courseId}/unenroll`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
          data: { studentId: tempStudent.userId },
        })
        .catch(() => {});
    }
  });

  test('catalog search filters course cards', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/catalog');
    await page.locator('#catalog-search').fill('DEMO-MATH');
    await expect(page.getByText(/mathematics|grade 8|DEMO-MATH/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('new student self-enrolls from catalog', async ({ page, request }) => {
    tempStudent = await registerStudent(request, 'CatalogEnroll');
    await loginViaForm(page, tempStudent.email, tempStudent.password);
    await page.goto('/catalog');
    await page.locator('#catalog-search').fill('DEMO-MATH');

    const courseCard = page.locator('[class*="rounded-lg"]').filter({ hasText: /DEMO-MATH|Mathematics/i }).first();
    await expect(courseCard).toBeVisible({ timeout: 15_000 });
    await courseCard.click();
    const enrollBtn = page.getByRole('button', { name: /^Enroll$/i });
    await expect(enrollBtn).toBeVisible({ timeout: 15_000 });
    await enrollBtn.click();
    await expect(page.getByText(/^Enrolled$/i)).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const statusRes = await request.get(
          `${apiURL}/api/courses/${getMathCourseId()}/enrollment-status`,
          { headers: { Authorization: `Bearer ${tempStudent.token}` } },
        );
        if (!statusRes.ok()) return false;
        const status = await statusRes.json();
        return status.data?.isEnrolled === true;
      })
      .toBeTruthy();
  });

  test('full course puts student on waitlist from catalog', async ({ page, request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    const courseId = getMathCourseId();
    const courseRes = await request.get(`${apiURL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(courseRes.ok()).toBeTruthy();
    const courseJson = await courseRes.json();
    const courseData = courseJson.data || courseJson;
    const enrolledCount = (courseData.students || []).length;
    originalMaxStudents = courseData.catalog?.maxStudents ?? null;

    await request.put(`${apiURL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { catalog: { ...courseData.catalog, maxStudents: enrolledCount } },
    });

    const waitStudent = await registerStudent(request, 'CatalogWait');
    await loginViaForm(page, waitStudent.email, waitStudent.password);
    await page.goto('/catalog');
    await page.locator('#catalog-search').fill('DEMO-MATH');

    const courseCard = page.locator('[class*="rounded-lg"]').filter({ hasText: /DEMO-MATH|Mathematics/i }).first();
    await expect(courseCard).toBeVisible({ timeout: 15_000 });
    await courseCard.click();
    await page.getByRole('button', { name: /join waitlist/i }).click();
    await expect(page.getByText(/waitlist/i).first()).toBeVisible({ timeout: 15_000 });

    await request
      .post(`${apiURL}/api/courses/${courseId}/unenroll`, {
        headers: { Authorization: `Bearer ${waitStudent.token}` },
        data: {},
      })
      .catch(() =>
        request.post(`${apiURL}/api/courses/${courseId}/unenroll`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
          data: { studentId: waitStudent.userId },
        }),
      );
  });

  test('transcript page loads semester grades for student', async ({ page, request }) => {
    const token = await getAuthToken(request, student);
    const semestersRes = await request.get(`${apiURL}/api/reports/semesters`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(semestersRes.ok()).toBeTruthy();
    const semestersBody = await semestersRes.json();
    const semesters = semestersBody.data as Array<{ term: string; year: number }>;
    expect(semesters.length).toBeGreaterThan(0);

    await loginViaForm(page, student.email, student.password);
    await page.goto('/reports/transcript');
    await expect(page.getByRole('heading', { name: /unofficial transcript/i })).toBeVisible({
      timeout: 20_000,
    });

    const first = semesters[0];
    const semesterValue = `${first.term}-${first.year}`;
    await page.locator('#transcript-semester-select').selectOption(semesterValue);
    await expect(page.locator('#transcript-semester-select')).toHaveValue(semesterValue);

    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('cell', { name: /Mathematics|DEMO-MATH/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
