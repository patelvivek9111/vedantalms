import { test, expect } from '@playwright/test';

const student = {
  email: 'arjun.menon@student.demo.vidyalms.com',
  password: 'VedantaDemo8!',
};

test.describe('Network offline banner', () => {
  test('shows banner when browser goes offline after login', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#email-address').fill(student.email);
    await page.locator('#password').fill(student.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

    await expect(page.getByRole('status', { name: /offline/i })).toHaveCount(0);

    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await expect(page.getByText('You appear to be offline')).toBeVisible({ timeout: 10_000 });

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await expect(page.getByText('You appear to be offline')).toHaveCount(0);
  });
});
