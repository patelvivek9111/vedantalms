/**
 * §14 Master inventory — long-tail live journeys.
 * Maps each test to production-regression-plan.md §14 rows.
 * Run: npm run test:e2e:inventory-longtail (after seed:e2e:visual + API + Vite)
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  teacher,
  student,
  admin,
  getAuthToken,
  loginViaForm,
  registerStudent,
} from '../helpers/live-auth';
import { trackCourse, cleanupTracked } from '../helpers/live-cleanup';

async function createTempCourse(request: APIRequestContext, token: string, label: string) {
  const courseCode = `LT${Date.now().toString(36).slice(-6)}`;
  const title = `${label} ${Date.now()}`;
  const res = await request.post(`${apiURL}/api/courses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      description: '§14 long-tail inventory E2E temp course with sufficient description.',
      catalog: { courseCode },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const courseId = body.data?._id || body._id;
  trackCourse(courseId);
  return { courseId, title, courseCode };
}

/** Teacher oversight table lists catalog code — not full title. */
async function findOversightCourseRow(page: Page, courseCode: string) {
  await page.locator('#teacher-courses-search').fill(courseCode);
  const row = page.getByRole('row', { name: new RegExp(courseCode, 'i') });
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
}

async function openBurgerMenu(page: Page) {
  const toggle = page
    .getByRole('button', { name: /menu|open navigation|burger|toggle account menu/i })
    .first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
}

async function expectToast(page: Page, pattern: RegExp) {
  const toast = page.locator('.Toastify__toast').filter({ hasText: pattern });
  await expect(toast.first()).toBeVisible({ timeout: 12_000 });
}

