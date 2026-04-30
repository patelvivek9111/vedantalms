/**
 * Run Day 4 health snapshot against two local instances (5000 + 5001).
 * Start both servers first: `npm run dev` and `npm run dev:peer`.
 */
require('dotenv').config();
if (!process.env.APP_HEALTH_URLS && !process.env.DAY4_HEALTH_URLS) {
  process.env.APP_HEALTH_URLS = 'http://localhost:5000,http://localhost:5001';
}
const { main } = require('./day4SocketValidation');

main().catch((err) => {
  console.error('[day4] Local pair check failed:', err.message);
  process.exitCode = 1;
});
