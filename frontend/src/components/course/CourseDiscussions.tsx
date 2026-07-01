import React, { useState, useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../../utils/authToken';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { API_URL } from '../../config';
import { formatDistanceToNow } from 'date-fns';
import CreateThreadModal from '../threads/CreateThreadModal';
import axios from 'axios';
import { deriveDiscussionWorkflowState } from '../../utils/discussionWorkflowStatus';
import { resolveDiscussionStatus, type DiscussionStatus } from '../../utils/discussionStatus';
import { Pin, MessageCircle, Clock } from 'lucide-react';
import { SectionDividerHeading } from '../common/SectionDividerHeading';
import { sortItemsByDueDateDesc, buildStudentDueGroups } from '../../utils/courseworkSort';

interface Thread {
  _id: string;
  title: string;
  content: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  lastActivity: string;
  isPinned: boolean;
  isGraded: boolean;
  totalPoints: number;
  group: string;
  dueDate: string | null;
  published?: boolean;
  locked?: boolean;
  lockAfterDue?: boolean;
  availableFrom?: string | null;
  discussionReleaseMode?: 'immediate' | 'manual' | 'hidden';
  gradesReleasedAt?: string | null;
  gradeHidden?: boolean;
  workflowState?: ReturnType<typeof deriveDiscussionWorkflowState>;
  discussionStatus?: DiscussionStatus;
  unreadCount?: number;
  hasPosted?: boolean;
  hasInstructorReply?: boolean;
  lastViewedAt?: string | null;
  currentUserParticipation?: {
    unreadCount?: number;
    hasPosted?: boolean;
    hasInstructorReply?: boolean;
    lastViewedAt?: string | null;
  };
}

interface Module {
  _id: string;
  name: string;
  title: string;
  description?: string;
  courseId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface CourseDiscussionsProps {
  courseId: string;
  courseGroups?: { name: string; weight: number }[];
  /** Matches server-side staff who can see/manage course discussions (instructor, TA, admin, registrar/dept admin). */
  canManageCourseDiscussions?: boolean;
}

const CourseDiscussions: React.FC<CourseDiscussionsProps> = ({
  courseId,
  courseGroups = [],
  canManageCourseDiscussions = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const formatRoleLabel = (role: string) => {
    if (!role) return '';
    const normalized = role.replace(/_/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  };
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);

  const isStaffWithoutCourseAccess =
    (user?.role === 'teacher' || user?.role === 'teaching_assistant') && !canManageCourseDiscussions;

  useEffect(() => {
    const fetchThreads = async () => {
      if (!courseId) return;
      
      try {
        setLoading(true);
        const response = await api.get(`/threads/course/${courseId}`, {
          params: { _nocache: Date.now() },
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });
        
        if (response.data.success) {
          const list = response.data.data;
          setThreads(Array.isArray(list) ? list : []);
        } else {
          setError(response.data?.message || 'Failed to fetch discussion threads');
        }
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        const msg = ax.response?.data?.message;
        setError(msg ? `Failed to load discussion threads: ${msg}` : 'Failed to load discussion threads');
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, [courseId]);

  useEffect(() => {
    const fetchModules = async () => {
      if (!courseId) return;
      try {
        const token = getMemoryAuthToken();
        const res = await axios.get(`${API_URL}/api/modules/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Defensive: ensure modules is always an array
        let modulesArr: Module[] = [];
        if (res.data && Array.isArray(res.data.data)) {
          modulesArr = res.data.data.map((module: any) => ({
            ...module,
            title: module.title // API returns 'title', not 'name'
          }));
        } else if (Array.isArray(res.data)) {
          modulesArr = res.data.map((module: any) => ({
            ...module,
            title: module.title // API returns 'title', not 'name'
          }));
        }
        setModules(modulesArr);
      } catch (err) {
        setModules([]);
      }
    };
    fetchModules();
  }, [courseId]);

  const handleCreateThread = () => {
    setIsCreateModalOpen(true);
  };

  const handleThreadCreated = (newThread: Thread) => {
    setThreads(prevThreads => [newThread, ...prevThreads]);
  };

  const handleThreadClick = (threadId: string) => {
    navigate(`/courses/${courseId}/threads/${threadId}`);
  };

  const renderWorkflowBadges = (thread: Thread) => {
    const state = deriveDiscussionWorkflowState(thread);
    const status = resolveDiscussionStatus(thread);
    const unreadCount = thread.unreadCount ?? thread.currentUserParticipation?.unreadCount ?? 0;
    const hasPosted = thread.hasPosted ?? thread.currentUserParticipation?.hasPosted ?? false;
    const hasInstructorReply = thread.hasInstructorReply ?? thread.currentUserParticipation?.hasInstructorReply ?? false;
    return (
      <>
        {unreadCount > 0 && (
          <span
            className="inline-flex items-center rounded-md border border-sky-200/90 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 shadow-sm dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200"
            aria-label={`${unreadCount} unread replies`}
          >
            {unreadCount} unread
          </span>
        )}
        {user?.role === 'student' && !hasPosted && (
          <span className="inline-flex items-center rounded-md border border-orange-200/90 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-900 shadow-sm dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-200">
            Not posted
          </span>
        )}
        {hasInstructorReply && (
          <span className="inline-flex items-center rounded-md border border-violet-200/90 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-900 shadow-sm dark:border-violet-800/50 dark:bg-violet-950/35 dark:text-violet-200">
            Instructor replied
          </span>
        )}
        {state.locked && (
          <span className="inline-flex items-center rounded-md border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
            Locked
          </span>
        )}
        {status === 'unpublished' && (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            Unpublished
          </span>
        )}
        {thread.isGraded && !state.released && user?.role === 'student' && (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            Grade hidden
          </span>
        )}
      </>
    );
  };

  const renderThreadCard = (thread: Thread, pinned: boolean) => {
    return (
      <button
        type="button"
        key={thread._id}
        onClick={() => handleThreadClick(thread._id)}
        className={`group relative w-full border-b border-slate-200/80 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/80 dark:border-slate-800 dark:hover:bg-slate-800/40 sm:px-5 sm:py-5 ${
          pinned ? 'border-l-[3px] border-l-blue-600 bg-blue-50/30 dark:border-l-blue-500 dark:bg-blue-950/20' : ''
        }`}
        aria-label={`Open ${pinned ? 'pinned ' : ''}discussion ${thread.title}`}
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 space-y-3">
            <div className="flex items-start gap-2">
              {pinned && (
                <span className="mt-1 shrink-0 text-blue-600 dark:text-blue-400" title="Pinned thread" aria-hidden>
                  <Pin className="h-4 w-4" strokeWidth={2.25} />
                </span>
              )}
              <h3 className="min-w-0 flex-1 text-[1.05rem] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50 sm:text-lg">
                {thread.title}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">{renderWorkflowBadges(thread)}</div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="text-slate-500 dark:text-slate-500">Posted by</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {thread.author.firstName} {thread.author.lastName}
                </span>
                <span className="inline-flex items-center rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
                  {formatRoleLabel(thread.author.role)}
                </span>
              </span>
              {thread.dueDate && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300/95">
                  <Clock className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/[0.03] dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300 dark:ring-white/5">
              <MessageCircle className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
            </span>
            {thread.isGraded && (
              <span className="inline-flex w-max max-w-full items-center justify-center rounded-md border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold leading-tight text-emerald-900 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                Graded ({thread.totalPoints} pts)
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-center p-4">
        {error}
      </div>
    );
  }

  const isStudentViewer = user?.role === 'student';
  const pinnedThreads = sortItemsByDueDateDesc(threads.filter((thread) => thread.isPinned));
  const regularThreads = threads.filter((thread) => !thread.isPinned);
  const threadIsSubmitted = (thread: Thread) =>
    Boolean(thread.hasPosted ?? thread.currentUserParticipation?.hasPosted);
  // Sort/group non-pinned threads exactly like the assignment list:
  //  - teachers/staff: a single list ordered by due date (latest first, undated last)
  //  - students: Overdue / Upcoming / Undated / Past sections
  const regularThreadSections: { key: string; label: string; items: Thread[] }[] = isStudentViewer
    ? buildStudentDueGroups(regularThreads, {
        isSubmitted: threadIsSubmitted,
        itemNoun: 'Threads',
      })
    : regularThreads.length > 0
      ? [{ key: 'threads', label: 'Threads', items: sortItemsByDueDateDesc(regularThreads) }]
      : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {canManageCourseDiscussions && isCreateModalOpen ? (
        <CreateThreadModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          courseId={courseId}
          onThreadCreated={handleThreadCreated}
          courseGroups={courseGroups}
          modules={modules}
        />
      ) : (
        <div className="space-y-6">
          {canManageCourseDiscussions && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create and manage discussion threads for this course
              </p>
              <button
                type="button"
                onClick={handleCreateThread}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
              >
                + Create New Thread
              </button>
            </div>
          )}

          {threads.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {isStaffWithoutCourseAccess ? 'Discussions are restricted' : 'No discussion threads'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isStaffWithoutCourseAccess
                ? 'Only the course instructor, teaching assistants, and enrolled students can see discussion threads. You can open this course, but you are not listed as staff or a student on it.'
                : canManageCourseDiscussions
                  ? 'Get started by creating a new discussion thread.'
                  : 'There are no discussion threads yet. Teachers will create threads here.'}
            </p>
            {canManageCourseDiscussions && (
              <div className="mt-6">
                <button
                  onClick={handleCreateThread}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Thread
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {pinnedThreads.length > 0 && (
              <section aria-labelledby="pinned-discussions-heading">
                <SectionDividerHeading id="pinned-discussions-heading">Pinned threads</SectionDividerHeading>
                <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/60">
                  {pinnedThreads.map((thread) => renderThreadCard(thread, true))}
                </div>
              </section>
            )}

            {regularThreadSections.map((section) => (
              <section key={section.key} aria-label={section.label}>
                <SectionDividerHeading id={`threads-heading-${section.key}`}>{section.label}</SectionDividerHeading>
                <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-700/60">
                  {section.items.map((thread) => renderThreadCard(thread, false))}
                </div>
              </section>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseDiscussions; 