import { test, expect, APIRequestContext } from '@playwright/test';
import { apiURL, getAuthToken, teacher, loginViaForm } from '../../helpers/live-auth';
import { createCourse, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 Step 9 (groups) — Create Group Set via UI (item 41 deferred).
 * DnD member assignment + student course Groups tab remain partial/deferred.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 groups course ${Date.now()}` });
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function listSetNames(request: APIRequestContext): Promise<string[]> {
  const res = await request.get(`${apiURL}/api/groups/sets/${courseId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok()) return [];
  const body = await res.json();
  const list = body.data || body;
  return (Array.isArray(list) ? list : []).map((s: { name?: string }) => s.name || '');
}

test.describe('§21 Groups — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('create group set via UI — persists via API', async ({ page, request }) => {
    const setName = `§21 set ${Date.now()}`;

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/groups`);

    await page.getByRole('button', { name: /create group set/i }).first().click();

    await page.locator('#new-set-name').fill(setName);
    await page.getByRole('button', { name: /^create$/i }).click();

    await expect.poll(() => listSetNames(request), { timeout: 15_000 }).toContain(setName);
  });
});
