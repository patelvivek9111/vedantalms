import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, MessageSquare, FileText, ClipboardList, Megaphone, Clock, CheckCircle, Settings, UserPlus } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import ProfileImage from '../common/ProfileImage';

interface GroupInfo {
  _id: string;
  name: string;
  groupSet: {
    _id: string;
    name: string;
    course: { _id: string; name: string };
  };
  members: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  }>;
}

interface UpcomingTask {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
}

const metricCardClassName =
  'rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80';
const quickActionClassName =
  'min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:px-4 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
const primaryActionClassName =
  'min-h-[44px] rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 sm:px-4 sm:text-sm';

const GroupHome: React.FC = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      try {
        const token = localStorage.getItem('token');
        const groupResponse = await axios.get(`${API_URL}/api/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const group = groupResponse.data;

        let members: GroupInfo['members'] = [];
        try {
          const membersResponse = await axios.get(`${API_URL}/api/groups/${groupId}/members`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const membersData = membersResponse.data?.data || membersResponse.data;
          members = Array.isArray(membersData) ? membersData : [];
        } catch {
          members = [];
        }

        let courseName = 'Course';
        try {
          const courseResponse = await axios.get(`${API_URL}/api/courses/${group.course}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          courseName = courseResponse.data?.data?.title || courseResponse.data?.title || 'Course';
        } catch {
          /* default */
        }

        setGroupInfo({
          _id: group._id,
          name: group.name,
          groupSet: {
            _id: group.groupSet,
            name: group.groupSetName,
            course: { _id: group.course, name: courseName },
          },
          members,
        });

        try {
          const assignmentsResponse = await axios.get(
            `${API_URL}/api/assignments/groupset/${group.groupSet}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const assignments = Array.isArray(assignmentsResponse.data)
            ? assignmentsResponse.data
            : assignmentsResponse.data?.data ?? [];
          const now = new Date();
          const upcoming = assignments
            .filter((a: { dueDate?: string }) => a.dueDate && new Date(a.dueDate) > now)
            .map((a: { _id: string; title: string; dueDate: string }) => ({
              id: a._id,
              title: a.title,
              dueDate: a.dueDate,
              priority: getPriority(a.dueDate),
            }));
          setUpcomingTasks(upcoming);
        } catch {
          setUpcomingTasks([]);
        }
      } catch {
        setGroupInfo(null);
        setUpcomingTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGroupInfo();
  }, [groupId]);

  const getPriority = (dueDate: string): 'high' | 'medium' | 'low' => {
    const daysUntilDue = Math.ceil(
      (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue <= 3) return 'high';
    if (daysUntilDue <= 7) return 'medium';
    return 'low';
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-6">
        <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  if (!groupInfo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-400">Group not found</p>
      </div>
    );
  }

  const memberCount = groupInfo.members.length;
  const leadersCount = memberCount > 0 ? 1 : 0;

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="mb-3 flex flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-6 md:flex-row md:items-center dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <h1 className="mb-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            {groupInfo.name}
          </h1>
          <div className="text-xs text-slate-600 sm:text-sm dark:text-slate-300">
            {groupInfo.groupSet.course.name} · {groupInfo.groupSet.name}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className={metricCardClassName}>
          <div className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Members
          </div>
          <div className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{memberCount}</div>
        </div>
        <div className={metricCardClassName}>
          <div className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Upcoming
          </div>
          <div className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {upcomingTasks.length}
          </div>
        </div>
        <div className={metricCardClassName}>
          <div className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Leaders
          </div>
          <div className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{leadersCount}</div>
        </div>
      </div>

      {isTeacher && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
            Quick Actions
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <button
              type="button"
              className={primaryActionClassName}
              onClick={() => navigate(`/groups/${groupId}/assignments`)}
            >
              View Assignments
            </button>
            <button
              type="button"
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => navigate(`/groups/${groupId}/discussion`)}
            >
              <MessageSquare className="h-4 w-4" />
              Discussion
            </button>
            <button
              type="button"
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => navigate(`/groups/${groupId}/pages`)}
            >
              <FileText className="h-4 w-4" />
              Pages
            </button>
            <button
              type="button"
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => navigate(`/groups/${groupId}/people`)}
            >
              <UserPlus className="h-4 w-4" />
              Manage Members
            </button>
            <button
              type="button"
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => navigate(`/groups/${groupId}/announcements`)}
            >
              <Megaphone className="h-4 w-4" />
              Announcements
            </button>
            <button
              type="button"
              className={`${quickActionClassName} flex items-center justify-center gap-2`}
              onClick={() => navigate(`/groups/${groupId}/people`)}
            >
              <Settings className="h-4 w-4" />
              Group Settings
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
              <Users className="h-5 w-5 text-slate-500" />
              Group Members
            </h2>
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}/people`)}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View all
            </button>
          </div>
          <div className="space-y-2">
            {groupInfo.members.length > 0 ? (
              groupInfo.members.slice(0, 4).map((member, index) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => navigate(`/groups/${groupId}/people`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
                >
                  <ProfileImage
                    firstName={member.firstName}
                    lastName={member.lastName}
                    profilePicture={member.profilePicture}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      index === 0
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {index === 0 ? 'Leader' : 'Member'}
                  </span>
                </button>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No members yet</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              Upcoming Tasks
            </h2>
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}/assignments`)}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View all
            </button>
          </div>
          {upcomingTasks.length > 0 ? (
            <div className="space-y-2">
              {upcomingTasks.slice(0, 4).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/groups/${groupId}/assignments`)}
                  className="flex w-full items-start justify-between gap-2 rounded-lg border border-slate-100 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" />
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      task.priority === 'high'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                        : task.priority === 'medium'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    }`}
                  >
                    {task.priority}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-medium text-slate-900 dark:text-slate-100">All caught up!</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                No upcoming assignments or discussions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupHome;
