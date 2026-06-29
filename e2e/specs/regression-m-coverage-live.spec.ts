/**
 * §14 inventory — convert remaining manual (M) load/journey gaps to automated coverage.
 * Run: npm run test:e2e:m-coverage (after seed:e2e:visual + API + Vite)
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  teacher,
  student,
  getAuthToken,
  loginViaForm,
} from '../helpers/live-auth';

let tempGroupSetName = '';
let tempGroupId = '';

async function createGroupSetWithGroups(request: APIRequestContext, token: string) {
  tempGroupSetName = `M-coverage ${Date.now()}`;
  const res = await request.post(`${apiURL}/api/groups/sets`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: tempGroupSetName,
      courseId: getMathCourseId(),
      allowSelfSignup: false,
      groupStructure: 'byGroupCount',
      groupCount: 2,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const groups = body.groups || body.data?.groups || [];
  tempGroupId = groups[0]?._id || '';
  expect(tempGroupId).toBeTruthy();
}

test.describe.serial('§14 M-coverage — shell & account', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('desktop global sidebar — nav items load and navigate', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/dashboard');
    const sidebar = page.getByTestId('global-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    await sidebar.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(/\/calendar/, { timeout: 15_000 });

    await sidebar.getByRole('link', { name: 'Inbox' }).click();
    await expect(page).toHaveURL(/\/inbox/, { timeout: 15_000 });

    await sidebar.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15_000 });
  });

  test('notification bell — panel loads on click', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Notifications/i }).click();
    await expect(page.getByRole('heading', { name: 'Notifications', level: 2 })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('login activity — section loads and filter changes', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=activity');
    await expect(page.getByRole('heading', { name: 'Recent Login Activity' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('#activity-filter')).toBeVisible();

    const activityResponse = page.waitForResponse(
      (res) => res.url().includes('/api/auth/login-activity') && res.request().method() === 'GET'
    );
    await page.locator('#activity-filter').selectOption('30');
    const res = await activityResponse;
    expect(res.ok()).toBeTruthy();

    await expect(
      page.getByText(/Showing \d+ of \d+ records|No login activity found/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe.serial('§14 M-coverage — course tabs & groups', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const token = await getAuthToken(request, teacher);
    await createGroupSetWithGroups(request, token);
  });

  test('student grades tab loads', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/grades`);
    await expect(page.getByRole('heading', { name: 'My Grades' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('syllabus tab loads for teacher', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/syllabus`);
    await expect(page.getByRole('heading', { name: 'Course Syllabus' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/official course information/i)).toBeVisible();
  });

  test('course meetings tab loads schedule UI', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/meetings`);
    await expect(page.getByText(/Upcoming Meetings|Schedule/i).first()).toBeVisible({
      timeout: 20_000,
    });
    const scheduleBtn = page.getByRole('button', { name: /Schedule/i });
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await scheduleBtn.click();
      await expect(page.getByPlaceholder('Meeting title')).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
    }
  });

  test('auto group assign — create set modal exposes split options', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/groups`);
    await page.getByRole('button', { name: 'Create Group Set' }).click();
    await expect(page.getByRole('heading', { name: 'Create Group Set' })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('#groupStructure').selectOption('byStudentsPerGroup');
    await expect(page.locator('#studentsPerGroup')).toBeVisible();
    await page.locator('#groupStructure').selectOption('byGroupCount');
    await expect(page.locator('#groupCount')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('auto group assign — API split creates groups visible in UI', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/groups`);
    await page.getByText(tempGroupSetName, { exact: false }).first().click();
    await expect(page.getByText(`Groups in ${tempGroupSetName}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Group 1/i).first()).toBeVisible();
  });

  test('group meetings tab loads', async ({ page }) => {
    test.skip(!tempGroupId, 'No group created in beforeAll');
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/groups/${tempGroupId}/meetings`);
    await expect(page.getByRole('heading', { name: 'Meetings', exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    const scheduleBtn = page.getByRole('button', { name: /Schedule|New meeting/i }).first();
    if (await scheduleBtn.isVisible().catch(() => false)) {
      await scheduleBtn.click();
      await expect(page.getByPlaceholder(/title|meeting/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('§14 M-coverage — QuizWave mobile immersive', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('QuizWave join screen renders immersive shell on mobile', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/quizwave/join');
    await expect(page.getByRole('heading', { name: 'QuizWave' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/enter the game pin/i)).toBeVisible();
    await expect(page.getByPlaceholder('000000')).toBeVisible();
    await expect(page.getByPlaceholder(/nickname/i)).toBeVisible();
  });
});
