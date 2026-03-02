import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import axios from 'axios';
import { API_URL } from '../config';
import PageView from './PageView';
import Breadcrumb from './common/Breadcrumb';
import MobileNavigation from './course/MobileNavigation';
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

const PageViewWrapper: React.FC = () => {
  const { courseId, pageId } = useParams<{ courseId: string; pageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { courses } = useCourse();
  const [course, setCourse] = useState<any>(null);
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  // Check if it's actually a mobile phone (not tablet/iPad)
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.screen.width;
      const viewportWidth = window.innerWidth;
      
      // Detect tablets/iPads more accurately
      const isTablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))|kindle/i.test(userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        (screenWidth >= 768 && screenWidth <= 1024 && 'ontouchstart' in window);
      
      // Detect phones - must be mobile user agent AND not a tablet AND small screen
      const isPhone = (
        /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
        (/mobile/i.test(userAgent) && !isTablet)
      ) && !isTablet;
      
      // Only show mobile view on actual phones with small screens (< 768px)
      const shouldShowMobile = isPhone && screenWidth < 768 && viewportWidth < 768;
      
      setIsMobileDevice(shouldShowMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId || courseId === 'undefined' || courseId === 'null') {
        return;
      }
      
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await axios.get(`${API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setCourse(response.data.data);
        } else {
          throw new Error(response.data.message || 'Failed to fetch course');
        }
      } catch (err: any) {
        if (err.response?.status === 400) {
          }
      } finally {
        setLoading(false);
      }
    };

    const fetchPage = async () => {
      if (!pageId) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get(`${API_URL}/api/pages/view/${pageId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setPage(response.data.data);
        }
      } catch (err) {
        // Silently fail - page title is optional
        console.debug('Failed to fetch page:', err);
      }
    };

    fetchCourse();
    fetchPage();
  }, [courseId, pageId]);

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

  if (!course || !course._id) {
    return <div>Course not found or invalid course data</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto">
      {/* Mobile Top Navigation */}
      <MobileNavigation
        isMobileDevice={isMobileDevice}
        course={course}
        showCourseDropdown={showCourseDropdown}
        setShowCourseDropdown={setShowCourseDropdown}
        user={user}
        courses={courses}
        courseId={courseId || ''}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && isMobileDevice && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[90]"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ touchAction: 'none', pointerEvents: 'auto' }}
        />
      )}

      {/* Course Sidebar */}
      <aside className={`w-full lg:w-64 lg:mr-8 mt-4 lg:mt-4 self-start lg:sticky lg:top-4 h-[calc(100vh-4rem-4rem)] lg:h-fit z-[95] lg:z-auto transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } fixed lg:relative left-0 top-16 lg:top-0 bg-white dark:bg-gray-900 lg:bg-transparent pt-16 lg:pt-0`}>
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-2xl shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700 m-4 lg:m-0 h-full lg:h-auto overflow-y-auto pb-20 lg:pb-4">
          <div className="flex justify-between items-center mb-2 lg:hidden">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Course Menu</h3>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {filteredNavigationItems.map((item: any) => (
            <button
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${item.id === 'pages' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold shadow' : ''}`}
              onClick={() => {
                navigate(`/courses/${course._id}/${item.id}`);
                setIsMobileMenuOpen(false);
              }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-base">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-auto w-full ${isMobileDevice ? 'pt-16' : 'pt-0'}`}>
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb Navigation - Desktop Only */}
          {course && (
            <div className="hidden lg:block mb-4">
              <Breadcrumb
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Courses', path: '/courses' },
                  { 
                    label: course.catalog?.courseCode || course.title || 'Course', 
                    path: `/courses/${courseId}` 
                  },
                  { 
                    label: 'Pages', 
                    path: `/courses/${courseId}/pages` 
                  },
                  { 
                    label: page?.title || 'Page', 
                    path: location.pathname 
                  }
                ]}
              />
            </div>
          )}
          <PageView />
        </div>
      </div>
    </div>
  );
};

export default PageViewWrapper; 