import React, { useState, useEffect, useMemo } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../../utils/authToken';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { format } from 'date-fns';
import ConfirmationModal from '../common/ConfirmationModal';
import PullToRefresh from '../common/PullToRefresh';
import { FilePenLine, MessageSquare, Rocket, ChevronDown, ChevronRight, Search, CalendarDays, Layers } from 'lucide-react';
import { FORM_INPUT, FORM_SELECT } from '../common/formStyles';
import {
  discussionGradeToGradebookValue,
  submissionToGradebookValue,
} from '../../utils/instructorGradebookGrades';
interface Attachment {
  _id: string;
  filename: string;
  path: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  attachments: Attachment[];
  createdBy: User;
}

interface AssignmentListProps {
  moduleId?: string;
  assignments?: Assignment[];
  userRole?: string;
  studentSubmissions?: any[];
  studentId?: string;
  submissionMap?: { [key: string]: string };
  courseId?: string;
  isQuizzesView?: boolean;
}


type ListViewMode = 'date' | 'type';

/** Single chronological list: earliest due first; items without a due date last. */
function sortItemsByDueDateAsc<T extends { dueDate?: string | null; title?: string; _id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = a.dueDate ? new Date(a.dueDate).getTime() : NaN;
    const bt = b.dueDate ? new Date(b.dueDate).getTime() : NaN;
    const hasA = !Number.isNaN(at);
    const hasB = !Number.isNaN(bt);
    if (hasA && hasB) {
      const byDate = at - bt;
      if (byDate !== 0) return byDate;
    } else if (hasA && !hasB) {
      return -1;
    } else if (!hasA && hasB) {
      return 1;
    }
    const byTitle = (a.title || '').localeCompare(b.title || '');
    if (byTitle !== 0) return byTitle;
    return (a._id || '').localeCompare(b._id || '');
  });
}

/** Single chronological list: latest due first, then earlier dates; items without a due date last. */
function sortItemsByDueDateDesc<T extends { dueDate?: string | null; title?: string; _id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = a.dueDate ? new Date(a.dueDate).getTime() : NaN;
    const bt = b.dueDate ? new Date(b.dueDate).getTime() : NaN;
    const hasA = !Number.isNaN(at);
    const hasB = !Number.isNaN(bt);
    if (hasA && hasB) {
      const byDate = bt - at;
      if (byDate !== 0) return byDate;
    } else if (hasA && !hasB) {
      return -1;
    } else if (!hasA && hasB) {
      return 1;
    }
    const byTitle = (a.title || '').localeCompare(b.title || '');
    if (byTitle !== 0) return byTitle;
    return (a._id || '').localeCompare(b._id || '');
  });
}

function isQuizItem(item: { isGradedQuiz?: boolean; group?: string }): boolean {
  if (item.isGradedQuiz === true) return true;
  const group = (item.group || '').trim().toLowerCase();
  return group === 'quizzes' || group.includes('quiz');
}

/** Canvas-style due line, e.g. "Apr 2 at 11:59pm" */
function formatCanvasDue(d: Date): string {
  return format(d, "MMM d 'at' h:mmaaa");
}

function getEarnedScoreForItem(item: any, submission: any | undefined, studentId?: string): number | null {
  if (!studentId) return null;
  if (item.type === 'discussion') {
    const grades = item.studentGrades;
    if (!Array.isArray(grades)) return null;
    const row = grades.find((g: any) => String(g.student?._id || g.student) === String(studentId));
    return typeof row?.grade === 'number' ? row.grade : null;
  }
  if (!submission) return null;
  if (submission.useIndividualGrades && Array.isArray(submission.memberGrades)) {
    const mg = submission.memberGrades.find(
      (m: any) => String(m.student?._id || m.student) === String(studentId)
    );
    if (mg && typeof mg.grade === 'number') return mg.grade;
  }
  if (typeof submission.grade === 'number') return submission.grade;
  return null;
}

function formatEarnedPointsValue(earned: number): string {
  const value = Number(earned);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}

