import { test, expect } from '@playwright/test';

const teacher = {
  email: 'teacher@vidyalms.com',
  password: 'password123',
};

async function loginViaForm(page: import('@playwright/test').Page, creds: typeof teacher) {
  await page.goto('/login');
  await page.locator('#email-address').fill(creds.email);
  await page.locator('#password').fill(creds.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Regression — todo filters', () => {
  test('teacher sees ungraded assignment tasks (role filter)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaForm(page, teacher);
    await page.goto('/todo');
    await expect(page.getByText(/to grade|Ungraded/i).first()).toBeVisible({ timeout: 20_000 });
  });

});
