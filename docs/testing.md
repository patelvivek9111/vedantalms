# Testing and regression

E2E seeds, regression inventory, Playwright conventions, and QuizWave scoring reference.

---

## E2E seed scripts

Run against a **disposable** database in CI; local `MONGODB_URI` for dev.

### `npm run seed:e2e:visual`

**Script:** `scripts/seedVisualE2e.js` — demo data for live journeys, visual snapshots, PR/nightly CI.

1. Upserts `teacher@vidyalms.com` / `admin@vidyalms.com` (password `password123` or `DEMO_*_PASSWORD`)
2. Runs `scripts/seedGrade8MathIndiaDemo.js` — Mathematics Grade 8 (`DEMO-MATH8-IN-2026`)
3. Writes `e2e/.env.local` with `E2E_MATH_COURSE_ID`, thread/quiz IDs

**Use before:** `test:e2e:live`, `test:e2e:live:pr`, `test:e2e:l4-inventory`, `test:e2e:visual`

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/lms-dev npm run seed:e2e:visual
```

### `npm run seed:e2e:upload`

**Script:** `scripts/seedUploadE2e.js` — isolated upload harness for chunk/file specs.

Creates `teacher.upload.e2e@example.com` etc. (`TestUpload123!`), harness course, writes `e2e/.env.local` with upload IDs.

**Use before:** `test:e2e:seeded`, `test:e2e:seeded-gated`

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/lms-dev npm run seed:e2e:upload
npm run test:e2e:seeded-gated
```

### Quick reference

| Goal | Commands |
|------|----------|
| Long-tail inventory | `seed:e2e:visual` → `test:e2e:inventory-longtail` |
| Full live regression | `seed:e2e:visual` → start API → `test:e2e:live` |
| PR smoke | `seed:e2e:visual` → `test:e2e:live:pr` |
| Upload specs | `seed:e2e:upload` → `test:e2e:seeded-gated` |
| Post-deploy smoke | `STAGING_API_URL=... npm run smoke:deploy` |

**Parallel safety:** temp threads/courses use `e2e/helpers/live-cleanup.ts`; serial workers (`--workers=1`) for shared math-course mutations.

Physical QR enrollment is manual/staging only.

---

## Regression inventory

**Goal:** every item in `docs/regression-inventory.json` reaches `logic.status: "covered"` and `ui.status: "covered"`.

| Asset | Purpose |
|-------|---------|
| `docs/regression-inventory.json` | Master list — one row per feature/rule/button group |
| `scripts/regression/check-inventory-coverage.js` | Prints % and gaps |
| `npm run regression:inventory` | Current score |
| `npm run regression:inventory:strict` | Fails unless 100% / 100% |
| `npm run regression:depth:strict` | Journey depth gate |
| `.github/workflows/regression-coverage.yml` | Weekly coverage + inventory |

**Status values:** `covered` (1.0) · `partial` (0.5) · `gap` (0.0)

### Logic coverage

Map backend rules to `logic.tests[]` in inventory JSON. Key suites:

```bash
npm run test:unit
npm run test:api
npm run test:grading
npm run test:discussion
npm run test:assignment-workflow
npm run test:files:all
npm run test:institutional-workflows
npm run test:migration
cd frontend && npm run test:run:stable
```

Ratchet Jest thresholds in `jest.config.js` monthly — never lower them.

### UI coverage

See `data-regression-id` convention below. Mark `ui.status: "covered"` when Playwright test clicks the id and asserts outcome (include refresh where state must persist).

Historical manual regression logs and June 2026 test reports are in [archive/](./archive/).

---

## `data-regression-id` convention

Every user-facing button, link-as-button, and menu item should have a stable Playwright selector:

```tsx
<button type="button" data-regression-id="discussion-reply-like" ...>
```

**Rules:**

1. Kebab-case, area-prefixed: `discussion-`, `assignment-`, `gradebook-`, etc.
2. Match an entry in `docs/regression-inventory.json` → `ui.regressionId`
3. Add when touching a component; don't batch-refactor the whole app
4. Menus: id on each `menuitem`, not only the ⋮ trigger

```typescript
await page.locator('[data-regression-id="discussion-reply-like"]').click();
```

**Snapshot pairing:** `e2e/specs/regression-interactions/<area>.spec.ts`

---

## QuizWave competitive scoring

### Architecture

```
quizwave.socket.js     → validates answer, calls processAnswer()
quizScoringEngine.js   → scores, streaks, ranks, leaderboards
quizwaveScoringConfig.js → tunable constants
```

Clients render `quizwave:player-result` / `quizwave:answer-received` and snapshot leaderboard only.

### Formula

```
basePoints = 1000
timeFactor = remainingTime / totalQuestionTime
speedBonus = floor(basePoints * timeFactor * 0.5)
effectiveStreak = min(streakBeforeAnswer, 5)
streakMultiplier = min(1 + effectiveStreak * 0.1, 1.5)
points = round((basePoints + speedBonus) * streakMultiplier * questionTypeMultiplier)
```

Incorrect → 0 points, streak reset. Milestones: 3 On Fire, 5 Unstoppable, 8 Quiz Master.

### Anti-cheat

Answers only in `QUESTION_ACTIVE`; one answer per question; server `phaseStartedAt` for response time; reject invalid indices and duplicates.

**Key files:** `config/quizwaveScoringConfig.js`, `services/quizScoringEngine.js`, `socket/quizwave.socket.js`, `tests/quizScoringEngine.test.js`

**Manual smoke:** two students, fast vs slow correct answer, streak reset on wrong, scoreboard deltas, MVP badges on finish.