function renderStudentPointsDisplay(earned: number | null, totalPoints: number): React.ReactNode {
  const total = Math.max(0, Math.round(Number(totalPoints) || 0));
  if (total <= 0) return null;

  const hasGrade = earned !== null && !Number.isNaN(Number(earned));
  const earnedDisplay = hasGrade ? formatEarnedPointsValue(Number(earned)) : '—';
  const isPerfect = hasGrade && Number(earned) >= total;

  return (
    <span
      className="inline-flex items-baseline gap-px whitespace-nowrap rounded-md bg-slate-100/90 px-1.5 py-0.5 tabular-nums dark:bg-slate-800/80"
      aria-label={
        hasGrade
          ? `${earnedDisplay} out of ${total} points`
          : `Not graded yet, ${total} points possible`
      }
    >
      <span
        className={
          hasGrade
            ? isPerfect
              ? 'text-sm font-semibold text-emerald-700 dark:text-emerald-400'
              : 'text-sm font-semibold text-slate-900 dark:text-slate-100'
            : 'text-sm font-medium text-slate-400 dark:text-slate-500'
        }
      >
        {earnedDisplay}
      </span>
      <span className="text-sm text-slate-400 dark:text-slate-500">/</span>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{total}</span>
      <span className="ml-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        pts
      </span>
    </span>
  );
}

/** Canvas-style subline: "Due … | n/m pts" (points only for students). */
function buildAssignmentMetaParts(opts: {
  dueOk: boolean;
  dueDate: Date | null;
  showPoints: boolean;
  pointsSegment: string;
}): string[] {
  const parts: string[] = [];
  if (opts.dueOk && opts.dueDate) {
    parts.push(`Due ${formatCanvasDue(opts.dueDate)}`);
  }
  if (parts.length === 0) {
    parts.push('No due date');
  }
  if (opts.showPoints) {
    parts.push(opts.pointsSegment);
  }
  return parts;
}

function filterListBySearch(list: any[], query: string): any[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(item => (item.title || '').toLowerCase().includes(q));
}

function buildTeacherTypeGroups(
  items: any[],
  isQuizzesView: boolean
): { key: string; label: string; items: any[] }[] {
  const quizzes = items.filter(item => item.type === 'assignment' && isQuizItem(item));
  const assignments = items.filter(item => item.type === 'assignment' && !isQuizItem(item));
  const discussions = items.filter(item => item.type === 'discussion');

  const groups: { key: string; label: string; items: any[] }[] = [];

  if (isQuizzesView) {
    if (quizzes.length > 0) {
      groups.push({ key: 'quizzes', label: 'Quizzes', items: sortItemsByDueDateDesc(quizzes) });
    }
  } else {
    if (assignments.length > 0) {
      groups.push({ key: 'assignments', label: 'Assignments', items: sortItemsByDueDateDesc(assignments) });
    }
    if (discussions.length > 0) {
      groups.push({ key: 'discussions', label: 'Discussions', items: sortItemsByDueDateDesc(discussions) });
    }
    if (quizzes.length > 0) {
      groups.push({ key: 'quizzes', label: 'Quizzes', items: sortItemsByDueDateDesc(quizzes) });
    }
  }

  return groups.length > 0 ? groups : [{ key: 'all', label: '', items }];
}

function sortItemsByTitle<T extends { title?: string; _id?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byTitle = (a.title || '').localeCompare(b.title || '');
    if (byTitle !== 0) return byTitle;
    return (a._id || '').localeCompare(b._id || '');
  });
}

const STUDENT_DUE_SECTIONS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'undated', label: 'Undated' },
  { key: 'past', label: 'Past' },
] as const;

type StudentDueCategory = (typeof STUDENT_DUE_SECTIONS)[number]['key'];

function hasStudentSubmittedItem(
  item: any,
  studentId: string | undefined,
  submissionMap: Record<string, string> | undefined,
  submissionByAssignmentId: Map<string, any>
): boolean {
  if (!studentId) return false;

  if (item.type === 'discussion') {
    if (item.hasSubmitted || item.hasPosted) return true;
    if (Array.isArray(item.replies)) {
      const posted = item.replies.some(
        (reply: any) =>
          reply.author &&
          (String(reply.author._id || reply.author) === String(studentId))
      );
      if (posted) return true;
    }
    if (Array.isArray(item.studentGrades)) {
      return item.studentGrades.some(
        (row: any) =>
          row.student &&
          (String(row.student._id || row.student) === String(studentId))
      );
    }
    return false;
  }

  const submission = submissionByAssignmentId.get(String(item._id));
  if (submission) {
    return Boolean(
      submission._id ||
        submission.submittedAt ||
        submission.attemptStatus === 'in_progress' ||
        submission.attemptStatus === 'submitted'
    );
  }

  return Boolean(submissionMap?.[`${String(studentId)}_${String(item._id)}`]);
}

function categorizeStudentListItem(
  item: any,
  opts: {
    studentId?: string;
    submissionMap?: Record<string, string>;
    submissionByAssignmentId: Map<string, any>;
    now?: Date;
  }
): StudentDueCategory {
  const now = opts.now ?? new Date();
  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
  const hasDue = Boolean(dueDate && !Number.isNaN(dueDate.getTime()));
  const submitted = hasStudentSubmittedItem(
    item,
    opts.studentId,
    opts.submissionMap,
    opts.submissionByAssignmentId
  );

  if (!hasDue) return 'undated';
  if (now > dueDate!) {
    return submitted ? 'past' : 'overdue';
  }
  return 'upcoming';
}

