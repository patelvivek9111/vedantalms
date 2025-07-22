import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../../config';
import AssignmentGrading from './AssignmentGrading';
import { 
  ClipboardList, 
  BookOpen, 
  FileText, 
  PenTool, 
  MessageSquare, 
  Megaphone, 
  Users, 
  BarChart3, 
  UserPlus 
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
        console.error('Error fetching course data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [assignmentId]);

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => 
    !item.roles || item.roles.includes(user?.role || '')
  );

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
    <div className="flex w-full max-w-7xl mx-auto">
      {/* Course Sidebar */}
      <aside className="w-64 mr-8 mt-4">
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-2xl shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700">
          {filteredNavigationItems.map(item => (
            <button
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 ${item.id === 'assignments' ? 'bg-blue-100 text-blue-700 font-semibold shadow' : ''}`}
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
          <AssignmentGrading />
        </div>
      </div>
    </div>
  );
};

export default AssignmentGradingWrapper; 