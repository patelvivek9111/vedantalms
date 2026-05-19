/**
 * Quick MongoDB connectivity check (exits 0/1). Run from repo root:
 *   node scripts/testMongoConnection.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const uri = (process.env.MONGODB_URI || '').trim();
const mask = (s) => {
  if (!s) return '(empty)';
  return s.replace(/:([^:@/]+)@/, ':****@');
};

async function main() {
  console.log('CWD:', process.cwd());
  console.log('MONGODB_URI:', mask(uri));

  if (!uri) {
    console.error('FAIL: MONGODB_URI not set in .env');
    process.exit(1);
  }

  try {
    const ipRes = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(8000) });
    const ip = await ipRes.text();
    console.log('Your public IP (whitelist this in Atlas):', ip.trim());
  } catch {
    console.log('Could not fetch public IP (optional).');
  }

  try {
    await mongoose.connect(uri, {
      dbName: 'lms',
      serverSelectionTimeoutMS: 10000,
    });
    console.log('OK: Connected to MongoDB');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('FAIL:', err.message);
    if (/whitelist|Server selection timed out|ECONNREFUSED/i.test(err.message)) {
      console.error('→ Atlas → Network Access → Add IP Address (or 0.0.0.0/0 for dev only)');
    }
    process.exit(1);
  }
}

main();
