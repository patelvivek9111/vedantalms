import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mathCourseId, teacher, student, loginViaForm } from '../helpers/live-auth';

const pages: { name: string; path: string; role: 'teacher' | 'student' }[] = [
  { name: 'dashboard', path: '/dashboard', role: 'teacher' },
  { name: 'course overview', path: `/courses/${mathCourseId}`, role: 'teacher' },
  { name: 'gradebook', path: `/courses/${mathCourseId}/gradebook`, role: 'teacher' },
  { name: 'student dashboard', path: '/dashboard', role: 'student' },
  { name: 'student course', path: `/courses/${mathCourseId}`, role: 'student' },
];

test.describe('Accessibility — live pages (axe)', () => {
  for (const entry of pages) {
    test(`${entry.name} has no serious axe violations`, async ({ page }) => {
      const creds = entry.role === 'teacher' ? teacher : student;
      await loginViaForm(page, creds.email, creds.password);
      await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });
  }
});
