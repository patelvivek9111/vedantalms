'use strict';

/**
 * Bootstrap users + MATH8 demo data for L3 visual snapshot E2E.
 * Requires MONGODB_URI. Creates teacher@vidyalms.com and admin@vidyalms.com if missing.
 */
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/user.model');

const BASE_USERS = [
  {
    email: 'teacher@vidyalms.com',
    password: process.env.DEMO_TEACHER_PASSWORD || 'password123',
    role: 'teacher',
    firstName: 'Demo',
    lastName: 'Teacher',
  },
  {
    email: 'admin@vidyalms.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'password123',
    role: 'admin',
    firstName: 'Demo',
    lastName: 'Admin',
  },
];

async function upsertUser(def) {
  let user = await User.findOne({ email: def.email });
  if (user) {
    user.role = def.role;
    user.firstName = def.firstName;
    user.lastName = def.lastName;
    user.password = def.password;
    await user.save();
    console.log(`[seed:visual] Updated ${def.email}`);
    return user;
  }
  user = await User.create(def);
  console.log(`[seed:visual] Created ${def.email}`);
  return user;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[seed:visual] MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  for (const def of BASE_USERS) {
    await upsertUser(def);
  }
  await mongoose.disconnect();

  const mathSeed = path.join(__dirname, 'seedGrade8MathIndiaDemo.js');
  const result = spawnSync('node', [mathSeed], { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('[seed:visual]', err);
  process.exit(1);
});
