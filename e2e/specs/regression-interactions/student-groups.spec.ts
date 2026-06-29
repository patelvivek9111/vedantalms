import { test, expect } from '@playwright/test';
import {
  apiURL,
  getAuthToken,
  teacher,
  loginViaForm,
  registerStudent,
} from '../../helpers/live-auth';
import { createCourse, enrollStudent, cleanupEphemeral } from '../../helpers/ephemeral';

/**
 * §21 deferral close — Student "My Groups" tab (StudentGroupView).
 * A teacher builds a manual group set + group and adds the enrolled student;
 * the student then opens /courses/:id/groups and sees their group card.
 */

test.describe.configure({ mode: 'serial' });

let teacherToken: string;
let courseId: string;
let groupId: string;
const prefix = `StuGrp${Date.now()}`;
const groupName = `My Team ${Date.now()}`;
let studentEmail: string;
let studentPassword: string;

test.beforeAll(async ({ request }) => {
  teacherToken = await getAuthToken(request, teacher);
  courseId = await createCourse(request, teacherToken, { title: `§21 student-groups ${Date.now()}` });

  const stud = await registerStudent(request, prefix);
  studentEmail = stud.email;
  studentPassword = stud.password;
  await enrollStudent(request, teacherToken, courseId, stud.userId);

  const setRes = await request.post(`${apiURL}/api/groups/sets`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { name: `§21 set ${Date.now()}`, courseId, groupStructure: 'manual' },
  });
  expect(setRes.ok(), await setRes.text()).toBeTruthy();
  const setBody = await setRes.json();
  const setId = setBody._id || setBody.groupSet?._id;

  const groupRes = await request.post(`${apiURL}/api/groups/sets/${setId}/groups`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { name: groupName, members: [], leader: null, groupId: `my-team-${Date.now()}` },
  });
  expect(groupRes.ok(), await groupRes.text()).toBeTruthy();
  groupId = (await groupRes.json())._id;

  // Add the enrolled student to the group (PUT replaces the member list).
  const putRes = await request.put(`${apiURL}/api/groups/${groupId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: { name: groupName, members: [stud.userId], leader: null },
  });
  expect(putRes.ok(), await putRes.text()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  await request
    .delete(`${apiURL}/api/groups/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    .catch(() => {});
  await cleanupEphemeral(request);
});

test.describe('§21 Student groups — My Groups tab', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('enrolled student sees their group card in the course Groups tab', async ({ page }) => {
    await loginViaForm(page, studentEmail, studentPassword);
    await page.goto(`/courses/${courseId}/groups`);

    await expect(page.getByRole('heading', { name: /my groups/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(groupName, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  });
});
