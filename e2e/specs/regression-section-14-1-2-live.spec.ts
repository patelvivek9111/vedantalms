/**
 * §14.1–14.2 — Auth, global shell, and Account visual + journey verification.
 * Run: npm run test:e2e:section-14-1-2
 */
import { test, expect, Page, Locator } from '@playwright/test';
import {
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

async function openBurgerMenu(page: Page) {
  const toggle = page
    .getByRole('button', { name: /menu|open navigation|burger|toggle account menu/i })
    .first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
}

test.describe('§14.1 Auth & global shell — journeys', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('login — invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email-address').fill(student.email);
    await page.locator('#password').fill('wrong-password-§14');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/invalid|incorrect|failed|wrong/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login — show/hide password toggle', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#password').fill('secret-test');
    const toggle = page.getByRole('button', { name: /show password/i });
    await toggle.click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  test('signup — register student and land on dashboard', async ({ page }) => {
    const stamp = Date.now();
    const email = `inv14-signup-${stamp}@example.com`;
    await page.goto('/signup');
    await page.locator('#firstName, [name="firstName"]').first().fill('Inv14');
    await page.locator('#lastName, [name="lastName"]').first().fill('Signup');
    await page.locator('#email-address, [name="email"]').first().fill(email);
    await page.locator('#password, [name="password"]').first().fill('password123');
    const roleSelect = page.locator('#role, [name="role"]').first();
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption('student');
    }
    await page.getByRole('button', { name: /sign up|create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });

  test('unauthorized — teacher sees 401 and can escape via sidebar', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/admin/users');
    await page.waitForURL('**/unauthorized', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '401' })).toBeVisible();
    await page.getByTestId('global-sidebar').getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe('§14.1 Auth & global shell — snapshots', () => {
  test('landing page desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
    await snap(page, '14-1-landing-desktop');
  });

  test('login page desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email-address')).toBeVisible();
    await snap(page, '14-1-login-desktop', { fullPage: false });
  });

  test('signup page desktop', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: /sign up|create account/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '14-1-signup-desktop');
  });

  test('dashboard student desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await snap(page, '14-1-dashboard-student-desktop');
  });

  test('global sidebar desktop', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/dashboard');
    const sidebar = page.getByTestId('global-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await snap(page, '14-1-global-sidebar-desktop', { fullPage: false, locator: sidebar });
  });

  test('404 not found', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/this-route-does-not-exist-§14-snap');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await snap(page, '14-1-404-desktop', { fullPage: false });
  });

  test('unauthorized page', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/unauthorized');
    await expect(page.getByRole('heading', { name: '401' })).toBeVisible();
    await snap(page, '14-1-unauthorized-desktop', { fullPage: false });
  });
});

test.describe('§14.1 mobile shell — snapshots', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('bottom nav on dashboard', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/dashboard');
    await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '14-1-bottom-nav-mobile', { fullPage: false });
  });
});

test.describe('§14.2 Account — journeys + snapshots', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('profile — edit bio journey', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=profile');
    await page.getByRole('button', { name: /edit profile/i }).click();
    const bio = `snap14-bio-${Date.now()}`;
    const bioField = page.locator('#bio');
    await bioField.fill(bio);
    const saveRes = page.waitForResponse(
      (r) => r.url().includes('/api/users/me') && r.request().method() === 'PUT' && r.ok()
    );
    await page.getByRole('button', { name: /^save$/i }).click();
    await saveRes;
    await expect(page.getByText(bio)).toBeVisible({ timeout: 15_000 });
  });

  test('notifications — toggle persists after reload', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/account?section=notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({
      timeout: 20_000,
    });
    const firstSwitch = page.getByRole('switch').first();
    await expect(firstSwitch).toBeVisible();
    const wasChecked = await firstSwitch.getAttribute('aria-checked');
    await firstSwitch.click();
    await expect(page.getByText(/preferences saved/i)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    const reloaded = page.getByRole('switch').first();
    await expect(reloaded).not.toHaveAttribute('aria-checked', wasChecked || '');
  });

  test('account profile snapshot', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=profile');
    await expect(page.getByRole('button', { name: /edit profile/i })).toBeVisible({ timeout: 15_000 });
    await snap(page, '14-2-account-profile-desktop');
  });

  test('account settings snapshot', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=settings');
    await expect(page.getByRole('button', { name: /^dark$/i })).toBeVisible({ timeout: 15_000 });
    await snap(page, '14-2-account-settings-desktop');
  });

  test('account notifications snapshot', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/account?section=notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, '14-2-account-notifications-desktop');
  });

  test('account login activity snapshot', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=activity');
    await expect(page.getByRole('heading', { name: 'Recent Login Activity' })).toBeVisible({
      timeout: 20_000,
    });
    await snap(page, '14-2-account-login-activity-desktop');
  });
});
