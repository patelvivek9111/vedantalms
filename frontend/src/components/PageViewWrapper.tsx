import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import PageView from './PageView';
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
  CheckSquare
} from 'lucide-react';

// Navigation items for the course sidebar
const navigationItems = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'modules', label: 'Modules', icon: BookOpen },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: PenTool },
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
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Debug logging
  console.log('PageViewWrapper - courseId:', courseId, 'pageId:', pageId);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId || courseId === 'undefined' || courseId === 'null') {
        console.error('Invalid course ID:', courseId);
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
        console.error('Error fetching course:', err);
        if (err.response?.status === 400) {
          console.error('Invalid course ID format');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  // Get custom sidebar configuration or use default
  const sidebarConfig = course?.sidebarConfig || {
    items: navigationItems.map((item, index) => ({
      id: item.id,
      label: item.label,
      visible: true,
      order: index,
      fixed: item.id === 'overview'
    })),
    studentVisibility: {
      overview: true,
      modules: true,
      pages: true,
      assignments: true,
      discussions: true,
      announcements: true,
      polls: true,
      groups: true,
      attendance: true,
      grades: true,
      gradebook: false,
      students: true
    }
  };

  // Create navigation items from custom configuration
  const customNavigationItems = sidebarConfig.items
    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
    .filter((item: { visible: boolean }) => item.visible)
    .map((item: { id: string; label: string; visible: boolean; order: number }) => {
      const originalItem = navigationItems.find(nav => nav.id === item.id);
      return {
        ...originalItem,
        ...item
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
    <div className="flex w-full max-w-7xl mx-auto">
      {/* Course Sidebar */}
      <aside className="w-64 mr-8 mt-4">
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-2xl shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700">
          {filteredNavigationItems.map((item: any) => (
            <button
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 ${item.id === 'pages' ? 'bg-blue-100 text-blue-700 font-semibold shadow' : ''}`}
              onClick={() => navigate(`/courses/${course._id}/${item.id}`)}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-base">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          <PageView />
        </div>
      </div>
    </div>
  );
};

export default PageViewWrapper; 