#!/usr/bin/env node
/** Minimal load smoke for §14.14 regression bundle. */
require('dotenv').config();
const axios = require('axios');

const BASE = process.env.LOAD_BASE_URL || process.env.E2E_API_URL || 'http://localhost:5000';

async function main() {
  const health = await axios.get(`${BASE}/health`, {
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (health.status !== 200 || health.data?.status !== 'ok') {
    console.error('[load-smoke] health check failed', health.status, health.data);
    process.exit(1);
  }
  console.log('[load-smoke] API health ok');
}

main().catch((err) => {
  console.error('[load-smoke]', err.message);
  process.exit(1);
});
