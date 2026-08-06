import React, { Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Routes, Route, Navigate, useParams, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { CourseProvider } from './contexts/CourseContext';
import { ModuleProvider } from './contexts/ModuleContext';
import { PrivateRoute } from './components/common/PrivateRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppLoadingSkeleton } from './components/common/SkeletonLoader';
import { Provider } from 'react-redux';
import { store } from './store/store';
import GlobalSidebar from './components/layout/GlobalSidebar';
import BottomNav from './components/layout/BottomNav';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { MobileKeyboardProvider } from './contexts/MobileKeyboardContext';
import { QueryProvider } from './providers/QueryProvider';
import SkipToMain from './design-system/SkipToMain';
import NetworkOfflineBanner from './design-system/NetworkOfflineBanner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useMessagingSocketConnection } from './hooks/inbox/useMessagingSocketConnection';
import { useNotificationSocketConnection } from './hooks/notifications/useNotificationSocketConnection';
import { useNotificationCrossTabSync } from './hooks/notifications/useNotificationCrossTabSync';
import { loginRedirectPath, homePathForRole, isPlatformAdminAllowedPath } from './utils/loginRedirect';
import { AdminPhoneGate } from './components/admin/AdminPhoneGate';

// Auth side-pages and legal copy — not first-paint critical.
const Signup = lazyWithRetry(() => import('./pages/Signup').then((m) => ({ default: m.Signup })));
const AcceptInvite = lazyWithRetry(() =>
  import('./pages/AcceptInvite').then((m) => ({ default: m.AcceptInvite }))
);
const PrivacyPolicy = lazyWithRetry(() =>
  import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy }))
);
const TermsOfService = lazyWithRetry(() =>
  import('./pages/TermsOfService').then((m) => ({ default: m.TermsOfService }))
);
const ForgotPassword = lazyWithRetry(() =>
  import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword }))
);
const ResetPassword = lazyWithRetry(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword }))
);
const StudentActivation = lazyWithRetry(() =>
  import('./pages/StudentActivation').then((m) => ({ default: m.StudentActivation }))
);

// Course / assignment / thread / group trees — heavy and rarely the first paint.
const CourseList = lazyWithRetry(() => import('./components/course/CourseList'));
const CourseForm = lazyWithRetry(() => import('./components/course/CourseForm'));
const PageView = lazyWithRetry(() => import('./components/pages/PageView'));
const PageViewWrapper = lazyWithRetry(() => import('./components/pages/PageViewWrapper'));
const AssignmentList = lazyWithRetry(() => import('./components/assignments/AssignmentList'));
const CreateAssignmentWrapper = lazyWithRetry(
  () => import('./components/assignments/CreateAssignmentWrapper')
);
const AssignmentViewWrapper = lazyWithRetry(
  () => import('./components/assignments/AssignmentViewWrapper')
);
const AssignmentDetailsWrapper = lazyWithRetry(
  () => import('./components/assignments/AssignmentDetailsWrapper')
);
const AssignmentGradingWrapper = lazyWithRetry(
  () => import('./components/assignments/AssignmentGradingWrapper')
);
const ThreadView = lazyWithRetry(() => import('./components/threads/ThreadView'));
const ThreadViewWrapper = lazyWithRetry(() => import('./components/threads/ThreadViewWrapper'));
const GroupDiscussion = lazyWithRetry(() => import('./components/groups/GroupDiscussion'));
const GroupPeopleWrapper = lazyWithRetry(() => import('./components/groups/GroupPeopleWrapper'));
const GroupHome = lazyWithRetry(() => import('./components/groups/GroupHome'));
const GroupPageView = lazyWithRetry(() => import('./components/groups/GroupPageView'));
const GroupMeetings = lazyWithRetry(() => import('./components/groups/GroupMeetings'));

