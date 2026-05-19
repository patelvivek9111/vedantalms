/**
 * Second LMS process for multi-node / Socket.IO Redis smoke tests.
 * Loads project .env, then listens on PEER_PORT (default 5001). Primary instance should use PORT=5000 (or default).
 *
 * Usage (from repo root, with Redis and MONGODB_URI in .env):
 *   Terminal A: npm run dev
 *   Terminal B: npm run dev:peer
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
process.env.PORT = process.env.PEER_PORT || '5001';
require(path.join(__dirname, '..', 'server.js'));
