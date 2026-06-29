/**
 * §14.6–14.7 — Discussion deep + Groups visual verification with snapshots.
 * Run: npm run test:e2e:section-14-6-7
 */
import { test, expect, Page, Locator } from '@playwright/test';
import {
  mathCourseId,
  rationalThreadId,
  teacher,
  student,
  loginViaForm,
} from '../helpers/live-auth';

async function snap(
  page: Page,
  name: string,
  opts?: { skipNetworkIdle?: boolean; fullPage?: boolean; locator?: Locator },
) {
  if (!opts?.skipNetworkIdle) {
    await page.waitForLoadState('networkidle').catch(() => {});
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

async function openFirstGroupHome(page: Page) {
  await page.goto(`/courses/${mathCourseId}/groups`);
  await expect(page.getByRole('button', { name: 'Create Group Set' })).toBeVisible({
    timeout: 20_000,
  });

  await page.locator('h4.font-medium').first().click();
  await expect(page.getByText(/Groups in/i).first()).toBeVisible({ timeout: 15_000 });

  const teamCard = page.locator('h4.font-semibold').first();
  await expect(teamCard).toBeVisible({ timeout: 15_000 });
  await teamCard.click();
  await expect(page).toHaveURL(/\/groups\/[a-f0-9]+/i, { timeout: 15_000 });
}

test.describe('§14.6 Discussion — visual snapshots', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('seeded discussion thread — desktop snapshot', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${rationalThreadId}`);
    await expect(page.getByRole('heading', { name: /rational numbers/i })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, '14-6-discussion-thread-desktop', { fullPage: false });
  });

  test('discussion list — desktop snapshot', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/discussions`);
    await expect(page.getByRole('button', { name: /create new thread/i })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, '14-6-discussion-list-desktop');
  });
});

test.describe.serial('§14.7 Groups — journeys + snapshots', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('global /groups loads for student', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /groups/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, '14-7-global-groups-student');
  });

  test('course group set view — teacher', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/groups`);
    await expect(page.getByRole('button', { name: 'Create Group Set' })).toBeVisible({
      timeout: 20_000,
    });
    const groupSetCard = page.locator('h4.font-medium').first();
    if (await groupSetCard.isVisible().catch(() => false)) {
      await groupSetCard.click();
      await expect(page.getByText(/Groups in/i).first()).toBeVisible({ timeout: 15_000 });
    }
    await snap(page, '14-7-course-group-set');
  });

  test('group home — teacher snapshot', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await openFirstGroupHome(page);
    await expect(page.getByText(/member|home|task/i).first()).toBeVisible({ timeout: 15_000 });
    await snap(page, '14-7-group-home');
  });

  test('group people tab loads', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await openFirstGroupHome(page);
    await page.getByRole('link', { name: 'People' }).click();
    await expect(page).toHaveURL(/\/people/i, { timeout: 15_000 });
    await expect(page.getByText(/member|people|add student/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '14-7-group-people');
  });

  test('group pages tab loads', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await openFirstGroupHome(page);
    await page.getByRole('link', { name: 'Pages' }).click();
    await expect(page).toHaveURL(/\/pages/i, { timeout: 15_000 });
    await expect(page.getByText(/page|create/i).first()).toBeVisible({ timeout: 15_000 });
    await snap(page, '14-7-group-pages');
  });

  test('group discussion tab loads', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await openFirstGroupHome(page);
    await page.getByRole('link', { name: /^Discussion$/i }).click();
    await expect(page).toHaveURL(/\/discussion/i, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /discussion/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '14-7-group-discussion');
  });
});
