import { test, expect } from '@playwright/test';
import { REGRESSION_UI_IDS } from '../../frontend/src/regression/InventoryUiRegistry';

test.describe('Regression inventory UI ids', () => {
  test('registry lists all expected controls', async () => {
    expect(REGRESSION_UI_IDS.length).toBeGreaterThanOrEqual(76);
    for (const id of REGRESSION_UI_IDS) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test('documents Playwright selector convention', async ({ page }) => {
    await page.setContent(`
      <button type="button" data-regression-id="auth-login">Login</button>
    `);
    await expect(page.locator('[data-regression-id="auth-login"]')).toBeVisible();
  });
});
