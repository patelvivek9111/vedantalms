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
import CourseList from './components/CourseList';
import CourseDetail from './components/CourseDetail';
import CourseForm from './components/CourseForm';
import PageView from './components/PageView';
import PageViewWrapper from './components/PageViewWrapper';
import AssignmentList from './components/assignments/AssignmentList';
import AssignmentDetails from './components/assignments/AssignmentDetails';
import CreateAssignmentForm from './components/assignments/CreateAssignmentForm';
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
import { Provider } from 'react-redux';
import { store } from './store/store';
import GroupDashboard from './components/groups/GroupDashboard';
import GroupDiscussion from './components/groups/GroupDiscussion';
import GroupPeople from './components/groups/GroupPeople';
import Announcements from './pages/Announcements';
import GlobalSidebar from './components/GlobalSidebar';
import CalendarPage from './components/Calendar';
import Inbox from './pages/Inbox';
import AccountPage from './pages/AccountPage';
import Groups from './pages/Groups';
import GroupSetView from './components/groups/GroupSetView';
import { ThemeProvider } from './context/ThemeContext';

// Wrapper components to handle moduleId prop
const AssignmentListWrapper = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  if (!moduleId) return null;
  return <AssignmentList moduleId={moduleId} />;
};

const CreateAssignmentFormWrapper = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  if (!moduleId) return null;
  return <CreateAssignmentForm moduleId={moduleId} />;
};

function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">401</h1>
        <p className="mt-2 text-gray-600">You are not authorized to access this page.</p>
      </div>
    </div>
  );
}

function GroupPeopleWrapper() {
  // Get groupId from params and groupSetId from outlet context
  const { groupId } = useParams();
  const context = useOutletContext() as any;
  const groupSetId = context?.groupSetId;
  if (!groupId || !groupSetId) return <div>No group selected.</div>;
  return <GroupPeople groupId={groupId} groupSetId={groupSetId} />;
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
      <main className={isAuthenticated ? "pb-10 pl-20" : "pb-10"}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/"
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
            <Route path="home" element={<div>Group Home (placeholder)</div>} />
            <Route path="pages" element={<div>Group Pages</div>} />
            <Route path="discussion" element={<GroupDiscussion />} />
            <Route path="assignments" element={<div>Group Assignments (placeholder)</div>} />
            <Route path="announcements" element={<div>Group Announcements (placeholder)</div>} />
            <Route path="people" element={<GroupPeopleWrapper />} />
            <Route index element={<div>Group Home (placeholder)</div>} />
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
            <AppContent />
          </CourseProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 