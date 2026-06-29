/**
 * Resolve Grade 8 math demo course ID when seed did not write e2e/.env.local
 * (e.g. Atlas already had the course from a prior seed run).
 */
import fs from 'fs';
import path from 'path';
import { request as playwrightRequest } from '@playwright/test';

const apiURL = process.env.E2E_API_URL || 'http://localhost:5000';
const mathCourseCode = process.env.E2E_MATH_COURSE_CODE || 'DEMO-MATH8-IN-2026';
const courseTitle = 'Mathematics — Grade 8 (Indian Curriculum)';
const e2eEnvPath = path.join(__dirname, '.env.local');

function mergeEnvLocal(updates: Record<string, string>) {
  const existing: Record<string, string> = {};
  if (fs.existsSync(e2eEnvPath)) {
    for (const line of fs.readFileSync(e2eEnvPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      existing[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  const merged = { ...existing, ...updates };
  fs.writeFileSync(
    e2eEnvPath,
    `${Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')}\n`,
    'utf8'
  );
  for (const [k, v] of Object.entries(updates)) {
    process.env[k] = v;
  }
}

export default async function globalSetup() {
  if (process.env.E2E_MATH_COURSE_ID) return;

  const teacherEmail = process.env.E2E_TEACHER_EMAIL || 'teacher@vidyalms.com';
  const teacherPassword = process.env.DEMO_TEACHER_PASSWORD || 'password123';

  const request = await playwrightRequest.newContext({ baseURL: apiURL });
  try {
    const login = await request.post(`${apiURL}/api/auth/login`, {
      data: { email: teacherEmail, password: teacherPassword },
    });
    if (!login.ok()) {
      console.warn(
        `[e2e global-setup] Could not log in as ${teacherEmail}; run npm run seed:e2e:visual`
      );
      return;
    }
    const { token } = await login.json();
    const coursesRes = await request.get(`${apiURL}/api/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!coursesRes.ok()) {
      console.warn('[e2e global-setup] GET /api/courses failed; run npm run seed:e2e:visual');
      return;
    }
    const body = await coursesRes.json();
    const courses: Array<{ _id: string; title?: string; catalog?: { courseCode?: string } }> =
      body.data || body;
    const codeLower = mathCourseCode.toLowerCase();
    const match =
      courses.find((c) => (c.catalog?.courseCode || '').toLowerCase() === codeLower) ||
      courses.find((c) => c.title === courseTitle);

    if (!match?._id) {
      console.warn(
        `[e2e global-setup] No course with code ${mathCourseCode}; run npm run seed:e2e:visual`
      );
      return;
    }

    const courseId = String(match._id);
    const updates: Record<string, string> = {
      E2E_MATH_COURSE_CODE: mathCourseCode,
      E2E_MATH_COURSE_ID: courseId,
    };

    const threadsRes = await request.get(`${apiURL}/api/threads/course/${courseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (threadsRes.ok()) {
      const threadsBody = await threadsRes.json();
      const threads: Array<{ _id: string; title?: string }> = threadsBody.data || threadsBody;
      const rational = threads.find((t) => t.title === 'Discussion: Rational Numbers');
      if (rational?._id) updates.E2E_RATIONAL_THREAD_ID = String(rational._id);
    }

    const modulesRes = await request.get(`${apiURL}/api/modules/${courseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (modulesRes.ok()) {
      const bulkRes = await request.get(
        `${apiURL}/api/assignments/course/${courseId}/module-assignments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (bulkRes.ok()) {
        const bulkBody = await bulkRes.json();
        const byModule: Record<string, Array<{ _id: string; title?: string; isGradedQuiz?: boolean }>> =
          bulkBody.byModuleId || {};
        const all = Object.values(byModule).flat();
        const quiz = all.find(
          (a) => a.title === 'Quiz — Rational Numbers' && a.isGradedQuiz
        );
        if (quiz?._id) updates.E2E_SEEDED_QUIZ_ID = String(quiz._id);
      }
    }

    mergeEnvLocal(updates);
    console.log(`[e2e global-setup] Resolved math course ${courseId} (${mathCourseCode})`);
  } finally {
    await request.dispose();
  }
}
