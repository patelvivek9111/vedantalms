import { test, expect } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  admin,
  loginViaForm,
  registerStudent,
} from '../../helpers/live-auth';

/**
 * §21 Step 7 — Admin write flows.
 *  - Create User submit (item 32): posts /api/auth/register, refreshes /api/admin/users.
 *  - Delete User submit: DELETE /api/admin/users/:id — persists (user gone from API).
 */

test.describe('§21 Admin — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('create user via Add User modal — persists and appears in admin list API', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const email = `s21-admincreate-${stamp}@test.demo.vidyalms.com`;

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/users');

    await page.getByRole('button', { name: /add user/i }).click();

    const form = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: /create user/i }) });
    await expect(form).toBeVisible({ timeout: 15_000 });

    await form.locator('input[type="text"]').nth(0).fill('S21');
    await form.locator('input[type="text"]').nth(1).fill(`AdminCreate${stamp}`);
    await form.locator('input[type="email"]').fill(email);
    await form.locator('input[type="password"]').fill('password123');
    await form.locator('select').selectOption('teacher');

    const [registerRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      form.getByRole('button', { name: /create user/i }).click(),
    ]);
    expect(registerRes.ok()).toBeTruthy();

    // Verify it really exists through the admin users API.
    const adminToken = await getAuthToken(request, admin);
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${apiURL}/api/admin/users?search=${encodeURIComponent(email)}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          );
          if (!res.ok()) return [];
          const body = await res.json();
          const list = body.data || body;
          return (Array.isArray(list) ? list : []).map(
            (u: { email?: string }) => u.email
          );
        },
        { timeout: 15_000 }
      )
      .toContain(email);
  });

  test('delete user via confirm modal — persists (user removed from admin API)', async ({
    page,
    request,
  }) => {
    // Seed a throwaway user to delete, so we never touch demo/admin accounts.
    // registerStudent sets firstName "E2E" and lastName to the prefix we pass.
    const prefix = `AdminDelete${Date.now()}`;
    const victim = await registerStudent(request, prefix);
    // The admin list hides accounts that have never logged in, so log the seeded
    // user in once (records a login) to make its row — and delete button — render.
    await getAuthToken(request, { email: victim.email, password: victim.password });
    const adminToken = await getAuthToken(request, admin);

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/users');

    // Filter the list down to just this user so the row (and its delete button) render.
    await page.getByPlaceholder('Search users...').fill(victim.email);

    const deleteButton = page.getByRole('button', { name: `Delete E2E ${prefix}` });
    await expect(deleteButton).toBeVisible({ timeout: 20_000 });
    await deleteButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const [deleteRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${victim.userId}` &&
          r.request().method() === 'DELETE',
        { timeout: 20_000 }
      ),
      dialog.getByRole('button', { name: /^delete$/i }).click(),
    ]);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify the user is really gone through the admin users API.
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${apiURL}/api/admin/users?search=${encodeURIComponent(victim.email)}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          );
          if (!res.ok()) return ['<error>'];
          const body = await res.json();
          const list = body.data || body;
          return (Array.isArray(list) ? list : []).map((u: { email?: string }) =>
            (u.email || '').toLowerCase()
          );
        },
        { timeout: 15_000 }
      )
      .not.toContain(victim.email.toLowerCase());
  });

  test('edit user via modal — Save Changes persists name + role via API', async ({
    page,
    request,
  }) => {
    const prefix = `AdminEdit${Date.now()}`;
    const victim = await registerStudent(request, prefix);
    // Log in once so the row renders in the admin list.
    await getAuthToken(request, { email: victim.email, password: victim.password });
    const adminToken = await getAuthToken(request, admin);

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/users');
    await page.getByPlaceholder('Search users...').fill(victim.email);

    const editBtn = page.getByRole('button', { name: `Edit E2E ${prefix}` });
    await expect(editBtn).toBeVisible({ timeout: 20_000 });
    await editBtn.click();

    const newFirst = `Renamed${Date.now()}`;
    await page.getByLabel('First Name').fill(newFirst);
    await page.getByLabel('Role').selectOption('teacher');

    const [putRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${victim.userId}` &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /save changes/i }).click(),
    ]);
    expect(putRes.ok(), await putRes.text()).toBeTruthy();

    // Verify the change persisted through the admin users API.
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${apiURL}/api/admin/users?search=${encodeURIComponent(victim.email)}`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
          );
          if (!res.ok()) return null;
          const body = await res.json();
          const list = body.data || body;
          const row = (Array.isArray(list) ? list : []).find(
            (u: { email?: string }) => (u.email || '').toLowerCase() === victim.email.toLowerCase()
          );
          return row ? `${row.firstName}:${row.role}` : null;
        },
        { timeout: 15_000 }
      )
      .toBe(`${newFirst}:teacher`);
  });

  test('delete guard — admin cannot delete their own account (400)', async ({ request }) => {
    const adminToken = await getAuthToken(request, admin);
    const me = await request.get(`${apiURL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(me.ok()).toBeTruthy();
    const meBody = await me.json();
    const adminId = meBody._id || meBody.id || meBody.user?._id || meBody.user?.id;

    const res = await request.delete(`${apiURL}/api/admin/users/${adminId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(400);

    // And the admin is still present afterwards.
    const stillThere = await request.get(
      `${apiURL}/api/admin/users?search=${encodeURIComponent(admin.email)}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const body = await stillThere.json();
    const list = body.data || body;
    expect((Array.isArray(list) ? list : []).map((u: { email?: string }) => u.email)).toContain(
      admin.email
    );
  });

  test('suspend then reactivate user — persists and gates login', async ({ page, request }) => {
    const prefix = `AdminSuspend${Date.now()}`;
    const victim = await registerStudent(request, prefix);
    // Log in once so the account both appears in the admin list and has a known-good login.
    await getAuthToken(request, { email: victim.email, password: victim.password });
    const adminToken = await getAuthToken(request, admin);

    const statusOf = async (): Promise<string> => {
      const res = await request.get(
        `${apiURL}/api/admin/users?search=${encodeURIComponent(victim.email)}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      if (!res.ok()) return '<error>';
      const body = await res.json();
      const list = body.data || body;
      const row = (Array.isArray(list) ? list : []).find(
        (u: { email?: string }) => (u.email || '').toLowerCase() === victim.email.toLowerCase()
      );
      return row?.status ?? '<missing>';
    };

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/users');
    await page.getByPlaceholder('Search users...').fill(victim.email);

    // Suspend.
    const suspendBtn = page.getByRole('button', { name: `Suspend E2E ${prefix}` });
    await expect(suspendBtn).toBeVisible({ timeout: 20_000 });
    const [suspendRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${victim.userId}/status` &&
          r.request().method() === 'PATCH',
        { timeout: 20_000 }
      ),
      suspendBtn.click(),
    ]);
    expect(suspendRes.ok()).toBeTruthy();
    await expect.poll(statusOf, { timeout: 15_000 }).toBe('suspended');

    // Suspended users are blocked from logging in.
    const blocked = await request.post(`${apiURL}/api/auth/login`, {
      data: { email: victim.email, password: victim.password },
    });
    expect(blocked.status()).toBe(403);

    // Reload + re-search so the row reflects persisted DB state (suspended → Activate).
    await page.reload();
    await page.getByPlaceholder('Search users...').fill(victim.email);

    // Reactivate.
    const activateBtn = page.getByRole('button', { name: `Activate E2E ${prefix}` });
    await expect(activateBtn).toBeVisible({ timeout: 20_000 });
    const [activateRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/admin/users/${victim.userId}/status` &&
          r.request().method() === 'PATCH',
        { timeout: 20_000 }
      ),
      activateBtn.click(),
    ]);
    expect(activateRes.ok()).toBeTruthy();

    // Login works again.
    const allowed = await request.post(`${apiURL}/api/auth/login`, {
      data: { email: victim.email, password: victim.password },
    });
    expect(allowed.ok()).toBeTruthy();
  });
});