function buildStudentCanvasGroups(
  items: any[],
  opts: {
    studentId?: string;
    submissionMap?: Record<string, string>;
    submissionByAssignmentId: Map<string, any>;
    itemNoun: string;
    now?: Date;
  }
): { key: string; label: string; items: any[] }[] {
  const buckets: Record<StudentDueCategory, any[]> = {
    overdue: [],
    upcoming: [],
    undated: [],
    past: [],
  };

  for (const item of items) {
    if (item.published === false && item.type !== 'discussion') continue;
    const category = categorizeStudentListItem(item, opts);
    buckets[category].push(item);
  }

  return STUDENT_DUE_SECTIONS.map(({ key, label }) => {
    let sorted: any[];
    if (key === 'overdue' || key === 'upcoming') {
      sorted = sortItemsByDueDateAsc(buckets[key]);
    } else if (key === 'past') {
      sorted = sortItemsByDueDateDesc(buckets[key]);
    } else {
      sorted = sortItemsByTitle(buckets[key]);
    }
    return { key, label: `${label} ${opts.itemNoun}`, items: sorted };
  }).filter(group => group.items.length > 0);
}

function normalizeListItem(item: any) {
  return {
    _id: item._id,
    title: item.title,
    dueDate: item.dueDate || item.due_date || item.discussionDueDate || null,
    availableFrom: item.availableFrom ?? item.available_from ?? null,
    attachments: item.attachments || [],
    createdBy: item.createdBy || item.author || { firstName: '', lastName: '' },
    type: item.type === 'discussion' || item.group === 'Discussions' ? 'discussion' : 'assignment',
    group: item.group || 'Assignments',
    isGradedQuiz: Boolean(item.isGradedQuiz),
    totalPoints: item.totalPoints || item.points || 0,
    published: item.published !== undefined ? item.published : true,
    replies: item.replies || [],
    studentGrades: item.studentGrades || [],
    hasSubmitted: Boolean(item.hasSubmitted ?? item.hasPosted),
  };
}

function renderMetaPartContent(part: string, emphasizeWholePart = false): React.ReactNode {
  if (part.startsWith('Due ')) {
    return (
      <>
        <span className="font-semibold text-slate-800 dark:text-slate-200">Due</span>
        <span>{part.slice(3)}</span>
      </>
    );
  }
  if (emphasizeWholePart) {
    return <span className="font-semibold text-slate-800 dark:text-slate-200">{part}</span>;
  }
  return part;
}

function computeAveragePercentFromGradedOnly(grades: number[], totalPoints: number): number | null {
  const total = Math.max(0, Number(totalPoints) || 0);
  if (total <= 0 || grades.length === 0) return null;
  const avgPoints = grades.reduce((sum, g) => sum + g, 0) / grades.length;
  return Math.round((avgPoints / total) * 1000) / 10;
}

/** Class average: sum of points across enrolled students (missing/ungraded = 0) ÷ enrollment. */
function computeClassAveragePercent(
  pointsByStudentId: Map<string, number>,
  excusedStudentIds: Set<string>,
  enrolledStudentIds: string[],
  totalPoints: number
): number | null {
  const total = Math.max(0, Number(totalPoints) || 0);
  const eligibleStudentIds = enrolledStudentIds.filter(id => !excusedStudentIds.has(id));
  if (total <= 0 || eligibleStudentIds.length === 0) return null;

  const pointsSum = eligibleStudentIds.reduce(
    (sum, studentId) => sum + (pointsByStudentId.get(studentId) ?? 0),
    0
  );
  return Math.round((pointsSum / eligibleStudentIds.length / total) * 1000) / 10;
}

function computeAveragePercent(
  pointsByStudentId: Map<string, number>,
  excusedStudentIds: Set<string>,
  enrolledStudentIds: string[],
  totalPoints: number
): number | null {
  if (enrolledStudentIds.length > 0) {
    return computeClassAveragePercent(
      pointsByStudentId,
      excusedStudentIds,
      enrolledStudentIds,
      totalPoints
    );
  }
  const gradedPoints = [...pointsByStudentId.values()];
  return computeAveragePercentFromGradedOnly(gradedPoints, totalPoints);
}

