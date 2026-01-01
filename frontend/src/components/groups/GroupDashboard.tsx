import React, { useEffect, useState } from 'react';
import { useParams, NavLink, useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Home, FileText, MessageSquare, ClipboardList, Megaphone, Users, ChevronDown, BookOpen, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import { AssignmentCard } from '../CourseDetail';
import GroupPages from './GroupPages';
import GroupAnnouncements from './GroupAnnouncements';

const tabs = [
  { name: 'Home', path: 'home', icon: Home },
  { name: 'Pages', path: 'pages', icon: FileText },
  { name: 'Discussion', path: 'discussion', icon: MessageSquare },
  { name: 'Assignments', path: 'assignments', icon: ClipboardList },
  { name: 'Announcements', path: 'announcements', icon: Megaphone },
  { name: 'People', path: 'people', icon: Users },
];

export default function GroupDashboard() {
  const { groupId } = useParams();
  const location = useLocation();
  const [groupName, setGroupName] = useState('Group');
  const [groupSetName, setGroupSetName] = useState('Group Set');
  const [groupSetId, setGroupSetId] = useState('');
  const [groupsInSet, setGroupsInSet] = useState<{ _id: string; name: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [courseId, setCourseId] = useState('');

  // Add user role detection (assume user is stored in localStorage)
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isInstructor = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  
  // Detect mobile device
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Top Navigation */}
      {isMobileDevice && (
        <nav className="fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="relative flex items-center justify-between px-4 py-3">
            {/* Group Dropdown */}
            <div className="relative flex-1 max-w-[60%]">
              <button
                onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                className="flex items-center justify-between w-full px-3 py-2 text-left bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors touch-manipulation"
                aria-label="Select group"
              >
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {groupSetName} / {groupName}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Group Dropdown Menu */}
              {showGroupDropdown && (
                <>
                  <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
                    onClick={() => setShowGroupDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-h-[60vh] overflow-y-auto z-[152]">
                    {groupsInSet && groupsInSet.length > 0 ? (
                      groupsInSet.map((g) => (
                        <button
                          key={g._id}
                          onClick={() => {
                            setShowGroupDropdown(false);
                            navigate(`/groups/${g._id}`);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                            g._id === groupId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="font-medium">{groupSetName} / {g.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No groups available</div>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-blue-600 dark:text-blue-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              aria-label="Toggle group menu"
            >
              <BookOpen className="w-6 h-6" />
            </button>
          </div>
        </nav>
      )}

      <div className={`max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 flex flex-col gap-4 px-4 sm:px-6 ${isMobileDevice ? 'pt-16' : ''}`}>
        {/* Simple Breadcrumb - Desktop Only */}
        {!isMobileDevice && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 px-1">
            <Link to="/groups" className="hover:underline text-gray-700 dark:text-gray-300 font-medium">Group Management</Link>
            <span className="mx-1 text-gray-300 dark:text-gray-600">&gt;</span>
            <span className="text-gray-700 dark:text-gray-300 font-semibold truncate">{groupName}</span>
          </div>
        )}
        
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Mobile Overlay */}
          {isMobileMenuOpen && isMobileDevice && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-[90]"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{ touchAction: 'none', pointerEvents: 'auto' }}
            />
          )}

          {/* Sidebar */}
          <aside 
            className={`${isMobileDevice 
              ? 'w-full fixed left-0 top-20 bottom-16 z-[95]' 
              : 'w-64 relative self-start sticky top-4 z-auto'
            } transition-transform duration-300 ease-in-out ${
              isMobileMenuOpen && isMobileDevice ? 'translate-x-0' : isMobileDevice ? '-translate-x-full' : 'translate-x-0'
            } bg-transparent`}
            style={{ 
              height: isMobileDevice ? 'calc(100vh - 80px - 64px)' : undefined
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <nav 
              className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur ${isMobileDevice ? 'rounded-t-2xl' : 'rounded-2xl'} shadow-lg p-4 sm:p-6 flex flex-col gap-1 border border-gray-100 dark:border-gray-700 ${isMobileDevice ? '' : 'h-auto pb-4'}`} 
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
              
              {/* Dropdown header - Desktop Only */}
              {!isMobileDevice && (
                <div className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-3 relative">
                  {(isInstructor || isAdmin) ? (
                    <button
                      className="w-full flex items-center justify-between font-bold text-xl text-left focus:outline-none text-gray-900 dark:text-gray-100"
                      onClick={() => setDropdownOpen((open) => !open)}
                    >
                      <span>{groupSetName} / {groupName}</span>
                      <ChevronDown className={`h-5 w-5 ml-2 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <div className="font-bold text-xl text-gray-900 dark:text-gray-100">{groupSetName} / {groupName}</div>
                  )}
                  {dropdownOpen && (isInstructor || isAdmin) && (
                    <div className="absolute left-0 right-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow mt-2 max-h-60 overflow-y-auto">
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
              )}
              
              <div 
                className={`flex-1 min-h-0 ${isMobileDevice ? 'overflow-y-auto' : 'overflow-visible'}`}
                style={{
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-y',
                  overscrollBehavior: 'contain'
                }}
              >
                <nav className="flex flex-col gap-1">
                  {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <NavLink
                        key={tab.path}
                        to={`/groups/${groupId}/${tab.path}`}
                        className={({ isActive }) =>
                          isActive
                            ? 'flex items-center gap-3 font-semibold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 rounded-lg px-4 py-2 shadow'
                            : 'flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg px-4 py-2 transition-colors'
                        }
                        onClick={() => setIsMobileMenuOpen(false)}
                        end
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-base">{tab.name}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            </nav>
          </aside>
        {/* Main Content */}
        <main className={`flex-1 min-w-0 ${isMobileMenuOpen ? 'lg:overflow-auto overflow-hidden' : ''}`}>
          {/* Only show one section at a time based on current path */}
          {isAssignments && (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
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
                      navigate={navigate}
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
          {(isHome || isDiscussion || isPeople) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <Outlet context={{ groupSetId, setIsMobileMenuOpen, isMobileMenuOpen }} />
            </div>
          )}
        </main>
      </div>
    </div>
    </div>
  );
} 