import { test, expect, APIRequestContext } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  loginViaForm,
  registerStudent,
} from '../../helpers/live-auth';
import { createCourse, enrollStudent, cleanupEphemeral, captureDownload } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Teacher attendance marking + CSV export.
 * Marking a status auto-persists via POST /api/courses/:id/attendance; we verify
 * through the read-back GET, then exercise the client-side "Export Daily CSV".
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
let studentId: string;
const prefix = `Attend${Date.now()}`;
const studentName = `E2E ${prefix}`;
const today = new Date().toISOString().split('T')[0];

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  // Teacher owns the course → is its instructor, which the attendance UI requires.
  courseId = await createCourse(request, teacherToken, { title: `§21 attendance ${Date.now()}` });
  const stud = await registerStudent(request, prefix);
  studentId = stud.userId;
  await enrollStudent(request, teacherToken, courseId, studentId);
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function statusForStudent(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(
    `${apiURL}/api/courses/${courseId}/attendance?date=${today}`,
    { headers: { Authorization: `Bearer ${teacherToken}` } }
  );
  if (!res.ok()) return null;
  const body = await res.json();
  const list = Array.isArray(body) ? body : [];
  const row = list.find((r: { studentId?: string }) => String(r.studentId) === String(studentId));
  return row?.status ?? null;
}

test.describe('§21 Attendance — mark + export', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('mark a student Present — auto-saves and reads back via API', async ({ page, request }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/attendance`);

    const presentBtn = page.getByRole('button', {
      name: `Set attendance to Present for ${studentName}`,
    });
    await expect(presentBtn).toBeVisible({ timeout: 30_000 });

    const [saveRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/courses/${courseId}/attendance` &&
          r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      presentBtn.click(),
    ]);
    expect(saveRes.ok(), await saveRes.text()).toBeTruthy();

    await expect.poll(() => statusForStudent(request), { timeout: 15_000 }).toBe('present');
  });

  test('Export Daily CSV downloads a non-empty file', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/attendance`);

    const exportBtn = page.getByRole('button', { name: /export daily csv|export csv/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 30_000 });

    const { filename, size } = await captureDownload(page, async () => {
      await exportBtn.click();
    });

    expect(filename).toMatch(/attendance.*\.csv$/i);
    expect(size).toBeGreaterThan(0);
  });
});
