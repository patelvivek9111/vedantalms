# Vedanta LMS — Learning Management System

A comprehensive Learning Management System built with **React**, **Node.js**, **Express**, and **MongoDB**. It supports courses, assignments, institutional grading, discussions, file workflows, QuizWave live sessions, and operational tooling for production teams.

**Live site:** [vedantaed.com](https://vedantaed.com)

---

## Table of contents

1. [Overview](#overview)
2. [Key features](#key-features)
3. [Technology stack](#technology-stack)
4. [Repository layout](#repository-layout)
5. [Getting started](#getting-started)
6. [User roles](#user-roles)
7. [API surface (selected)](#api-surface-selected)
8. [Security](#security)
9. [Deployment](#deployment)
10. [Development & quality](#development--quality)
11. [Data models (selected)](#data-models-selected)
12. [UI and UX](#ui-and-ux)
13. [Roadmap ideas](#roadmap-ideas)
14. [License, contributing, support](#license)

---

## Overview

Vedanta LMS is a full-featured platform for educators and institutions: course shells, modules and pages, assignments and submissions, **policy-driven grading** with lifecycle controls, **transcripts**, **discussions** (including scaled reply storage and audit trails), **notifications and inbox**, **QuizWave** over Socket.IO, meetings (including Zoho hooks), and **data portability** (export/restore bundles with verification scripts).

**Product accents in this codebase**

- **Institutional grading** — Policy resolution, grade lifecycle (post → finalize → amend), frozen snapshots, transcript recompute, FERPA-aware permissions, registrar-oriented APIs.
- **Shared grading engine** — `shared/grading` with backend/frontend parity tests.
- **Files and uploads** — REST file access, resumable **chunk uploads** (`/api/upload/chunk/*`), reconciliation and maintenance workers, Jest and Playwright coverage for upload reliability.
- **Production operations** — BullMQ async jobs, ops dashboard, extended health probes, provider adapters (`adapters/` + `config/providers.js` for storage, cache, queue).
- **Mobile-friendly shell** — Bottom nav, pull-to-refresh, swipe and haptics where supported, shared UI under `frontend/src/components/common` and `frontend/src/design-system/`.
- **Internationalization** — `i18next` / `react-i18next` in the frontend for incremental locale rollout.
- **Observability** — Prometheus-style `GET /metrics` and deeper readiness via `GET /health/ready` when optional Redis/queue/storage are configured; local stack under `monitoring/`.

**Where to read more**

| Area | Location |
|------|----------|
| Production deployment and grading waves | `docs/production/README.md`, `docs/production-checklist.md` |
| Runbooks (backup, restore, incidents) | `docs/operations/` |
| Architecture (export, portability, migrations) | `docs/architecture/` |
| FERPA | `docs/security/ferpa-access-controls.md` |
| Backend Jest layout | `tests/README.md` |
| Frontend Vitest layout | `frontend/tests/README.md` |

---

## Key features

### Course management

- Course creation with metadata, syllabus, visibility, terms, codes, and credits.
- **Modules** with ordering (including drag-and-drop), locks, and nested **pages** (rich text, markdown-style workflows where enabled).
- Customizable course navigation (sidebar patterns, module cards).

### Assignments

- Due dates, publish state, visibility, file attachments, and multiple question styles.
- **Group assignments** with group targeting; course shell can load module assignments in bulk (`GET /api/assignments/course/:courseId/module-assignments`) to avoid N+1 requests.
- **Submissions** with attempts, late handling, and **submission versioning** (`submissionVersion` model) for audit-friendly history.

### Grading and assessment

- **Policies** — Institution and course policies (scales, weights, drop-lowest, late rules), effective-policy preview/diff, audit history in the UI.
- **Gradebook** — Instructor grid with filters, search, virtualization, keyboard navigation, async Excel export with client fallback.
- **Lifecycle** — Post → finalize → amend with confirmations and timelines; frozen `studentCourseGradeSnapshot` rows; transcript issuance logs.
- **Capabilities** — Fine-grained gates such as `VIEW_LIFECYCLE`, `POST_GRADES`, `FINALIZE_GRADES`, `AMEND_GRADES`, `RECOMPUTE_GRADES`.
- **Transcripts** — Semester views and GPA via `shared/grading` (parity-tested with the API).

### Institutional operations and data portability

- Institution grading policy in system settings; **ops dashboard** (`GET /api/ops/dashboard`).
- **Export / restore** — `npm run export:institution` / `npm run restore:institution` with manifests, checksums, and verification scripts (`verify:data-integrity`, `verify:restore`, and related).
- **Providers** — `STORAGE_PROVIDER`, `CACHE_PROVIDER`, `QUEUE_PROVIDER` via `config/providers.js` (local/Cloudinary, memory/Redis, inline/BullMQ).

### Student management

- Enrollment flows (including requests and bulk paths where configured), profiles, and analytics surfaces tied to courses.

### Discussions

- Threaded discussions at course and module scope; pins, likes, locks, and **discussion grading** endpoints on threads.
- **Reply storage** — Root and nested replies are served through thread routes (`GET|POST /api/threads/:threadId/replies`, etc.) with a dedicated **`/api/replies`** router for reply-centric operations (for example nested **children**). Large courses can use **collection-backed replies** (see migrations `migrate:discussion-replies*`) instead of growing embedded arrays forever.
- **Participation and read state** — Dedicated models and repair scripts for counters, read markers, and duplicates.
- **Audit** — `DiscussionAuditEvent` records moderation-relevant actions where enabled.
- **Benchmarks and verification** — `npm run bench:discussion`, `npm run verify:discussion-*`, and ops tools under `scripts/ops/` (see [Development & quality](#development--quality)).

### Groups, messaging, announcements, polls, calendar, attendance, tasks, catalog

- Group sets, group discussions, group meetings.
- Inbox conversations with course context and attachments; notification center with preferences.
- Announcements and polls; integrated calendar; attendance; per-user todos; public/catalog discovery.

### QuizWave (live sessions)

- Teacher session control and student PIN join over **Socket.IO**; optional **Redis adapter** for horizontal scale; cleanup worker; metrics on `/health` and `/metrics`.

### Timed quizzes

- Server-side sweep worker: `npm run worker:timed-quiz-sweep` (supports recovery scripts such as `npm run recover:timed-quizzes`).

### Files and uploads

- **`/api/files`** — Authenticated file metadata and download paths (FERPA-sensitive flows).
- **Multipart and chunk uploads** — `POST /api/upload` and `/api/upload/chunk/*` for large or resumable uploads.
- **Maintenance** — `worker:file-maintenance`, `worker:blob-purge`, institutional blob restore (`restore:institution:blobs`), and many `verify:*` / `migrate:*` scripts for orphan cleanup, integrity, and syllabus file-asset migrations.

### Meetings

- Course and group meeting sections; **Zoho Meeting** integration (routes under `/api/integrations/zoho-meeting`).

### Administrative

- Admin dashboard, user and course oversight, reports (`/api/reports`, registrar routes), security and audit listings, maintenance toggles.

---

## Technology stack

### Frontend (`frontend/`)

- **React 18**, **TypeScript**, **Vite**, **React Router**, **Tailwind CSS**
- **Redux Toolkit**, **Axios**
- **TinyMCE**, **TipTap** — Rich authoring; legacy **React Quill** may still appear in older surfaces
- **@hello-pangea/dnd** — Drag and drop (module/course ordering)
- **React Big Calendar**, **Lucide React**, **react-toastify**
- **i18next** / **react-i18next**
- **react-markdown**, **dompurify**, **docx-preview**, **html5-qrcode**, **qrcode.react**
- **ExcelJS** — Gradebook and exports
- **Vitest** + **jsdom** — Unit and component tests (`frontend/tests/`)

### Backend (repository root)

- **Node.js**, **Express**, **MongoDB**, **Mongoose**
- **JWT**, **bcryptjs**, **Multer**, **express-validator**, **CORS**, **Helmet**, **express-rate-limit**
- **Socket.IO** + optional **@socket.io/redis-adapter** and **ioredis**
- **BullMQ** — Async grading and related jobs when `REDIS_URL` is set
- **pino** / **pino-http** — Structured logging
- **Jest**, **Supertest**, **mongodb-memory-server** — API and service tests (`tests/`)
- **shared/grading**, **shared/portability** — Shared math and export manifest utilities

### Quality and E2E

- **Playwright** (`e2e/`) — Browser tests for uploads, files, discussions, assignments, timed quiz races, smoke flows; **`@axe-core/playwright`** for accessibility checks in selected specs.
- **GitHub Actions** — `.github/workflows/` (predeploy, grading, hardening, and related gates)

### Infrastructure (typical)

- **MongoDB Atlas** or self-hosted MongoDB
- **Railway / Render** (API), **Vercel** (frontend) — see `vercel.json` and deployment docs
- **Cloudinary** or local storage via provider adapters
- **Redis** — Sockets, BullMQ, optional cache
- **Docker** — `Dockerfile`, `docker-compose.prod.yml`
- **Prometheus / Grafana** — `monitoring/docker-compose.observability.yml`

---

## Repository layout

High-level map of what lives in git. **Omitted:** build output (`frontend/dist/`, `.vite/`), `node_modules/`, `uploads/`, `coverage/`, local env files, and other gitignored paths. Some paths may appear twice on disk when tooling copies files (e.g. Windows vs POSIX); treat the tree as logical layout. For deployment and grading operations, see **`docs/production/README.md`**.

```
lms/
├── .github/
│   └── workflows/                       # CI: predeploy, grading-production, hardening-production, …
│
├── e2e/                                 # Playwright (Chromium/Firefox/WebKit + mobile-chrome; optional Edge)
│   ├── playwright.config.ts             # baseURL, webServer (Vite), E2E_BASE_URL / E2E_SKIP_SERVER / e2e/.env.local
│   ├── specs/                           # smoke, upload-reliability, upload-platform, file-*, assignment-access,
│   │                                    # timed-quiz-race, discussion-hardening, discussion-e2e-accessibility, …
│   ├── fixtures/                        # uploadSeeds.ts, filePlatform.ts
│   └── helpers/                         # uploadChaos.ts and shared E2E helpers
│
├── frontend/                            # Vite + React 18 + TypeScript (separate package.json)
│   ├── index.html
│   ├── vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig.json, tsconfig.test.json, .npmrc
│   ├── package.json
│   ├── public/
│   │   └── assets/                      # Static logos, favicons (see public/assets/README.md)
│   ├── tests/                           # Vitest
│   │   ├── setup.ts, helpers/, fixtures/
│   │   └── unit/                        # components/, hooks/, utils/, features/, files/, …
│   └── src/
│       ├── main.tsx, App.tsx, index.css, config.ts
│       ├── components/
│       │   ├── activity/                # Activity / dashboard widgets
│       │   ├── admin/                   # Ops dashboard, grading policy tab, file recovery / version restore UIs
│       │   ├── announcements/
│       │   ├── assignments/             # Lists, forms, grading (jsx/tsx), wrappers, file upload sections, quiz UI
│       │   ├── common/                  # RichTextEditor, ErrorBoundary, layout primitives, Calendar, ToDo, …
│       │   ├── course/                # CourseDetail, discussions, modules, meetings, storage, copy, QR, …
│       │   ├── discussions/           # Reply composer and discussion-only pieces (used with threads/)
│       │   ├── enrollment/
│       │   ├── files/                 # Dropzone, progress, previews (pdf/docx/office/media), governance UI
│       │   ├── grades/                # Gradebook, lifecycle, policy modals, student grades, what-if, audit UI
│       │   ├── groups/                # Group sets, pages, discussions, meetings, mobile nav
│       │   ├── layout/                # GlobalSidebar, BottomNav, Navigation, BurgerMenu, nav customization
│       │   ├── login/
│       │   ├── modals/                # User/sidebar/overview modals, contact inquiry, …
│       │   ├── modules/               # ModuleCard, CreateModuleForm, module sections
│       │   ├── pages/                 # Rich content pages inside modules (PageView, PageViewer, editors)
│       │   ├── polls/
│       │   ├── quizwave/              # Builder, session control, student join/game/feedback screens
│       │   ├── students/
│       │   └── threads/               # ThreadView, CreateThreadModal, wrappers
│       ├── config/                    # quizwave scoring and other static config
│       ├── constants/                 # e.g. sidebar defaults
│       ├── contexts/                  # Auth, theme, course, module providers
│       ├── design-system/             # Tokens, StatusBadge, ErrorBanner, ConfirmDialog, loading/empty states
│       ├── features/
│       │   ├── gradebook/             # Toolbar, filters, keyboard nav, status helpers (uses shared/grading client-side)
│       │   └── audit/                 # Audit filter bar, entry filtering
│       ├── hooks/                     # Grading policy, gradebook data, async jobs, uploads, mobile, debounce, …
│       ├── lib/                       # Client libraries (e.g. upload recovery / resumable chunk coordination)
│       ├── pages/                     # Routed screens: auth, catalog, course shells, admin, transcript, …
│       ├── services/                  # api.ts, gradingApi.ts, chunkedUploadApi.ts, fileUploadApi.ts, recoveryApi.ts,
│       │                              # jobsApi, opsApi, inbox, quizwave, announcements, …
│       ├── store/                     # Redux store setup and slices
│       ├── types/                     # Shared TS types (grading, quizwave, …)
│       └── utils/                     # Gradebook compute/export, transcript GPA, discussions, inbox filters, …
│
├── shared/                              # Pure JS packages consumed by API, scripts, and Vite alias
│   ├── grading/                         # policyResolver, gradeCalculation, gradebookCell, transcriptHash, …
│   │                                    # Built outputs: cjs/, mjs/, browser/ + package.json + index.d.ts
│   └── portability/                     # exportManifest, checkpoint, sectionRegistry, schemaMetadata (cjs)
│
├── adapters/                            # Phase P providers (wired from config/providers.js)
│   ├── cache/                           # memory vs Redis
│   ├── storage/                         # local disk vs Cloudinary
│   └── jobs/                            # inline vs BullMQ
│
├── config/
│   ├── providers.js                     # STORAGE_PROVIDER, CACHE_PROVIDER, QUEUE_PROVIDER resolution
│   ├── paths.js                         # Export/restore/migration default paths
│   └── startupValidation.js             # Boot-time env validation
│
├── domains/                             # Thin facades composing services for bounded contexts
│   ├── grading/index.js
│   ├── audit/index.js
│   └── transcript/index.js
│
├── controllers/                         # HTTP handlers (33+ modules): auth, user, course, module, page,
│                                        # assignment, submission, grades, gradeLifecycle, gradingPolicy, jobs,
│                                        # ops, registrarReports, reports, file, fileRecovery, group, inbox,
│                                        # announcement, poll, event, attendance, todo, quizwave, zohoMeeting,
│                                        # contact, admin, courseStorage, …
│
├── services/                            # Business logic (~90 modules), including:
│   ├── export/                          # institutionalExport, chunkedWriter, blobManifest
│   ├── import/                          # institutionalImport, importGuards, idRemapper, blobRestore
│   ├── backup/                          # backupManifest, snapshotArchive
│   ├── integrity/                       # dataIntegrity
│   ├── verification/                    # file/upload platform closure checks (used by verify* scripts)
│   ├── sis/, lti/                       # SIS staging, LTI readiness stubs
│   ├── cache/, storage/, jobs/          # Provider entrypoints (delegate to adapters)
│   ├── grading*.js, grade*.js           # Policies, lifecycle, gradebook export/data, transcript issuance/recompute
│   ├── file*.js, blob*.js, chunkedUpload, uploadRecovery, fileGovernance*, fileIntegrity, …
│   ├── jobQueue, gradingJobProcessors   # BullMQ wiring
│   ├── discussion*.js                  # Replies, access, participation, counters, sanitizer, observability, …
│   ├── quizwave*, timedQuiz*, quizScoring*
│   └── ferpaAudit, academicAudit*, institutionalNotification, …
│
├── models/                              # Mongoose schemas + plugins/
│   ├── plugins/                         # portabilityMetadata, immutableAppendOnly, …
│   ├── user, course, module, page, Assignment, Submission, submissionVersion
│   ├── thread (+ discussionReply, discussionParticipation, discussionAuditEvent when enabled)
│   ├── institutionGradingPolicy, courseGradingPolicy, gradingPolicyAudit, courseGradeLifecycle,
│   ├── studentCourseGradeSnapshot, gradeAmendmentRecord, transcriptIssueLog, asyncJob
│   ├── fileAsset, previewManifest, institutionBackupManifest, migrationRun, migrationMetadata
│   ├── Group, GroupSet, quizwave, announcement, poll, event, attendance, todo, notification(+Preferences)
│   ├── Conversation(+Participant), Message (inbox), loginActivity, systemSettings, systemAuditEvent, …
│
├── routes/                              # Mounted under /api/* in server.js (see below for file list)
├── middleware/
│   ├── auth.js, upload.js, fileAccess.js
│   ├── academicPermissions.js, ferpaAccess.js, requestCorrelation.js
│   └── discussionRouteMetrics.js        # Optional metrics hooks for thread/reply traffic
│
├── utils/                               # API-layer helpers (not domain services)
│   ├── gradeCalculation.js            # Delegates into shared/grading
│   ├── ensureIndexes.js               # Index helpers used at runtime / boot
│   ├── bullmqConnection.js, cache.js, cloudinary.js, emailService.js, contactFormMail.js
│   ├── quizwaveSessionStore.js, quizwaveCleanup.js, quizwaveSocketThrottle.js
│   ├── fileBlobUtils.js, fileResponse.js, fileSettings.js, fileReports.js, docxTextExtract.js
│   ├── courseSelfEnroll.js, semesterUtils.js, ids.js
│
├── socket/
│   └── quizwave.socket.js               # Socket.IO namespace wiring for live sessions
│
├── workers/                             # Long-running node processes (see package.json `worker:*`)
│   ├── quizwaveCleanupWorker.js
│   ├── gradingJobsWorker.js
│   ├── timedQuizSweepWorker.js
│   ├── fileMaintenanceWorker.js
│   └── blobPurgeWorker.js
│
├── scripts/                             # CLI: migrations, export/restore, verify*, bench, load, ops repairs
│   ├── migrations/
│   │   ├── run.js, registry.js, lib/    # Migration runner + shared migration helpers
│   │   ├── migrations/                  # Numbered migrations (grading indexes, lifecycle backfills, …)
│   │   └── *.js                         # Feature migrations (assignments, discussions, syllabus files, legacy uploads)
│   ├── ops/                             # Discussion repairs, integrity dashboards, timed-quiz/grade recovery
│   ├── bench/, load/, perf/             # Gradebook, discussion, institutional load benches
│   ├── demoData/, lib/                  # Seeding helpers, discussionRepairCli, …
│   ├── archive/                         # Retired one-off scripts kept for reference
│   ├── devServer.js, devLock.js, stopDev.js, predeploySmokeCheck.js, …
│   └── verify*.js, export*.js, restore*.js, seed*.js, validate*.js, check*.js, cleanup*.js, …
│
├── tests/                               # Jest (see tests/README.md); grouped by concern:
│   ├── setup.js, helpers.js, mongoMemoryServer.js, grading/fixtures.js, grading/e2eContractSeed.js
│   ├── unit/                            # api/, controllers/, middleware/, services/, utils/
│   ├── integration/, ci/
│   ├── grading/                         # Policy, lifecycle, parity, jobs, transcript, audit timeline
│   ├── portability/, migration/
│   ├── discussions/                     # Access, replies, participation, moderation, visibility
│   ├── assignment-workflow/             # Submission races, grade release, legacy compat
│   ├── file-access, file-versioning, file-cleanup, file-integrity, file-preview, file-recovery
│   ├── ferpa-files, uploads, chunk-upload, storage-portability, blob-*
│   ├── institutional-workflows/         # Course copy, file attach, ops recovery
│   └── legacy-file-migration/
│
├── docs/
│   ├── production-checklist.md
│   ├── production/                      # deployment, scaling, DR, grading audit model, phase reports
│   ├── operations/                    # backup/restore, cutover, incidents, uploads, discussions, large courses, …
│   ├── architecture/                  # export, backup, portability, providers, workflow consistency
│   ├── files/                           # Upload architecture, secure delivery, versioning, instructor/student flows
│   ├── security/                        # ferpa-access-controls.md
│   ├── release/                         # Onboarding, validation checklists, monitoring, rollback
│   └── archive/                         # Historical phase / predeploy reports
│
├── monitoring/
│   └── docker-compose.observability.yml # Prometheus, Grafana, Alertmanager recipe
│
├── server.js                            # Express app, /api mounts, chunk-upload routes, /health, /metrics
├── jest.config.js
├── nodemon.json                         # Watches API tree; exec scripts/devServer.js
├── package.json, package-lock.json
├── Dockerfile, .dockerignore, docker-compose.prod.yml, vercel.json, generate-secret.js
└── README.md
```

**Express routers (`routes/`):** `admin`, `announcement`, `assignment`, `attendance`, `auth`, `catalog`, `contact`, `course`, `event`, `file`, `gradingPolicy`, `groupRoutes` (groups), `inbox`, `jobs`, `module`, `notification`, `ops`, `page`, `poll`, `quizwave`, `registrarReports`, `reports`, `reply`, `submission`, `thread`, `todo`, `user`, `zohoMeeting` — each `*.routes.js` is mounted from `server.js` (plus inline `POST /api/upload` and `/api/upload/chunk/*` handlers for resumable uploads).

---

## Getting started

### Prerequisites

- **Node.js 18+** (LTS recommended) — aligns with current Jest, Playwright, and toolchain versions
- **MongoDB** (local or Atlas)
- **npm** (or pnpm/yarn if you adapt commands)
- **Redis** — optional locally; recommended for multi-instance sockets and BullMQ workers

### Clone and install

```bash
git clone https://github.com/yourusername/lms.git
cd lms
npm install
cd frontend && npm install && cd ..
```

### Environment

Copy **`.env.example`** in the repository root to **`.env`** and adjust values. It documents Mongo connection pools, JWT settings, rate limits, Redis and socket tuning, provider flags, and many optional operational variables.

Minimal local excerpt:

```env
MONGODB_URI=mongodb://localhost:27017/lms
JWT_SECRET=your-super-secret-jwt-key-123
JWT_EXPIRE=30d
PORT=5000
NODE_ENV=development
```

### Run the API and the SPA

From the **repository root**, `npm run dev` runs **nodemon** with `scripts/devServer.js` (see `nodemon.json`). A **`predev`** script frees port **5000** via `scripts/stopDev.js` so restarts are less likely to fail with `EADDRINUSE`.

```bash
# Terminal 1 — API (default http://localhost:5000)
npm run dev

# Terminal 2 — Vite (default http://localhost:5173)
cd frontend && npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend:** http://localhost:5000  

Use `npm run stop:dev` to stop whatever is bound to port 5000, and `npm run dev:clean` to kill the port then start nodemon.

### End-to-end tests

Playwright config lives in `e2e/playwright.config.ts`. By default it can start **only the Vite dev server**; **API-dependent tests need MongoDB and the Express server running** (or set `E2E_SKIP_SERVER` / `E2E_BASE_URL` as appropriate for your setup). See `npm run test:e2e` and `npm run test:e2e:install` in [Development & quality](#development--quality).

### Production-oriented path

1. Read `docs/production-checklist.md` and `docs/production/README.md`.  
2. Run grading gates: `npm run verify:grading`, `npm run test:grading`, `npm run validate:indexes`.  
3. Preview migrations: `npm run migrate:dry-run`, then `npm run migrate` in a maintenance window.  
4. For async exports/recompute, set `REDIS_URL` and run `npm run worker:grading-jobs` beside the API.  
5. Optional metrics stack: `npm run obs:up` (see `monitoring/docker-compose.observability.yml`).

### Windows note

`npm run build:frontend` uses **bash** (`bash -c '…'`). On Windows, use **Git Bash**, **WSL**, or run `cd frontend && npm install && npm run build` manually.

---

## User roles

| Role | Typical capabilities |
|------|----------------------|
| **Admin** | Full system access, users, courses, settings, institution export/restore CLIs, ops dashboard |
| **Registrar / department admin** | Grading policy, lifecycle oversight, registrar reports, transcript recompute (capability-gated) |
| **Teacher** | Courses, content, assignments, gradebook, discussions, grading lifecycle actions permitted by policy |
| **Student** | Enrolled courses, submissions, discussions, grades, transcripts, calendar, notifications |

Exact permissions combine **role** and **capability** checks on sensitive routes.

---

## API surface (selected)

Full behavior is defined in `routes/*.routes.js`; this list is a **non-exhaustive** index.

| Area | Examples |
|------|----------|
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| **Courses** | `GET/POST /api/courses`, `GET/PUT/DELETE /api/courses/:id`, enrollment routes |
| **Assignments** | `GET /api/assignments/course/:courseId/module-assignments`, CRUD under `/api/assignments` |
| **Submissions** | `POST /api/submissions`, listing and grading under `/api/submissions` |
| **Files** | `GET /api/files/...` (metadata and download; see `file.routes.js`) |
| **Uploads** | `POST /api/upload`, `POST /api/upload/chunk/init`, chunk PUT/complete/status routes on `server.js` |
| **Grades** | Gradebook, lifecycle, provenance under `/api/grades` (see `grades.routes.js`) |
| **Grading policy** | `/api/grading-policy/...` (institution, course, preview, effective, audit, transcript recompute) |
| **Jobs** | `GET /api/jobs/:jobId`, `GET /api/jobs/:jobId/download` |
| **Ops / registrar** | `GET /api/ops/dashboard`, `GET /api/registrar/reports/*` |
| **Threads** | `GET/POST /api/threads`, `GET /api/threads/:threadId`, **paginated** `GET /api/threads/:threadId/replies`, `POST /api/threads/:threadId/replies`, moderation and grading subpaths |
| **Replies** | `GET /api/replies/:replyId/children`, … (see `reply.routes.js`) |
| **Groups, inbox, notifications, todos, polls, QuizWave, Zoho** | Respective `/api/...` routers |
| **Health** | `GET /health`, `GET /health/ready`, `GET /health/ops`, `GET /metrics` |

---

## Security

- JWT authentication, bcrypt password hashing, RBAC plus **academic capabilities** for grading.
- **FERPA**-scoped access (`middleware/ferpaAccess.js`) and audit logging on sensitive grade reads.
- CORS, Helmet, validation, upload restrictions, session and login-activity tracking.
- Stricter rate limits on grading lifecycle, transcript, and recompute endpoints in production (see `.env.example`).

---

## Deployment

Typical targets: **Railway**, **Render**, **Vercel** (frontend) + API host, or containers via **Docker**.

| Artifact | Purpose |
|----------|---------|
| `vercel.json` | SPA hosting and rewrites for API/uploads/health |
| `.env.example` | Authoritative template for production and ops toggles |
| `Dockerfile`, `docker-compose.prod.yml` | Container baseline |
| `docs/production/deployment.md` | Step-by-step and environment notes |

**Important frontend env vars**

- Set **`VITE_API_URL`** per environment, or rely on **same-origin** `/api` when rewrites proxy to the API.  
- **`VITE_SOCKET_ORIGIN`** — When the SPA and API differ, QuizWave needs a real Socket.IO origin; see `frontend/src/config.ts` and comments in `.env.example`.  
- Placeholder hosts such as **`placeholder.onrender.com`** are ignored so a bad template value does not break login.

---

## Development and quality

### Root npm scripts (grouped)

Scripts are defined in **`package.json`**; names and flags may evolve. Groupings below match current automation.

| Group | Examples |
|-------|----------|
| **Dev lifecycle** | `dev`, `dev:clean`, `stop:dev`, `check:mongo`, `verify:dev-lifecycle` |
| **Build** | `build`, `build:frontend` (bash on Windows — see above) |
| **Test (Jest)** | `test`, `test:api`, `test:unit`, `test:grading`, `test:portability`, `test:migration`, `test:files`, `test:discussion`, `test:institutional-workflows`, `test:file-recovery`, `test:chunk-upload`, `test:files:all` |
| **Grading verification** | `verify:grading`, `validate:indexes`, `verify:audit-integrity`, `verify:snapshots`, `perf:gradebook`, `bench:gradebook` |
| **Migrations** | `migrate`, `migrate:dry-run`, syllabus/assignment/discussion migrations and rollbacks (see `package.json` for exact names) |
| **Institution export/restore** | `export:institution`, `restore:institution`, `verify:data-integrity`, `verify:restore`, `verify:institution-export`, `verify:restore-parity`, blob restore variants |
| **Files and uploads** | `verify:file-*`, `cleanup:file-orphans*`, `migrate:legacy-files*`, `verify:upload-*`, `test:file-scale`, `test:e2e:uploads` |
| **Discussions** | `verify:discussion-*`, `migrate:discussion-*`, `repair:discussion-*`, `prune:discussion-embedded*`, `bench:discussion`, `bench:discussion-large`, `support:discussion-dashboard`, `discussion:rollback-playbook` |
| **Assignments** | `verify:assignment-group-migration`, `verify:assignment-workflow:production`, `migrate:assignment-group-ids*`, `rollback:assignment-workflow*`, `test:load:assignment-workflow` |
| **E2E** | `test:e2e`, `test:e2e:install`, `seed:e2e:upload`, `test:e2e:seeded` |
| **Workers** | `worker:grading-jobs`, `worker:quizwave-cleanup`, `worker:timed-quiz-sweep`, `worker:file-maintenance`, `worker:blob-purge` (+ `:apply` where applicable) |
| **Observability** | `obs:up`, `obs:down`, `obs:logs` |
| **Smoke / production checks** | `smoke:predeploy`, `verify:production-health`, `verify:workflows`, `audit:duplicates` |

### Frontend npm scripts (`frontend/package.json`)

| Script | Purpose |
|--------|---------|
| `dev` | Vite dev server |
| `build` | Typecheck + production bundle |
| `lint` | ESLint |
| `test` | Vitest watch |
| `test:run`, `test:run:stable` | One-shot test runs |
| `test:unit`, `test:components`, `test:grading`, `test:workflows`, `test:fux`, `test:files` | Focused suites |

### Contribution workflow

- Match existing patterns in the nearest feature folder before introducing new abstractions.  
- Prefer **`npm run audit:duplicates`** before large refactors if you touch both `.jsx` and `.tsx`.  
- For release branches, run the **grading** and **predeploy** scripts your team has wired in CI (`docs/production/README.md`).

---

## Data models (selected)

| Model / area | Notes |
|--------------|--------|
| **User** | Auth, profile, roles, preferences |
| **Course**, **Module**, **Page** | Shell, ordering, visibility |
| **Assignment**, **Submission** | Questions, due dates, groups; files and attempt metadata |
| **submissionVersion** | Version history for submissions |
| **Gradebook-related** | Policies, lifecycle, snapshots, amendments, transcript logs, async jobs (see existing README model list in code: `institutionGradingPolicy`, `courseGradingPolicy`, `courseGradeLifecycle`, `studentCourseGradeSnapshot`, …) |
| **Thread** | Discussion threads (heavy reply arrays may be migrated to collection storage) |
| **discussionReply** | Collection-backed reply documents when migration is applied |
| **discussionParticipation** | Per-user participation and counters |
| **discussionAuditEvent** | Moderation-oriented audit rows |

---

## UI and UX

- Responsive layout for mobile, tablet, and desktop; bottom navigation and global sidebar patterns.
- Design tokens, status badges, confirm dialogs, skip links, and loading/error patterns under `design-system/` and `components/common`.
- Pull-to-refresh, swipe, optional haptics, and offline-minded hooks where used.
- Theme support depends on feature flags and `ThemeContext` — refer to the live app and `frontend/src` for current dark/light behavior.

---

## Roadmap ideas

Non-committing ideas: deeper SIS/LTI, signed URL streaming for large exports, richer meeting analytics, adaptive quizzes, plagiarism tooling, native mobile clients, expanded email templates, MFA, SCORM, full i18n locale packs, broader automated Socket.IO regression coverage.

---

## License

**ISC** — see `package.json`.

---

## Contributing

Pull requests are welcome. Please run the relevant **Jest** / **Vitest** suites and any **Playwright** specs that touch your area; follow the repository’s existing style and keep diffs focused.

---

## Support

Open a GitHub issue or contact your institution’s Vedanta LMS operators for production incidents (use the runbooks under `docs/operations/` when applicable).

---

## Acknowledgments

Built with the open-source ecosystem above and operational practices documented in-repo for safe grading and data handling.

---

**Repository `package.json` version:** 1.0.0  
**README last revised:** 2026-05-27
