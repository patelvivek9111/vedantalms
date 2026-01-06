import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CreateAssignmentForm from '../components/assignments/CreateAssignmentForm';
import { ArrowLeft, Menu, X, ClipboardList, BookOpen, FileText, PenTool, MessageSquare, Megaphone, Users, BarChart3, UserPlus, CheckSquare, ClipboardCheck, GraduationCap } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

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
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Edit Assignment</h1>
          <button
            onClick={() => navigate(-1)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto">
        {/* Course Sidebar */}
        {course && (
          <aside
            className={`fixed lg:relative top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-auto w-64 bg-white/95 dark:bg-gray-900/95 backdrop-blur lg:bg-white/80 dark:lg:bg-gray-900/80 z-[95] lg:z-auto transform ${
              isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            } transition-transform duration-300 ease-in-out lg:mr-8 lg:mt-4`}
          >
            <nav className="rounded-2xl shadow-lg p-3 sm:p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700 h-full lg:h-auto overflow-y-auto pb-20 lg:pb-4">
              {filteredNavigationItems.map((item: any) => (
                <button
                  key={item.id}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-lg transition-colors font-medium text-sm sm:text-base text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 ${item.id === 'assignments' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold shadow' : ''}`}
                  onClick={() => {
                    navigate(`/courses/${course._id}/${item.id}`);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-x-hidden lg:ml-0">
          <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 pt-16 lg:pt-6 overflow-x-hidden">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-2 sm:p-4 lg:p-6 overflow-x-hidden">
              <div className="hidden lg:block mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Assignment</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Editing: {assignment?.title}
                </p>
              </div>
              <div className="lg:hidden mb-4 sm:mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Editing: {assignment?.title}
                </p>
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