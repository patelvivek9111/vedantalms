/**
 * Bootstrap a platform_admin (not creatable from school Admin UI).
 *
 * Usage:
 *   node scripts/createPlatformAdmin.js --email you@example.com --password 'YourPass123'
 *   node scripts/createPlatformAdmin.js --email you@example.com --password 'YourPass123' --promote
 *
 * Env alternatives: PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD
 * --promote: if email exists, only set role to platform_admin (password unchanged unless --password given)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const email = String(arg('email') || process.env.PLATFORM_ADMIN_EMAIL || '')
    .toLowerCase()
    .trim();
  const password = arg('password') || process.env.PLATFORM_ADMIN_PASSWORD || '';
  const firstName = arg('firstName') || 'Platform';
  const lastName = arg('lastName') || 'Admin';
  const promote = hasFlag('promote');

  if (!email) {
    throw new Error('Provide --email or PLATFORM_ADMIN_EMAIL');
  }
  if (!promote && (!password || password.length < 8)) {
    throw new Error('Provide --password (min 8) or PLATFORM_ADMIN_PASSWORD (or use --promote on existing user)');
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  const root = await ensureDefaultRootAccount();

  let user = await User.findOne({ email }).select('+password');
  if (user) {
    user.role = 'platform_admin';
    user.accountStatus = 'active';
    if (!user.rootAccountId) {
      user.rootAccountId = root._id;
      user.accountId = root._id;
    }
    if (password && password.length >= 8) {
      user.password = password;
    }
    await user.save();
    console.log(`Updated existing user → platform_admin: ${email} (id=${user._id})`);
  } else {
    if (!password || password.length < 8) {
      throw new Error('New user requires --password (min 8 characters)');
    }
    user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'platform_admin',
      accountStatus: 'active',
      rootAccountId: root._id,
      accountId: root._id,
    });
    console.log(`Created platform_admin: ${email} (id=${user._id})`);
  }

  console.log('Log in on the normal /login page with that email and password.');
  console.log('Then open Admin → Institutions (/admin/institutions).');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
