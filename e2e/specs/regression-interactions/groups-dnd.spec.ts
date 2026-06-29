import { test, expect, APIRequestContext, Page, Locator } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  loginViaForm,
  registerStudent,
} from '../../helpers/live-auth';
import { createCourse, enrollStudent, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Group drag-and-drop member assignment.
 *
 * The UI uses @hello-pangea/dnd (pointer-driven, react-beautiful-dnd fork), so we
 * simulate a real mouse drag with incremental moves + settle delays. Dragging an
 * enrolled student from the sidebar onto a group persists via PUT /api/groups/:id,
 * which we verify through the groups API.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
let setId: string;
let groupId: string;
const groupName = `Team Alpha ${Date.now()}`;
let studentName: string;
let studentId: string;

async function createManualGroupSet(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${apiURL}/api/groups/sets`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { name: `§21 manual set ${Date.now()}`, courseId, groupStructure: 'manual' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body._id || body.groupSet?._id;
}

async function createEmptyGroup(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${apiURL}/api/groups/sets/${setId}/groups`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      name: groupName,
      members: [],
      leader: null,
      groupId: `team-alpha-${Date.now()}`,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json())._id;
}

async function groupMemberIds(request: APIRequestContext): Promise<string[]> {
  const res = await request.get(`${apiURL}/api/groups/sets/${setId}/groups`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok()) return [];
  const groups = await res.json();
  const target = (Array.isArray(groups) ? groups : []).find(
    (g: { _id: string }) => String(g._id) === String(groupId)
  );
  return (target?.members || []).map((m: string | { _id?: string }) =>
    String(typeof m === 'string' ? m : m?._id)
  );
}

/** Simulate a react-beautiful-dnd (@hello-pangea/dnd) mouse drag. */
async function rbdDrag(page: Page, source: Locator, target: Locator): Promise<void> {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('drag source/target not visible');
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  // Initial nudge past the drag threshold so rbd starts the drag (and cancels click).
  await page.mouse.move(s.x + s.width / 2 + 6, s.y + s.height / 2 + 6, { steps: 6 });
  await page.waitForTimeout(200);
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 25 });
  await page.waitForTimeout(200);
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + 2, { steps: 6 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 dnd course ${Date.now()}` });

  const studentInfo = await registerStudent(request, `GrpMember${Date.now()}`);
  studentId = studentInfo.userId;
  studentName = `E2E GrpMember`; // firstName "E2E" + lastName prefix; matched loosely below
  await enrollStudent(request, teacherToken, courseId, studentId);

  setId = await createManualGroupSet(request);
  groupId = await createEmptyGroup(request);
});

test.afterAll(async ({ request }) => {
  await request
    .delete(`${apiURL}/api/groups/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    .catch(() => {});
  await cleanupEphemeral(request);
});

test.describe('§21 Groups — drag-and-drop member assignment', () => {
  test.use({ viewport: { width: 1400, height: 950 } });

  test('drag a student from the sidebar into a group — persists via API', async ({
    page,
    request,
  }) => {
    expect(await groupMemberIds(request)).not.toContain(String(studentId));

    await loginViaForm(page, teacher.email, teacher.password);
    await page.goto(`/courses/${courseId}/groups`);

    // Select the manual group set so the DnD board renders.
    await page.getByText(/§21 manual set/i).first().click();

    // Source: the draggable student <li> in the sidebar; target: the group card.
    const studentItem = page.getByText(new RegExp(studentName, 'i')).first();
    await expect(studentItem).toBeVisible({ timeout: 20_000 });
    const groupCard = page.getByText(groupName, { exact: true }).first();
    await expect(groupCard).toBeVisible({ timeout: 20_000 });

    await rbdDrag(page, studentItem, groupCard);

    // Persisted: the student now belongs to the group (verified through the API).
    await expect
      .poll(() => groupMemberIds(request), { timeout: 20_000 })
      .toContain(String(studentId));
  });
});
