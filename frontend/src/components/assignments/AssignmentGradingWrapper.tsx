import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../../config';
import AssignmentGrading from './AssignmentGrading';
import logger from '../../utils/logger';
import { 
  ClipboardList, 
  BookOpen, 
  FileText, 
  PenTool, 
  MessageSquare, 
  Megaphone, 
  Users, 
  BarChart3, 
  UserPlus,
  CheckSquare,
  ClipboardCheck,
  GraduationCap,
  Menu,
  X
} from 'lucide-react';

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

const AssignmentGradingWrapper: React.FC = () => {
  const { id: assignmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch course data for the assignment
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!assignmentId) return;
      
      try {
        const token = localStorage.getItem('token');
        // First get the assignment to find its course
        const assignmentRes = await axios.get(`${API_URL}/api/assignments/${assignmentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (assignmentRes.data) {
          const assignment = assignmentRes.data;
          // Get the course ID from the assignment's module
          if (assignment.module) {
            // Handle both string and object module references
            const moduleId = typeof assignment.module === 'string' ? assignment.module : assignment.module._id;
            const moduleRes = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (moduleRes.data.success) {
              const courseId = moduleRes.data.data.course._id || moduleRes.data.data.course;
              // Fetch course data
              const courseRes = await axios.get(`${API_URL}/api/courses/${courseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (courseRes.data.success) {
                setCourse(courseRes.data.data);
              }
            }
          }
        }
      } catch (err) {
        logger.error('Error fetching course data', err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [assignmentId]);

  // Merge existing config with default navigationItems to ensure all items are included
  const existingItems = course?.sidebarConfig?.items || [];
  const existingItemsMap = new Map(existingItems.map((item: any) => [item.id, item]));
  
  // Build merged items: start with all navigationItems, use existing config if available
  const mergedItems = navigationItems.map((navItem, index) => {
    const existing = existingItemsMap.get(navItem.id);
    if (existing) {
      // Use existing config, but ensure we have the icon and other properties from navigationItems
      return {
        ...existing,
        label: navItem.label, // Always use the current label from navigationItems
        fixed: navItem.id === 'overview'
      };
    }
    // Item doesn't exist in config, add it with defaults
    return {
      id: navItem.id,
      label: navItem.label,
      visible: true,
      order: index,
      fixed: navItem.id === 'overview'
    };
  });

  // Get custom sidebar configuration or use default
  const sidebarConfig = {
    items: mergedItems,
    studentVisibility: {
      overview: true,
      syllabus: true,
      modules: true,
      pages: true,
      assignments: true,
      quizzes: true,
      discussions: true,
      announcements: true,
      polls: true,
      groups: true,
      attendance: true,
      grades: true,
      gradebook: false,
      students: true,
      ...(course?.sidebarConfig?.studentVisibility || {})
    }
  };

  // Create navigation items from custom configuration
  const customNavigationItems = sidebarConfig.items
    .filter((item: any): item is { id: string; label: string; visible: boolean; order: number } => 
      typeof item === 'object' && 
      item !== null && 
      typeof item.id === 'string' && 
      typeof item.visible === 'boolean' && 
      typeof item.order === 'number'
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((item) => item.visible)
    .map((item) => {
      const originalItem = navigationItems.find(nav => nav.id === item.id);
      return originalItem ? {
        ...originalItem,
        ...item
      } : {
        id: item.id,
        label: item.label,
        icon: ClipboardList, // Default icon fallback
        visible: item.visible,
        order: item.order
      };
    });

  // Filter navigation items based on user role and student visibility
  const filteredNavigationItems = customNavigationItems.filter((item: any) => {
    // Check role-based filtering
    if (item.roles && !item.roles.includes(user?.role || '')) {
      return false;
    }
    
    // For students, check both general visibility and student visibility settings
    if (user?.role === 'student') {
      return item.visible && sidebarConfig.studentVisibility[item.id as keyof typeof sidebarConfig.studentVisibility];
    }
    
    // Teachers and admins can see all items (they can see everything)
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!course) {
    return <div>Course not found</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-[100] bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 touch-manipulation"
        aria-label="Toggle course menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[90]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Course Sidebar */}
      <aside
        className={`fixed lg:relative top-0 left-0 h-[calc(100vh-4rem)] lg:h-auto w-64 bg-white/95 dark:bg-gray-900/95 backdrop-blur lg:bg-white/80 dark:lg:bg-gray-900/80 z-[95] lg:z-auto transform ${
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto lg:ml-0">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
          <AssignmentGrading />
        </div>
      </div>
    </div>
  );
};

export default AssignmentGradingWrapper; 