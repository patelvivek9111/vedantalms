/**
 * §14.11–14.12 — QuizWave + Admin (strict journeys).
 * Run: npm run test:e2e:section-14-11-12
 */
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  admin,
  teacher,
  student,
  mathCourseId,
  loginViaForm,
} from '../helpers/live-auth';

async function ensureQuizWaveDashboard(page: Page, courseId: string) {
  await page.goto(`/courses/${courseId}/quizwave`);
  const closeSession = page.getByRole('button', { name: /^Close( session)?$/i });
  if (await closeSession.first().isVisible({ timeout: 4_000 }).catch(() => false)) {
    await page.waitForTimeout(2_500);
    await closeSession.first().click();
  }
  await expect(page.getByRole('button', { name: 'Start session' }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe.serial('§14.11 QuizWave — teacher host + student play', () => {
  let teacherContext: BrowserContext;
  let studentContext: BrowserContext;
  let teacherPage: Page;
  let studentPage: Page;
  let gamePin = '';

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    studentContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    teacherPage = await teacherContext.newPage();
    studentPage = await studentContext.newPage();
  });

  test.afterAll(async () => {
    if (teacherPage) {
      const closeSession = teacherPage.getByRole('button', { name: /^Close( session)?$/i });
      if (await closeSession.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        await teacherPage.waitForTimeout(2_000);
        await closeSession.first().click();
      }
    }
    await teacherContext?.close();
    await studentContext?.close();
  });

  test('teacher dashboard lists seeded quiz and starts session with PIN', async () => {
    await loginViaForm(teacherPage, teacher.email, teacher.password);
    await ensureQuizWaveDashboard(teacherPage, mathCourseId);
    await expect(
      teacherPage.getByRole('button', { name: 'Start session' }).first()
    ).toBeVisible({ timeout: 15_000 });
    const quizCard = teacherPage
      .locator('article')
      .filter({ hasText: /Rational numbers & linear equations/i });
    await quizCard.getByRole('button', { name: 'Start session' }).click();
    await expect(teacherPage.getByText('Game PIN', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const pinEl = teacherPage.getByLabel(/^Game PIN \d/);
    await expect(pinEl).toBeVisible();
    const pinLabel = await pinEl.getAttribute('aria-label');
    gamePin = (pinLabel || '').replace(/^Game PIN\s*/i, '').replace(/\s/g, '');
    expect(gamePin).toMatch(/^\d{6}$/);
  });

  test('student joins lobby via PIN', async () => {
    expect(gamePin).toMatch(/^\d{6}$/);
    await loginViaForm(studentPage, student.email, student.password);
    await studentPage.goto('/quizwave/join');
    await studentPage.getByPlaceholder('000000').fill(gamePin);
    await studentPage.getByPlaceholder(/nickname/i).fill('E2EPlayer');
    await studentPage.getByRole('button', { name: 'Join Game' }).click();
    await expect(studentPage).toHaveURL(new RegExp(`/quizwave/play/${gamePin}`), {
      timeout: 15_000,
    });
    await expect(studentPage.getByText(/waiting for quiz to start/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('teacher starts quiz, student answers, host sees participation', async () => {
    await teacherPage.getByRole('button', { name: 'Start quiz' }).click();
    await expect(teacherPage.getByText(/Joined students/i)).toBeVisible({ timeout: 20_000 });
    await expect(teacherPage.getByText('E2EPlayer')).toBeVisible({ timeout: 15_000 });

    await expect(studentPage.getByText(/waiting for quiz to start/i)).not.toBeVisible({
      timeout: 25_000,
    });

    await studentPage.locator('.grid button').nth(2).click();
    await expect(studentPage.getByRole('heading', { name: 'Correct' })).toBeVisible({
      timeout: 25_000,
    });

    await expect(
      teacherPage.getByTitle(/\d+ of \d+ participants answered/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('§14.11 QuizWave — mobile immersive join shell', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('join screen shows PIN, nickname, and immersive shell', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/quizwave/join');
    await expect(page.getByRole('heading', { name: 'QuizWave' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/enter the game pin/i)).toBeVisible();
    await expect(page.getByPlaceholder('000000')).toBeVisible();
    await expect(page.getByPlaceholder(/nickname/i)).toBeVisible();
  });
});

test.describe('§14.12 Admin — journeys', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);
  });

  test('dashboard shows stats, storage, recent activity, and quick links', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Total Users').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Total Courses').first()).toBeVisible();
    await expect(page.getByText('Active Users').first()).toBeVisible();
    await expect(page.getByText('Storage Usage').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    await expect(page.getByRole('link', { name: /User Management/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Course Oversight/i })).toBeVisible();
  });

  test('users — search, role filter, and add-user modal', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByPlaceholder('Search users...').fill('teacher');
    await page
      .locator('select')
      .filter({ has: page.locator('option[value="teacher"]') })
      .selectOption('teacher');
    await expect(page.locator('table tbody').getByText(/teacher@vidyalms/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Add User' }).click();
    await expect(page.getByRole('heading', { name: 'Create New User' })).toBeVisible();
    await page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Create New User' }) })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await expect(page.getByRole('heading', { name: 'Create New User' })).not.toBeVisible();
  });

  test('courses — search, published filter, publish control present', async ({ page }) => {
    await page.goto('/admin/courses');
    await expect(page.getByRole('heading', { name: /Course Oversight/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByPlaceholder('Search courses...').fill('DEMO-MATH');
    await page
      .locator('select')
      .filter({ has: page.locator('option[value="published"]') })
      .selectOption('published');
    await expect(page.locator('table').getByText(/DEMO-MATH/i)).toBeVisible({ timeout: 15_000 });
    const mathRow = page.locator('table tbody tr').filter({ hasText: /DEMO-MATH/i });
    await expect(mathRow.getByText('Published')).toBeVisible();
    await expect(mathRow.locator('td').last().locator('button')).toHaveCount(3);
  });

  test('analytics — metrics, date range, export button', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: /Analytics Dashboard/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Total Users').first()).toBeVisible();
    await page.locator('select').filter({ hasText: 'Last 30 days' }).selectOption('7d');
    await expect(page.getByRole('button', { name: /Export Report/i })).toBeVisible();
  });

  test('settings — section tabs, general fields, save', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Operations' }).click();
    await expect(page.getByRole('heading', { name: 'File Recovery Center' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByText('General Settings')).toBeVisible();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 15_000 });
  });

  test('security — stats and recent events', async ({ page }) => {
    await page.goto('/admin/security');
    await expect(page.getByRole('heading', { name: /Security Center/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Security Score').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Security Events' })).toBeVisible();
    await expect(page.getByText(/coming soon/i).first()).toBeVisible();
  });

  test('backup placeholder page loads', async ({ page }) => {
    await page.goto('/admin/backup');
    await expect(page.getByRole('heading', { name: /Backup & Recovery/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/system backup and recovery management/i)).toBeVisible();
  });
});

test.describe('§14.12 Admin — route guard', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('teacher blocked from /admin/users', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/unauthorized/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '401' })).toBeVisible();
  });
});
