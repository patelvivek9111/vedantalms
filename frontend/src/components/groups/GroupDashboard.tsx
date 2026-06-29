import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Home, FileText, MessageSquare, ClipboardList, Megaphone, Users } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import { AssignmentCard } from '../course/CourseDetail';
import GroupPages from './GroupPages';
import GroupAnnouncements from './GroupAnnouncements';
import Breadcrumb from '../common/Breadcrumb';
import GroupSidebar from './GroupSidebar';
import GroupMobileNavigation from './GroupMobileNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { useCourseShellMobile } from '../../hooks/useCourseShellMobile';

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
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobileDevice = useCourseShellMobile();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [course, setCourse] = useState<any>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [threadTitle, setThreadTitle] = useState('');

  const isInstructor = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  const currentPath = location.pathname;
  const pathSegments = currentPath.split('/').filter(Boolean);
  const groupIndex = pathSegments.findIndex((seg) => seg === groupId);
  const lastSegment =
    groupIndex >= 0 && groupIndex < pathSegments.length - 1
      ? pathSegments[groupIndex + 1]
      : pathSegments[pathSegments.length - 1];

  const isViewingPage = !!currentPath.match(/\/groups\/[^/]+\/pages\/[^/]+$/);
  const isViewingThread = !!currentPath.match(/\/groups\/[^/]+\/discussion\/[^/]+$/);
  const isPages = lastSegment === 'pages' && !isViewingPage;
  const isAssignments = lastSegment === 'assignments';
  const isAnnouncements = lastSegment === 'announcements';
  const isHome =
    lastSegment === 'home' || lastSegment === groupId || !lastSegment || groupIndex === pathSegments.length - 1;
  const isDiscussion = lastSegment === 'discussion' && !isViewingThread;
  const isPeople = lastSegment === 'people';
  const isMeetings = lastSegment === 'meetings';

  useEffect(() => {
    async function fetchGroup() {
      if (!groupId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroupName(res.data.name || 'Group');
        setGroupSetId(res.data.groupSet);
        setGroupSetName(res.data.groupSetName || 'Group Set');
        const fetchedCourseId = res.data.course?._id || res.data.course || '';
        setCourseId(fetchedCourseId);
        if (fetchedCourseId) {
          try {
            const courseRes = await axios.get(`${API_URL}/api/courses/${fetchedCourseId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (courseRes.data.success) setCourse(courseRes.data.data);
          } catch {
            /* optional */
          }
        }
      } catch {
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
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroupsInSet(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
      } catch {
        setGroupsInSet([]);
      }
    }
    fetchGroupsInSet();
  }, [groupSetId]);

  useEffect(() => {
    if (!groupSetId || groupSetId.length !== 24) {
      setAssignments([]);
      return;
    }
    const fetchGroupAssignments = async () => {
      setAssignmentsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/assignments/groupset/${groupSetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAssignments(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
      } catch {
        setAssignments([]);
      } finally {
        setAssignmentsLoading(false);
      }
    };
    fetchGroupAssignments();
  }, [groupSetId]);

  useEffect(() => {
    if (!isViewingPage || !groupId) return;
    const segments = location.pathname.split('/').filter(Boolean);
    const pageIdIndex = segments.findIndex((seg) => seg === 'pages');
    if (pageIdIndex < 0 || pageIdIndex >= segments.length - 1) return;
    const pageId = segments[pageIdIndex + 1];
    const token = localStorage.getItem('token');
    axios
      .get(`${API_URL}/api/pages/${pageId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) setPageTitle(res.data.data.title || 'Page');
      })
      .catch(() => setPageTitle('Page'));
  }, [isViewingPage, location.pathname, groupId]);

  useEffect(() => {
    if (!isViewingThread || !groupId) return;
    const segments = location.pathname.split('/').filter(Boolean);
    const threadIdIndex = segments.findIndex((seg) => seg === 'discussion');
    if (threadIdIndex < 0 || threadIdIndex >= segments.length - 1) return;
    const threadId = segments[threadIdIndex + 1];
    const token = localStorage.getItem('token');
    axios
      .get(`${API_URL}/api/threads/${threadId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.data.success) setThreadTitle(res.data.data.title || 'Thread');
      })
      .catch(() => setThreadTitle('Thread'));
  }, [isViewingThread, location.pathname, groupId]);

  const breadcrumbItems =
    course && courseId
      ? [
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Courses', path: '/courses' },
          {
            label: course.catalog?.courseCode || course.title || 'Course',
            path: `/courses/${courseId}`,
          },
          { label: 'Groups', path: `/courses/${courseId}/groups` },
          { label: groupSetName, path: `/courses/${courseId}/groups` },
          { label: groupName, path: `/groups/${groupId}/home` },
          ...(isViewingPage
            ? [
                { label: 'Pages', path: `/groups/${groupId}/pages` },
                { label: pageTitle || 'Page', path: location.pathname },
              ]
            : isViewingThread
              ? [
                  { label: 'Discussion', path: `/groups/${groupId}/discussion` },
                  { label: threadTitle || 'Thread', path: location.pathname },
                ]
              : lastSegment && lastSegment !== groupId && lastSegment !== 'home'
                ? [
                    {
                      label:
                        tabs.find((t) => t.path === lastSegment)?.name ||
                        lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1),
                      path: location.pathname,
                    },
                  ]
                : []),
        ]
      : [];

  const outletContext = { groupSetId, setIsMobileMenuOpen, isMobileMenuOpen };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <GroupMobileNavigation
        isMobileDevice={isMobileDevice}
        groupSetName={groupSetName}
        groupName={groupName}
        groupsInSet={groupsInSet}
        groupId={groupId || ''}
        showGroupDropdown={showGroupDropdown}
        setShowGroupDropdown={setShowGroupDropdown}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="sticky top-0 z-[35] mx-auto hidden w-full max-w-7xl bg-gray-50 px-4 pt-2 dark:bg-gray-900 lg:block">
        <div className="flex flex-col">
        <div className="pb-3">
          {breadcrumbItems.length > 0 && <Breadcrumb className="mb-0" items={breadcrumbItems} />}
        </div>
        <div className="h-px w-full shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />
        <div className="h-3 shrink-0" aria-hidden />
      </div>
      </div>

      <div className={`mx-auto flex w-full max-w-7xl ${isMobileDevice ? 'flex-col pt-16' : 'flex-row pt-0'}`}>
        {isMobileMenuOpen && isMobileDevice && (
          <div
            className="fixed inset-0 z-[90] bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ touchAction: 'none', pointerEvents: 'auto' }}
          />
        )}

        <GroupSidebar
          isMobileDevice={isMobileDevice}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          groupId={groupId || ''}
          groupSetName={groupSetName}
          groupName={groupName}
          groupsInSet={groupsInSet}
          tabs={tabs}
          canSwitchGroup={isInstructor || isAdmin}
        />

        <div className={`w-full flex-1 overflow-visible lg:overflow-auto ${isMobileMenuOpen ? 'overflow-hidden lg:overflow-auto' : ''}`}>
          <div className={`container mx-auto pb-6 ${isViewingThread ? 'px-0 pt-0' : 'px-4 pt-2'} lg:pt-3`}>
            {isAssignments && (
              <div className="space-y-3 sm:space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
                    Group Assignments
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Assignments for this group set
                  </p>
                </div>
                {assignmentsLoading ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading assignments...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center dark:border-slate-600 dark:bg-slate-800/50">
                    <ClipboardList className="mx-auto mb-4 h-10 w-10 text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No assignments yet</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      There are no assignments for this group set yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {assignments.map((assignment) => (
                      <AssignmentCard
                        key={assignment._id}
                        assignment={{
                          ...assignment,
                          moduleTitle: groupSetName || 'Group assignment',
                        }}
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
            {(isViewingPage || isViewingThread || isHome || isDiscussion || isPeople || isMeetings) && (
              <Outlet context={outletContext} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
