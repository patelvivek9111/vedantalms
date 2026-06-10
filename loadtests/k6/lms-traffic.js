/**
 * k6 VedantaLMS traffic script (70% student / 20% instructor / 10% admin).
 *
 * Prerequisites:
 *   k6 install — https://k6.io/docs/get-started/installation/
 *   node scripts/load/seedCapacityFixtures.js
 *
 * Run:
 *   k6 run loadtests/k6/lms-traffic.js \
 *     -e BASE_URL=http://localhost:5000 \
 *     -e FIXTURE_FILE=uploads/reports/capacity-fixtures.json \
 *     -e VUS=250
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE = __ENV.BASE_URL || 'http://localhost:5000';
const FIXTURE_FILE = __ENV.FIXTURE_FILE || 'uploads/reports/capacity-fixtures.json';
const PASSWORD = __ENV.CAPACITY_PASSWORD || 'LoadTest123!';

const fixture = JSON.parse(open(FIXTURE_FILE));

const studentEmails = new SharedArray('students', () =>
  fixture.students.map((s) => s.email)
);

export const options = {
  scenarios: {
    lms_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 100) },
        { duration: '60s', target: Number(__ENV.VUS || 100) },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

function login(email) {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  const body = res.json();
  return body.token;
}

export default function () {
  const roll = Math.random();
  let token;
  if (roll < 0.7) {
    const email = studentEmails[__VU % studentEmails.length];
    token = login(email);
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    http.get(`${BASE}/api/courses`, { headers });
    http.get(`${BASE}/api/planner/feed`, { headers });
    http.get(`${BASE}/api/courses/${fixture.course.id}`, { headers });
    http.get(`${BASE}/api/threads/course/${fixture.course.id}`, { headers });
    http.get(`${BASE}/api/notifications/unread-count`, { headers });
  } else if (roll < 0.9) {
    token = login(fixture.teacher.email);
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    http.get(`${BASE}/api/grades/course/${fixture.course.id}/gradebook`, { headers });
    http.get(`${BASE}/api/planner/feed`, { headers });
  } else {
    token = login(fixture.admin.email);
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    http.get(`${BASE}/api/admin/users`, { headers });
    http.get(`${BASE}/api/admin/courses`, { headers });
  }
  sleep(1);
}