const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAccountTree = lazyWithRetry(() => import('./pages/AdminAccountTree').then(m => ({ default: m.AdminAccountTree })));
const AdminPlatformInstitutions = lazyWithRetry(() =>
  import('./pages/AdminPlatformInstitutions').then((m) => ({ default: m.AdminPlatformInstitutions }))
);
const AdminUserManagement = lazyWithRetry(() => import('./pages/AdminUserManagement').then(m => ({ default: m.AdminUserManagement })));
const AdminAnalytics = lazyWithRetry(() => import('./pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminSystemSettings = lazyWithRetry(() => import('./pages/AdminSystemSettings').then(m => ({ default: m.AdminSystemSettings })));
const AdminCourseOversight = lazyWithRetry(() => import('./pages/AdminCourseOversight').then(m => ({ default: m.AdminCourseOversight })));
const AdminSecurity = lazyWithRetry(() => import('./pages/AdminSecurity').then(m => ({ default: m.AdminSecurity })));
const RegistrarOffice = lazyWithRetry(() => import('./pages/registrar/RegistrarLayout').then(m => ({ default: m.RegistrarLayout })));
const RegistrarDashboard = lazyWithRetry(() => import('./pages/registrar/RegistrarDashboard').then(m => ({ default: m.RegistrarDashboard })));
const RegistrarTerms = lazyWithRetry(() => import('./pages/registrar/RegistrarTerms').then(m => ({ default: m.RegistrarTerms })));
const RegistrarStudents = lazyWithRetry(() => import('./pages/registrar/RegistrarStudents').then(m => ({ default: m.RegistrarStudents })));
const RegistrarStudentStub = lazyWithRetry(() => import('./pages/registrar/RegistrarStudentStub').then(m => ({ default: m.RegistrarStudent360 })));
const RegistrarPrograms = lazyWithRetry(() => import('./pages/registrar/RegistrarPrograms').then(m => ({ default: m.RegistrarPrograms })));
const RegistrarSections = lazyWithRetry(() => import('./pages/registrar/RegistrarSections').then(m => ({ default: m.RegistrarSections })));
const RegistrarGradeStatus = lazyWithRetry(() => import('./pages/registrar/RegistrarGradeStatus').then(m => ({ default: m.RegistrarGradeStatus })));
const RegistrarTranscripts = lazyWithRetry(() => import('./pages/registrar/RegistrarTranscripts').then(m => ({ default: m.RegistrarTranscripts })));
const RegistrarReports = lazyWithRetry(() => import('./pages/registrar/RegistrarReports').then(m => ({ default: m.RegistrarReports })));
const RegistrarOperations = lazyWithRetry(() => import('./pages/registrar/RegistrarOperations').then(m => ({ default: m.RegistrarOperations })));
const RegistrarSis = lazyWithRetry(() => import('./pages/registrar/RegistrarSis').then(m => ({ default: m.RegistrarSis })));
const RegistrarSettings = lazyWithRetry(() => import('./pages/registrar/RegistrarSettings').then(m => ({ default: m.RegistrarSettings })));
const TeacherCourseOversight = lazyWithRetry(() => import('./pages/TeacherCourseOversight').then(m => ({ default: m.TeacherCourseOversight })));
const ModuleEditPage = lazyWithRetry(() => import('./pages/ModuleEditPage'));
const PageEditPage = lazyWithRetry(() => import('./pages/PageEditPage'));
const AssignmentEditPage = lazyWithRetry(() => import('./pages/AssignmentEditPage'));
const Transcript = lazyWithRetry(() => import('./pages/Transcript'));
const GroupDashboard = lazyWithRetry(() => import('./components/groups/GroupDashboard'));
const Announcements = lazyWithRetry(() => import('./pages/Announcements'));
const CalendarPage = lazyWithRetry(() => import('./components/common/Calendar'));
const Inbox = lazyWithRetry(() => import('./pages/Inbox'));
const ToDoPage = lazyWithRetry(() => import('./pages/ToDoPage'));
const AccountPage = lazyWithRetry(() => import('./pages/AccountPage'));
const Groups = lazyWithRetry(() => import('./pages/Groups'));
const GroupSetView = lazyWithRetry(() => import('./components/groups/GroupSetView'));
const Catalog = lazyWithRetry(() => import('./pages/Catalog'));
const JoinCoursePage = lazyWithRetry(() => import('./pages/JoinCoursePage'));
const CoursePeople = lazyWithRetry(() => import('./pages/CoursePeople'));
const CourseDetail = lazyWithRetry(() => import('./components/course/CourseDetail'));
const QuizWaveDashboard = lazyWithRetry(() => import('./components/quizwave/QuizWaveDashboard'));
const StudentJoinScreen = lazyWithRetry(() => import('./components/quizwave/StudentJoinScreen'));
const StudentGameScreen = lazyWithRetry(() => import('./components/quizwave/StudentGameScreen'));

// Wrapper to get courseId from URL params
const QuizWaveDashboardWrapper: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  if (!courseId) {
    return <div>Course ID is required</div>;
  }
  return withRouteLoader(<QuizWaveDashboard courseId={courseId} />);
};


// Wrapper components to handle moduleId prop
const AssignmentListWrapper = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  if (!moduleId) return null;
  return <AssignmentList moduleId={moduleId} />;
};

