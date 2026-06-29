import { test, expect, Page, Locator } from '@playwright/test';
import { admin, mathCourseId, rationalThreadId, seededQuizId, student, teacher, loginViaForm } from '../helpers/live-auth';

async function snap(
  page: Page,
  name: string,
  opts?: { skipNetworkIdle?: boolean; fullPage?: boolean; locator?: Locator },
) {
  if (!opts?.skipNetworkIdle) {
    await page.waitForLoadState('networkidle');
  }
  const target = opts?.locator ?? page;
  await expect(target).toHaveScreenshot(`${name}.png`, {
    fullPage: opts?.fullPage ?? true,
    mask: [
      page.locator('img[src*="profile"], img[alt*="avatar" i]'),
      page.locator('[class*="animate-pulse"]'),
    ],
  });
}

test.describe('§7 Visual snapshots — desktop (VIS-01–14)', () => {
  test('VIS-01 login desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email-address')).toBeVisible();
    await snap(page, 'VIS-01-login-desktop');
  });

  test('VIS-02 dashboard student desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await snap(page, 'VIS-02-dashboard-student-desktop');
  });

  test('VIS-03 course overview desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-03-course-overview-desktop');
  });

  test('VIS-06 discussion thread desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${rationalThreadId}`);
    await expect(page.getByRole('heading', { name: /rational numbers/i })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, 'VIS-06-discussion-desktop');
  });

  test('VIS-07 gradebook teacher desktop', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible({ timeout: 25_000 });
    await snap(page, 'VIS-07-gradebook-desktop');
  });

  test('VIS-08 announcements desktop', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/announcements`);
    await expect(page.getByRole('button', { name: /new announcement|create announcement/i })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, 'VIS-08-announcements-desktop');
  });

  test('VIS-09 inbox desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/inbox/);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-09-inbox-desktop');
  });

  test('VIS-10 admin users desktop', async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });
    // Viewport-only: user row count varies with seed mutations across the suite.
    await snap(page, 'VIS-10-admin-users-desktop', { fullPage: false });
  });

  test('VIS-11 calendar desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: 'Today' }).first()).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-11-calendar-desktop');
  });

  test('VIS-12 quizwave lobby desktop', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/quizwave`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-12-quizwave-desktop');
  });

  test('VIS-14 404 desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/this-route-does-not-exist-regression');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await snap(page, 'VIS-14-404-desktop');
  });

  test('VIS-13 offline banner desktop', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#email-address').fill(student.email);
    await page.locator('#password').fill(student.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await expect(page.getByRole('status', { name: /offline/i })).toHaveCount(0);
    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await expect(page.getByText('You appear to be offline')).toBeVisible({ timeout: 10_000 });
    await snap(page, 'VIS-13-offline-banner-desktop', { skipNetworkIdle: true, fullPage: false });
    await context.setOffline(false);
  });
});

test.describe('§7 Visual snapshots — mobile (VIS-01–06, 09, 13)', () => {
  test('VIS-01 login mobile', async ({ page }) => {
    await page.goto('/login');
    await snap(page, 'VIS-01-login-mobile');
  });

  test('VIS-02 dashboard student mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await snap(page, 'VIS-02-dashboard-student-mobile');
  });

  test('VIS-03 course overview mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-03-course-overview-mobile');
  });

  test('VIS-04 assignment view mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${seededQuizId}/view`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-04-assignment-view-mobile');
  });

  test('VIS-05 quiz start screen mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/assignments/${seededQuizId}/view`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-05-quiz-start-mobile');
  });

  test('VIS-06 discussion thread mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${rationalThreadId}`);
    await expect(page.getByRole('heading', { name: /rational numbers/i })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, 'VIS-06-discussion-mobile');
  });

  test('VIS-09 inbox mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/inbox');
    await expect(page.getByRole('heading', { name: /inbox/i })).toBeVisible({ timeout: 20_000 });
    await snap(page, 'VIS-09-inbox-mobile');
  });

  test('VIS-13 offline banner mobile', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#email-address').fill(student.email);
    await page.locator('#password').fill(student.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await expect(page.getByRole('status', { name: /offline/i })).toHaveCount(0);
    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await expect(page.getByText('You appear to be offline')).toBeVisible({ timeout: 10_000 });
    await snap(page, 'VIS-13-offline-banner-mobile', { skipNetworkIdle: true, fullPage: false });
    await context.setOffline(false);
  });
});
