import { APIRequestContext, Page, expect } from '@playwright/test';
import { apiURL, getAuthToken, teacher, admin, getUserIdFromToken } from './live-auth';

/**
 * Ephemeral fixture + mechanic helpers for live regression specs.
 *
 * Philosophy: every mutating/destructive UI journey should build its own
 * throwaway data via the API (course / module / thread / assignment / student),
 * exercise the real UI, then delete everything in afterAll/finally. This lets
 * us automate the long tail of "deferred" write flows without ever touching the
 * shared demo seed. See production-regression-plan.md §21.
 */

type ResourceKind =
  | 'assignment'
  | 'thread'
  | 'announcement'
  | 'module'
  | 'course';

interface TrackedResource {
  kind: ResourceKind;
  id: string;
}

const registry: TrackedResource[] = [];

function track(kind: ResourceKind, id: string | undefined | null): string {
  if (id) registry.push({ kind, id: String(id) });
  return String(id);
}

const deletePathByKind: Record<ResourceKind, (id: string) => string> = {
  assignment: (id) => `/api/assignments/${id}`,
  thread: (id) => `/api/threads/${id}`,
  announcement: (id) => `/api/announcements/${id}`,
  module: (id) => `/api/modules/${id}`,
  course: (id) => `/api/courses/${id}`,
};

/** Deletion order: leaf resources first, course last, so FK-style refs resolve. */
const cleanupOrder: ResourceKind[] = [
  'announcement',
  'assignment',
  'thread',
  'module',
  'course',
];

/**
 * Best-effort teardown for everything created via this module. Call in afterAll.
 * Course deletion is admin-only, so courses are removed with an admin token while
 * leaf resources use the teacher (owner) token.
 */
export async function cleanupEphemeral(request: APIRequestContext): Promise<void> {
  const teacherToken = await getAuthToken(request, teacher).catch(() => null);
  const adminToken = await getAuthToken(request, admin).catch(() => null);
  if (!teacherToken && !adminToken) {
    registry.splice(0);
    return;
  }
  const tokenForKind = (kind: ResourceKind) =>
    kind === 'course' ? adminToken || teacherToken : teacherToken || adminToken;
  const items = registry.splice(0);
  for (const kind of cleanupOrder) {
    const token = tokenForKind(kind);
    if (!token) continue;
    const headers = { Authorization: `Bearer ${token}` };
    for (const item of items.filter((r) => r.kind === kind)) {
      await request
        .delete(`${apiURL}${deletePathByKind[kind](item.id)}`, { headers })
        .catch(() => {});
    }
  }
}