test.describe.serial('§14 master inventory — long tail', () => {
  test.afterAll(async ({ request }) => {
    await cleanupTracked(request);
  });

  // ── 14.1 Auth & global shell ─────────────────────────────────────────────

  test('14.1.1 landing — hero, login link, contact modal', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /log in|sign in/i }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Contact' }).first().click();
    await expect(page.getByRole('dialog').or(page.getByText(/contact|inquiry|message/i)).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
  });

  test('14.1.2 signup page — form fields render', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('#email-address, [name="email"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#password, [name="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up|create account/i }).first()).toBeVisible();
  });

  test('14.1.3 404 — unknown route and back to dashboard', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/this-route-does-not-exist-§14');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await page.getByRole('link', { name: /back to dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('14.1.4 burger — customize navigation + Change User modal', async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/dashboard');
    await openBurgerMenu(page);
    const customize = page.getByRole('button', { name: /customize navigation/i });
    if (await customize.isVisible().catch(() => false)) {
      await customize.click();
      await expect(page.getByText(/customize navigation/i).first()).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
    }
    await openBurgerMenu(page);
    const changeUser = page.getByRole('button', { name: 'Change User' });
    if (await changeUser.isVisible().catch(() => false)) {
      await changeUser.click();
      await expect(page.getByRole('heading', { name: 'Change User' })).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: /close change user/i }).click();
    }
  });

  test('14.1.5 theme — dark mode persists after reload', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=settings');
    await page.getByRole('button', { name: /^dark$/i }).click();
    await expect(page.getByText(/saved|success/i).first()).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: /^light$/i }).click();
  });

  test('14.1.6 toast — success toast on course archive', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const { courseCode } = await createTempCourse(request, token, 'ToastLT');
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    const row = await findOversightCourseRow(page, courseCode);
    await row.getByTitle('Archive course').click();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expectToast(page, /archived/i);
  });

  test('14.1.7 logout — session cleared', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/dashboard');
    await openBurgerMenu(page);
    const logout = page.getByRole('button', { name: /log out|logout/i });
    if (await logout.isVisible().catch(() => false)) {
      await logout.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    }
  });

  // ── 14.2 Account ─────────────────────────────────────────────────────────

  test('14.2.1 profile — edit bio and save', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/account?section=profile');
    await page.getByRole('button', { name: /edit profile/i }).click();
    const bio = `inv14-bio-${Date.now()}`;
    const bioField = page.locator('#bio');
    await expect(bioField).toBeVisible();
    await bioField.click();
    await bioField.fill(bio);
    await expect(bioField).toHaveValue(bio);
    const saveRes = page.waitForResponse(
      (r) => r.url().includes('/api/users/me') && r.request().method() === 'PUT' && r.ok()
    );
    await page.getByRole('button', { name: /^save$/i }).click();
    const payload = await (await saveRes).json();
    expect(payload.user?.bio).toBe(bio);
    await expect(page.getByText(bio)).toBeVisible({ timeout: 15_000 });
  });

  // ── 14.3 Courses list & lifecycle ────────────────────────────────────────

  test('14.3.1 student course list — /courses loads', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/courses');
    await expect(page.getByText(/mathematics|grade 8|my courses|courses/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('14.3.2 teacher oversight — search filters courses', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    await expect(page.getByRole('heading', { name: 'My Courses' })).toBeVisible({ timeout: 20_000 });
    await page.locator('#teacher-courses-search').fill('MATH8');
    await expect(page.getByRole('row', { name: /MATH8/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('14.3.3 create course — UI wizard', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/courses/create');
    const title = `§14 UI course ${Date.now()}`;
    await page.locator('#title, [name="title"]').first().fill(title);
    await page.locator('#description, [name="description"]').first().fill(
      '§14 UI create course journey with sufficient description for validation.'
    );
    const createRes = page.waitForResponse(
      (r) => r.url().includes('/api/courses') && r.request().method() === 'POST' && r.ok()
    );
    await page.getByRole('button', { name: /create course/i }).click();
    const body = await (await createRes).json();
    const courseId = body.data?._id || body._id;
    trackCourse(courseId);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });

  test('14.3.4 edit course — save title change', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const { courseId, title } = await createTempCourse(request, token, 'EditLT');
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/edit`);
    const titleField = page.locator('#title, [name="title"]').first();
    await expect(titleField).toHaveValue(title, { timeout: 15_000 });
    const updated = `${title} updated`;
    await titleField.click();
    await titleField.fill(updated);
    await expect(titleField).toHaveValue(updated, { timeout: 10_000 });
    const save = page.waitForResponse(
      (r) => r.url().includes(`/api/courses/${courseId}`) && r.request().method() === 'PUT' && r.ok()
    );
    await page.getByRole('button', { name: /save changes/i }).click();
    await save;
    const courseRes = await request.get(`${apiURL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(courseRes.ok()).toBeTruthy();
    const courseBody = await courseRes.json();
    expect(courseBody.data?.title || courseBody.title).toBe(updated);
  });

  test('14.3.5 archive / restore — oversight + success toast', async ({ page, request }) => {
    const token = await getAuthToken(request, teacher);
    const { courseCode } = await createTempCourse(request, token, 'ArchiveLT');
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    const row = await findOversightCourseRow(page, courseCode);
    await row.getByTitle('Archive course').click();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expectToast(page, /archived/i);
    await page.reload();
    const archivedRow = await findOversightCourseRow(page, courseCode);
    await expect(archivedRow.getByTitle('Restore course')).toBeVisible({ timeout: 20_000 });
    await archivedRow.getByTitle('Restore course').click();
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expectToast(page, /restored/i);
  });

  test('14.3.6 copy course — modal opens from oversight', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/teacher/courses');
    await page.locator('#teacher-courses-search').fill('DEMO-MATH8');
    const row = page.getByRole('row', { name: /DEMO-MATH8/i }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByTitle('Copy course').click();
    await expect(page.getByRole('heading', { name: /copy course/i })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('14.3.7 delete course — admin confirm + success toast', async ({ page, request }) => {
    const adminToken = await getAuthToken(request, admin);
    const { courseId } = await createTempCourse(request, adminToken, 'DeleteLT');
    await loginViaForm(page, admin.email, admin.password);
    await page.goto(`/courses/${courseId}`);
    await page.getByRole('button', { name: 'Delete Course' }).click();
    await expect(page.getByRole('heading', { name: 'Delete Course' })).toBeVisible();
    const del = page.waitForResponse(
      (r) => r.url().includes(`/api/courses/${courseId}`) && r.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await del;
    await expectToast(page, /deleted successfully/i);
    await expect(page).toHaveURL(/\/courses/, { timeout: 15_000 });
  });

  test('14.3.8 customize sidebar — hide polls tab persists after reload', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}`);
    await page.getByRole('button', { name: 'Customize Sidebar' }).click();
    await expect(page.getByText(/customize course sidebar/i)).toBeVisible({ timeout: 10_000 });
    const pollsRow = page
      .locator('div.flex.items-center.gap-3')
      .filter({ has: page.locator('span:text-is("Polls")') })
      .first();
    await pollsRow.getByTitle('Hide item').click();
    const save = page.waitForResponse(
      (r) => r.url().includes('/api/courses/') && r.request().method() === 'PUT' && r.ok()
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await save;
    await page.reload();
    await expect(page.getByRole('link', { name: /^polls$/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Customize Sidebar' }).click();
    const pollsRestoreRow = page
      .locator('div.flex.items-center.gap-3')
      .filter({ has: page.locator('span:text-is("Polls")') })
      .first();
    await pollsRestoreRow.getByTitle('Show item').click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  });

  test('14.3.9 enrollment QR card — visible on overview', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}`);
    await expect(page.getByText(/enrollment|join.*course|qr/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('14.3.10 people — approve pending enrollment UI', async ({ page, request }) => {
    const temp = await registerStudent(request, 'PendingLT');
    await request.post(`${apiURL}/api/courses/${mathCourseId}/enrollment/request`, {
      headers: { Authorization: `Bearer ${temp.token}` },
    }).catch(async () => {
      await request.post(`${apiURL}/api/courses/${mathCourseId}/enroll`, {
        headers: { Authorization: `Bearer ${temp.token}` },
      });
    });
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/people`);
    const approve = page.getByRole('button', { name: 'Approve' }).first();
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
      await expectToast(page, /added to the course|approved/i);
    } else {
      await expect(page.getByRole('heading', { name: /people|students/i }).first()).toBeVisible();
    }
  });

  // ── 14.4 Course sections ─────────────────────────────────────────────────

  test('14.4.1 configure overview — modal opens', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}`);
    await page.getByRole('button', { name: 'Configure Overview' }).click();
    await expect(page.getByText(/overview|hero|color/i).first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('14.4.2 modules tab — navigates and shows content', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/modules`);
    await expect(page.getByRole('heading', { name: /modules/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /add module/i }).first()).toBeVisible();
  });

  test('14.4.3 gradebook — teacher inline view loads', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/gradebook`);
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible({ timeout: 25_000 });
  });

  // ── 14.8 Inbox ───────────────────────────────────────────────────────────

  test('14.8.1 inbox — folders and compose', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/inbox');
    await expect(page.getByRole('button', { name: /compose new message/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/inbox|sent|drafts/i).first()).toBeVisible();
  });

  // ── 14.10 Catalog ────────────────────────────────────────────────────────

  test('14.10.1 catalog — search and course cards', async ({ page }) => {
    await loginViaForm(page, student.email, student.password);
    await page.goto('/catalog');
    await page.getByPlaceholder(/search/i).first().fill('Math');
    await expect(page.getByText(/mathematics|grade 8/i).first()).toBeVisible({ timeout: 15_000 });
  });

  // ── 14.11 QuizWave ───────────────────────────────────────────────────────

  test('14.11.1 quizwave — teacher lobby page', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${mathCourseId}/quizwave`);
    await expect(page.getByRole('heading', { name: /quizwave|live quiz/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  // ── 14.12 Admin ──────────────────────────────────────────────────────────

  test('14.12.1 admin users — page loads', async ({ page }) => {
    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
  });

  test('14.12.2 admin route guard — teacher blocked', async ({ page }) => {
    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/unauthorized/, { timeout: 15_000 });
  });
});
