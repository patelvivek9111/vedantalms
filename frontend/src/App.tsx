import React from 'react';
import { Routes, Route, Navigate, useParams, useOutletContext, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CourseProvider } from './contexts/CourseContext';
import { ModuleProvider } from './contexts/ModuleContext';
import { PrivateRoute } from './components/PrivateRoute';
import Navigation from './components/Navigation';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUserManagement } from './pages/AdminUserManagement';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AdminSystemSettings } from './pages/AdminSystemSettings';
import { AdminCourseOversight } from './pages/AdminCourseOversight';
import { AdminSecurity } from './pages/AdminSecurity';
import { TeacherCourseOversight } from './pages/TeacherCourseOversight';
import CourseList from './components/CourseList';
import CourseDetail from './components/CourseDetail';
import CourseForm from './components/CourseForm';
import PageView from './components/PageView';
import PageViewWrapper from './components/PageViewWrapper';
import AssignmentList from './components/assignments/AssignmentList';
import AssignmentDetails from './components/assignments/AssignmentDetails';
import CreateAssignmentForm from './components/assignments/CreateAssignmentForm';
import CreateAssignmentWrapper from './components/assignments/CreateAssignmentWrapper';
import GradeSubmissions from './components/assignments/GradeSubmissions';
import ViewAssignment from './components/assignments/ViewAssignment';
import ModuleEditPage from './pages/ModuleEditPage';
import PageEditPage from './pages/PageEditPage';
import AssignmentEditPage from './pages/AssignmentEditPage';
import AssignmentGrading from './components/assignments/AssignmentGrading';
import AssignmentViewWrapper from './components/assignments/AssignmentViewWrapper';
import AssignmentDetailsWrapper from './components/assignments/AssignmentDetailsWrapper';
import AssignmentGradingWrapper from './components/assignments/AssignmentGradingWrapper';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ThreadView from './components/ThreadView';
import ThreadViewWrapper from './components/ThreadViewWrapper';
import Transcript from './pages/Transcript';
import { Provider } from 'react-redux';
import { store } from './store/store';
import GroupDashboard from './components/groups/GroupDashboard';
import GroupDiscussion from './components/groups/GroupDiscussion';
import GroupPeopleWrapper from './components/groups/GroupPeopleWrapper';
import GroupHome from './components/groups/GroupHome';
import Announcements from './pages/Announcements';
import GlobalSidebar from './components/GlobalSidebar';
import BottomNav from './components/BottomNav';
import CalendarPage from './components/Calendar';
import Inbox from './pages/Inbox';
import ToDoPage from './pages/ToDoPage';
import AccountPage from './pages/AccountPage';
import Groups from './pages/Groups';
import GroupSetView from './components/groups/GroupSetView';
import Catalog from './pages/Catalog';
import CoursePeople from './pages/CoursePeople';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import QuizWaveDashboard from './components/quizwave/QuizWaveDashboard';
import StudentJoinScreen from './components/quizwave/StudentJoinScreen';
import StudentGameScreen from './components/quizwave/StudentGameScreen';

// Wrapper to get courseId from URL params
const QuizWaveDashboardWrapper: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  if (!courseId) {
    return <div>Course ID is required</div>;
  }
  return <QuizWaveDashboard courseId={courseId} />;
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
  return <Announcements courseId={courseId} />;
}

function DashboardWrapper() {
  const { user } = useAuth();
  
  // Render admin dashboard for admin users
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  
  // Render regular dashboard for other users
  return <Dashboard />;
}

function AppContent() {
  const { user, loading } = useAuth();
  const isAuthenticated = !!user;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 dark:text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 dark:text-white">
      {isAuthenticated && <GlobalSidebar />}
      {isAuthenticated && <BottomNav />}
      <main className={isAuthenticated ? "pb-20 lg:pb-10 lg:pl-20" : "pb-10"}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/signup" element={<Signup />} />
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
                <CourseDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:id/:section"
            element={
              <PrivateRoute>
                <CourseDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/courses/:courseId/people"
            element={
              <PrivateRoute>
                <CoursePeople />
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
                <AssignmentEditPage />
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
                  <ModuleEditPage />
                </ModuleProvider>
              </PrivateRoute>
            }
          />
          <Route
            path="/pages/:pageId/edit"
            element={
              <PrivateRoute>
                <ModuleProvider>
                  <PageEditPage />
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
              <Groups />
            </PrivateRoute>
          } />
          <Route path="/groupsets/:groupSetId" element={
            <PrivateRoute>
              <GroupSetView />
            </PrivateRoute>
          } />
          <Route path="/groups/:groupId/*" element={<GroupDashboard />}>
            <Route path="home" element={<GroupHome />} />
            <Route path="discussion" element={<GroupDiscussion />} />
            <Route path="discussion/:threadId" element={<ThreadView />} />
            <Route path="people" element={<GroupPeopleWrapper />} />
            <Route index element={<GroupHome />} />
          </Route>
          <Route
            path="/calendar"
            element={
              <PrivateRoute>
                <CalendarPage />
              </PrivateRoute>
            }
          />
          <Route path="/inbox" element={<PrivateRoute><Inbox /></PrivateRoute>} />
          <Route
            path="/todo"
            element={
              <PrivateRoute>
                <ToDoPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/catalog"
            element={
              <PrivateRoute>
                <Catalog />
              </PrivateRoute>
            }
          />
          <Route
            path="/account"
            element={
              <PrivateRoute>
                <AccountPage />
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
                <AdminUserManagement />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <PrivateRoute>
                <AdminCourseOversight />
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher/courses"
            element={
              <PrivateRoute allowedRoles={['teacher']}>
                <TeacherCourseOversight />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <PrivateRoute>
                <AdminAnalytics />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <PrivateRoute>
                <AdminSystemSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/security"
            element={
              <PrivateRoute>
                <AdminSecurity />
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
                <Transcript />
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
                <StudentJoinScreen />
              </PrivateRoute>
            }
          />
          <Route
            path="/quizwave/play/:pin"
            element={
              <PrivateRoute>
                <StudentGameScreen />
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
          <CourseProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </CourseProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 