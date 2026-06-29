import { test, expect, APIRequestContext, Page } from '@playwright/test';
import {
  apiURL,
  mathCourseId,
  getMathCourseId,
  teacher,
  student,
  getAuthToken,
  registerStudent,
  loginViaForm,
} from '../helpers/live-auth';
import { trackThread, cleanupTracked } from '../helpers/live-cleanup';

const otherStudent = { email: 'ananya.iyer@student.demo.vidyalms.com', password: 'VedantaDemo8!' };

let unpublishedId = '';
let hiddenGradeId = '';
let lockedId = '';
let groupThreadId = '';
let requirePostId = '';
let studentToken = '';
let otherToken = '';
let staffToken = '';

async function enablePlainEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lms:e2e:plain-editor', '1'));
}

async function createThread(
  request: APIRequestContext,
  token: string,
  data: Record<string, unknown>
) {
  const res = await request.post(`${apiURL}/api/threads`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.data?._id || body._id;
}

async function resolveTeamAGroupScope(request: APIRequestContext, teacherToken: string) {
  const setsRes = await request.get(`${apiURL}/api/groups/sets/${getMathCourseId()}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  expect(setsRes.ok(), await setsRes.text()).toBeTruthy();
  const setsBody = await setsRes.json();
  const sets = setsBody.data || setsBody;
  const termSet =
    sets.find((s: { name?: string }) => s.name?.includes('Term project')) || sets[0];
  expect(termSet?._id).toBeTruthy();

  const groupsRes = await request.get(`${apiURL}/api/groups/sets/${termSet._id}/groups`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  expect(groupsRes.ok(), await groupsRes.text()).toBeTruthy();
  const groupsBody = await groupsRes.json();
  const groups = groupsBody.data || groupsBody;
  const teamA =
    groups.find((g: { name?: string }) => /team a/i.test(g.name || '')) || groups[0];
  expect(teamA?._id).toBeTruthy();

  return { groupSetId: termSet._id as string, groupId: teamA._id as string };
}

test.describe('Discussion institutional hardening — live API', () => {
  test.beforeAll(async ({ request }) => {
    const teacherToken = await getAuthToken(request, teacher);
    studentToken = await getAuthToken(request, student);
    otherToken = await getAuthToken(request, otherStudent);
    staffToken = teacherToken;

    unpublishedId = await createThread(request, teacherToken, {
      title: `Hardening unpublished ${Date.now()}`,
      content: '<p>Draft discussion.</p>',
      courseId: getMathCourseId(),
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
    });
    const unpublish = await request.patch(`${apiURL}/api/threads/${unpublishedId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { published: false },
    });
    expect(unpublish.ok(), await unpublish.text()).toBeTruthy();

    hiddenGradeId = await createThread(request, teacherToken, {
      title: `Hardening hidden grade ${Date.now()}`,
      content: '<p>Hidden grade discussion.</p>',
      courseId: getMathCourseId(),
      isGraded: true,
      totalPoints: 10,
      discussionReleaseMode: 'hidden',
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
    });

    lockedId = await createThread(request, teacherToken, {
      title: `Hardening locked ${Date.now()}`,
      content: '<p>Locked discussion.</p>',
      courseId: getMathCourseId(),
      locked: true,
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
    });

    const teamAScope = await resolveTeamAGroupScope(request, teacherToken);

    groupThreadId = await createThread(request, teacherToken, {
      title: `Hardening group ${Date.now()}`,
      content: '<p>Team A only discussion.</p>',
      courseId: getMathCourseId(),
      groupSet: teamAScope.groupSetId,
      groupId: teamAScope.groupId,
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
    });

    requirePostId = await createThread(request, teacherToken, {
      title: `Hardening requirePost ${Date.now()}`,
      content: '<p>Post before you can see others.</p>',
      courseId: getMathCourseId(),
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: true },
    });
    await request.post(`${apiURL}/api/threads/${requirePostId}/replies`, {
      headers: { Authorization: `Bearer ${otherToken}` },
      data: {
        content: '<p>Hidden until you post.</p>',
        idempotencyKey: `require-post-${Date.now()}`,
      },
    });

    for (const id of [unpublishedId, hiddenGradeId, lockedId, groupThreadId, requirePostId]) {
      trackThread(id);
    }
  });

  test.afterAll(async ({ request }) => {
    await cleanupTracked(request);
  });

  test('student cannot access unpublished discussion', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/threads/${unpublishedId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect([403, 404]).toContain(res.status());
  });

  test('student cannot see other students grades on hidden discussion', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/threads/${hiddenGradeId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const grades = body.data?.studentGrades || [];
    expect(grades.length).toBeLessThanOrEqual(1);
    if (grades[0]) {
      expect(grades[0]?.gradeVisibility?.scoreVisible).not.toBe(true);
    }
  });

  test('student outside group cannot open group discussion', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/threads/${groupThreadId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('locked discussion denies reply posting', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/threads/${lockedId}/replies`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { content: '<p>late reply</p>', idempotencyKey: `lock-${Date.now()}` },
    });
    expect(res.status()).toBe(403);
  });

  test('course staff can view unpublished discussion', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/threads/${unpublishedId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(res.status()).toBe(200);
  });

  test('requirePostBeforeSee hides replies until student posts', async ({ page }) => {
    await enablePlainEditor(page);
    await loginViaForm(page, student.email, student.password);
    await page.goto(`/courses/${mathCourseId}/threads/${requirePostId}`);
    await expect(
      page.getByText('Replies are hidden until you post your first reply.')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Hidden until you post.')).toHaveCount(0);

    const start = page.getByRole('button', { name: /start the discussion/i });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }
    await page
      .getByRole('textbox', { name: /discussion rich text editor|share your thoughts/i })
      .fill('My first post to unlock replies.');
    await page.getByRole('button', { name: /post reply/i }).click();
    await expect(page.getByText('Hidden until you post.')).toBeVisible({ timeout: 15_000 });
  });
});
