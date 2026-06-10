/**
 * k6 notification publish stress (requires teacher token + course with N students).
 * Complements scripts/load/notificationStressBench.js (service-level).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.TEACHER_TOKEN;
const COURSE_ID = __ENV.COURSE_ID;
const MODULE_ID = __ENV.MODULE_ID;

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<10000'],
  },
};

export default function () {
  if (!TOKEN || !COURSE_ID || !MODULE_ID) {
    throw new Error('Set TEACHER_TOKEN, COURSE_ID, MODULE_ID');
  }
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
  const res = http.post(
    `${BASE}/api/assignments`,
    JSON.stringify({
      title: `k6 publish ${Date.now()}`,
      description: 'Load test',
      module: MODULE_ID,
      published: true,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    }),
    { headers }
  );
  check(res, { 'assignment created': (r) => r.status === 200 || r.status === 201 });
  sleep(1);
}
