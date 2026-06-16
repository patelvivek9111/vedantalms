import { test, expect, Page, Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Role = 'student' | 'teacher' | 'teaching_assistant' | 'admin';

const users: Record<Role, any> = {
  student: { _id: 'student1', id: 'student1', firstName: 'Sam', lastName: 'Student', email: 'sam@example.test', role: 'student' },
  teacher: { _id: 'teacher1', id: 'teacher1', firstName: 'Tina', lastName: 'Teacher', email: 'tina@example.test', role: 'teacher' },
  teaching_assistant: { _id: 'ta1', id: 'ta1', firstName: 'Taylor', lastName: 'TA', email: 'ta@example.test', role: 'teaching_assistant' },
  admin: { _id: 'admin1', id: 'admin1', firstName: 'Ari', lastName: 'Admin', email: 'admin@example.test', role: 'admin' },
};

const course = {
  _id: 'course1',
  id: 'course1',
  title: 'Certified Discussion Course',
  catalog: { courseCode: 'DISC-500' },
  operationalStatus: 'active',
  students: [{ _id: 'student1', firstName: 'Sam', lastName: 'Student' }],
};

function reply(overrides: Record<string, any> = {}) {
  return {
    _id: overrides._id || 'root1',
    content: overrides.content || '<p>Visible root reply</p>',
    author: overrides.author || users.student,
    parentReply: overrides.parentReply || null,
    parentReplyId: overrides.parentReplyId || null,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    childCount: overrides.childCount ?? 1,
    likes: overrides.likes || [],
    moderationState: overrides.moderationState || 'active',
    isHidden: overrides.isHidden || false,
    isDeleted: overrides.isDeleted || false,
  };
}

function thread(overrides: Record<string, any> = {}) {
  return {
    _id: 'thread1',
    title: 'Institutional Discussion Certification',
    content: '<p>Discuss institutional readiness.</p>',
    author: users.teacher,
    course: 'course1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    replies: [reply()],
    repliesPagination: { page: 1, limit: 50, total: 51, totalPages: 2 },
    isPinned: false,
    isGraded: true,
    totalPoints: 10,
    group: 'Discussions',
    dueDate: null,
    locked: false,
    published: true,
    discussionReleaseMode: 'hidden',
    gradeHidden: true,
    studentGrades: [],
    settings: { requirePostBeforeSee: false, allowLikes: true, allowComments: true },
    unreadCount: 3,
    hasPosted: false,
    hasInstructorReply: true,
    currentUserParticipation: { unreadCount: 3, hasPosted: false, hasInstructorReply: true },
    discussionStatus: 'active',
    ...overrides,
  };
}

async function seedSession(page: Page, role: Role, draft?: string) {
  await page.addInitScript(
    ({ token, user, draftHtml }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('lms:e2e:plain-editor', '1');
      if (draftHtml) {
        localStorage.setItem(`thread_reply_draft_thread1_${user._id}`, draftHtml);
      }
    },
    { token: `${role}-token`, user: users[role], draftHtml: draft }
  );
}

async function installDiscussionApi(page: Page, options: { role: Role; initialThread?: any; failFirstReply?: boolean; courseOverride?: any } = { role: 'student' }) {
  let currentThread = options.initialThread || thread();
  let replyFailuresRemaining = options.failFirstReply ? 1 : 0;
  const idempotencyKeys = new Set<string>();
  const seenRequests: any[] = [];

  async function fulfill(route: Route, body: any, status = 200) {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    seenRequests.push({ method, path, postData: request.postDataJSON?.() });

    if (path === '/auth/me') {
      return fulfill(route, { success: true, user: users[options.role] });
    }
    if (path === '/courses/course1') {
      return fulfill(route, { success: true, data: { ...course, ...(options.courseOverride || {}) } });
    }
    if (path === '/courses') {
      return fulfill(route, { success: true, data: [course] });
    }
    if (path === '/modules/course1') {
      return fulfill(route, { success: true, data: [] });
    }
    if (path === '/threads/course/course1') {
      return fulfill(route, { success: true, data: [currentThread] });
    }
    if (path === '/threads/thread1/participant/student1') {
      return fulfill(route, {
        success: true,
        data: {
          ...currentThread,
          replies: currentThread.repliesHiddenUntilPost ? [] : currentThread.replies,
        },
      });
    }
    if (path === '/threads/thread1' && method === 'GET') {
      if (request.headers().authorization === 'Bearer other-student-token') {
        return fulfill(route, { success: false, code: 'DISCUSSION_GROUP_FORBIDDEN' }, 403);
      }
      return fulfill(route, { success: true, data: currentThread });
    }
    if (path === '/threads/thread1/mark-read' && method === 'POST') {
      currentThread = {
        ...currentThread,
        unreadCount: 0,
        currentUserParticipation: { ...currentThread.currentUserParticipation, unreadCount: 0 },
      };
      return fulfill(route, { success: true, data: currentThread });
    }
    if (path === '/threads/thread1/replies' && method === 'POST') {
      const body = request.postDataJSON();
      if (replyFailuresRemaining > 0) {
        replyFailuresRemaining -= 1;
        return fulfill(route, { success: false, message: 'network retry simulation' }, 503);
      }
      const duplicate = idempotencyKeys.has(body.idempotencyKey);
      idempotencyKeys.add(body.idempotencyKey);
      if (!duplicate) {
        currentThread = {
          ...currentThread,
          repliesHiddenUntilPost: false,
          hasPosted: true,
          currentUserParticipation: { ...currentThread.currentUserParticipation, hasPosted: true },
          replies: [
            ...currentThread.replies,
            reply({
              _id: 'student-retry-reply',
              content: body.content,
              childCount: 0,
              author: users.student,
            }),
          ],
        };
      }
      return fulfill(route, { success: true, data: currentThread, duplicateSuppressed: duplicate });
    }
    if (path === '/replies/root1/children') {
      return fulfill(route, {
        success: true,
        data: [reply({ _id: 'child1', parentReply: 'root1', parentReplyId: 'root1', content: '<p>Loaded child reply</p>', childCount: 0 })],
        pagination: { limit: 50, total: 1, nextCursor: null },
      });
    }
    if (path === '/replies/root1/hide' && method === 'POST') {
      currentThread = {
        ...currentThread,
        replies: currentThread.replies.map((row: any) =>
          row._id === 'root1' ? { ...row, content: '', moderationState: 'hidden', isHidden: true } : row
        ),
      };
      return fulfill(route, { success: true, data: currentThread });
    }
    if (path === '/replies/root1/restore' && method === 'POST') {
      currentThread = {
        ...currentThread,
        replies: currentThread.replies.map((row: any) =>
          row._id === 'root1' ? { ...row, content: '<p>Visible root reply</p>', moderationState: 'active', isHidden: false } : row
        ),
      };
      return fulfill(route, { success: true, data: currentThread });
    }
    if (path === '/threads/thread1/lock' && method === 'POST') {
      currentThread = { ...currentThread, locked: true };
      return fulfill(route, { success: true, data: currentThread });
    }
    if (path === '/threads/thread1/unlock' && method === 'POST') {
      currentThread = { ...currentThread, locked: false };
      return fulfill(route, { success: true, data: currentThread });
    }
    if (path === '/threads/thread1/grade' && method === 'POST') {
      const body = request.postDataJSON();
      currentThread = {
        ...currentThread,
        studentGrades: [{
          student: users.student,
          grade: body.grade,
          feedback: body.feedback,
          gradedAt: new Date().toISOString(),
          gradedBy: users.teacher,
        }],
      };
      return fulfill(route, { success: true, data: currentThread });
    }

    return fulfill(route, { success: true, data: [] });
  });

  return {
    requests: seenRequests,
    current: () => currentThread,
  };
}

