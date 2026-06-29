import { test, expect } from '@playwright/test';
import { admin, teacher, loginViaForm } from '../helpers/live-auth';

const adminPages = [
  { path: '/admin/users', heading: /User Management/i },
  { path: '/admin/courses', heading: /Course Oversight|Courses/i },
  { path: '/admin/analytics', heading: /Analytics/i },
  { path: '/admin/settings', heading: /System Settings|Settings/i },
  { path: '/admin/security', heading: /Security/i },
  { path: '/admin/backup', heading: /Backup/i },
] as const;

test.describe('§10 Admin — /admin/* pages load', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);
  });

  for (const { path, heading } of adminPages) {
    test(`admin page loads: ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
        timeout: 25_000,
      });
    });
  }

  test('admin dashboard shows quick links', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /User Management/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: /Course Oversight/i })).toBeVisible();
  });
});

test.describe('§10 Admin — teacher blocked from /admin/users', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('teacher visiting /admin/users is redirected to unauthorized', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/admin/users');
    await page.waitForURL('**/unauthorized', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '401' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
