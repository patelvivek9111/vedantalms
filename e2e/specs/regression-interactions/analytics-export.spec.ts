import { test, expect } from '@playwright/test';
import { admin, loginViaForm } from '../../helpers/live-auth';
import { captureDownload } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Admin Analytics "Export Report".
 * Previously a dead button (no handler). Now it builds a CSV from the loaded
 * analytics data and triggers a client-side download. We assert a real file
 * lands with the expected name + non-empty body.
 */

test.describe('§21 Admin Analytics — export report', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Export Report downloads a non-empty analytics CSV', async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);

    // Wait for the analytics data to load so the export has rows to serialize.
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/admin/analytics') && r.request().method() === 'GET',
        { timeout: 30_000 }
      ),
      page.goto('/admin/analytics'),
    ]);

    const exportBtn = page.getByRole('button', { name: 'Export Report' });
    await expect(exportBtn).toBeVisible({ timeout: 20_000 });

    const { filename, size } = await captureDownload(page, async () => {
      await exportBtn.click();
    });

    expect(filename).toMatch(/analytics-report-.*\.csv$/);
    expect(size).toBeGreaterThan(0);
  });
});
