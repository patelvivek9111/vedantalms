import { request, APIRequestContext, Page } from '@playwright/test';
import { UPLOAD_SEED } from './uploadSeeds';

export const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
export const frontendURL = process.env.E2E_BASE_URL || 'http://localhost:3001';

export async function loginAs(
  ctx: APIRequestContext,
  email: string,
  password: string
): Promise<string | null> {
  const res = await ctx.post(`${apiURL}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body.token || body.data?.token || null;
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** API login + localStorage (avoids flaky Vite proxy UI login in e2e). */
export async function seedBrowserSession(
  page: Page,
  ctx: APIRequestContext,
  email: string,
  password: string
): Promise<boolean> {
  const res = await ctx.post(`${apiURL}/api/auth/login`, { data: { email, password } });
  if (!res.ok()) return false;
  const body = await res.json();
  const token = body.token || body.data?.token;
  const userData = body.user || body.data?.user;
  if (!token || !userData) return false;

  const user = {
    _id: String(userData.id || userData._id),
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    role: userData.role,
    bio: userData.bio || '',
    profilePicture: userData.profilePicture || '',
  };

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          id: user._id,
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          bio: user.bio,
          profilePicture: user.profilePicture,
        },
      }),
    });
  });

  await page.addInitScript(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
    },
    { t: token, u: user }
  );

  await page.goto(`${frontendURL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => localStorage.getItem('token'), { timeout: 5000 });
  if (page.url().includes('/login')) {
    return false;
  }
  return true;
}

export const roles = {
  student: {
    email: process.env.E2E_STUDENT_EMAIL || UPLOAD_SEED.student.email,
    password: process.env.E2E_STUDENT_PASSWORD || UPLOAD_SEED.student.password,
  },
  teacher: {
    email: process.env.E2E_TEACHER_EMAIL || UPLOAD_SEED.teacher.email,
    password: process.env.E2E_TEACHER_PASSWORD || UPLOAD_SEED.teacher.password,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || UPLOAD_SEED.admin.email,
    password: process.env.E2E_ADMIN_PASSWORD || UPLOAD_SEED.admin.password,
  },
};
