import { test, expect } from '@playwright/test';
import path from 'path';

const samplePng = path.join(process.cwd(), 'e2e/fixtures/regression-sample.png');
const student = {
  email: 'arjun.menon@student.demo.vidyalms.com',
  password: 'VedantaDemo8!',
};

async function loginViaForm(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#email-address').fill(student.email);
  await page.locator('#password').fill(student.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

test.describe('Regression — inbox compose send + attachment', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('compose message with attachment and send reply in thread', async ({ page }) => {
    await loginViaForm(page);

    const subject = `Regression inbox ${Date.now()}`;
    const body = 'Regression compose with attachment verification.';

    await page.goto('/inbox?compose=1');
    await expect(page.locator('#compose-subject')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Choose group').click();
    const composeToField = page.locator('#compose-to').locator('..');
    await expect(composeToField.getByText('Teachers', { exact: true })).toBeVisible({ timeout: 10_000 });
    await composeToField.getByText('Teachers', { exact: true }).click();
    await expect(composeToField.getByText('Demo Teacher', { exact: true })).toBeVisible({ timeout: 15_000 });
    await composeToField.getByText('Demo Teacher', { exact: true }).click();

    await page.locator('#compose-subject').fill(subject);
    await page.locator('#compose-message').fill(body);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(samplePng);
    await expect(page.getByText(/regression-sample|1 attached|attached/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#compose-subject')).not.toBeVisible({ timeout: 20_000 });

    await page.goto('/inbox?folder=sent');
    await expect(page.getByText(subject)).toBeVisible({ timeout: 20_000 });

    await page.getByText(subject).click();
    await page.getByRole('button', { name: 'Reply' }).click();
    await page.waitForSelector('#reply-message_ifr', { timeout: 20_000 });
    await page.evaluate(() => {
      const editor = (
        window as unknown as { tinymce?: { get: (id: string) => { setContent: (html: string) => void } } }
      ).tinymce?.get('reply-message');
      if (!editor) throw new Error('TinyMCE reply-message editor not ready');
      editor.setContent('<p>Regression reply with attachment.</p>');
    });
    await page.getByLabel('Attach files to reply').click();
    await page.locator('input[type="file"]').last().setInputFiles(samplePng);
    await expect(page.locator('form').getByRole('button', { name: 'Send' })).toBeEnabled({
      timeout: 15_000,
    });
    await page.locator('form').getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Regression reply with attachment.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Forward' }).click();
    await expect(page.locator('#compose-subject')).toBeVisible({ timeout: 15_000 });
    const forwardSubject = await page.locator('#compose-subject').inputValue();
    expect(forwardSubject).toMatch(/^Fwd:\s/i);
    await expect(page.locator('#compose-message')).toHaveValue(/Forwarded message/);

    await page.getByLabel('Choose group').click();
    const forwardToField = page.locator('#compose-to').locator('..');
    await forwardToField.getByText('Teachers', { exact: true }).click();
    await forwardToField.getByText('Demo Teacher', { exact: true }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#compose-subject')).not.toBeVisible({ timeout: 20_000 });

    await page.goto('/inbox?folder=sent');
    await expect(page.getByText(forwardSubject)).toBeVisible({ timeout: 20_000 });
  });
});
