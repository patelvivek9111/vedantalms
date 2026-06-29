module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Shared lms-test MongoDB — serial execution avoids cross-file races on users/conversations.
  maxWorkers: 1,
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'routes/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // Enforced ratchet floor — measured baseline 2026-06 (lines 45.06 / stmts 43.54 /
  // funcs 43.05 / branches 31.99 via `npm run test:coverage`), set a couple points
  // under to absorb run-to-run variance. RAISE these as backend tests are added;
  // never lower them (see docs/production-regression-plan.md §20).
  coverageThreshold: {
    global: {
      statements: 42,
      branches: 30,
      functions: 42,
      lines: 44
    }
  },
  verbose: true,
  testTimeout: 120000
};

