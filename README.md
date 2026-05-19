# 📚 Vedanta LMS - Learning Management System

A comprehensive, modern Learning Management System built with React, Node.js, Express, and MongoDB. Designed for educational institutions to manage courses, assignments, students, and administrative tasks efficiently.

## 🌟 Overview

Vedanta LMS is a full-featured learning management platform that enables educators to create engaging courses, manage student enrollments, track progress, and facilitate collaboration. Students can access course materials, submit assignments, participate in discussions, and track their academic progress.

**Live URL**: [vedantaed.com](https://vedantaed.com)

**Current product accents (beyond the checklist below)**  
The codebase emphasizes **institutional grading** (policy resolution, grade lifecycle post/finalize/amend, frozen snapshots, transcript recompute, FERPA-aware permissions, registrar tooling), a **shared canonical grading engine** (`shared/grading`) with backend/frontend parity tests, **data portability** (institution export/restore bundles, integrity verification, backup manifests), and **production operations** (async jobs via BullMQ, ops dashboard, extended health probes, provider adapters for storage/cache/queue). Existing strengths remain: mobile-friendly shell (bottom nav, pull-to-refresh, swipe, haptics), notification center + inbox, QuizWave over Socket.IO (Redis adapter in production), Zoho Meeting hooks, shared UI primitives (`components/common`, `design-system/`), and offline-minded helpers. The frontend bundles `react-i18next` for eventual multi-language rollout. Backend exposes Prometheus-friendly `/metrics` and deeper readiness via `/health/ready` when using the optional stack under `monitoring/`.

---

## ✨ Key Features

### 🎓 Course Management
- **Course Creation & Customization**
  - Create courses with detailed descriptions, syllabi, and metadata
  - Customizable course navigation sidebar
  - Course visibility controls (public/private)
  - Semester and term management
  - Course code and credit hours tracking

- **Module Organization**
  - Organize course content into modules
  - Drag-and-drop module reordering
  - Module-level content management
  - Lock/unlock modules for sequential learning

- **Rich Content Pages**
  - Rich text editor with formatting options
  - Markdown support
  - Image and file embedding
  - Page-level permissions

### 📝 Assignment Management
- **Individual Assignments**
  - Create assignments with due dates
  - Multiple question types: text, multiple-choice, matching
  - File attachments support
  - Assignment visibility controls
  - Publish/unpublish assignments

- **Group Assignments**
  - Assign assignments to student groups
  - Group-based submission tracking
  - Collaborative assignment management

- **Submission Handling**
  - File upload support
  - Multiple submission attempts
  - Late submission tracking
  - Submission status monitoring

### 📊 Grading & Assessment
- **Flexible Grading System**
  - Institution-wide and per-course grading policies (letter scales, weights, drop-lowest, late penalties)
  - Effective policy resolution with preview and diff against prior versions
  - Category-based grading (assignment groups) with shared calculation engine
  - Policy audit history and provenance panels in the UI

- **Gradebook**
  - Instructor gradebook with filters (all / needs grading / below threshold), debounced search, virtualized rows
  - Keyboard navigation between cells; async server-side Excel export with client fallback
  - Student grade overview and what-if score calculator (policy-aware)
  - Grade export tied to grading engine version and resolved policy snapshots

- **Grade lifecycle & academic records**
  - Course workflow: **post → finalize → amend** with confirmation dialogs and amendment timeline
  - Frozen `studentCourseGradeSnapshot` rows and transcript issuance logs
  - Course audit timeline, grade provenance, and academic audit events
  - Capability-based access (`VIEW_LIFECYCLE`, `POST_GRADES`, `FINALIZE_GRADES`, `AMEND_GRADES`, `RECOMPUTE_GRADES`)

- **Transcript System**
  - Student academic transcript with semester-wise grades
  - GPA calculation via shared `shared/grading` (parity-tested with backend)
  - Transcript regenerate and institution-wide recompute endpoints

### 🏛️ Institutional Operations & Data Portability
- **Admin / registrar tooling**
  - Institution grading policy tab in system settings
  - Operations dashboard (`GET /api/ops/dashboard`) for queue, storage, and health signals
  - Registrar report routes under `/api/registrar/reports`

- **Export, backup & restore**
  - Institution bundle export (`npm run export:institution`) with manifest v2, checksums, resumable checkpoints
  - Restore/dry-run/merge flows (`npm run restore:institution`) with ID remapping guards
  - Backup manifest model, compatibility verification, and data-integrity scripts

- **Provider abstraction (Phase P)**
  - Pluggable storage (`local` / Cloudinary), cache (`memory` / Redis), and job queue (`inline` / BullMQ)
  - Configuration via `config/providers.js` and `STORAGE_PROVIDER`, `CACHE_PROVIDER`, `QUEUE_PROVIDER`

- **Documentation & runbooks**
  - Production guides: `docs/production/` (deployment, scaling, disaster recovery, grading audit model)
  - Operations runbooks: `docs/operations/` (backup, restore, migration cutover, incident response)
  - Architecture notes: `docs/architecture/` (export, backup, portability, migration readiness)
  - FERPA controls: `docs/security/ferpa-access-controls.md`

### 👥 Student Management
- **Enrollment System**
  - Student search and enrollment
  - Enrollment approval workflow
  - Bulk enrollment support
  - Unenrollment capabilities

- **Student Profiles**
  - Profile pictures and personal information
  - Academic history tracking
  - Performance analytics

### 💬 Collaboration & Communication
- **Discussion Forums**
  - Threaded discussions
  - Course and module-level discussions
  - Reply and like functionality
  - Thread pinning
  - Discussion grading

- **Group Projects**
  - Create and manage student groups
  - Group sets for multiple projects
  - Group discussion boards
  - Group pages and announcements
  - Group assignment management

- **Messaging System**
  - Inbox for direct messages
  - Conversation threads
  - Unread message tracking
  - Real-time notifications

### 📢 Announcements & Polls
- **Announcements**
  - Course-wide announcements
  - Pin important announcements
  - Rich text formatting
  - Date-based filtering

- **Polls**
  - Create interactive polls
  - Student voting
  - Real-time results
  - Poll analytics

### 📅 Calendar & Events
- **Integrated Calendar**
  - View all assignments and events
  - Due date tracking
  - Event creation and management
  - Calendar export

### ✅ Attendance Tracking
- **Digital Attendance**
  - Mark attendance for course sessions
  - Date-based attendance records
  - Attendance statistics
  - Export attendance reports

### 📋 Task Management
- **To-Do Lists**
  - Personal task management
  - Course-specific tasks
  - Due date reminders
  - Task completion tracking

### 🔍 Course Catalog
- **Public Course Discovery**
  - Browse available courses
  - Course search and filtering
  - Course details and enrollment
  - Category-based browsing

### 🔔 Notifications & inbox (current implementation)
- **In-app notifications**
  - List, filter, pagination, unread counts, bulk read/delete
  - Preference documents (delivery toggles, quiet hours, course-level tweaks)
  - Mirrors across teacher/student dashboards via `NotificationCenter`
- **Inbox / messaging**
  - Conversations with course context, attachments, star/read/folder moves
  - Client-side filter helpers (`inboxFilters`) and unread badge hooks (`useUnreadMessages`)

### ⚡ QuizWave (live sessions)
- **Teacher flow** — build/run sessions, session control dashboard, cleanup workers
- **Student flow** — PIN join, live game screen, real-time updates over Socket.IO
- **Ops** — optional Redis adapter for multi-instance socket fan-out, dedicated cleanup worker (`workers/quizwaveCleanupWorker.js`), QuizWave metrics surfaced on `/health` and `/metrics`

### 🤝 Meetings & external tools
- **Course & group meetings**
  - First-class meeting sections in course and group experiences
- **Zoho Meeting**
  - OAuth-style connection model and API routes for meeting automation (see `zohoMeeting` controller/routes/models)

### 📱 Mobile shell, accessibility, and offline-minded UX
- Customizable global and bottom navigation, mobile top bar, burger/sidebar patterns
- Pull-to-refresh, swipeable lists/containers, floating action affordances
- Screen reader announcements, confirmation modals, skeleton loading states
- Offline storage utilities and sync-oriented hooks for resilient client behavior

### 🌍 Internationalization (libraries on board)
- `i18next` + `react-i18next` are installed and ready for locale files; UI copy can be migrated incrementally without swapping the stack.

### 👨‍💼 Administrative Features
- **Admin Dashboard**
  - System-wide analytics
  - User statistics
  - Course statistics
  - System health monitoring
  - Storage usage tracking

- **User Management**
  - Create and manage user accounts
  - Role assignment (Admin, Registrar, Teacher, Student, and related academic roles)
  - User search and filtering
  - Bulk user operations
  - Login activity tracking

- **Course Oversight**
  - View all courses in the system
  - Course analytics and statistics
  - Course management controls
  - Teacher course oversight

- **System Settings**
  - General settings (site name, description)
  - Security settings (password policies, session timeout)
  - Email configuration
  - Storage settings
  - Maintenance mode
  - Institution grading policy and operations dashboard tab

- **Reports & Analytics**
  - Student performance reports
  - Course completion reports
  - Enrollment statistics
  - Grade distribution reports
  - Export to CSV

- **Security Management**
  - Login activity monitoring
  - Security audit logs
  - Password policy enforcement
  - Session management

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **React Redux** - State management
- **Axios** - HTTP client
- **React Quill** - Rich text editor (stack entry retained for reference; active rich-text surfaces use TinyMCE + TipTap below)
- **TinyMCE** - Advanced text editor
- **TipTap** - Modern rich text editor
- **React Big Calendar** - Calendar component
- **Lucide React** - Icons
- **React Toastify** - Notifications
- **i18next / react-i18next** - Internationalization libraries (ready for locale packs)
- **react-markdown** + **dompurify** - Safer rich text rendering paths
- **lottie-react** - Lightweight motion assets
- **react-split** - Resizable panes (gradebook / complex layouts)
- **ExcelJS** - Gradebook Excel export (client fallback + server async exports)
- **Vitest** + **jsdom** - Frontend unit/integration tests (`vite.config.ts`, `src/test/setup.ts`; policy parity + FUX workflow suites)

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Multer** - File uploads
- **Express Validator** - Input validation
- **CORS** - Cross-origin resource sharing
- **Socket.IO** - Realtime channel for QuizWave and related features
- **@socket.io/redis-adapter** + **ioredis** - Optional Redis-backed socket fan-out for horizontally scaled deployments
- **Helmet** - Security headers
- **express-rate-limit** - HTTP rate limiting
- **pino** + **pino-http** - Structured logging
- **Supertest** + **Jest** - API tests (`tests/`, `tests/grading/`, `tests/portability/`, `tests/migration/`)
- **BullMQ** - Async grading jobs (exports, recompute) when `REDIS_URL` is set
- **shared/grading** + **shared/portability** - Canonical grading math and export manifest utilities (CJS/MJS/browser builds)

### Infrastructure
- **MongoDB Atlas** - Cloud database
- **Railway/Render** - Hosting (backend)
- **Vercel** - Hosting (frontend)
- **Cloudinary** - File storage (optional)
- **Redis** - Optional: Socket.IO adapter, BullMQ job queue, distributed policy cache, session helpers
- **Prometheus / Grafana / Alertmanager** - Local observability recipe via `monitoring/docker-compose.observability.yml`
- **Docker** - `Dockerfile`, `docker-compose.prod.yml` for containerized production layouts
- **GitHub Actions** - `predeploy.yml`, `grading-production.yml`, `hardening-production.yml`

---

## 📁 Project Structure

_High-level map of the repository. Build artifacts (`frontend/dist/`, `coverage/`, Vite cache) are gitignored and not listed. See `docs/production/README.md` for the operational doc index._

```
lms/
├── .github/workflows/                  # CI/CD
│   ├── predeploy.yml                   # Pre-release smoke + grading checks
│   ├── grading-production.yml          # Grading policy / lifecycle gates
│   └── hardening-production.yml        # Production hardening workflow
│
├── frontend/                           # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/                  # InstitutionGradingPolicyTab, OpsDashboardPanel
│   │   │   ├── announcements/          # AnnouncementForm, AnnouncementList
│   │   │   ├── assignments/            # Assignment CRUD, grading, file upload
│   │   │   ├── common/                 # BaseModal, DataTable, PullToRefresh, AsyncJobBanner, …
│   │   │   ├── course/                 # Course shell sections (modules, quizzes, meetings, …)
│   │   │   ├── enrollment/             # EnrollmentRequestsHandler
│   │   │   ├── grades/                 # Gradebook, lifecycle, policy modals, audit UI
│   │   │   │   ├── GradebookView.tsx / StudentGradesView.tsx
│   │   │   │   ├── GradingPolicyModal.tsx / PolicyAuditHistory.tsx / PolicyDiffViewer.tsx
│   │   │   │   ├── EffectivePolicyPreview.tsx / PolicyProvenancePanel.tsx
│   │   │   │   ├── CourseGradeLifecyclePanel.tsx / AmendmentTimeline.tsx
│   │   │   │   └── AssignmentGroupsModal.tsx / GradeScaleModal.tsx
│   │   │   ├── groups/                 # Group sets, meetings, discussions
│   │   │   ├── polls/                  # PollForm, PollList, PollVote
│   │   │   ├── quizwave/               # Live quiz builder + student join/game screens
│   │   │   ├── students/               # StudentsManagement, StudentCard
│   │   │   ├── CourseDetail.tsx        # Course hub (gradebook, lifecycle, exports)
│   │   │   ├── WhatIfScores.tsx
│   │   │   └── …                       # Navigation, inbox shell, calendar, etc.
│   │   ├── design-system/              # tokens, StatusBadge, ErrorBanner, ConfirmDialog, …
│   │   ├── features/
│   │   │   ├── gradebook/              # Toolbar, filters, keyboard nav, status utils
│   │   │   └── audit/                  # AuditFilterBar, filterAuditEntries
│   │   ├── pages/                      # Route pages (Admin*, Catalog, Transcript, …)
│   │   ├── services/
│   │   │   ├── api.ts                  # Core REST client
│   │   │   ├── gradingApi.ts           # Policy, lifecycle, provenance, audit
│   │   │   ├── jobsApi.ts / opsApi.ts  # Async jobs + ops dashboard
│   │   │   └── announcementService.ts / inboxService.ts / quizwaveService.ts
│   │   ├── hooks/
│   │   │   ├── useGradingPolicy.ts / useCourseGradeLifecycle.ts
│   │   │   ├── useInstructorGradebookData.ts / useAsyncJob.ts
│   │   │   ├── useNetworkStatus.ts / useUnsavedChangesGuard.ts / useDebounce.ts
│   │   │   └── …                       # Mobile, offline, grade scale, submissions
│   │   ├── utils/
│   │   │   ├── gradebookCompute.ts     # Client gradebook (uses shared/grading)
│   │   │   ├── instructorGradebookGrades.ts / transcriptGpa.ts
│   │   │   ├── gradebookExport.ts / gradeUtils.ts / gradeUtils.types.ts
│   │   │   └── __tests__/              # Vitest policy parity (*.policy.test.ts)
│   │   ├── context/ / contexts/ / store/ / constants/
│   │   ├── App.tsx / main.tsx / config.ts
│   │   └── test/setup.ts               # Vitest bootstrap
│   ├── public/assets/                  # Logos, favicons (dist/ and .vite/ are gitignored)
│   ├── index.html / vite.config.ts / package.json
│   └── tailwind.config.js / postcss.config.js
│
├── shared/                             # Cross-runtime packages (no DOM)
│   ├── grading/                        # Canonical policy + grade math (cjs/mjs/browser)
│   │   ├── policyResolver.* / policySnapshot.* / gradeCalculation.*
│   │   ├── gradebookCell.* / transcriptHash.* / gradingEngineVersion.*
│   │   └── package.json / index.d.ts
│   └── portability/                    # Export manifest v2, section registry, checkpoints
│       ├── exportManifest.cjs / exportUtils.cjs / sectionRegistry.cjs
│       └── checkpoint.cjs / schemaMetadata.cjs
│
├── adapters/                           # Provider implementations (Phase P)
│   ├── cache/                          # memoryCacheAdapter, redisCacheAdapter
│   ├── storage/                        # localStorageAdapter, cloudStorageAdapter
│   └── jobs/                           # bullMQAdapter
│
├── config/
│   ├── providers.js                    # STORAGE/CACHE/QUEUE provider resolution
│   ├── paths.js                        # Export/restore/migration paths
│   └── startupValidation.js            # Boot-time env checks
│
├── domains/                            # Domain facades (grading, audit, transcript)
│   ├── grading/index.js
│   ├── audit/index.js
│   └── transcript/index.js
│
├── controllers/
│   ├── grades.controller.js            # Gradebook, transcript regenerate, exports
│   ├── gradeLifecycle.controller.js    # Post / finalize / amend / audit timeline
│   ├── gradingPolicy.controller.js     # Institution + course policy CRUD/preview
│   ├── jobs.controller.js              # Async job status + download
│   ├── ops.controller.js               # Ops dashboard aggregates
│   ├── registrarReports.controller.js
│   └── …                               # course, assignment, quizwave, admin, inbox, …
│
├── services/
│   ├── gradingPolicy.service.js
│   ├── gradeLifecycle.service.js / gradeCalculation.service.js
│   ├── gradingPolicyAudit.service.js / gradingPolicySnapshot.service.js
│   ├── gradebookData.service.js / gradebookExport.service.js
│   ├── transcriptIssuance.service.js / transcriptRecompute.service.js
│   ├── academicAudit.service.js / academicAuditTimeline.service.js
│   ├── ferpaAudit.service.js / jobQueue.service.js / gradingJobProcessors.js
│   ├── export/institutionalExport.service.js / chunkedWriter.js
│   ├── import/institutionalImport.service.js / importGuards.js / idRemapper.js
│   ├── integrity/dataIntegrity.service.js
│   ├── backup/backupManifest.service.js / snapshotArchive.service.js
│   ├── cache/index.js / storage/index.js / jobs/index.js
│   └── sis/ / lti/                     # SIS staging + LTI readiness stubs
│
├── models/
│   ├── institutionGradingPolicy.model.js / courseGradingPolicy.model.js
│   ├── courseGradeLifecycle.model.js / studentCourseGradeSnapshot.model.js
│   ├── gradeAmendmentRecord.model.js / gradingPolicyAudit.model.js
│   ├── transcriptIssueLog.model.js / institutionBackupManifest.model.js
│   ├── asyncJob.model.js / migrationRun.model.js / systemAuditEvent.model.js
│   ├── sisStagingEnrollment.model.js
│   └── …                               # course, user, assignment, submission, …
│
├── routes/
│   ├── grades.routes.js                # Gradebook + lifecycle + provenance
│   ├── gradingPolicy.routes.js         # /api/grading-policy/*
│   ├── jobs.routes.js                  # /api/jobs/:jobId
│   ├── ops.routes.js                   # /api/ops/dashboard
│   ├── registrarReports.routes.js
│   └── …                               # auth, courses, quizwave, admin, …
│
├── middleware/
│   ├── auth.js / roleCheck.js / upload.js
│   ├── academicPermissions.js          # Capability gates for grading
│   ├── ferpaAccess.js                  # FERPA-scoped record access
│   └── requestCorrelation.js           # Request ID propagation
│
├── utils/                              # Server helpers (cache, cloudinary, indexes, …)
│   ├── gradeCalculation.js             # Delegates to shared/grading
│   ├── bullmqConnection.js / ensureIndexes.js
│   └── quizwaveCleanup.js / quizwaveSessionStore.js / …
│
├── socket/quizwave.socket.js
│
├── workers/
│   ├── quizwaveCleanupWorker.js        # npm run worker:quizwave-cleanup
│   └── gradingJobsWorker.js            # npm run worker:grading-jobs
│
├── scripts/
│   ├── migrations/                     # DB migrations (registry + runner)
│   │   ├── migrations/001-backfill-grade-lifecycle.js
│   │   ├── migrations/002-backfill-snapshot-is-current.js
│   │   └── migrations/003-sync-grading-indexes.js
│   ├── exportInstitutionBundle.js / restoreInstitutionBundle.js
│   ├── verifyDataIntegrity.js / verifyRestore.js / verifyInstitutionExport.js
│   ├── verifyBackupCompatibility.js / verifyAuditIntegrity.js / verifySnapshots.js
│   ├── verifySharedGrading.js / checkDeprecatedGradingCalculator.js
│   ├── validateMongoIndexes.js / perf/gradebookBench.js
│   ├── predeploySmokeCheck.js
│   ├── day1BaselineCheck.js … day5LoadRamp.js   # Hardening benchmarks → DAY_PROGRESS.md
│   ├── demoData/ + seedGrade8*Demo.js + patchGrade8Math8DemoRealism.js
│   └── fixDuplicatePins.js / fixPinIndex.js     # One-off DB maintenance
│
├── tests/
│   ├── setup.js / helpers.js
│   ├── *.test.js                       # API integration suites
│   ├── grading/                        # Policy, lifecycle, FERPA, parity, e2e
│   ├── portability/                    # Provider + export manifest tests
│   └── migration/                      # institutionMigration.test.js
│
├── docs/
│   ├── production-checklist.md
│   ├── production/                     # deployment, scaling, DR, readiness reports
│   ├── operations/                     # backup, restore, cutover, incident runbooks
│   ├── architecture/                   # export, backup, portability, migration
│   └── security/ferpa-access-controls.md
│
├── monitoring/                         # Prometheus + Grafana + Alertmanager compose
├── uploads/                            # Local file storage (gitignored)
├── server.js
├── package.json / jest.config.js
├── Dockerfile / docker-compose.prod.yml / .dockerignore
├── vercel.json / generate-secret.js
└── DAY_PROGRESS.md                     # Append-only hardening notes (day1–5 scripts)
```
---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Quick Start (Local Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lms.git
   cd lms
   ```

2. **Install backend dependencies (root)**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Set up local environment variables**
   Copy `.env.example` to `.env` (or create one) in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/lms
   JWT_SECRET=your-super-secret-jwt-key-123
   JWT_EXPIRE=30d
   PORT=5000
   NODE_ENV=development
   ```

5. **Start development servers**
   
   Backend (from root):
   ```bash
   npm run dev
   ```
   
   Frontend (from root):
   ```bash
   cd frontend
   npm run dev
   ```

6. **Access the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

### Advanced / Production Path
- Start with `docs/production-checklist.md` and the index at `docs/production/README.md`.
- Run grading gates before release: `npm run verify:grading`, `npm run test:grading`, `npm run validate:indexes`.
- Preview DB migrations: `npm run migrate:dry-run` then apply in a maintenance window with `npm run migrate`.
- For async exports/recompute, set `REDIS_URL` and run `npm run worker:grading-jobs` alongside the API.
- Optional observability stack: `monitoring/docker-compose.observability.yml` (`npm run obs:up`).

---

## 👤 User Roles

### Admin
- Full system access
- User management
- Course oversight
- System settings (including institution grading policy and ops dashboard)
- Analytics and reports
- Security management
- Institution export/restore and integrity verification (via CLI scripts)

### Registrar / department admin
- Institution grading policy read/write
- Grade lifecycle oversight and registrar reports
- Operations dashboard access
- Transcript recompute (capability-gated)

### Teacher
- Create and manage courses
- Enroll/unenroll students
- Create assignments and grade submissions
- Manage course content (modules, pages)
- Track student progress
- Generate reports
- Manage course grading policy, post/finalize/amend grades, and run gradebook exports

### Student
- Enroll in courses
- View course content
- Submit assignments
- Participate in discussions
- View grades and transcripts
- Access calendar and events

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/auth/login-activity` - Login activity history

### Courses
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create course
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course
- `POST /api/courses/:id/enrollment` - Enroll student
- `POST /api/courses/:id/unenroll` - Unenroll student

### Assignments
- `GET /api/assignments/course/:courseId/module-assignments` - All module-scoped assignments for a course in one response (`byModuleId` map; used by the course shell to avoid N+1 GETs)
- `GET /api/assignments` - Get assignments
- `POST /api/assignments` - Create assignment
- `GET /api/assignments/:id` - Get assignment details
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment
- `POST /api/assignments/:id/publish` - Publish assignment

### Submissions
- `POST /api/submissions` - Submit assignment
- `GET /api/submissions/assignment/:id` - Get submissions for assignment
- `GET /api/submissions/student/:id` - Get student submissions
- `PUT /api/submissions/:id/grade` - Grade submission

### Grades & gradebook
- `GET /api/grades/student/course/:courseId` - Student course grade summary
- `GET /api/grades/course/:courseId/gradebook` - Instructor gradebook payload
- `POST /api/grades/course/:courseId/gradebook/export` - Enqueue async gradebook export (job id)
- `POST /api/grades/course/:courseId/transcript/regenerate` - Regenerate frozen snapshots (capability-gated)

### Grading policy (`/api/grading-policy`)
- `GET/PUT /api/grading-policy/institution` - Institution-wide policy (admin/registrar)
- `GET/PUT /api/grading-policy/course/:courseId` - Course policy overrides
- `POST /api/grading-policy/course/:courseId/preview` - Preview effective policy
- `GET /api/grading-policy/course/:courseId/effective` - Resolved effective policy
- `GET /api/grading-policy/audit/:entityType/:entityId` - Policy change audit history
- `POST /api/grading-policy/transcript/recompute` - Institution transcript recompute

### Grade lifecycle (`/api/grades/course/:courseId/...`)
- `GET .../lifecycle` - Lifecycle state for a course
- `GET .../amendments` - Amendment history
- `GET .../audit` / `GET .../audit-timeline` - Course grading audit views
- `GET .../provenance` - Grade provenance for compliance review
- `POST .../post` - Post grades to students
- `POST .../finalize` - Finalize course grades (frozen snapshots)
- `POST .../amend` - Amend finalized grades (append-only audit trail)

### Async jobs
- `GET /api/jobs/:jobId` - Poll export/recompute job status
- `GET /api/jobs/:jobId/download` - Download completed export artifact

### Operations & registrar
- `GET /api/ops/dashboard` - Admin/registrar ops dashboard aggregates
- `GET /api/registrar/reports/*` - Registrar report endpoints (see `registrarReports.routes.js`)

### Discussions
- `GET /api/threads` - Get discussion threads
- `POST /api/threads` - Create thread
- `GET /api/threads/:id` - Get thread details
- `POST /api/threads/:id/replies` - Reply to thread

### Groups
- `GET /api/groups` - Get groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/members` - Add member to group

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/courses` - Get all courses
- `GET /api/admin/analytics` - Get system analytics
- `GET /api/reports/*` - Various report endpoints

### Catalog & enrollment discovery
- `GET /api/catalog` - Public/browseable catalog payloads (enrollment hints, waitlists when authenticated)
- `POST /api/courses/:id/enroll` - Student self-enrollment flows (see course routes for guards)

### Notifications
- `GET /api/notifications` - Filterable notification feed
- `GET /api/notifications/unread-count` - Lightweight badge endpoint
- `PATCH /api/notifications/:id/read` / `PATCH /api/notifications/read-all` - Read state mutations
- `DELETE /api/notifications/:id` - Remove a notification
- `GET/PUT /api/notifications/preferences` - Channel + quiet-hour settings

### Inbox
- `GET/POST /api/inbox/conversations` - List + create threads (direct or group, optional course binding)
- `GET/POST /api/inbox/conversations/:conversationId/messages` - Message history + composer attachments
- `POST /api/inbox/conversations/:conversationId/read|move|star|...` - Mailbox operations (see `inbox.routes.js` for full verbs)

### Todos
- `GET/POST/PATCH/DELETE /api/todos` - Per-user task lists (title validation, due dates)

### QuizWave
- Refer to `quizwave.routes.js` for session lifecycle (`/api/quizwave/...`) covering builder assets, live session control, and participant flows

### Observability
- `GET /health` — Liveness: Mongo/Redis readiness, storage flags, socket counters
- `GET /health/ready` — Readiness probe (Mongo, Redis adapter, job queue, storage)
- `GET /health/ops` — Request metrics JSON for the ops dashboard
- `GET /metrics` — Prometheus text exposition (compatible with the `monitoring/` compose stack)

---

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC) plus academic **capabilities** for grading actions
- FERPA-scoped access middleware (`ferpaAccess.js`) and audit logging for sensitive grade reads
- CORS configuration
- Input validation
- File upload restrictions
- Session timeout management
- Login activity tracking
- Rate limits on grading lifecycle, transcript, and recompute endpoints

---

## 📦 Deployment

### Production Deployment
The application is configured for deployment on:
- **Railway** (recommended for all-in-one)
- **Vercel** (frontend) + **Render** (backend) - free option
- **Render** (all-in-one)

Current repository deployment configuration:
- Frontend deployment config: `vercel.json`
- Environment variable template: `.env.example`
- Optional container baseline: `Dockerfile` and `.dockerignore`
- Release process checklist: `docs/production-checklist.md` and `docs/production/deployment.md`
- Production compose reference: `docker-compose.prod.yml`
- Optional monitoring stack: `monitoring/docker-compose.observability.yml`

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-very-long-random-secret
FRONTEND_URL=https://vedantaed.com
VITE_API_URL=https://your-backend-domain.com
```

`VITE_API_URL` should be set explicitly in each frontend environment (production/staging/dev).  
If it is not set in production, frontend requests fall back to same-origin `/api`.

For **Vercel + Render** in this repo, `vercel.json` rewrites `/api/*`, `/uploads/*`, and `/health` to `https://vedantalms-backend.onrender.com`, so you can leave **`VITE_API_URL` empty** (or unset) and avoid CORS for REST calls. **`placeholder.onrender.com`** and similar template hosts are ignored in `frontend/src/config.ts` so a bad env value does not break login. **QuizWave** still needs a real Socket.IO host when `VITE_API_URL` is empty: the client uses **`VITE_SOCKET_ORIGIN`** if set, otherwise the same default Render origin as in `getBackendOrigin()`.

---

## 🧪 Development

### Available Scripts

**Root directory:**
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` / `npm run build:frontend` - Build frontend
- `npm test` - Run all backend Jest suites (needs MongoDB; defaults to `mongodb://localhost:27017/lms-test`). Set `JEST_VERBOSE_LOGS` to restore `console.*` on failures.
- `npm run test:grading` / `npm run test:grading:policy` - Grading policy, lifecycle, FERPA, and parity suites
- `npm run test:portability` / `npm run test:migration` - Provider/export and institution migration tests
- `npm run verify:grading` - Shared grading source + deprecated calculator guard
- `npm run validate:indexes` - Mongo index validation
- `npm run migrate` / `npm run migrate:dry-run` - Apply or preview DB migrations
- `npm run verify:audit-integrity` / `npm run verify:snapshots` - Post-migration grading integrity checks
- `npm run export:institution` / `npm run restore:institution` - Institution bundle export and restore
- `npm run verify:data-integrity` / `npm run verify:restore` / `npm run verify:backup-compatibility` - DR verification
- `npm run verify:institution-export` - Validate export bundle structure
- `npm run perf:gradebook` - Gradebook benchmark harness
- `npm run smoke:predeploy` - Mongo/Redis predeploy smoke checks
- `npm run worker:quizwave-cleanup` / `npm run worker:grading-jobs` - Background workers (grading jobs need `REDIS_URL`)
- `npm run seed:demo:*` / `npm run patch:demo:math8-realism` - Demo course seeding
- `npm run audit:duplicates` - Detect duplicate `.jsx/.tsx` basenames
- `npm run obs:*` - Prometheus/Grafana docker compose helpers
- `npm run check:day1` … `npm run check:day5` (+ variants) - Hardening benchmarks (append to `DAY_PROGRESS.md`)
- `npm run dev:peer` - Auxiliary peer server for multi-node/socket validation

**Frontend directory:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Vitest in watch mode
- `npm run test:run` / `npm run test:run:stable` - Single Vitest run (stable caps workers/memory)
- `npm run test:grading` - Policy parity unit tests (`src/utils/__tests__/*.policy.test.ts`)
- `npm run test:workflows` / `npm run test:fux` - Gradebook + hook workflow tests

---

## 📝 Data Models

### User
- Authentication credentials
- Profile information
- Role (admin, teacher, student)
- Preferences
- Login activity

### Course
- Basic information (title, description, code)
- Enrollment lists
- Module organization
- Settings and configuration
- Sidebar customization

### Module
- Course association
- Content pages
- Order and visibility

### Assignment
- Assignment details
- Due dates
- Questions and answers
- Group assignment support
- Grading criteria

### Submission
- Student submissions
- Files and attachments
- Grading information
- Submission status

### Grade
- Grade entries
- Weighted calculations
- Category organization
- Student and course association

### Institutional grading & records
- **InstitutionGradingPolicy** / **CourseGradingPolicy** — Defaults, scales, weights, penalties
- **GradingPolicyAudit** — Append-only policy change log
- **CourseGradeLifecycle** — Posted/finalized state per course term
- **StudentCourseGradeSnapshot** — Frozen grades for transcripts (with `isCurrent` flag)
- **GradeAmendmentRecord** — Post-finalize amendments
- **TranscriptIssueLog** — Transcript issuance audit
- **SystemAuditEvent** — Cross-cutting academic audit events
- **AsyncJob** — Background export/recompute jobs
- **InstitutionBackupManifest** / **MigrationRun** — Export bundles and migration tracking

---

## 🎨 UI/UX Features

- Responsive design (mobile, tablet, desktop)
- Modern, clean interface
- Dark mode support (if implemented)
- Drag-and-drop functionality
- Real-time updates
- Loading states and error handling
- Toast notifications
- Modal dialogs
- Sidebar navigation
- Search functionality
- Shared design system under `components/common` and `design-system/` (tokens, status badges, error banners, confirm dialogs, skip link, offline banner)
- Customizable navigation (global sidebar + bottom nav with persisted layout options)
- Mobile interactions (swipe gestures, optional haptics, floating action affordances)

---

## 🔄 Future Enhancements

Potential features for future releases:
- Full SIS/LTI integration beyond current staging/readiness stubs
- Cloud object storage with signed URLs and streaming exports (adapter hooks exist)
- Deepen meeting integrations (recording metadata, attendance sync)
- AI-assisted course help expansion (context-aware tutoring and study plans)
- Advanced quiz builder enhancements (adaptive flows and richer analytics)
- Plagiarism detection
- Mobile app (React Native)
- Email notifications (extend server-side `emailService` templates & triggers)
- Two-factor authentication
- Content duplication and course templates
- SCORM compliance
- Wire `i18next` locale files + language switcher
- Expand Socket.IO automated coverage alongside existing HTTP Jest suites

---

## 📄 License

ISC License

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Support

For issues, questions, or support, please open an issue on GitHub or contact the development team.

---

## 🙏 Acknowledgments

Built with modern web technologies to provide an exceptional learning management experience.

---

**Version**: 1.1.0  
**Last Updated**: 2026-05-18

