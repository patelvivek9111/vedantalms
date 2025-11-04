import React, { useEffect, useState } from 'react';
import { useParams, NavLink, useNavigate, Outlet, Link } from 'react-router-dom';
import { Home, FileText, MessageSquare, ClipboardList, Megaphone, Users, ChevronDown } from 'lucide-react';
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
  const [groupName, setGroupName] = useState('Group');
  const [groupSetName, setGroupSetName] = useState('Group Set');
  const [groupSetId, setGroupSetId] = useState('');
  const [groupsInSet, setGroupsInSet] = useState<{ _id: string; name: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [courseId, setCourseId] = useState('');

  // Add user role detection (assume user is stored in localStorage)
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isInstructor = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

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
    <div className="max-w-6xl mx-auto py-8 flex flex-col gap-4">
      {/* Simple Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 px-1">
        <Link to="/groups" className="hover:underline text-gray-700 font-medium">Group Management</Link>
        <span className="mx-1 text-gray-300">&gt;</span>
        <span className="text-gray-700 font-semibold">{groupName}</span>
      </div>
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 bg-white/80 backdrop-blur rounded-2xl shadow-lg p-6 h-fit relative border border-gray-100 mt-2">
          {/* Dropdown header */}
          <div className="mb-8 border-b pb-3 relative">
            {(isInstructor || isAdmin) ? (
              <button
                className="w-full flex items-center justify-between font-bold text-xl text-left focus:outline-none text-gray-900"
                onClick={() => setDropdownOpen((open) => !open)}
              >
                <span>{groupSetName} / {groupName}</span>
                <ChevronDown className={`h-5 w-5 ml-2 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <div className="font-bold text-xl text-gray-900">{groupSetName} / {groupName}</div>
            )}
            {dropdownOpen && (isInstructor || isAdmin) && (
              <div className="absolute left-0 right-0 z-10 bg-white border rounded shadow mt-2 max-h-60 overflow-y-auto">
                {groupsInSet.map((g) => (
                  <div
                    key={g._id}
                    className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${g._id === groupId ? 'bg-blue-100 font-semibold' : ''}`}
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
          <nav className="flex flex-col gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={({ isActive }) =>
                    isActive
                      ? 'flex items-center gap-3 font-semibold text-blue-700 bg-blue-100 rounded-lg px-4 py-2 shadow'
                      : 'flex items-center gap-3 text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg px-4 py-2 transition-colors'
                  }
                  end
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-base">{tab.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Assignments Tab Content */}
          {window.location.pathname.includes('/assignments') && (
            <div className="p-4">
              <h3 className="text-xl font-semibold mb-4">Group Assignments</h3>
              {assignmentsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="flex flex-col items-center">
                    <ClipboardList className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
                    <p className="text-sm text-gray-500">There are no assignments for this group set yet.</p>
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
          {/* Pages Tab Content */}
          {window.location.pathname.includes('/pages') && groupId && (
            <GroupPages groupSetId={groupSetId} groupId={groupId} isInstructor={isInstructor} />
          )}
          {/* Announcements Tab Content */}
          {window.location.pathname.includes('/announcements') && groupSetId && courseId && (
            <GroupAnnouncements groupSetId={groupSetId} courseId={courseId} />
          )}
          {/* Other tab content */}
          <Outlet context={{ groupSetId }} />
        </main>
      </div>
    </div>
  );
} 