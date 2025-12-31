#!/usr/bin/env node

// Generate a secure JWT secret for production
const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');
console.log('🔐 Generated JWT Secret:');
console.log(secret);
console.log('\n📝 Add this to your environment variables as JWT_SECRET');
console.log('\n⚠️  Keep this secret secure and never commit it to version control!');