const CreateAssignmentFormWrapper = () => {
  return <CreateAssignmentWrapper />;
};

function Unauthorized() {
  const { user } = useAuth();
  const home = homePathForRole(user?.role);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">401</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">You are not authorized to access this page.</p>
        <Link
          to={home}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go to your home
        </Link>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">404</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">This page does not exist.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}


function AnnouncementsWrapper() {
  const { courseId } = useParams<{ courseId: string }>();
  if (!courseId) return null;
  return withRouteLoader(<Announcements courseId={courseId} />);
}

function DashboardWrapper() {
  const { user } = useAuth();

  if (user?.role === 'registrar' || user?.role === 'department_admin') {
    return <Navigate to="/registrar" replace />;
  }

  // Platform admins manage tenants — not school admin stats APIs
  if (user?.role === 'platform_admin') {
    return <Navigate to="/admin/institutions" replace />;
  }

  // Render admin dashboard for institution admins
  if (user?.role === 'admin') {
    return (
      <AdminPhoneGate>
        {withRouteLoader(<AdminDashboard />)}
      </AdminPhoneGate>
    );
  }

  // Render regular dashboard for other users
  return <Dashboard />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute allowedRoles={['admin']}>
      <AdminPhoneGate>{children}</AdminPhoneGate>
    </PrivateRoute>
  );
}

const withRouteLoader = (node: React.ReactNode) => (
  <Suspense fallback={<AppLoadingSkeleton />}>{node}</Suspense>
);

function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (user) {
    return <Navigate to={loginRedirectPath(location.state, user.role)} replace />;
  }
  return <Login />;
}

function AppShell() {
  const { loading } = useAuth();

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  return (
    <CourseProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </CourseProvider>
  );
}