function buildAssignmentGradeMap(submissions: any[]): {
  pointsByStudentId: Map<string, number>;
  excusedStudentIds: Set<string>;
} {
  const pointsByStudentId = new Map<string, number>();
  const excusedStudentIds = new Set<string>();

  for (const submission of submissions) {
    if (submission.group?.members?.length) {
      for (const member of submission.group.members) {
        const memberId = String(member._id || member);
        const value = submissionToGradebookValue(submission, memberId);
        if (value === 'excused') excusedStudentIds.add(memberId);
        else if (typeof value === 'number') pointsByStudentId.set(memberId, value);
      }
      continue;
    }

    if (!submission.student) continue;
    const studentId = String(submission.student._id || submission.student);
    const value = submissionToGradebookValue(submission);
    if (value === 'excused') excusedStudentIds.add(studentId);
    else if (typeof value === 'number') pointsByStudentId.set(studentId, value);
  }

  return { pointsByStudentId, excusedStudentIds };
}

function buildDiscussionGradeMap(item: {
  studentGrades?: Array<{ student?: any; grade?: number; excused?: boolean }>;
}): {
  pointsByStudentId: Map<string, number>;
  excusedStudentIds: Set<string>;
} {
  const pointsByStudentId = new Map<string, number>();
  const excusedStudentIds = new Set<string>();

  for (const row of item.studentGrades || []) {
    const studentId = String(row.student?._id || row.student || '');
    if (!studentId) continue;
    const value = discussionGradeToGradebookValue(row);
    if (value === 'excused') excusedStudentIds.add(studentId);
    else if (typeof value === 'number') pointsByStudentId.set(studentId, value);
  }

  return { pointsByStudentId, excusedStudentIds };
}

function computeDiscussionAveragePercent(
  item: {
    studentGrades?: Array<{ student?: any; grade?: number; excused?: boolean }>;
    totalPoints?: number;
  },
  enrolledStudentIds: string[]
): number | null {
  const { pointsByStudentId, excusedStudentIds } = buildDiscussionGradeMap(item);
  return computeAveragePercent(
    pointsByStudentId,
    excusedStudentIds,
    enrolledStudentIds,
    item.totalPoints || 0
  );
}

async function fetchDiscussionAveragePercent(
  threadId: string,
  totalPoints: number,
  enrolledStudentIds: string[],
  cachedItem?: { studentGrades?: Array<{ student?: any; grade?: number; excused?: boolean }> }
): Promise<number | null> {
  const total = Math.max(0, Number(totalPoints) || 0);
  if (total <= 0) return null;

  const cachedGrades = cachedItem?.studentGrades || [];
  if (cachedGrades.length > 0) {
    return computeDiscussionAveragePercent(
      { studentGrades: cachedGrades, totalPoints: total },
      enrolledStudentIds
    );
  }

  try {
    const res = await api.get(`/threads/${threadId}`, {
      params: { includeGrades: 'true', limit: 0 },
    });
    const thread = res.data?.data || res.data;
    return computeDiscussionAveragePercent(
      {
        studentGrades: thread?.studentGrades || [],
        totalPoints: thread?.totalPoints ?? total,
      },
      enrolledStudentIds
    );
  } catch {
    return null;
  }
}

async function fetchAllAssignmentSubmissions(assignmentId: string): Promise<any[]> {
  const submissions: any[] = [];
  let cursor: string | null = null;

  for (;;) {
    const params: { limit: number; cursor?: string } = { limit: 200 };
    if (cursor) params.cursor = cursor;

    const res = await api.get(`/submissions/assignment/${assignmentId}`, { params });
    const page = res.data?.data || res.data || [];
    if (!Array.isArray(page)) break;

    submissions.push(...page);
    if (!res.data?.hasMore || !res.data?.nextCursor) break;
    cursor = res.data.nextCursor;
  }

  return submissions;
}

async function fetchAssignmentAveragePercent(
  assignmentId: string,
  totalPoints: number,
  enrolledStudentIds: string[]
): Promise<number | null> {
  const total = Math.max(0, Number(totalPoints) || 0);
  if (total <= 0) return null;
  try {
    const submissions = await fetchAllAssignmentSubmissions(assignmentId);
    const { pointsByStudentId, excusedStudentIds } = buildAssignmentGradeMap(submissions);
    return computeAveragePercent(
      pointsByStudentId,
      excusedStudentIds,
      enrolledStudentIds,
      total
    );
  } catch {
    return null;
  }
}

function formatAveragePercentLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

