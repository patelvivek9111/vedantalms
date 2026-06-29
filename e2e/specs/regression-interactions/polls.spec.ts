import { test, expect, APIRequestContext } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  student,
  loginViaForm,
  getUserId,
} from '../../helpers/live-auth';
import { scaffoldCourseWithModule, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 Step 9 (polls) — vote flow + delete + close (item 39 deferred).
 * Teachers close an active poll with the "Close poll" button, which PUTs
 * { isActive: false }; we verify the persisted closed state via the polls API.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let studentId: string;
let courseId: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  studentId = await getUserId(request, student);
  const scaffold = await scaffoldCourseWithModule(request, teacherToken, { studentId });
  courseId = scaffold.courseId;
});

test.afterAll(async ({ request }) => {
  await cleanupEphemeral(request);
});

async function createPoll(
  request: APIRequestContext,
  title: string,
  endDate: string
): Promise<string> {
  const res = await request.post(`${apiURL}/api/polls/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      title,
      description: 'Ephemeral poll for §21.',
      options: ['Option Alpha', 'Option Beta'],
      endDate,
      allowMultipleVotes: false,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.data?._id || body._id;
}

test.describe('§21 Polls — write flows', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('student votes — vote recorded and visible via results API', async ({ page, request }) => {
    const title = `§21 vote poll ${Date.now()}`;
    const pollId = await createPoll(request, title, new Date(Date.now() + 7 * 86_400_000).toISOString());

    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${courseId}/polls`);

    await page.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await page.getByRole('button', { name: /option alpha/i }).click();
    await page.getByRole('button', { name: /submit vote/i }).click();

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/polls/${pollId}/results`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          if (!res.ok()) return -1;
          const body = await res.json();
          const poll = body.data || body;
          return (poll.options || []).reduce(
            (sum: number, o: { votes?: number }) => sum + (o.votes || 0),
            0
          );
        },
        { timeout: 15_000 }
      )
      .toBeGreaterThan(0);
  });

  test('teacher closes an active poll — Close poll button persists isActive=false', async ({
    page,
    request,
  }) => {
    const title = `§21 close poll ${Date.now()}`;
    const pollId = await createPoll(
      request,
      title,
      new Date(Date.now() + 7 * 86_400_000).toISOString()
    );

    const isActiveOf = async (): Promise<boolean | null> => {
      const res = await request.get(`${apiURL}/api/polls/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      if (!res.ok()) return null;
      const body = await res.json();
      const list = body.data || body;
      const poll = (Array.isArray(list) ? list : []).find(
        (p: { _id?: string }) => String(p._id) === String(pollId)
      );
      return poll ? Boolean(poll.isActive) : null;
    };

    expect(await isActiveOf()).toBe(true);

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/polls`);

    await page
      .getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
      .click();

    const [closeRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/polls/${pollId}` &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: `Close poll: ${title}` }).click(),
    ]);
    expect(closeRes.ok(), await closeRes.text()).toBeTruthy();

    await expect.poll(isActiveOf, { timeout: 15_000 }).toBe(false);
  });

  test('teacher deletes a poll — confirm modal removes it', async ({ page, request }) => {
    const title = `§21 delete poll ${Date.now()}`;
    await createPoll(request, title, new Date(Date.now() + 86_400_000).toISOString());

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/polls`);

    await page.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await page.getByRole('button', { name: `Delete poll: ${title}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^delete$/i }).click();

    await expect
      .poll(
        async () => {
          const res = await request.get(`${apiURL}/api/polls/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${teacherToken}` },
          });
          const body = await res.json();
          const list = body.data || body;
          return (Array.isArray(list) ? list : []).map((p: { title?: string }) => p.title);
        },
        { timeout: 15_000 }
      )
      .not.toContain(title);
  });
});
