import React, { useEffect, useState } from 'react';
import { useParams, NavLink, useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Home, FileText, MessageSquare, ClipboardList, Megaphone, Users, ChevronDown, X, ArrowLeft, Folder, Settings, HelpCircle, User as UserIcon, LogOut, BookOpen } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import AssignmentCard from '../assignments/AssignmentCard';
import GroupPages from './GroupPages';
import GroupAnnouncements from './GroupAnnouncements';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl } from '../../services/api';
import { ChangeUserModal } from '../ChangeUserModal';

const tabs = [
  { id: 'home', label: 'Home', path: 'home', icon: Home },
  { id: 'pages', label: 'Pages', path: 'pages', icon: FileText },
  { id: 'discussion', label: 'Discussion', path: 'discussion', icon: MessageSquare },
  { id: 'assignments', label: 'Assignments', path: 'assignments', icon: ClipboardList },
  { id: 'announcements', label: 'Announcements', path: 'announcements', icon: Megaphone },
  { id: 'people', label: 'People', path: 'people', icon: Users },
];

export default function GroupDashboard() {
  const { groupId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('Group');
  const [groupSetName, setGroupSetName] = useState('Group Set');
  const [groupSetId, setGroupSetId] = useState('');
  const [groupsInSet, setGroupsInSet] = useState<{ _id: string; name: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);

  // Add user role detection
  const isInstructor = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get the current active tab from the pathname - use more precise matching
  const currentPath = location.pathname;
  // Extract just the last segment after the groupId
  const pathSegments = currentPath.split('/').filter(Boolean);
  const groupIndex = pathSegments.findIndex(seg => seg === groupId);
  const lastSegment = groupIndex >= 0 && groupIndex < pathSegments.length - 1 
    ? pathSegments[groupIndex + 1] 
    : pathSegments[pathSegments.length - 1];
  
  // Only show one section at a time based on the last path segment
  const isAssignments = lastSegment === 'assignments';
  const isPages = lastSegment === 'pages';
  const isAnnouncements = lastSegment === 'announcements';
  const isHome = lastSegment === 'home' || lastSegment === groupId || !lastSegment || groupIndex === pathSegments.length - 1;
  const isDiscussion = lastSegment === 'discussion' && !currentPath.includes('/discussion/');
  const isPeople = lastSegment === 'people';

  useEffect(() => {
    async function fetchGroup() {
      if (!groupId) {
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/groups/` + groupId, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupName(res.data.name || 'Group');
        setGroupSetId(res.data.groupSet);
        setGroupSetName(res.data.groupSetName || 'Group Set');
        setCourseId(res.data.course?._id || res.data.course || '');
      } catch (err) {
        setGroupName('Group');
        setGroupSetName('Group Set');
      }
    }
    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    async function fetchGroupsInSet() {
      if (!groupSetId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/groups/sets/${groupSetId}/groups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupsInSet(res.data);
      } catch {
        setGroupsInSet([]);
      }
    }
    fetchGroupsInSet();
  }, [groupSetId]);

  // Fetch group assignments for the group set
  useEffect(() => {
    if (!groupSetId || typeof groupSetId !== 'string' || groupSetId.length !== 24) {
      setAssignments([]);
      return;
    }
    const fetchGroupAssignments = async () => {
      setAssignmentsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/assignments/groupset/${groupSetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAssignments(res.data);
      } catch (err) {
        setAssignments([]);
      } finally {
        setAssignmentsLoading(false);
      }
    };
    fetchGroupAssignments();
  }, [groupSetId]);

  // Determine active section
  const activeSection = tabs.find(tab => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const groupIndex = pathSegments.findIndex(seg => seg === groupId);
    const lastSegment = groupIndex >= 0 && groupIndex < pathSegments.length - 1 
      ? pathSegments[groupIndex + 1] 
      : pathSegments[pathSegments.length - 1];
    return tab.path === lastSegment || (tab.path === 'home' && (lastSegment === groupId || !lastSegment || groupIndex === pathSegments.length - 1));
  })?.id || 'home';

  // Create navigation items for CourseSidebar
  const navigationItems = tabs.map(tab => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon
  }));

  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto">
      {/* Top Navigation Bar (Mobile Only) - Matching Course Pages */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => {
              // Navigate back to course if courseId is available
              if (courseId) {
                navigate(`/courses/${courseId}`);
              } else {
                // Fallback: try to get from localStorage or go to courses list
                const storedCourseId = localStorage.getItem('previousCourseId');
                if (storedCourseId) {
                  navigate(`/courses/${storedCourseId}`);
                } else {
                  navigate('/courses');
                }
              }
            }}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Go back to course"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate px-2">
            {groupName}
          </h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-blue-600 dark:text-blue-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Toggle group menu"
          >
            <BookOpen className="w-6 h-6" />
          </button>
        </div>
      </nav>
      
      <ChangeUserModal
        isOpen={showChangeUserModal}
        onClose={() => setShowChangeUserModal(false)}
      />


      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[90]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Group Sidebar */}
      <aside 
        className={`${isMobileDevice 
          ? 'w-full fixed left-0 top-16 bottom-16 z-[95]' 
          : 'w-64 relative mr-8 mt-4 self-start sticky top-4 z-auto'
        } transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen && isMobileDevice ? 'translate-x-0' : isMobileDevice ? '-translate-x-full' : 'translate-x-0'
        } bg-transparent`}
        style={{ 
          height: isMobileDevice ? 'calc(100vh - 64px - 64px)' : undefined
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
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Group Menu</h3>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Dropdown header */}
          <div className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-3 relative flex-shrink-0">
            {(isInstructor || isAdmin) ? (
              <button
                className="w-full flex items-center justify-between font-bold text-lg text-left focus:outline-none text-gray-900 dark:text-gray-100"
                onClick={() => setDropdownOpen((open) => !open)}
              >
                <span className="truncate">{groupSetName} / {groupName}</span>
                <ChevronDown className={`h-5 w-5 ml-2 transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <div className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{groupSetName} / {groupName}</div>
            )}
            {dropdownOpen && (isInstructor || isAdmin) && (
              <div className="absolute left-0 right-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-2 max-h-60 overflow-y-auto">
                {groupsInSet.map((g) => (
                  <div
                    key={g._id}
                    className={`px-4 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-900 dark:text-gray-100 ${g._id === groupId ? 'bg-blue-100 dark:bg-blue-900/50 font-semibold' : ''}`}
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate(`/groups/${g._id}`);
                    }}
                  >
                    {g.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div 
            className={`flex-1 min-h-0 ${isMobileDevice ? 'overflow-y-auto' : 'overflow-visible'}`}
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain'
            }}
          >
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const tab = tabs.find(t => t.id === item.id);
              return (
                <button
                  key={item.id}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${
                    activeSection === item.id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold shadow' : ''
                  }`}
                  onClick={() => {
                    navigate(`/groups/${groupId}/${tab?.path || item.id}`);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-base">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:ml-8">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 pt-16 lg:pt-4">
          {/* Breadcrumb (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 px-1">
            <Link to="/groups" className="hover:underline text-gray-700 dark:text-gray-300 font-medium">Group Management</Link>
            <span className="mx-1 text-gray-300 dark:text-gray-600">&gt;</span>
            <span className="text-gray-700 dark:text-gray-300 font-semibold truncate">{groupName}</span>
          </div>
          {/* Only show one section at a time based on current path */}
          {isAssignments && (
            <div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Group Assignments</h3>
              {assignmentsLoading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="flex flex-col items-center">
                    <ClipboardList className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No assignments yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">There are no assignments for this group set yet.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignments.map(assignment => (
                    <AssignmentCard
                      key={assignment._id}
                      assignment={assignment}
                      isInstructor={isInstructor}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {isPages && groupId && (
            <GroupPages groupSetId={groupSetId} groupId={groupId} isInstructor={isInstructor} />
          )}
          {isAnnouncements && groupSetId && courseId && (
            <GroupAnnouncements groupSetId={groupSetId} courseId={courseId} />
          )}
          {/* Other tab content (home, discussion, people) */}
          {(isHome || isDiscussion || isPeople) && <Outlet context={{ groupSetId }} />}
        </div>
      </main>
    </div>
  );
} 