const AssignmentList: React.FC<AssignmentListProps> = ({ moduleId, assignments: propAssignments, userRole, studentSubmissions, studentId, submissionMap, courseId, isQuizzesView = false }) => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('date');
  const [gradingPeriod, setGradingPeriod] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedStudentSections, setExpandedStudentSections] = useState<Record<string, boolean>>({
    overdue: true,
    upcoming: true,
    undated: true,
    past: true,
  });
  const [averagePercentById, setAveragePercentById] = useState<Record<string, number | null>>({});
  const [loadingAverages, setLoadingAverages] = useState(false);
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
  const [enrolledStudentsLoaded, setEnrolledStudentsLoaded] = useState(false);

  const isTeacherOrAdmin =
    userRole === 'teacher' || userRole === 'admin' || userRole === 'teaching_assistant';
  const isStudentViewer = userRole === 'student';
  const submissionByAssignmentId = useMemo(() => {
    const map = new Map<string, any>();
    (studentSubmissions || []).forEach((submission: any) => {
      const assignmentId = submission.assignment?._id || submission.assignment;
      if (assignmentId) map.set(String(assignmentId), submission);
    });
    return map;
  }, [studentSubmissions]);

  const handleRowClick = (item: any, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('a')) {
      return;
    }
    const buttonAncestor = target.closest('button');
    if (buttonAncestor && buttonAncestor !== event.currentTarget) {
      return;
    }
    
    // Navigate to assignment details first
    if (item.type === 'discussion') {
      if (courseId) {
        navigate(`/courses/${courseId}/threads/${item._id}`);
      } else {
        navigate(`/discussions/${item._id}/view`);
      }
    } else {
      // For assignments, go to details page with /view route
      navigate(`/assignments/${item._id}/view`);
    }
  };

  const fetchAssignments = async () => {
    if (propAssignments) {
      setLoading(false);
      return;
    }
    if (!moduleId) return;
    try {
      const token = getMemoryAuthToken();
      const response = await api.get(`/assignments/module/${moduleId}`);
      const assignmentsData = response.data?.data || response.data;
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      // Fetch graded discussions (threads)
      let threadsRes;
      try {
        threadsRes = await api.get(`/threads/module/${moduleId}`, { params: { includeGrades: 'true' } });
      } catch (e) {
        // fallback if /api/threads/module/:moduleId does not exist
        threadsRes = await api.get(`/threads`, { params: { module: moduleId, includeGrades: 'true' } });
      }
      // Only include graded discussions
      const gradedDiscussions = (threadsRes.data.data || threadsRes.data || []).filter((thread: any) => thread.isGraded);
      setDiscussions(gradedDiscussions);
      setLoading(false);
    } catch (err) {
      setError('Error fetching assignments');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [moduleId, propAssignments]);

  // Refresh function for pull-to-refresh
  const handleRefresh = async () => {
    await fetchAssignments();
  };

  const studentListItems = useMemo(() => {
    if (!isStudentViewer) return [];

    const assignmentsList = propAssignments
      ? (Array.isArray(propAssignments) ? propAssignments : [])
      : (Array.isArray(assignments) ? assignments : []);

    const mergedList = propAssignments
      ? assignmentsList.map(item => normalizeListItem(item))
      : [
          ...assignmentsList.map(item => normalizeListItem(item)),
          ...discussions.map(d =>
            normalizeListItem({
              ...d,
              type: 'discussion',
              group: d.group || 'Discussions',
              createdBy: d.author || { firstName: '', lastName: '' },
            })
          ),
        ];

    return mergedList.filter(item => item.published !== false || item.type === 'discussion');
  }, [isStudentViewer, propAssignments, assignments, discussions]);

  const studentCanvasGroups = useMemo(() => {
    if (!isStudentViewer) return [];
    const itemNoun = isQuizzesView ? 'Quizzes' : 'Assignments';
    return buildStudentCanvasGroups(studentListItems, {
      studentId,
      submissionMap,
      submissionByAssignmentId,
      itemNoun,
    });
  }, [
    isStudentViewer,
    studentListItems,
    studentId,
    submissionMap,
    submissionByAssignmentId,
    isQuizzesView,
  ]);

  useEffect(() => {
    if (!isTeacherOrAdmin || !courseId) {
      setEnrolledStudentIds([]);
      setEnrolledStudentsLoaded(true);
      return;
    }

    let cancelled = false;
    setEnrolledStudentsLoaded(false);

    const loadEnrolledStudents = async () => {
      try {
        const res = await api.get(`/courses/${courseId}/students`);
        const students = Array.isArray(res.data) ? res.data : res.data?.data || [];
        if (!cancelled) {
          setEnrolledStudentIds(
            students
              .map((student: { _id?: string }) => String(student._id || ''))
              .filter(Boolean)
          );
        }
      } catch {
        if (!cancelled) setEnrolledStudentIds([]);
      } finally {
        if (!cancelled) setEnrolledStudentsLoaded(true);
      }
    };

    loadEnrolledStudents();
    return () => {
      cancelled = true;
    };
  }, [isTeacherOrAdmin, courseId]);

  const assignmentsList = useMemo(
    () =>
      propAssignments
        ? (Array.isArray(propAssignments) ? propAssignments : [])
        : (Array.isArray(assignments) ? assignments : []),
    [propAssignments, assignments]
  );

  const flatList = useMemo(() => {
    const normalized = assignmentsList.map(item => normalizeListItem(item));
    const searched = filterListBySearch(normalized, searchQuery);
    return sortItemsByDueDateDesc(searched);
  }, [assignmentsList, searchQuery]);

  const flatListItemKey = useMemo(
    () => (isTeacherOrAdmin ? flatList.map(item => `${item._id}:${item.type}`).join('|') : ''),
    [isTeacherOrAdmin, flatList]
  );

  useEffect(() => {
    if (!isTeacherOrAdmin || flatList.length === 0) {
      setAveragePercentById({});
      setLoadingAverages(false);
      return;
    }

    if (courseId && !enrolledStudentsLoaded) {
      setLoadingAverages(true);
      return;
    }

    let cancelled = false;
    setLoadingAverages(true);

    const loadAverages = async () => {
      const results = await Promise.all(
        flatList.map(async item => {
          if (item.type === 'discussion') {
            const percent = await fetchDiscussionAveragePercent(
              item._id,
              item.totalPoints,
              enrolledStudentIds,
              item
            );
            return [item._id, percent] as const;
          }
          const percent = await fetchAssignmentAveragePercent(
            item._id,
            item.totalPoints,
            enrolledStudentIds
          );
          return [item._id, percent] as const;
        })
      );
      if (!cancelled) {
        setAveragePercentById(Object.fromEntries(results));
        setLoadingAverages(false);
      }
    };

    loadAverages();
    return () => {
      cancelled = true;
    };
  }, [isTeacherOrAdmin, flatListItemKey, enrolledStudentIds, courseId, enrolledStudentsLoaded]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  // Bulk action handlers
  const handleBulkPublish = async () => {
    if (selectedIds.length === 0) {
      toast.warn('Please select at least one item');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        try {
        const item = flatList.find(a => a._id === id);
        if (item?.type === 'discussion') {
          await api.patch(`/threads/${id}/publish`, { published: true });
        } else {
          await api.patch(`/assignments/${id}/publish`, { published: true });
          }
          successCount++;
        } catch (err) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        // Refresh the list
        if (moduleId) {
          const response = await api.get(`/assignments/module/${moduleId}`);
          const assignmentsData = response.data?.data || response.data;
          setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
          
          try {
            const threadsRes = await api.get(`/threads/module/${moduleId}`);
            const threadsData = threadsRes.data?.data || threadsRes.data;
            setDiscussions(Array.isArray(threadsData) ? threadsData : []);
          } catch (e) {
            try {
              const threadsRes = await api.get(`/threads?module=${moduleId}`);
              const threadsData = threadsRes.data?.data || threadsRes.data;
              setDiscussions(Array.isArray(threadsData) ? threadsData : []);
            } catch (e2) {
              // If both fail, just continue
            }
          }
        }
        toast.success(`Successfully published ${successCount} item${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to publish ${failCount} item${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedIds([]);
    } catch (err) {
      toast.error('Error during bulk publish operation');
    }
  };

  const handleBulkUnpublish = async () => {
    if (selectedIds.length === 0) {
      toast.warn('Please select at least one item');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        try {
        const item = flatList.find(a => a._id === id);
        if (item?.type === 'discussion') {
          await api.patch(`/threads/${id}/publish`, { published: false });
        } else {
          await api.patch(`/assignments/${id}/publish`, { published: false });
          }
          successCount++;
        } catch (err) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        // Refresh the list
        if (moduleId) {
          const response = await api.get(`/assignments/module/${moduleId}`);
          const assignmentsData = response.data?.data || response.data;
          setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
          
          try {
            const threadsRes = await api.get(`/threads/module/${moduleId}`);
            const threadsData = threadsRes.data?.data || threadsRes.data;
            setDiscussions(Array.isArray(threadsData) ? threadsData : []);
          } catch (e) {
            try {
              const threadsRes = await api.get(`/threads?module=${moduleId}`);
              const threadsData = threadsRes.data?.data || threadsRes.data;
              setDiscussions(Array.isArray(threadsData) ? threadsData : []);
            } catch (e2) {
              // If both fail, just continue
            }
          }
        }
        toast.success(`Successfully unpublished ${successCount} item${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to unpublish ${failCount} item${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedIds([]);
    } catch (err) {
      toast.error('Error during bulk unpublish operation');
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.warn('Please select at least one item');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setShowDeleteConfirm(false);

    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        try {
          const item = flatList.find(a => a._id === id);
          if (item?.type === 'discussion') {
            await api.delete(`/threads/${id}`);
          } else {
            await api.delete(`/assignments/${id}`);
          }
          successCount++;
        } catch (err) {
          failCount++;
        }
      }));

      if (successCount > 0) {
        // Refresh the list
        if (moduleId) {
          const response = await api.get(`/assignments/module/${moduleId}`);
          const assignmentsData = response.data?.data || response.data;
          setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
          
          try {
            const threadsRes = await api.get(`/threads/module/${moduleId}`);
            const threadsData = threadsRes.data?.data || threadsRes.data;
            setDiscussions(Array.isArray(threadsData) ? threadsData : []);
          } catch (e) {
            try {
              const threadsRes = await api.get(`/threads?module=${moduleId}`);
              const threadsData = threadsRes.data?.data || threadsRes.data;
              setDiscussions(Array.isArray(threadsData) ? threadsData : []);
            } catch (e2) {
              // If both fail, just continue
            }
          }
        }
        toast.success(`Successfully deleted ${successCount} item${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} item${failCount !== 1 ? 's' : ''}`);
      }
      setSelectedIds([]);
    } catch (err) {
      toast.error('Error during bulk delete operation');
    }
  };

  // Filtering and sorting logic for both roles
  const toggleSelect = (id: string) => {
    setSelectedIds(ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]));
  };
  const allRowsSelected =
    isTeacherOrAdmin &&
    flatList.length > 0 &&
    flatList.every(item => selectedIds.includes(item._id));
  const toggleSelectAll = () => {
    if (!isTeacherOrAdmin) return;
    setSelectedIds(allRowsSelected ? [] : flatList.map(i => i._id));
  };

  const toggleStudentSection = (sectionKey: string) => {
    setExpandedStudentSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const canvasGroups =
    isStudentViewer
      ? studentCanvasGroups
      : isTeacherOrAdmin
        ? listViewMode === 'type'
          ? buildTeacherTypeGroups(flatList, isQuizzesView)
          : [{ key: 'all', label: '', items: flatList }]
        : [];

  const showGroupHeaders = isStudentViewer || (isTeacherOrAdmin && listViewMode === 'type');
  const searchPlaceholder = isQuizzesView ? 'Search for Quiz' : 'Search for Assignment';

  const canvasHasItems = canvasGroups.some(g => g.items.length > 0);

  return (
    <PullToRefresh onRefresh={handleRefresh} className="space-y-3 sm:space-y-4">
      <div className="space-y-3 sm:space-y-4">
      {/* Assignment list toolbar (teachers) */}
      {isTeacherOrAdmin && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full sm:w-auto sm:min-w-[200px]">
              <label htmlFor="assignment-grading-period" className="sr-only">
                Grading period
              </label>
              <select
                id="assignment-grading-period"
                value={gradingPeriod}
                onChange={e => setGradingPeriod(e.target.value)}
                className={`${FORM_SELECT} min-h-[44px] w-full appearance-none bg-slate-50/80 pr-10 dark:bg-slate-800/50`}
              >
                <option value="all">All grading periods</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>

            <div className="relative min-w-0 flex-1">
              <label htmlFor="assignment-search" className="sr-only">
                {searchPlaceholder}
              </label>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="assignment-search"
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={`${FORM_INPUT} min-h-[44px] w-full bg-slate-50/80 pl-10 dark:bg-slate-800/50`}
              />
            </div>

            <div
              className="flex shrink-0 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/60"
              role="group"
              aria-label="List view"
            >
              <button
                type="button"
                onClick={() => setListViewMode('date')}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition touch-manipulation sm:px-4 sm:text-sm ${
                  listViewMode === 'date'
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                <span>By date</span>
              </button>
              <button
                type="button"
                onClick={() => setListViewMode('type')}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition touch-manipulation sm:px-4 sm:text-sm ${
                  listViewMode === 'type'
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" aria-hidden />
                <span>By type</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isTeacherOrAdmin && flatList.length > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              checked={allRowsSelected}
              onChange={toggleSelectAll}
              aria-label="Select all items"
            />
            Select all
          </label>
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-600">
              <button
                type="button"
                onClick={handleBulkPublish}
                className="rounded px-3 py-1.5 text-xs font-medium text-green-800 transition-colors hover:bg-green-200 dark:text-green-200 bg-green-100 dark:bg-green-900/50 dark:hover:bg-green-900/70"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={handleBulkUnpublish}
                className="rounded px-3 py-1.5 text-xs font-medium text-yellow-800 transition-colors hover:bg-yellow-200 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/50 dark:hover:bg-yellow-900/70"
              >
                Unpublish
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="rounded px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-200 dark:text-red-200 bg-red-100 dark:bg-red-900/50 dark:hover:bg-red-900/70"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      )}

      {(isStudentViewer || isTeacherOrAdmin) &&
        (canvasHasItems ? (
          <div className="space-y-4">
            {canvasGroups.map(group => {
              const isExpanded = isStudentViewer ? expandedStudentSections[group.key] !== false : true;
              return (
              <div key={group.key || group.label || 'by-due-date'}>
                <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70 dark:bg-slate-950 dark:ring-slate-700/60">
                {isStudentViewer && group.label ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                    onClick={() => toggleStudentSection(group.key)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
                    )}
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {group.label}
                    </span>
                  </button>
                ) : isTeacherOrAdmin && listViewMode === 'type' && group.label ? (
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      {group.label}
                    </span>
                  </div>
                ) : null}
                {(!isStudentViewer || isExpanded) && (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {group.items.map(item => {
                      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
                      const dueOk = Boolean(dueDate && !Number.isNaN(dueDate.getTime()));
                      const submission = submissionByAssignmentId.get(String(item._id));
                      const earned = getEarnedScoreForItem(item, submission, studentId);
                      const dateMetaParts = buildAssignmentMetaParts({
                        dueOk,
                        dueDate,
                        showPoints: false,
                        pointsSegment: '',
                      });
                      const showStudentPoints =
                        isStudentViewer && Math.max(0, Math.round(Number(item.totalPoints) || 0)) > 0;
                      const rowIcon =
                        item.type === 'discussion' ? (
                          <MessageSquare className="h-5 w-5" aria-hidden />
                        ) : isQuizItem(item) ? (
                          <Rocket className="h-5 w-5" aria-hidden />
                        ) : (
                          <FilePenLine className="h-5 w-5" aria-hidden />
                        );
                      return (
                        <li key={item._id} className="flex items-stretch">
                          {isTeacherOrAdmin ? (
                            <label
                              className="flex shrink-0 cursor-pointer items-center px-2 py-4"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                                checked={selectedIds.includes(item._id)}
                                onChange={() => toggleSelect(item._id)}
                                aria-label={`Select ${item.title}`}
                              />
                            </label>
                          ) : null}
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80 sm:gap-4 sm:px-5 dark:hover:bg-slate-900/80"
                            onClick={e => handleRowClick(item, e)}
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100/80 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                              {rowIcon}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.95rem] font-semibold leading-snug text-slate-900 dark:text-slate-50 sm:text-base">
                                {item.title}
                              </span>
                              {isStudentViewer ? (
                                <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
                                  {dateMetaParts.map((part, i) => (
                                    <React.Fragment key={`${item._id}-meta-${i}`}>
                                      {i > 0 ? (
                                        <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                                          {' '}|{' '}
                                        </span>
                                      ) : null}
                                      <span>{renderMetaPartContent(part)}</span>
                                    </React.Fragment>
                                  ))}
                                </span>
                              ) : (
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                  {dateMetaParts.map((part, i) => (
                                    <React.Fragment key={`${item._id}-date-${i}`}>
                                      {i > 0 ? (
                                        <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                                          |
                                        </span>
                                      ) : null}
                                      <span>{renderMetaPartContent(part)}</span>
                                    </React.Fragment>
                                  ))}
                                </span>
                              )}
                            </span>
                            {showStudentPoints ? (
                              <span className="shrink-0 pl-2 sm:min-w-[5.75rem] sm:text-right">
                                {renderStudentPointsDisplay(earned, item.totalPoints)}
                              </span>
                            ) : null}
                          </button>
                          {isTeacherOrAdmin ? (
                            <div
                              className="flex shrink-0 items-center border-l border-slate-100 px-3 py-2 dark:border-slate-800"
                              onClick={e => e.stopPropagation()}
                            >
                              <span
                                className="min-w-[3.5rem] text-right text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100"
                                title="Class average across enrolled students (missing or ungraded work counts as 0)"
                              >
                                {loadingAverages && averagePercentById[item._id] === undefined
                                  ? '…'
                                  : formatAveragePercentLabel(averagePercentById[item._id])}
                              </span>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-white py-12 text-center text-sm text-slate-500 ring-1 ring-slate-200/70 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-700/60">
            No {isQuizzesView ? 'quizzes' : 'assignments'} found
          </div>
        ))}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Items"
        message={`Are you sure you want to delete ${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
      </div>
    </PullToRefresh>
  );
};

export default AssignmentList;