function AppContent() {
  const { user, token } = useAuth();
  const { offline } = useNetworkStatus();
  const location = useLocation();
  const isAuthenticated = !!user;
  const isInboxThread =
    location.pathname === '/inbox' && Boolean(new URLSearchParams(location.search).get('c'));
  const hideMobileBottomNav =
    /\/quizwave(\/|$)/.test(location.pathname) || isInboxThread;
  // Only the dashboard pins the desktop dock, so only it needs standing clearance.
  const dockPinned = location.pathname === '/dashboard' || location.pathname === '/';

  useMessagingSocketConnection(user?._id, token);
  useNotificationSocketConnection(user?._id, token);
  useNotificationCrossTabSync(user?._id);

  if (
    user?.role === 'platform_admin' &&
    !isPlatformAdminAllowedPath(location.pathname)
  ) {
    return <Navigate to="/admin/institutions" replace />;
  }

  return (
    <MobileKeyboardProvider>
    <div
      className={
        isAuthenticated
          ? 'flex min-h-dvh flex-col bg-gray-50 dark:bg-slate-950 dark:text-white'
          : 'flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950 dark:text-slate-100'
      }
    >
      {isAuthenticated && <SkipToMain />}
      {isAuthenticated && offline && <NetworkOfflineBanner />}
      {isAuthenticated && <GlobalSidebar />}
      {isAuthenticated && !hideMobileBottomNav && <BottomNav />}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          isAuthenticated
            ? `flex min-h-dvh flex-1 flex-col bg-gray-50 dark:bg-gray-900 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] print:pb-0 transition-all duration-300 outline-none ${
                dockPinned ? 'lg:pb-24' : 'lg:pb-10'
              }`
            : 'flex min-h-0 flex-1 flex-col print:pb-0'
        }
      >
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={isAuthenticated ? <Navigate to={homePathForRole(user?.role)} replace /> : <LandingPage />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to={homePathForRole(user?.role)} replace /> : withRouteLoader(<Signup />)} />
          <Route
            path="/accept-invite"
            element={isAuthenticated ? <Navigate to={homePathForRole(user?.role)} replace /> : withRouteLoader(<AcceptInvite />)}
          />
          <Route path="/privacy" element={withRouteLoader(<PrivacyPolicy />)} />
          <Route path="/terms" element={withRouteLoader(<TermsOfService />)} />
          <Route path="/forgot-password" element={withRouteLoader(<ForgotPassword />)} />
          <Route path="/reset-password" element={withRouteLoader(<ResetPassword />)} />
          <Route
            path="/activate"
            element={isAuthenticated ? <Navigate to={homePathForRole(user?.role)} replace /> : withRouteLoader(<StudentActivation />)}
          />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <PrivateRoute>
                {withRouteLoader(<CourseList />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/create"
            element={
              <PrivateRoute>
                {withRouteLoader(<CourseForm mode="create" />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:id"
            element={
              <PrivateRoute>
                {withRouteLoader(<CourseDetail />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:id/:section"
            element={
              <PrivateRoute>
                {withRouteLoader(<CourseDetail />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:courseId/people"
            element={
              <PrivateRoute>
                {withRouteLoader(<CoursePeople />)}
              </PrivateRoute>
            }
          />

          <Route
            path="/courses/:id/edit"
            element={
              <PrivateRoute>
                {withRouteLoader(<CourseForm mode="edit" />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:courseId/pages/:pageId"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  {withRouteLoader(<PageViewWrapper />)}
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          <Route
            path="/pages/:pageId"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  {withRouteLoader(<PageView />)}
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          {/* Assignment Routes */}
          <Route
            path="/modules/:moduleId/assignments"
            element={
              <PrivateRoute>
                {withRouteLoader(<AssignmentListWrapper />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/modules/:moduleId/assignments/create"
            element={
              <PrivateRoute>
                {withRouteLoader(<CreateAssignmentFormWrapper />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/assignments/:id/view"
            element={
              <PrivateRoute>
                {withRouteLoader(<AssignmentViewWrapper />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/assignments/:id/grade"
            element={
              <PrivateRoute allowedRoles={['teacher', 'admin']}>
                {withRouteLoader(<AssignmentGradingWrapper />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/assignments/:id/edit"
            element={
              <PrivateRoute>
                {withRouteLoader(<AssignmentEditPage />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/assignments/:id"
            element={
              <PrivateRoute>
                {withRouteLoader(<AssignmentDetailsWrapper />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/modules/:moduleId/edit"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  {withRouteLoader(<ModuleEditPage />)}
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          <Route
            path="/pages/:pageId/edit"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  {withRouteLoader(<PageEditPage />)}
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          {/* Thread Routes */}
          <Route
            path="/courses/:courseId/threads/:threadId"
            element={
              <PrivateRoute>
                {withRouteLoader(<ThreadViewWrapper />)}
              </PrivateRoute>
            }
          />
          <Route path="/groups" element={
            <PrivateRoute>
              {withRouteLoader(<Groups />)}
            </PrivateRoute>
          } />
          <Route path="/groupsets/:groupSetId" element={
            <PrivateRoute>
              {withRouteLoader(<GroupSetView />)}
            </PrivateRoute>
          } />
          <Route path="/groups/:groupId/*" element={withRouteLoader(<GroupDashboard />)}>
            <Route path="home" element={withRouteLoader(<GroupHome />)} />
            <Route path="discussion" element={withRouteLoader(<GroupDiscussion />)} />
            <Route path="meetings" element={withRouteLoader(<GroupMeetings />)} />
            <Route path="discussion/:threadId" element={withRouteLoader(<ThreadView />)} />
            <Route path="people" element={withRouteLoader(<GroupPeopleWrapper />)} />
            <Route path="pages/:pageId" element={
              <ModuleProvider>
                {withRouteLoader(<GroupPageView />)}
              </ModuleProvider>
            } />
            <Route index element={withRouteLoader(<GroupHome />)} />
          </Route>
          <Route
            path="/calendar"
            element={
              <PrivateRoute>
                {withRouteLoader(<CalendarPage />)}
              </PrivateRoute>
            }
          />
          <Route path="/inbox" element={<PrivateRoute>{withRouteLoader(<Inbox />)}</PrivateRoute>} />
          <Route
            path="/todo"
            element={
              <PrivateRoute>
                {withRouteLoader(<ToDoPage />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/catalog"
            element={
              <PrivateRoute>
                {withRouteLoader(<Catalog />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/join-course"
            element={
              <PrivateRoute>
                {withRouteLoader(<JoinCoursePage />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/account"
            element={
              <PrivateRoute>
                {withRouteLoader(<AccountPage />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/threads/:threadId"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  {withRouteLoader(<ThreadViewWrapper />)}
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          
          {/* Admin Routes */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                {withRouteLoader(<AdminUserManagement />)}
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <AdminRoute>
                {withRouteLoader(<AdminCourseOversight />)}
              </AdminRoute>
            }
          />
          <Route
            path="/teacher/courses"
            element={
              <PrivateRoute allowedRoles={['teacher', 'admin']}>
                {withRouteLoader(<TeacherCourseOversight />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminRoute>
                {withRouteLoader(<AdminAnalytics />)}
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                {withRouteLoader(<AdminSystemSettings />)}
              </AdminRoute>
            }
          />
          <Route
            path="/admin/security"
            element={
              <AdminRoute>
                {withRouteLoader(<AdminSecurity />)}
              </AdminRoute>
            }
          />
          <Route
            path="/admin/accounts"
            element={
              <AdminRoute>
                {withRouteLoader(<AdminAccountTree />)}
              </AdminRoute>
            }
          />
          <Route
            path="/admin/institutions"
            element={
              <PrivateRoute allowedRoles={['platform_admin']}>
                <AdminPhoneGate>
                  {withRouteLoader(<AdminPlatformInstitutions />)}
                </AdminPhoneGate>
              </PrivateRoute>
            }
          />
          <Route
            path="/registrar"
            element={
              <PrivateRoute allowedRoles={['admin', 'registrar', 'department_admin']}>
                {withRouteLoader(<RegistrarOffice />)}
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={withRouteLoader(<RegistrarDashboard />)} />
            <Route path="terms" element={withRouteLoader(<RegistrarTerms />)} />
            <Route path="students" element={withRouteLoader(<RegistrarStudents />)} />
            <Route path="students/:studentId" element={withRouteLoader(<RegistrarStudentStub />)} />
            <Route path="programs" element={withRouteLoader(<RegistrarPrograms />)} />
            <Route path="sections" element={withRouteLoader(<RegistrarSections />)} />
            <Route path="grades" element={withRouteLoader(<RegistrarGradeStatus />)} />
            <Route path="transcripts" element={withRouteLoader(<RegistrarTranscripts />)} />
            <Route path="reports" element={withRouteLoader(<RegistrarReports />)} />
            <Route path="operations" element={withRouteLoader(<RegistrarOperations />)} />
            <Route path="sis" element={withRouteLoader(<RegistrarSis />)} />
            <Route path="settings" element={withRouteLoader(<RegistrarSettings />)} />
          </Route>
          <Route
            path="/admin/backup"
            element={
              <AdminRoute>
                <div className="p-6">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Backup & Recovery</h1>
                  <p className="text-gray-600 dark:text-gray-400">System backup and recovery management</p>
                </div>
              </AdminRoute>
            }
          />
          {/* Reports/Transcript Routes */}
          <Route
            path="/reports/transcript"
            element={
              <PrivateRoute allowedRoles={['student']}>
                {withRouteLoader(<Transcript />)}
              </PrivateRoute>
            }
          />
          
          {/* QuizWave Routes */}
          <Route
            path="/courses/:courseId/quizwave"
            element={
              <PrivateRoute>
                <QuizWaveDashboardWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/quizwave/join"
            element={
              <PrivateRoute>
                {withRouteLoader(<StudentJoinScreen />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/quizwave/play/:pin"
            element={
              <PrivateRoute>
                {withRouteLoader(<StudentGameScreen />)}
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
    </MobileKeyboardProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <TenantProvider>
          <AuthProvider>
            <QueryProvider>
              <AppShell />
            </QueryProvider>
          </AuthProvider>
        </TenantProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 