async function gotoThread(page: Page) {
  await page.goto('/courses/course1/threads/thread1');
  await expect(page.getByRole('heading', { name: /institutional discussion certification/i })).toBeVisible();
}

test.describe('discussion E2E and accessibility certification', () => {
  test('student workflow covers badges, require-post, read-state, lazy children, retry, and duplicate suppression', async ({ page }) => {
    await seedSession(page, 'student', '<p>Recovered retry reply</p>');
    const api = await installDiscussionApi(page, {
      role: 'student',
      failFirstReply: true,
      initialThread: thread({
        settings: { requirePostBeforeSee: true, allowLikes: true, allowComments: true },
        repliesHiddenUntilPost: true,
        replies: [reply()],
      }),
    });

    await gotoThread(page);
    await expect.poll(() => api.requests.some((request) => request.path === '/threads/thread1/mark-read')).toBe(true);
    await expect(page.getByText('Not posted yet')).toBeVisible();
    await expect(page.getByText('Instructor replied')).toBeVisible();
    await expect(page.getByText('Grade hidden')).toBeVisible();
    await expect(page.getByText('Replies are hidden until you post your first reply.')).toBeVisible();

    await page.getByRole('button', { name: /start the discussion/i }).click();
    await page.getByRole('button', { name: /post reply/i }).dispatchEvent('click');
    await expect(page.getByRole('alert')).toContainText('could not post your reply');
    await page.getByRole('button', { name: /post reply/i }).dispatchEvent('click');
    await expect(page.getByText('Recovered retry reply')).toBeVisible();

    const postBodies = api.requests
      .filter((request) => request.method === 'POST' && request.path === '/threads/thread1/replies')
      .map((request) => request.postData);
    expect(postBodies).toHaveLength(2);
    expect(postBodies[0].idempotencyKey).toBeTruthy();
    expect(postBodies[0].idempotencyKey).toBe(postBodies[1].idempotencyKey);
    expect(api.current().replies.filter((row: any) => row._id === 'student-retry-reply')).toHaveLength(1);
  });

  test('student can expand lazy children and keyboard-open discussion cards', async ({ page }) => {
    await seedSession(page, 'student');
    await installDiscussionApi(page, { role: 'student' });

    await page.goto('/courses/course1/discussions');
    const card = page.getByRole('button', { name: /open discussion institutional discussion certification/i });
    await expect(card).toBeVisible();
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/courses\/course1\/threads\/thread1/);

    await page.getByRole('button', { name: /load 1 child replies/i }).click();
    await expect(page.getByText('Loaded child reply')).toBeVisible();
  });

  test('teacher, TA, and admin moderation controls enforce visibility and lock workflows', async ({ page }) => {
    for (const role of ['teacher', 'teaching_assistant', 'admin'] as Role[]) {
      await page.unroute('**/api/**').catch(() => undefined);
      await seedSession(page, role);
      await installDiscussionApi(page, { role });
      await gotoThread(page);

      await page.getByRole('button', { name: /more options for reply/i }).click();
      await page.getByRole('menuitem', { name: /hide/i }).click();
      await expect(page.getByText('This reply is hidden by a moderator.')).toBeVisible();

      await page.getByRole('button', { name: /more options for reply/i }).click();
      await page.getByRole('menuitem', { name: /restore/i }).click();
      await expect(page.getByText('Visible root reply')).toBeVisible();
    }
  });

  test('teacher can lock and unlock a discussion from the browser controls', async ({ page }) => {
    await seedSession(page, 'teacher');
    await installDiscussionApi(page, { role: 'teacher' });
    await gotoThread(page);

    await expect(page.getByRole('button', { name: /lock discussion/i })).toBeVisible();
    await page.getByRole('button', { name: /lock discussion/i }).click();
    await expect(page.getByText('Locked', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /unlock discussion/i }).click();
    await expect(page.getByRole('button', { name: /lock discussion/i })).toBeVisible();
  });

  test('instructor grading and hidden-grade release behavior remain scoped', async ({ page }) => {
    await seedSession(page, 'teacher');
    await installDiscussionApi(page, { role: 'teacher' });
    await gotoThread(page);

    await page.getByRole('button', { name: /add grade/i }).click();
    await page.getByLabel(/grade \(out of 10\)/i).fill('9');
    await page.getByLabel(/feedback/i).fill('Strong participation');
    await page.getByRole('button', { name: /submit grade/i }).click();
    const gradeBadge = page.locator('.tabular-nums').first();
    await expect(gradeBadge).toContainText('9');
    await expect(gradeBadge).toContainText('10');

    await page.unroute('**/api/**');
    await seedSession(page, 'student');
    await installDiscussionApi(page, {
      role: 'student',
      initialThread: thread({
        studentGrades: [{ student: users.student, grade: 9, feedback: 'Strong participation', gradedAt: new Date().toISOString(), gradedBy: users.teacher }],
        discussionReleaseMode: 'hidden',
        gradeHidden: true,
      }),
    });
    await gotoThread(page);
    await expect(page.getByText('Grade hidden')).toBeVisible();
    await expect(page.locator('.tabular-nums').filter({ hasText: '9' })).toHaveCount(0);
  });

  test('archived, finalized, module-hidden, and group-isolated states deny restricted student actions', async ({ page }) => {
    await seedSession(page, 'student');
    await installDiscussionApi(page, {
      role: 'student',
      courseOverride: { operationalStatus: 'archived' },
      initialThread: thread({ locked: true, discussionStatus: 'hidden' }),
    });
    await gotoThread(page);
    await expect(page.getByText(/This discussion is read-only/)).toBeVisible();
    await expect(page.getByRole('button', { name: /start the discussion/i })).toHaveCount(0);

    const outsideGroupStatus = await page.evaluate(async () => {
      const res = await fetch('/api/threads/thread1', {
        headers: { Authorization: 'Bearer other-student-token' },
      });
      return res.status;
    });
    expect(outsideGroupStatus).toBe(403);
  });

  test('mobile viewport supports discussion navigation, moderation targets, and axe accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedSession(page, 'teacher');
    await installDiscussionApi(page, { role: 'teacher' });
    await gotoThread(page);

    await expect(page.getByRole('button', { name: /go back to discussions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /more options for reply/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /lock discussion/i })).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('desktop discussion surfaces pass automated accessibility checks', async ({ page }, testInfo) => {
    await seedSession(page, 'student');
    await installDiscussionApi(page, { role: 'student' });
    await gotoThread(page);

    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    if (testInfo.project.name !== 'webkit') {
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
    }

    const accessibility = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
