import React, { Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CourseProvider } from './contexts/CourseContext';
import { ModuleProvider } from './contexts/ModuleContext';
import { PrivateRoute } from './components/common/PrivateRoute';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import CourseList from './components/course/CourseList';
import CourseForm from './components/course/CourseForm';
import PageView from './components/pages/PageView';
import PageViewWrapper from './components/pages/PageViewWrapper';
import AssignmentList from './components/assignments/AssignmentList';
import CreateAssignmentWrapper from './components/assignments/CreateAssignmentWrapper';
import AssignmentViewWrapper from './components/assignments/AssignmentViewWrapper';
import AssignmentDetailsWrapper from './components/assignments/AssignmentDetailsWrapper';
import AssignmentGradingWrapper from './components/assignments/AssignmentGradingWrapper';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppLoadingSkeleton } from './components/common/SkeletonLoader';
import ThreadView from './components/threads/ThreadView';
import ThreadViewWrapper from './components/threads/ThreadViewWrapper';
import { Provider } from 'react-redux';
import { store } from './store/store';
import GroupDiscussion from './components/groups/GroupDiscussion';
import GroupPeopleWrapper from './components/groups/GroupPeopleWrapper';
import GroupHome from './components/groups/GroupHome';
import GroupPageView from './components/groups/GroupPageView';
import GroupMeetings from './components/groups/GroupMeetings';
import GlobalSidebar from './components/layout/GlobalSidebar';
import BottomNav from './components/layout/BottomNav';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryProvider } from './providers/QueryProvider';
import SkipToMain from './design-system/SkipToMain';
import NetworkOfflineBanner from './design-system/NetworkOfflineBanner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useMessagingSocketConnection } from './hooks/inbox/useMessagingSocketConnection';
import { useNotificationSocketConnection } from './hooks/notifications/useNotificationSocketConnection';
import { useNotificationCrossTabSync } from './hooks/notifications/useNotificationCrossTabSync';
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUserManagement = lazyWithRetry(() => import('./pages/AdminUserManagement').then(m => ({ default: m.AdminUserManagement })));
const AdminAnalytics = lazyWithRetry(() => import('./pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminSystemSettings = lazyWithRetry(() => import('./pages/AdminSystemSettings').then(m => ({ default: m.AdminSystemSettings })));
const AdminCourseOversight = lazyWithRetry(() => import('./pages/AdminCourseOversight').then(m => ({ default: m.AdminCourseOversight })));
const AdminSecurity = lazyWithRetry(() => import('./pages/AdminSecurity').then(m => ({ default: m.AdminSecurity })));
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">401</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">You are not authorized to access this page.</p>
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
  
  // Render admin dashboard for admin users
  if (user?.role === 'admin') {
    return withRouteLoader(<AdminDashboard />);
  }
  
  // Render regular dashboard for other users
  return <Dashboard />;
}

const withRouteLoader = (node: React.ReactNode) => (
  <Suspense fallback={<AppLoadingSkeleton />}>{node}</Suspense>
);

function AppContent() {
  const { user, loading, token } = useAuth();
  const { offline } = useNetworkStatus();
  const isAuthenticated = !!user;

  useMessagingSocketConnection(user?._id, token);
  useNotificationSocketConnection(user?._id, token);
  useNotificationCrossTabSync(user?._id);

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  return (
    <div
      className={
        isAuthenticated
          ? 'min-h-dvh bg-gray-100 dark:bg-gray-900 dark:text-white'
          : 'flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950 dark:text-slate-100'
      }
    >
      {isAuthenticated && <SkipToMain />}
      {isAuthenticated && offline && <NetworkOfflineBanner />}
      {isAuthenticated && <GlobalSidebar />}
      {isAuthenticated && <BottomNav />}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          isAuthenticated
            ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-10 lg:pl-20 print:pb-0 print:pl-0 transition-all duration-300 outline-none'
            : 'flex min-h-0 flex-1 flex-col print:pb-0'
        }
      >
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />} />
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
                <CourseList />
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/create"
            element={
              <PrivateRoute>
                <CourseForm mode="create" />
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
                <CourseForm mode="edit" />
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:courseId/pages/:pageId"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  <PageViewWrapper />
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          <Route
            path="/pages/:pageId"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  <PageView />
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          {/* Assignment Routes */}
          <Route
            path="/modules/:moduleId/assignments"
            element={
              <PrivateRoute>
                <AssignmentListWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/modules/:moduleId/assignments/create"
            element={
              <PrivateRoute>
                <CreateAssignmentFormWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/assignments/:id/view"
            element={
              <PrivateRoute>
                <AssignmentViewWrapper />
              </PrivateRoute>
            }
          />
          <Route
            path="/assignments/:id/grade"
            element={
              <PrivateRoute allowedRoles={['teacher', 'admin']}>
                <AssignmentGradingWrapper />
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
                <AssignmentDetailsWrapper />
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
                <ThreadViewWrapper />
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
            <Route path="home" element={<GroupHome />} />
            <Route path="discussion" element={<GroupDiscussion />} />
            <Route path="meetings" element={<GroupMeetings />} />
            <Route path="discussion/:threadId" element={<ThreadView />} />
            <Route path="people" element={<GroupPeopleWrapper />} />
            <Route path="pages/:pageId" element={
              <ModuleProvider>
                <GroupPageView />
              </ModuleProvider>
            } />
            <Route index element={<GroupHome />} />
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
                  <ThreadViewWrapper />
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          
          {/* Admin Routes */}
          <Route
            path="/admin/users"
            element={
              <PrivateRoute>
                {withRouteLoader(<AdminUserManagement />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <PrivateRoute>
                {withRouteLoader(<AdminCourseOversight />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher/courses"
            element={
              <PrivateRoute allowedRoles={['teacher']}>
                {withRouteLoader(<TeacherCourseOversight />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <PrivateRoute>
                {withRouteLoader(<AdminAnalytics />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <PrivateRoute>
                {withRouteLoader(<AdminSystemSettings />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/security"
            element={
              <PrivateRoute>
                {withRouteLoader(<AdminSecurity />)}
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/backup"
            element={
              <PrivateRoute>
                <div className="p-6">
                  <h1 className="text-3xl font-bold text-gray-900">Backup & Recovery</h1>
                  <p className="text-gray-600">System backup and recovery management</p>
                </div>
              </PrivateRoute>
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
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <QueryProvider>
            <CourseProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </CourseProvider>
          </QueryProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 