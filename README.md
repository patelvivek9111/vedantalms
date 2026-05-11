# 📚 Vedanta LMS - Learning Management System

A comprehensive, modern Learning Management System built with React, Node.js, Express, and MongoDB. Designed for educational institutions to manage courses, assignments, students, and administrative tasks efficiently.

## 🌟 Overview

Vedanta LMS is a full-featured learning management platform that enables educators to create engaging courses, manage student enrollments, track progress, and facilitate collaboration. Students can access course materials, submit assignments, participate in discussions, and track their academic progress.

**Live URL**: [vedantaed.com](https://vedantaed.com)

**Current product accents (beyond the checklist below)**  
The codebase now emphasizes a mobile-friendly shell (customizable bottom navigation, pull-to-refresh, swipe gestures, haptics), a full notification center backed by REST APIs, granular inbox UX (folders, filters, unread tracking), QuizWave synchronous sessions powered by Socket.IO (with Redis adapter support in production), optional Zoho Meeting hooks for course/group meetings, shared UI primitives (`components/common` such as breadcrumbs, tables, skeletons), and offline-oriented helpers (`offlineStorage`, offline sync hooks). The frontend bundles `react-i18next` / `i18next` for eventual multi-language rollout. Backend exposure includes Prometheus-friendly `/metrics` when operating with the optional observability stack under `monitoring/`.

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
  - Multiple grading schemes (points, percentages, letter grades)
  - Weighted grade calculations
  - Category-based grading (assignments, quizzes, discussions, etc.)
  - Custom grade scales

- **Gradebook**
  - Comprehensive gradebook view
  - Student grade overview
  - What-if score calculator
  - Grade export functionality

- **Transcript System**
  - Student academic transcript
  - Semester-wise grade tracking
  - GPA calculation
  - Credit hours tracking

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
  - Role assignment (Admin, Teacher, Student)
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
- **Vitest** + **jsdom** - Frontend unit/integration tests (configured inside `vite.config.ts`, setup in `src/test/setup.ts`)

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
- **Supertest** + **Jest** - API and controller tests (`tests/*.test.js`, `tests/setup.js`)

### Infrastructure
- **MongoDB Atlas** - Cloud database
- **Railway/Render** - Hosting (backend)
- **Vercel** - Hosting (frontend)
- **Cloudinary** - File storage (optional)
- **Redis** - Optional dependency when `REDIS_URL` is provided (Socket.IO adapter + session helpers)
- **Prometheus / Grafana / Alertmanager** - Local observability recipe via `monitoring/docker-compose.observability.yml`

---

## 📁 Project Structure

_This tree keeps the earlier file-level map and is extended (not replaced) with folders that landed in recent iterations—shared UI primitives, Vitest harness files, quizwave worker, fuller hook/util lists, and backend test harness files._

```
lms/
├── frontend/                           # React frontend application
│   ├── src/
│   │   ├── components/                 # Reusable React components
│   │   │   ├── announcements/          # Announcement-related components
│   │   │   │   ├── AnnouncementForm.tsx
│   │   │   │   └── AnnouncementList.tsx
│   │   │   ├── assignments/            # Assignment-related components
│   │   │   │   ├── AssignmentCard.tsx
│   │   │   │   ├── AssignmentDetails.jsx
│   │   │   │   ├── AssignmentDetailsWrapper.tsx
│   │   │   │   ├── AssignmentGrading.jsx
│   │   │   │   ├── AssignmentGradingWrapper.tsx
│   │   │   │   ├── AssignmentList.tsx
│   │   │   │   ├── AssignmentViewWrapper.tsx
│   │   │   │   ├── AssignmentFileUploadSection.tsx
│   │   │   │   ├── CreateAssignmentForm.tsx
│   │   │   │   ├── CreateAssignmentWrapper.tsx
│   │   │   │   ├── FilePreview.tsx
│   │   │   │   ├── GradeSubmissions.jsx
│   │   │   │   └── ScrollableQuizSidebar.tsx
│   │   │   ├── course/                 # Course-related components
│   │   │   │   ├── AssignmentsSection.tsx
│   │   │   │   ├── CourseAssignments.tsx
│   │   │   │   ├── CourseMeetingsSection.tsx
│   │   │   │   ├── CourseOverview.tsx
│   │   │   │   ├── CourseQuizzes.tsx
│   │   │   │   ├── CourseSidebar.tsx
│   │   │   │   ├── MobileNavigation.tsx
│   │   │   │   ├── ModulesSection.tsx
│   │   │   │   ├── OverviewSection.tsx
│   │   │   │   ├── PollsSection.tsx
│   │   │   │   ├── QuizzesSection.tsx
│   │   │   │   └── SyllabusSection.tsx
│   │   │   ├── common/                  # Shared UI primitives (breadcrumb, tables, modals, a11y)
│   │   │   │   ├── BackButton.tsx
│   │   │   │   ├── BaseModal.tsx
│   │   │   │   ├── Breadcrumb.tsx
│   │   │   │   ├── ConfirmationModal.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── DatePicker.tsx
│   │   │   │   ├── FloatingActionButton.tsx
│   │   │   │   ├── FloatingLabelInput.tsx
│   │   │   │   ├── FloatingLabelPasswordInput.tsx
│   │   │   │   ├── FloatingLabelSelect.tsx
│   │   │   │   ├── FloatingLabelTextarea.tsx
│   │   │   │   ├── FormFieldGroup.tsx
│   │   │   │   ├── MobileTopNav.tsx
│   │   │   │   ├── PullToRefresh.tsx
│   │   │   │   ├── ScreenReaderAnnouncement.tsx
│   │   │   │   ├── SkeletonLoader.tsx
│   │   │   │   ├── SwipeableContainer.tsx
│   │   │   │   ├── SwipeableListItem.tsx
│   │   │   │   └── SyncIndicator.tsx
│   │   │   ├── enrollment/             # Enrollment-related components
│   │   │   │   └── EnrollmentRequestsHandler.tsx
│   │   │   ├── grades/                 # Grade-related components
│   │   │   │   ├── AssignmentGroupsModal.tsx
│   │   │   │   ├── GradebookView.tsx
│   │   │   │   ├── GradeScaleModal.tsx
│   │   │   │   └── StudentGradesView.tsx
│   │   │   ├── groups/                 # Group-related components
│   │   │   │   ├── GroupAnnouncements.tsx
│   │   │   │   ├── GroupDashboard.tsx
│   │   │   │   ├── GroupDiscussion.tsx
│   │   │   │   ├── GroupHome.tsx
│   │   │   │   ├── GroupManagement.tsx
│   │   │   │   ├── GroupMeetings.tsx
│   │   │   │   ├── GroupPages.tsx
│   │   │   │   ├── GroupPageView.tsx
│   │   │   │   ├── GroupPeople.tsx
│   │   │   │   ├── GroupPeopleWrapper.tsx
│   │   │   │   ├── GroupSetView.tsx
│   │   │   │   └── StudentGroupView.tsx
│   │   │   ├── polls/                  # Poll-related components
│   │   │   │   ├── PollForm.tsx
│   │   │   │   ├── PollList.tsx
│   │   │   │   └── PollVote.tsx
│   │   │   ├── quizwave/               # QuizWave interactive quiz components
│   │   │   │   ├── QuizBuilder.tsx
│   │   │   │   ├── QuizSessionControl.tsx
│   │   │   │   ├── QuizWaveDashboard.tsx
│   │   │   │   ├── StudentGameScreen.tsx
│   │   │   │   ├── StudentJoinScreen.tsx
│   │   │   │   └── StudentQuizWaveView.tsx
│   │   │   ├── students/               # Student-related components
│   │   │   │   ├── StudentCard.tsx
│   │   │   │   └── StudentsManagement.tsx
│   │   │   ├── AnnouncementDetailModal.tsx
│   │   │   ├── Attendance.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── BurgerMenu.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── ChangeUserModal.tsx
│   │   │   ├── CourseDetail.tsx
│   │   │   ├── CourseDiscussions.tsx
│   │   │   ├── CourseForm.tsx
│   │   │   ├── CourseList.tsx
│   │   │   ├── CoursePages.tsx
│   │   │   ├── CreateModuleForm.tsx
│   │   │   ├── CreatePageForm.tsx
│   │   │   ├── CreateThreadModal.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── GlobalSidebar.tsx
│   │   │   ├── InteractiveEyes.tsx
│   │   │   ├── LatestAnnouncements.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ModuleCard.tsx
│   │   │   ├── ModuleList.tsx
│   │   │   ├── NavCustomizationModal.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── NotificationCenter.tsx
│   │   │   ├── OverviewConfigModal.tsx
│   │   │   ├── PageView.tsx
│   │   │   ├── PageViewer.tsx
│   │   │   ├── PageViewWrapper.tsx
│   │   │   ├── PrivateRoute.tsx
│   │   │   ├── ProfileImage.tsx
│   │   │   ├── RichTextEditor.tsx
│   │   │   ├── SidebarConfigModal.tsx
│   │   │   ├── StudentGradeSidebar.tsx
│   │   │   ├── ThreadView.tsx
│   │   │   ├── ThreadViewWrapper.tsx
│   │   │   ├── ToDoPanel.tsx
│   │   │   ├── WhatIfScores.tsx
│   │   │   └── __tests__/              # Vitest specs (mirrors routes, hooks, utils)
│   │   ├── pages/                      # Page-level components (routes)
│   │   │   ├── AccountPage.tsx
│   │   │   ├── AdminAnalytics.tsx
│   │   │   ├── AdminCourseOversight.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminSecurity.tsx
│   │   │   ├── AdminSystemSettings.tsx
│   │   │   ├── AdminUserManagement.tsx
│   │   │   ├── Announcements.tsx
│   │   │   ├── AssignmentEditPage.tsx
│   │   │   ├── Catalog.tsx
│   │   │   ├── CourseDetail.tsx
│   │   │   ├── CoursePeople.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Groups.tsx
│   │   │   ├── Inbox.tsx
│   │   │   ├── LandingPage.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── ModuleEditPage.tsx
│   │   │   ├── PageEditPage.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── TeacherCourseOversight.tsx
│   │   │   ├── ToDoPage.tsx
│   │   │   └── Transcript.tsx
│   │   ├── services/                   # API service layer
│   │   │   ├── announcementService.ts
│   │   │   ├── api.ts
│   │   │   ├── inboxService.ts
│   │   │   └── quizwaveService.ts
│   │   ├── hooks/                      # Custom React hooks
│   │   │   ├── useAssignmentGroupsManagement.ts
│   │   │   ├── useBottomNavSwipe.ts
│   │   │   ├── useCourseSectionSwipe.ts
│   │   │   ├── useDiscussions.ts
│   │   │   ├── useDraftManager.ts
│   │   │   ├── useGradebookData.ts
│   │   │   ├── useGradeManagement.ts
│   │   │   ├── useGradeScaleManagement.ts
│   │   │   ├── useInstructorGradebookData.ts
│   │   │   ├── useMobileDevice.ts
│   │   │   ├── useNavigationHistory.ts
│   │   │   ├── useOfflineSync.ts
│   │   │   ├── useOnlineStatus.ts
│   │   │   ├── useSidebarConfig.ts
│   │   │   ├── useStudentGradeData.ts
│   │   │   ├── useStudentSubmissions.ts
│   │   │   ├── useSubmissionIds.ts
│   │   │   ├── useSwipeGesture.ts
│   │   │   ├── useSyllabusManagement.ts
│   │   │   └── useUnreadMessages.ts
│   │   ├── utils/                      # Utility functions
│   │   │   ├── dateUtils.ts
│   │   │   ├── gradebookExport.ts
│   │   │   ├── gradeUtils.ts
│   │   │   ├── hapticFeedback.ts
│   │   │   ├── inboxFilters.ts
│   │   │   ├── logger.ts
│   │   │   ├── offlineStorage.ts
│   │   │   ├── pushNotifications.ts
│   │   │   └── quizwaveSocket.ts
│   │   ├── context/                    # React context providers
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── contexts/                   # Additional context providers
│   │   │   ├── CourseContext.tsx
│   │   │   └── ModuleContext.tsx
│   │   ├── store/                      # Redux store configuration
│   │   │   └── store.ts
│   │   ├── constants/                  # Application constants
│   │   │   └── courseNavigation.ts
│   │   ├── App.tsx                     # Main application component
│   │   ├── main.tsx                    # Application entry point
│   │   ├── index.css                   # Global styles
│   │   ├── config.ts                   # Frontend configuration
│   │   ├── global.d.ts                 # TypeScript global type definitions
│   │   └── test/                       # Vitest bootstrap
│   │       └── setup.ts                # Quiet Router/act noise + shared matchers config
│   ├── public/                         # Static assets
│   │   └── assets/                     # Images and other static files
│   ├── dist/                           # Production build output
│   ├── index.html                      # HTML template
│   ├── package.json                    # Frontend dependencies
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── vite.config.ts                  # Vite build configuration + embedded Vitest settings
│   ├── tailwind.config.js              # Tailwind CSS configuration
│   └── postcss.config.js               # PostCSS configuration
│
├── controllers/                        # Express route controllers
│   ├── admin.controller.js             # Admin operations controller
│   ├── announcement.controller.js      # Announcement operations controller
│   ├── assignment.controller.js        # Assignment operations controller
│   ├── attendance.controller.js       # Attendance operations controller
│   ├── auth.controller.js              # Authentication controller
│   ├── course.controller.js            # Course operations controller
│   ├── event.controller.js             # Event operations controller
│   ├── grades.controller.js            # Grade operations controller
│   ├── group.controller.js             # Group operations controller
│   ├── groupMeeting.controller.js      # Group meeting operations controller
│   ├── inbox.controller.js             # Messaging/inbox controller
│   ├── module.controller.js            # Module operations controller
│   ├── page.controller.js              # Page operations controller
│   ├── poll.controller.js              # Poll operations controller
│   ├── quizwave.controller.js          # QuizWave operations controller
│   ├── reports.controller.js           # Reports controller
│   ├── submission.controller.js        # Submission operations controller
│   ├── todo.controller.js              # Todo operations controller
│   ├── user.controller.js              # User operations controller
│   └── zohoMeeting.controller.js       # Zoho meeting integration controller
│
├── models/                             # Mongoose data models
│   ├── announcement.model.js           # Announcement model
│   ├── Assignment.js                   # Assignment model
│   ├── attendance.model.js             # Attendance model
│   ├── Conversation.js                 # Conversation model (messaging)
│   ├── ConversationParticipant.js      # Conversation participant model
│   ├── course.model.js                 # Course model
│   ├── event.model.js                  # Event model
│   ├── Group.js                        # Group model
│   ├── GroupSet.js                     # Group set model
│   ├── groupMeeting.model.js           # Group meeting model
│   ├── loginActivity.model.js         # Login activity tracking model
│   ├── Message.js                      # Message model (messaging)
│   ├── module.model.js                 # Module model
│   ├── notification.model.js           # Notification model
│   ├── notificationPreferences.model.js # Notification preferences model
│   ├── page.model.js                   # Page model
│   ├── poll.model.js                   # Poll model
│   ├── quizwave.model.js               # QuizWave model
│   ├── Submission.js                   # Submission model
│   ├── systemSettings.model.js         # System settings model
│   ├── thread.model.js                 # Discussion thread model
│   ├── todo.model.js                   # Todo model
│   ├── user.model.js                   # User model
│   └── zohoMeetingConnection.model.js  # Zoho meeting connection model
│
├── routes/                             # Express route definitions
│   ├── admin.routes.js                 # Admin routes
│   ├── announcement.routes.js         # Announcement routes
│   ├── assignment.routes.js            # Assignment routes
│   ├── attendance.routes.js            # Attendance routes
│   ├── auth.routes.js                  # Authentication routes
│   ├── catalog.routes.js               # Course catalog routes
│   ├── course.routes.js                # Course routes
│   ├── event.routes.js                 # Event routes
│   ├── grades.routes.js                # Grade routes
│   ├── groupRoutes.js                  # Group routes
│   ├── inbox.routes.js                 # Messaging/inbox routes
│   ├── module.routes.js                # Module routes
│   ├── notification.routes.js          # Notification routes
│   ├── page.routes.js                  # Page routes
│   ├── poll.routes.js                  # Poll routes
│   ├── quizwave.routes.js              # QuizWave routes
│   ├── reports.routes.js               # Report routes
│   ├── submission.routes.js            # Submission routes
│   ├── thread.routes.js                # Discussion thread routes
│   ├── todo.routes.js                  # Todo routes
│   ├── user.routes.js                  # User routes
│   └── zohoMeeting.routes.js           # Zoho meeting integration routes
│
├── middleware/                         # Express middleware
│   ├── auth.js                         # Authentication middleware
│   ├── roleCheck.js                    # Role-based access control middleware
│   └── upload.js                       # File upload middleware
│
├── middlewares/                        # Additional middleware
│   └── auth.middleware.js              # Alternative auth middleware
│
├── utils/                              # Backend utility functions
│   ├── cache.js                        # Lightweight caching helpers
│   ├── cloudinary.js                   # Cloudinary integration for file storage
│   ├── emailService.js                 # Transactional/system email bootstrap
│   ├── ensureIndexes.js                # Mongo index enforcement on boot
│   ├── gradeCalculation.js             # Grade calculation utilities
│   ├── quizwaveCleanup.js              # QuizWave session cleanup timers (skipped in NODE_ENV=test)
│   ├── quizwaveSessionStore.js         # QuizWave ephemeral session persistence (Redis-ready)
│   └── quizwaveSocketThrottle.js       # Socket event throttling helpers
│
├── socket/                             # Socket.io real-time functionality
│   └── quizwave.socket.js              # QuizWave socket handlers
│
├── scripts/                            # Utility scripts
│   ├── auditDuplicateExtensions.js     # Frontend duplicate-extension audit (pairs with npm run audit:duplicates)
│   ├── checkQuizWaveStatus.js          # QuizWave status checking script
│   ├── cleanupOldSessions.js           # Session cleanup script
│   ├── day1BaselineCheck.js            # Local baseline health checks
│   ├── day2AlertDryRun.js              # Dry-run alerting paths
│   ├── day2CaptureBaseline.js          # Capture baseline metrics
│   ├── day2SyntheticProbe.js           # Synthetic probe validation
│   ├── day3EndpointBenchmark.js        # Endpoint benchmarking script
│   ├── day4CheckLocalPair.js           # Local pair validation helpers
│   ├── day4SocketValidation.js         # Socket behavior validation
│   ├── day5LoadRamp.js                 # Progressive load ramp test
│   ├── fixDuplicatePins.js             # Fix duplicate pins script
│   ├── fixPinIndex.js                  # Fix pin index script
│   ├── predeploySmokeCheck.js          # Invoked via npm run smoke:predeploy
│   ├── runDay5ApiRamp.js               # API-focused ramp harness
│   └── startPeerServer.js              # Local peer server for multi-node testing (`npm run dev:peer`)
│
├── workers/                            # Long-running worker entrypoints
│   └── quizwaveCleanupWorker.js       # Dedicated QuizWave janitor (`npm run worker:quizwave-cleanup`)
│
├── monitoring/                         # Observability and local monitoring
│   ├── docker-compose.observability.yml    # Prometheus + Grafana + Alertmanager stack
│   ├── alertmanager/                   # Alertmanager configuration
│   ├── prometheus/                     # Prometheus scrape/rule configuration
│   └── grafana/                        # Dashboards and provisioning
│
├── uploads/                            # File upload directory
│
├── tests/                               # Backend Jest suites (supertest + mongoose)
│   ├── setup.js                        # NODE_ENV=test, silent logs, mongo disconnect hooks
│   ├── helpers.js                      # mongo wait helpers
│   └── *.test.js                       # Integration + controller/middleware specs (notifications, inbox, catalog, ...)
├── docs/                               # Operational / release notes (non-code)
│   ├── production-checklist.md         # Rollout readiness list
│   └── predeploy-bug-hunt-report-2026-04-29.md
├── server.js                           # Express server entry point
├── package.json                        # Backend dependencies
├── vercel.json                         # Vercel deployment configuration
├── generate-secret.js                  # Secret generation utility
├── jest.config.js                      # Jest testing configuration
├── Dockerfile                          # Container build (referenced in Deployment section)
└── .dockerignore                       # Docker build exclusions
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
- Use `docs/production-checklist.md` for release readiness and production rollout steps.
- Use the deployment section below for hosting options and required production environment variables.
- Optional observability stack is available at `monitoring/docker-compose.observability.yml`.

---

## 👤 User Roles

### Admin
- Full system access
- User management
- Course oversight
- System settings
- Analytics and reports
- Security management

### Teacher
- Create and manage courses
- Enroll/unenroll students
- Create assignments and grade submissions
- Manage course content (modules, pages)
- Track student progress
- Generate reports

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

### Grades
- `GET /api/grades/course/:id` - Get course grades
- `GET /api/grades/student/:id` - Get student grades
- `POST /api/grades` - Create grade entry
- `PUT /api/grades/:id` - Update grade

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
- `GET /health` — JSON payload with Mongo/Redis readiness, storage flags, socket counters
- `GET /metrics` — Prometheus text exposition (compatible with the `monitoring/` compose stack)

---

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- CORS configuration
- Input validation
- File upload restrictions
- Session timeout management
- Login activity tracking

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
- Release process checklist: `docs/production-checklist.md`
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
- `npm run build` - Build frontend
- `npm run build:frontend` - Build frontend only
- `npm test` - Run backend tests (Jest; needs MongoDB; defaults to `mongodb://localhost:27017/lms-test` unless `MONGODB_URI` is set). Set `JEST_VERBOSE_LOGS` to restore `console.*` output during failures.
- `npm run smoke:predeploy` - Run Mongo/Redis predeploy smoke checks
- `npm run audit:duplicates` - Detect duplicate `.jsx/.tsx` or `.js/.ts` basenames before migration
- `npm run worker:quizwave-cleanup` - Run the dedicated QuizWave janitor process
- `npm run obs:*` - Helper aliases for the dockerized Prometheus/Grafana stack (`monitoring/docker-compose.observability.yml`)
- `npm run check:day1` … `npm run check:day5` (+ variants) - Local reliability / benchmarking scripts used during hardening milestones
- `npm run dev:peer` - Starts the auxiliary peer server used when validating multi-node/socket flows (`scripts/startPeerServer.js`)

**Frontend directory:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Vitest in watch mode
- `npm run test:run` - Single Vitest run
- `npm run test:run:stable` - Single run with capped workers/memory (recommended in CI or if the suite struggles to finish)

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
- Shared design system pieces under `components/common` (floating labels, skeletons, data tables, breadcrumbs, pull-to-refresh)
- Customizable navigation (global sidebar + bottom nav with persisted layout options)
- Mobile interactions (swipe gestures, optional haptics, floating action affordances)

---

## 🔄 Future Enhancements

Potential features for future releases:
- Deepen meeting integrations (provider abstraction, recording metadata, attendance sync)
- AI-assisted course help expansion (context-aware tutoring and study plans)
- Advanced quiz builder enhancements (adaptive flows and richer analytics)
- Plagiarism detection
- Mobile app (React Native)
- Email notifications (transactional email service utilities exist server-side—extend templates & triggers)
- Two-factor authentication
- Advanced analytics dashboard
- Content duplication
- Course templates
- SCORM compliance
- Wire `i18next` resources + language switcher (dependencies already ship with the frontend bundle)
- Expand automated coverage for Socket.IO paths now that HTTP suites exit cleanly with `mongoose.disconnect` per file

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

**Version**: 1.0.0  
**Last Updated**: 2026-05-06

