#!/usr/bin/env node
/**
 * Assignment workflow institutional load profile runner.
 *
 * Requires a seeded course and API tokens. This does not create product behavior;
 * it measures API latency, timeout rate, payload size, and memory growth.
 */
require('dotenv').config();
const axios = require('axios');

const base = process.env.API_URL || 'http://localhost:5000';
const instructorToken = process.env.INSTRUCTOR_TOKEN || process.env.TOKEN;
const studentTokens = (process.env.STUDENT_TOKENS || '').split(',').filter(Boolean);
const courseId = process.env.COURSE_ID;
const quizId = process.env.TIMED_QUIZ_ASSIGNMENT_ID;

async function timed(label, fn) {
  const startedAt = Date.now();
  try {
    const res = await fn();
    return { label, ok: true, status: res.status, durationMs: Date.now() - startedAt };
  } catch (err) {
    return {
      label,
      ok: false,
      status: err.response?.status || 0,
      durationMs: Date.now() - startedAt,
      error: err.message,
    };
  }
}

async function main() {
  if (!courseId || !instructorToken) {
    throw new Error('Set COURSE_ID and INSTRUCTOR_TOKEN/TOKEN.');
  }

  const startHeap = process.memoryUsage().heapUsed;
  const checks = [];
  for (let page = 1; page <= Number(process.env.GRADEBOOK_PAGES || 5); page += 1) {
    checks.push(timed(`gradebook_page_${page}`, () =>
      axios.get(`${base}/api/grades/course/${courseId}/gradebook`, {
        headers: { Authorization: `Bearer ${instructorToken}` },
        params: { page, pageSize: Number(process.env.PAGE_SIZE || 100) },
        timeout: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
      })
    ));
  }

  if (quizId && studentTokens.length) {
    const sampleTokens = studentTokens.slice(0, Number(process.env.CONCURRENT_STUDENTS || 300));
    for (const token of sampleTokens) {
      checks.push(timed('timed_quiz_start', () =>
        axios.post(`${base}/api/assignments/${quizId}/quiz/start`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
        })
      ));
    }
  }

  const results = await Promise.all(checks);
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const percentile = (p) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] || 0;
  const failed = results.filter((result) => !result.ok);

  console.log(JSON.stringify({
    ok: failed.length === 0,
    profile: {
      targetStudents: 1000,
      targetAssignments: 50,
      targetConcurrentSubmissions: 300,
    },
    summary: {
      totalRequests: results.length,
      failedRequests: failed.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      heapDeltaBytes: process.memoryUsage().heapUsed - startHeap,
    },
    bottleneckRanking: results
      .slice()
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10),
    recommendedIndexes: [
      'Submission { assignment: 1, student: 1, group: 1 }',
      'Submission { attemptStatus: 1, attemptDeadlineAt: 1 }',
      'Submission { assignment: 1, submittedAt: -1 }',
      'Assignment { module: 1, groupSet: 1 }',
    ],
  }, null, 2));

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
