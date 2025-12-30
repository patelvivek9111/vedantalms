import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import ModuleEditPage from '../pages/ModuleEditPage';
import logger from '../utils/logger';
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
  X,
  ArrowLeft
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

const ModuleEditWrapper: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchModuleAndCourse = async () => {
      if (!moduleId) return;
      
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        // Fetch module to get course ID
        const moduleResponse = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!moduleResponse.data.success) {
          throw new Error('Failed to fetch module');
        }

        const moduleData = moduleResponse.data.data;
        const courseId = moduleData.course?._id || moduleData.course;
        
        if (!courseId || courseId === 'undefined' || courseId === 'null') {
          logger.error('Invalid course ID from module', new Error('Invalid course ID'), { moduleId, courseId });
          return;
        }
        
        // Fetch course data
        const courseResponse = await axios.get(`${API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (courseResponse.data.success) {
          setCourse(courseResponse.data.data);
        } else {
          throw new Error(courseResponse.data.message || 'Failed to fetch course');
        }
      } catch (err: any) {
        logger.error('Error fetching module/course', err);
        if (err.response?.status === 400) {
          logger.error('Invalid course ID format', new Error('Invalid course ID format'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchModuleAndCourse();
  }, [moduleId]);

  // Merge existing config with default navigationItems to ensure all items are included
  const existingItems = course?.sidebarConfig?.items || [];
  const existingItemsMap = new Map(existingItems.map((item: any) => [item.id, item]));
  
  // Build merged items: start with all navigationItems, use existing config if available
  const mergedItems = navigationItems.map((navItem, index) => {
    const existing = existingItemsMap.get(navItem.id);
    if (existing) {
      // Use existing config, but ensure we have the icon and other properties from navigationItems
      return {
        ...navItem, // Start with navItem to ensure icon and other properties are included
        ...existing, // Override with existing config
        label: navItem.label, // Always use the current label from navigationItems
        icon: navItem.icon, // Always use the icon from navigationItems
        fixed: navItem.id === 'overview'
      };
    }
    return {
      ...navItem,
      order: index,
      visible: true,
      fixed: navItem.id === 'overview'
    };
  });

  // Filter navigation items based on user role
  const filteredNavigationItems = mergedItems.filter((item: any) => {
    if (!item.visible) return false;
    if (item.roles && user) {
      return item.roles.includes(user.role);
    }
    return true;
  });

  // Sort by order
  filteredNavigationItems.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">Failed to load course data.</span>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Menu Button */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Module</h2>
          </div>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </nav>

      <div className={`flex ${isMobileDevice ? 'flex-col pt-16' : 'flex-row pt-0'} w-full max-w-7xl mx-auto`}>
        {/* Mobile Overlay */}
        {isMobileMenuOpen && isMobileDevice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[90]"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ touchAction: 'none', pointerEvents: 'auto' }}
          />
        )}

        {/* Course Sidebar */}
        <aside 
          className={`${isMobileDevice 
            ? 'w-full fixed left-0 top-20 bottom-16 z-[95]' 
            : 'w-64 relative mr-8 mt-4 self-start sticky top-4 z-auto'
          } transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen && isMobileDevice ? 'translate-x-0' : isMobileDevice ? '-translate-x-full' : 'translate-x-0'
          } bg-transparent`}
          style={{ 
            height: isMobileDevice ? 'calc(100vh - 80px - 64px)' : undefined
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <nav 
            className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur ${isMobileDevice ? 'rounded-t-2xl' : 'rounded-2xl'} shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700 ${isMobileDevice ? '' : 'm-0 h-auto pb-4'}`} 
            style={{ 
              height: '100%',
              maxHeight: '100%',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobileDevice && (
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Course Menu</h3>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div 
              className={`flex-1 min-h-0 ${isMobileDevice ? 'overflow-y-auto' : 'overflow-visible'}`}
              style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain'
              }}
            >
              {filteredNavigationItems.map((item: any) => {
                const IconComponent = item.icon || ClipboardList;
                return (
                  <button
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${item.id === 'modules' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold shadow' : ''}`}
                    onClick={() => {
                      navigate(`/courses/${course._id}/${item.id}`);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-base">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 overflow-auto w-full ${isMobileMenuOpen ? 'lg:overflow-auto overflow-hidden' : ''}`}>
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 lg:pb-6">
            <ModuleEditPage />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleEditWrapper;

