/**
 * §14.3 Courses lifecycle + §14.4 course tab gaps.
 * Run: npm run test:e2e:section-14-3-4 (after seed:e2e:visual + API :5000 + Vite :3001)
 */
import { test, expect } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  teacher,
  student,
  getAuthToken,
  loginViaForm,
} from '../helpers/live-auth';

const TEACHER_TABS: { path: string; heading: RegExp }[] = [
  { path: '', heading: /mathematics|grade 8|overview/i },
  { path: 'syllabus', heading: /course syllabus/i },
  { path: 'modules', heading: /modules/i },
  { path: 'pages', heading: /pages/i },
  { path: 'assignments', heading: /assignments/i },
  { path: 'quizzes', heading: /quizzes/i },
  { path: 'discussions', heading: /discussions/i },
  { path: 'announcements', heading: /announcements/i },
  { path: 'polls', heading: /polls/i },
  { path: 'groups', heading: /groups/i },
  { path: 'meetings', heading: /meetings|schedule/i },
  { path: 'attendance', heading: /attendance/i },
  { path: 'gradebook', heading: /gradebook|export excel/i },
  { path: 'students', heading: /add students|enrolled students|instructor/i },
];

test.describe.serial('§14.3 — course lifecycle gaps', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('course color — teacher changes default color on dashboard', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const courseRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(courseRes.ok()).toBeTruthy();
    const courseBody = await courseRes.json();
    const course = courseBody.data || courseBody;
    const originalColor = course.defaultColor || '#556B2F';
    const newColor = originalColor === '#E2725B' ? '#228B22' : '#E2725B';

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/dashboard');
    const courseCard = page.locator('[data-course-card]').filter({
      hasText: /MATH8|Mathematics/i,
    }).first();
    await expect(courseCard).toBeVisible({ timeout: 20_000 });

    await courseCard.locator('button').first().click();
    await expect(page.getByText('Choose Color')).toBeVisible({ timeout: 10_000 });

    const colorName = newColor === '#E2725B' ? 'Terra Cotta' : 'Forest Green';
    const colorSave = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/courses/${getMathCourseId()}`) &&
        r.request().method() === 'PUT' &&
        r.ok()
    );
    await page.getByTitle(colorName).click();
    await colorSave;

    const afterRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const after = (await afterRes.json()).data || (await afterRes.json());
    expect(after.defaultColor).toBe(newColor);

    // Restore original color
    await request.put(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { defaultColor: originalColor },
    });
  });

  test('configure overview — save announcement settings', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const courseRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const course = (await courseRes.json()).data || (await courseRes.json());
    const original = course.overviewConfig || {
      showLatestAnnouncements: false,
      numberOfAnnouncements: 3,
    };
    const toggled = {
      showLatestAnnouncements: !original.showLatestAnnouncements,
      numberOfAnnouncements: original.numberOfAnnouncements || 3,
    };

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}`);
    await page.getByRole('button', { name: 'Configure Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Overview Configuration' })).toBeVisible({
      timeout: 10_000,
    });

    const toggleLabel = page.locator('label.relative.inline-flex.items-center.cursor-pointer').first();
    const isChecked = await page.locator('input[type="checkbox"]').first().isChecked();
    if (toggled.showLatestAnnouncements !== isChecked) {
      await toggleLabel.click();
    }

    const saveRes = page.waitForResponse(
      (r) =>
        r.url().includes('/overview-config') &&
        r.request().method() === 'PUT' &&
        r.ok()
    );
    await page.getByRole('button', { name: 'Save Configuration' }).click();
    await saveRes;

    const verifyRes = await request.get(`${apiURL}/api/courses/${getMathCourseId()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updated = (await verifyRes.json()).data || (await verifyRes.json());
    expect(updated.overviewConfig?.showLatestAnnouncements).toBe(toggled.showLatestAnnouncements);

    // Restore
    await request.put(`${apiURL}/api/courses/${getMathCourseId()}/overview-config`, {
      headers: { Authorization: `Bearer ${token}` },
      data: original,
    });
  });

  test('enrollment join token — API returns join code and path', async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    const res = await request.get(`${apiURL}/api/courses/${getMathCourseId()}/enrollment-join-info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.joinCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(body.joinPath).toMatch(/\/join-course\?t=/);
    expect(body.joinUrl).toBeTruthy();
  });
});

test.describe.serial('§14.4 — course section journeys', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('all teacher tabs load via direct URL', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    for (const tab of TEACHER_TABS) {
      const url = tab.path
        ? `/courses/${mathCourseId}/${tab.path}`
        : `/courses/${mathCourseId}`;
      await page.goto(url);
      await expect(page.getByText(tab.heading).first()).toBeVisible({ timeout: 25_000 });
    }
  });

  test('syllabus — edit and save details', async ({ page }) => {
    const officeValue = `E2E office ${Date.now()}`;
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/syllabus`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('#syllabus-office').fill(officeValue);
    const saveRes = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/courses/${getMathCourseId()}`) &&
        r.request().method() === 'PUT' &&
        r.ok()
    );
    await page.getByRole('button', { name: 'Save details' }).click();
    await saveRes;
    await expect(page.getByText(officeValue)).toBeVisible({ timeout: 15_000 });
  });

  test('attendance — teacher marks student present (daily + calendar)', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/attendance`);
    await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible({
      timeout: 25_000,
    });

    const presentBtn = page
      .getByRole('button', { name: /set attendance to present/i })
      .first();
    await expect(presentBtn).toBeVisible({ timeout: 20_000 });

    const markRes = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/courses/${getMathCourseId()}/attendance`) &&
        r.request().method() === 'POST' &&
        r.ok()
    );
    await presentBtn.click();
    await markRes;
    await expect(presentBtn).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Calendar View' }).click();
    await expect(page.getByText('Monthly Attendance Calendar')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Daily View' }).click();
    await expect(page.getByRole('heading', { name: /student attendance/i })).toBeVisible();
  });

  test('student grades tab loads', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/grades`);
    await expect(page.getByRole('heading', { name: 'My Grades' })).toBeVisible({
      timeout: 20_000,
    });
  });
});
