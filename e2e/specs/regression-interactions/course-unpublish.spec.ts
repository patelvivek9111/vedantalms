import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, admin, loginViaForm } from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Admin course unpublish toggle.
 * PATCH /api/courses/:id/publish toggles the published flag. We seed a published
 * course, click the row's "Unpublish course" action, and verify it flips to false.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
const courseTitle = `§21 unpublish ${Date.now()}`;

async function isPublished(request: APIRequestContext, token: string): Promise<boolean | null> {
  const res = await request.get(`${apiURL}/api/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  const course = body.data || body;
  return Boolean(course.published);
}

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: courseTitle });
  // Courses start unpublished; toggle once so it is published for the unpublish test.
  const pub = await request.patch(`${apiURL}/api/courses/${courseId}/publish`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { published: true },
  });
  expect(pub.ok(), await pub.text()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

test.describe('§21 Admin courses — unpublish', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('admin unpublishes a published course from the oversight table', async ({ page, request }) => {
    expect(await isPublished(request, teacherToken)).toBe(true);

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/courses');

    await page.getByPlaceholder('Search courses...').fill(courseTitle);

    const unpublishBtn = page.locator('button[aria-label="Unpublish course"]:visible').first();
    await expect(unpublishBtn).toBeVisible({ timeout: 20_000 });

    const [patchRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/courses/${courseId}/publish` &&
          r.request().method() === 'PATCH',
        { timeout: 20_000 }
      ),
      unpublishBtn.click(),
    ]);
    expect(patchRes.ok(), await patchRes.text()).toBeTruthy();

    await expect.poll(() => isPublished(request, teacherToken), { timeout: 15_000 }).toBe(false);
  });
});
