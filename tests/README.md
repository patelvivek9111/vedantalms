# Backend tests

Jest runs all `**/*.test.js` under this folder (`npm test` from repo root).

## Layout

```
tests/
├── setup.js              # Global Jest setup (env, Mongo teardown)
├── helpers.js            # Shared helpers (e.g. waitForMongoConnection)
├── unit/
│   ├── api/              # HTTP / route tests (supertest + server)
│   ├── controllers/      # Controller unit tests (mocked models)
│   ├── middleware/       # Middleware unit tests
│   └── services/         # Service-layer unit tests
├── integration/          # Multi-step / workflow tests
├── grading/              # Grading policy, parity, e2e (fixtures in grading/)
├── portability/          # Storage/cache/provider adapters
└── migration/            # Institution migration tests
```

## Commands

| Command | What it runs |
|---------|----------------|
| `npm test` | All backend tests |
| `npm run test:grading` | `tests/grading/` |
| `npm run test:portability` | `tests/portability/` |
| `npm run test:migration` | `tests/migration/` |
| `npm run test:api` | `tests/unit/api` + `tests/integration` |
