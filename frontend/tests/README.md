# Frontend tests

Vitest runs all `tests/**/*.test.{ts,tsx}` (`npm test` from `frontend/`).

## Layout

```
frontend/tests/
├── setup.ts                 # Vitest global setup (jest-dom, console filters)
├── fixtures/
│   └── grading/
│       └── fixtures.ts      # Shared grading scenario data
└── unit/
    ├── components/          # React component tests
    ├── hooks/               # Hook tests
    ├── utils/               # Utility / grading policy tests
    └── features/
        ├── audit/
        └── gradebook/
```

## Imports in test files

| Alias | Points to |
|-------|-----------|
| `@/…` | `frontend/src/…` (app source) |
| `@tests/…` | `frontend/tests/…` (fixtures, helpers) |

## Commands

| Command | What it runs |
|---------|----------------|
| `npm test` | All frontend tests (watch mode) |
| `npm run test:run` | Single run (if defined) |
| `npx vitest run tests/unit/components` | Component tests only |
| `npx vitest run tests/unit/utils` | Utils / grading policy tests |
