# E2E seed scripts

Scripts that prepare MongoDB + env for Playwright live and seeded suites. Run against a **disposable** database in CI; use local `MONGODB_URI` for dev.

## `npm run seed:e2e:visual`

**Script:** `scripts/seedVisualE2e.js`

**Purpose:** Production-like demo data for L2 live journeys, L3 visual snapshots, and PR/nightly CI.

**What it does:**

1. Upserts base accounts:
   - `teacher@vidyalms.com` / `password123` (or `DEMO_TEACHER_PASSWORD`)
   - `admin@vidyalms.com` / `password123` (or `DEMO_ADMIN_PASSWORD`)
2. Runs `scripts/seedGrade8MathIndiaDemo.js` — Mathematics Grade 8 course (`catalog.courseCode` **DEMO-MATH8-IN-2026**), demo students (e.g. `arjun.menon@student.demo.vidyalms.com` / `VedantaDemo8!`), modules, assignments, discussions.
3. Writes **`e2e/.env.local`** with resolved IDs (merged with any existing keys):
   - `E2E_MATH_COURSE_CODE` / `E2E_MATH_COURSE_ID`
   - `E2E_RATIONAL_THREAD_ID` (Discussion: Rational Numbers)
   - `E2E_SEEDED_QUIZ_ID` (Quiz — Rational Numbers)

Live specs read these via `e2e/helpers/live-auth.ts`. If `.env.local` is missing but the API is up, Playwright **`e2e/global-setup.ts`** looks up the course by catalog code before tests run.

**When to use:**

- Before `npm run test:e2e:live`, `test:e2e:live:pr`, `test:e2e:l4-inventory`
- CI: `live-e2e-nightly.yml`, `live-e2e-pr.yml`, `e2e-multibrowser-weekly.yml`
- Visual baselines: `npm run test:e2e:visual`

**Required env:** `MONGODB_URI`

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/lms-dev npm run seed:e2e:visual
```

---

## `npm run seed:e2e:upload`

**Script:** `scripts/seedUploadE2e.js`

**Purpose:** Isolated upload/file harness — deterministic teacher/student/admin, course, page, and `FileAsset` rows for chunk upload and file-workflow specs.

**What it does:**

1. Creates or updates users (`teacher.upload.e2e@example.com`, `student.upload.e2e@example.com`, `admin.upload.e2e@example.com`) with password `TestUpload123!` (or `E2E_UPLOAD_PASSWORD`)
2. Creates **Upload E2E Harness Course** with module, page, and sample file metadata
3. Writes `e2e/.env.local` with `E2E_COURSE_ID`, tokens, and IDs for Playwright (merges with math demo IDs if `seed:e2e:visual` ran first)

**When to use:**

- Before `npm run test:e2e:seeded` or `npm run test:e2e:seeded-gated`
- CI: `live-e2e-nightly.yml` → `seeded-edge-e2e` job
- Local file/upload debugging

**Required env:** `MONGODB_URI` (defaults to `mongodb://127.0.0.1:27017/lms`)

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/lms-dev npm run seed:e2e:upload
npm run test:e2e:seeded-gated
```

---

## Onboarding checklist

| Goal | Command |
|------|---------|
| §14 long-tail (shell + course lifecycle) | `seed:e2e:visual` → `test:e2e:inventory-longtail` |
| Full live regression (math course) | `seed:e2e:visual` → start API → `test:e2e:live` |
| Fast PR smoke | `seed:e2e:visual` → `test:e2e:live:pr` |
| Upload / file specs only | `seed:e2e:upload` → `test:e2e:seeded-gated` |
| Post-deploy smoke | `node scripts/smokeDeploy.js` (see env below) |

**Post-deploy / staging smoke** (`scripts/smokeDeploy.js`):

```bash
STAGING_API_URL=https://api.example.com \
STAGING_EMAIL=teacher@vidyalms.com \
STAGING_PASSWORD=password123 \
npm run smoke:deploy
```

Checks: `/health`, login, `GET /api/courses`, `GET /api/todos`.

---

## Parallel-safe live specs

Live specs that create temp threads/courses should use `e2e/helpers/live-cleanup.ts` (`trackThread`, `trackCourse`, `cleanupTracked` in `afterAll`). Serial execution (`--workers=1`) is still required for shared math-course mutations.

---

## Physical QR scan

Course enrollment via camera QR is **manual / staging only** — not seeded or automated. Use staging checklist §10 for sign-off.
