import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CreateAssignmentForm from '../components/assignments/CreateAssignmentForm';
import { ArrowLeft, ClipboardList, BookOpen, FileText, PenTool, MessageSquare, Megaphone, Users, BarChart3, UserPlus, CheckSquare, ClipboardCheck, GraduationCap, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';
import Breadcrumb from '../components/common/Breadcrumb';
import { hapticNavigation } from '../utils/hapticFeedback';

// Navigation items for the course sidebar
const navigationItems = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'syllabus', label: 'Syllabus', icon: GraduationCap },
  { id: 'modules', label: 'Modules', icon: BookOpen },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: PenTool },
  { id: 'quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { id: 'discussions', label: 'Discussions', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CheckSquare },
  { id: 'grades', label: 'Grades', icon: BarChart3, roles: ['student'] },
  { id: 'gradebook', label: 'Gradebook', icon: BookOpen, roles: ['teacher', 'admin'] },
  { id: 'students', label: 'People', icon: UserPlus },
];

const AssignmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!id) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/assignments/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data) {
          // Handle both direct response.data and nested response.data.data
          const assignment = response.data.data || response.data;
          setAssignment(assignment);
          
          // Get module ID from assignment
          if (assignment.module) {
            const moduleId = typeof assignment.module === 'string'
              ? assignment.module
              : assignment.module._id;
            setModuleId(moduleId);
            
            // Fetch course data
            const moduleRes = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (moduleRes.data.success) {
              const courseId = moduleRes.data.data.course._id || moduleRes.data.data.course;
              const courseRes = await axios.get(`${API_URL}/api/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (courseRes.data.success) {
                setCourse(courseRes.data.data);
              }
            }
          }
        } else {
          setError('Failed to load assignment data');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading assignment');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded relative text-sm sm:text-base" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don't have permission to edit assignments.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!moduleId) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded relative text-sm sm:text-base" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">Could not determine module for this assignment.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Filter navigation items based on user role
  const filteredNavigationItems = course ? navigationItems.filter((item: any) => {
    if (item.roles && !item.roles.includes(user?.role || '')) {
      return false;
    }
    return true;
  }) : navigationItems;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm safe-area-inset-top">
        <div className="relative flex items-center justify-between px-4 py-3 gap-2">
          <button
            onClick={() => {
              hapticNavigation();
              navigate(course?._id ? `/courses/${course._id}/assignments` : '/dashboard');
            }}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex-1 text-center">Editing</h1>
          <div className="w-10 flex-shrink-0"></div> {/* Spacer for centering */}
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto">

        {/* Main Content Area */}
        <div className="flex-1 overflow-x-hidden lg:ml-0">
          <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 pt-16 lg:pt-6 overflow-x-hidden">
            {/* Breadcrumb Navigation - Desktop Only */}
            {course && assignment && (
              <div className="hidden lg:block mb-4">
                <Breadcrumb
                  items={[
                    { label: 'Dashboard', path: '/dashboard' },
                    { label: 'Courses', path: '/courses' },
                    { 
                      label: course.catalog?.courseCode || course.title || 'Course', 
                      path: `/courses/${course._id}` 
                    },
                    { 
                      label: assignment.isGradedQuiz ? 'Quizzes' : 'Assignments', 
                      path: `/courses/${course._id}/${assignment.isGradedQuiz ? 'quizzes' : 'assignments'}` 
                    },
                    { 
                      label: assignment.title || 'Assignment', 
                      path: `/assignments/${id}` 
                    },
                    { 
                      label: 'Edit', 
                      path: location.pathname 
                    }
                  ]}
                />
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 sm:p-4 lg:p-6 overflow-x-hidden">
              <div className="hidden lg:block mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Assignment</h1>
              </div>
              
              <CreateAssignmentForm 
                moduleId={moduleId} 
                editMode={true}
                assignmentData={assignment}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentEditPage; 