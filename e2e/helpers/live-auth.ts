import { expect, APIRequestContext, Page } from '@playwright/test';

export const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';
export const appBaseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
export const mathCourseCode = process.env.E2E_MATH_COURSE_CODE || 'DEMO-MATH8-IN-2026';

const mathCourseTitle = 'Mathematics — Grade 8 (Indian Curriculum)';

function envId(key: string, label: string): string {
  const id = process.env[key];
  if (!id) {
    throw new Error(
      `${key} is not set (${label}). Run npm run seed:e2e:visual — it writes e2e/.env.local — or ensure the API is up so e2e global-setup can resolve the course.`
    );
  }
  return id;
}

export function getMathCourseId(): string {
  return envId('E2E_MATH_COURSE_ID', `math demo course ${mathCourseCode}`);
}

export function getRationalThreadId(): string {
  return envId('E2E_RATIONAL_THREAD_ID', 'Discussion: Rational Numbers');
}

export function getSeededQuizId(): string {
  return envId('E2E_SEEDED_QUIZ_ID', 'Quiz — Rational Numbers');
}

export function getRegressionDeletedFileId(): string {
  return envId('E2E_REGRESSION_DELETED_FILE_ID', '§14.14 deleted file — run e2eSeedSection14-14');
}

export function getRegressionVersionFileId(): string {
  return envId('E2E_REGRESSION_VERSION_FILE_ID', '§14.14 versioned file — run e2eSeedSection14-14');
}

export function getRegressionPageId(): string {
  return envId('E2E_REGRESSION_PAGE_ID', '§14.14 page edit target — run e2eSeedSection14-14');
}

/** Lazy env read so global-setup / seed output is visible in template strings. */
function envStringProxy(getter: () => string): string {
  return new Proxy({} as string, {
    get(_target, prop) {
      const id = getter();
      if (prop === Symbol.toPrimitive) {
        return (hint: string) => (hint === 'number' ? Number.NaN : id);
      }
      if (prop === 'toString') return () => id;
      if (prop === 'valueOf') return () => id;
      const value = (id as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(id) : value;
    },
  }) as unknown as string;
}

export const mathCourseId = envStringProxy(getMathCourseId);
export const rationalThreadId = envStringProxy(getRationalThreadId);
export const seededQuizId = envStringProxy(getSeededQuizId);
export const regressionDeletedFileId = envStringProxy(getRegressionDeletedFileId);
export const regressionVersionFileId = envStringProxy(getRegressionVersionFileId);
export const regressionPageId = envStringProxy(getRegressionPageId);

export const teacher = { email: 'teacher@vidyalms.com', password: 'password123' };
export const student = { email: 'arjun.menon@student.demo.vidyalms.com', password: 'VedantaDemo8!' };
export const admin = { email: 'admin@vidyalms.com', password: 'password123' };

export async function resolveMathCourseId(request: APIRequestContext): Promise<string> {
  if (process.env.E2E_MATH_COURSE_ID) return process.env.E2E_MATH_COURSE_ID;
  const token = await getAuthToken(request, teacher);
  const res = await request.get(`${apiURL}/api/courses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const courses: Array<{ _id: string; title?: string; catalog?: { courseCode?: string } }> =
    body.data || body;
  const codeLower = mathCourseCode.toLowerCase();
  const match =
    courses.find((c) => (c.catalog?.courseCode || '').toLowerCase() === codeLower) ||
    courses.find((c) => c.title === mathCourseTitle);
  expect(match?._id, `No course with catalog code ${mathCourseCode}`).toBeTruthy();
  process.env.E2E_MATH_COURSE_ID = String(match!._id);
  return process.env.E2E_MATH_COURSE_ID;
}

export async function getAuthToken(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  const login = await request.post(`${apiURL}/api/auth/login`, { data: creds });
  expect(login.ok()).toBeTruthy();
  const body = await login.json();
  return body.token as string;
}

export async function registerStudent(request: APIRequestContext, prefix: string) {
  const email = `${prefix}-${Date.now()}@test.demo.vidyalms.com`;
  const register = await request.post(`${apiURL}/api/auth/register`, {
    data: {
      firstName: 'E2E',
      lastName: prefix,
      email,
      password: 'password123',
      role: 'student',
      termsAccepted: true,
    },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  const body = await register.json();
  const token = body.token as string;
  const userId =
    body.user?._id ||
    body.user?.id ||
    (await getUserIdFromToken(request, token));
  return { email, password: 'password123', token, userId };
}

export async function getUserIdFromToken(request: APIRequestContext, token: string) {
  const me = await request.get(`${apiURL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(me.ok()).toBeTruthy();
  const body = await me.json();
  return (body._id || body.id || body.user?._id || body.user?.id) as string;
}

export async function getUserId(
  request: APIRequestContext,
  creds: { email: string; password: string }
) {
  return getUserIdFromToken(request, await getAuthToken(request, creds));
}

/** Seed the browser session cookie on the app origin (same-origin /api proxy in E2E). */
export async function seedBrowserAuthCookie(
  page: Page,
  creds: { email: string; password: string }
) {
  const login = await page.request.post(`${appBaseURL}/api/auth/login`, {
    data: creds,
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { token } = await login.json();
  const cookieUrl = new URL(appBaseURL);
  await page.context().addCookies([
    {
      name: 'lms_auth',
      value: token,
      domain: cookieUrl.hostname,
      path: '/',
      httpOnly: true,
      secure: cookieUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
  await page.addInitScript((authToken: string) => {
    sessionStorage.setItem('lms_auth_token', authToken);
  }, token);
  return token as string;
}

export async function loginViaForm(page: Page, email: string, password: string) {
  await seedBrowserAuthCookie(page, { email, password });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(page.locator('#main-content, main').first()).toBeVisible({ timeout: 30_000 });
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.removeItem('lms_auth_token');
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
}