function unwrapId(body: { data?: { _id?: string }; _id?: string }): string {
  const id = body?.data?._id || body?._id;
  expect(id, `expected an _id in response: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
  return String(id);
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface CreateCourseOptions {
  title?: string;
  description?: string;
  courseCode?: string;
}

export async function createCourse(
  request: APIRequestContext,
  token: string,
  opts: CreateCourseOptions = {}
): Promise<string> {
  const suffix = uniqueSuffix();
  const res = await request.post(`${apiURL}/api/courses`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: opts.title || `§21 ephemeral course ${suffix}`,
      description: opts.description || 'Temporary course for regression write-flow coverage.',
      catalog: { courseCode: opts.courseCode || `E21${suffix.replace(/[^a-z0-9]/gi, '').slice(-5)}` },
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return track('course', unwrapId(await res.json()));
}

export async function createModule(
  request: APIRequestContext,
  token: string,
  courseId: string,
  title = `§21 module ${uniqueSuffix()}`
): Promise<string> {
  const res = await request.post(`${apiURL}/api/modules`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, course: courseId, description: 'Ephemeral module.' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const id = track('module', unwrapId(await res.json()));
  // Modules are unpublished by default; publish so students can see contents.
  await request
    .patch(`${apiURL}/api/modules/${id}/publish`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(() => {});
  return id;
}

/** Teacher/admin enrolls an existing student into a course (no approval needed). */
export async function enrollStudent(
  request: APIRequestContext,
  teacherToken: string,
  courseId: string,
  studentId: string
): Promise<void> {
  const res = await request.post(`${apiURL}/api/courses/${courseId}/enroll-teacher`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { studentId },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export interface CreateThreadOptions {
  title?: string;
  content?: string;
  isGraded?: boolean;
  totalPoints?: number;
  locked?: boolean;
  discussionReleaseMode?: 'immediate' | 'hidden';
  moduleId?: string;
}

export async function createThread(
  request: APIRequestContext,
  token: string,
  courseId: string,
  opts: CreateThreadOptions = {}
): Promise<string> {
  const res = await request.post(`${apiURL}/api/threads`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: opts.title || `§21 thread ${uniqueSuffix()}`,
      content: opts.content || '<p>Ephemeral discussion prompt.</p>',
      courseId,
      module: opts.moduleId,
      isGraded: opts.isGraded || false,
      totalPoints: opts.isGraded ? opts.totalPoints ?? 10 : undefined,
      group: 'Discussions',
      locked: opts.locked === true,
      discussionReleaseMode: opts.discussionReleaseMode || 'immediate',
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const id = body?.data?._id || body?._id || body?.thread?._id;
  expect(id, `thread create response: ${JSON.stringify(body).slice(0, 200)}`).toBeTruthy();
  return track('thread', id);
}

export interface QuizQuestion {
  type: 'multiple-choice' | 'text';
  text: string;
  points: number;
  options?: { text: string; isCorrect?: boolean }[];
}

export interface CreateAssignmentOptions {
  title?: string;
  description?: string;
  group?: string;
  isGradedQuiz?: boolean;
  questions?: QuizQuestion[];
  availableFrom?: string;
  dueDate?: string;
  publish?: boolean;
}

export async function createAssignment(
  request: APIRequestContext,
  token: string,
  moduleId: string,
  opts: CreateAssignmentOptions = {}
): Promise<string> {
  const multipart: Record<string, string> = {
    title: opts.title || `§21 assignment ${uniqueSuffix()}`,
    description: opts.description || 'Ephemeral assignment.',
    moduleId,
    group: opts.group || (opts.isGradedQuiz ? 'quizzes' : 'assignments'),
    isGradedQuiz: opts.isGradedQuiz ? 'true' : 'false',
    availableFrom: opts.availableFrom || new Date(Date.now() - 3_600_000).toISOString(),
    dueDate: opts.dueDate || new Date(Date.now() + 7 * 86_400_000).toISOString(),
    questions: JSON.stringify(opts.questions || []),
  };
  const res = await request.post(`${apiURL}/api/assignments`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const created = await res.json();
  const id = track('assignment', created?.data?._id || created?._id);
  if (opts.publish !== false && !created.published) {
    await request
      .patch(`${apiURL}/api/assignments/${id}/publish`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => {});
  }
  return id;
}

/**
 * Full "course with one published module and an enrolled student" scaffold —
 * the most common base for write-flow journeys.
 */
export interface ScaffoldResult {
  courseId: string;
  moduleId: string;
}

export async function scaffoldCourseWithModule(
  request: APIRequestContext,
  teacherToken: string,
  opts: { studentId?: string; courseTitle?: string } = {}
): Promise<ScaffoldResult> {
  const courseId = await createCourse(request, teacherToken, { title: opts.courseTitle });
  const moduleId = await createModule(request, teacherToken, courseId);
  if (opts.studentId) {
    await enrollStudent(request, teacherToken, courseId, opts.studentId);
  }
  return { courseId, moduleId };
}

export async function resolveUserId(
  request: APIRequestContext,
  token: string
): Promise<string> {
  return getUserIdFromToken(request, token);
}

/* ---------------------------------------------------------------------------
 * Mechanic helpers (Page-level) — unblock flows previously deferred as
 * "not automatable in MCP browser". Playwright handles them natively.
 * ------------------------------------------------------------------------- */

/** Upload one or more files into a (possibly hidden) <input type=file>. */
export async function uploadFiles(
  page: Page,
  inputSelector: string,
  files: { name: string; mimeType: string; buffer: Buffer }[]
): Promise<void> {
  await page.setInputFiles(inputSelector, files);
}

/** Trigger an action that starts a download and return basic file facts. */
export async function captureDownload(
  page: Page,
  trigger: () => Promise<void>
): Promise<{ filename: string; size: number }> {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const stream = await download.createReadStream();
  let size = 0;
  if (stream) {
    for await (const chunk of stream) size += (chunk as Buffer).length;
  }
  return { filename: download.suggestedFilename(), size };
}

/** Assert an external link points where expected without launching it. */
export async function assertExternalLink(
  page: Page,
  selector: string,
  expectedHrefPattern: RegExp
): Promise<void> {
  const link = page.locator(selector).first();
  await expect(link).toHaveAttribute('href', expectedHrefPattern);
}

/** Stub the camera so QR-scan UIs render without real hardware. */
export async function stubGetUserMedia(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fakeStream = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      // captureStream exists in Chromium
      return (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(5);
    };
    const md = (navigator.mediaDevices ||= {} as MediaDevices);
    md.getUserMedia = async () => fakeStream();
  });
}
