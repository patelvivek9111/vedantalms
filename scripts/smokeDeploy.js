/**
 * Post-deploy / staging smoke — health + login + one read + one write.
 * Usage:
 *   STAGING_API_URL=https://api.example.com STAGING_EMAIL=... STAGING_PASSWORD=... node scripts/smokeDeploy.js
 *   PRODUCTION_API_URL=https://vedantaed.com/api ... (same vars)
 */
const base = process.env.STAGING_API_URL || process.env.PRODUCTION_API_URL || process.env.SMOKE_API_URL || 'http://127.0.0.1:5000';
const email = process.env.STAGING_EMAIL || process.env.SMOKE_EMAIL || 'teacher@vidyalms.com';
const password = process.env.STAGING_PASSWORD || process.env.SMOKE_PASSWORD || 'password123';

async function main() {
  const results = [];
  const fail = (name, detail) => {
    results.push({ name, pass: false, ...detail });
    throw new Error(`${name} failed`);
  };
  const pass = (name, detail = {}) => results.push({ name, pass: true, ...detail });

  const healthUrl = `${base.replace(/\/$/, '')}/health`;
  const health = await fetch(healthUrl).catch((e) => fail('health', { error: e.message }));
  if (!health.ok) fail('health', { status: health.status });
  const healthBody = await health.json().catch(() => ({}));
  pass('health', { status: health.status, ready: healthBody.ready ?? healthBody.status });

  const loginRes = await fetch(`${base.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) fail('login', { status: loginRes.status });
  const loginBody = await loginRes.json();
  const token = loginBody.token;
  if (!token) fail('login', { error: 'no token' });
  pass('login');

  const coursesRes = await fetch(`${base.replace(/\/$/, '')}/api/courses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!coursesRes.ok) fail('read_courses', { status: coursesRes.status });
  pass('read_courses');

  const todosRes = await fetch(`${base.replace(/\/$/, '')}/api/todos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!todosRes.ok) fail('read_todos', { status: todosRes.status });
  pass('read_todos');

  console.log(JSON.stringify({ ok: true, base, results }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
