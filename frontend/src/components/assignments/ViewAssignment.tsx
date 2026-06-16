import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { API_URL } from '../../config';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { safeFormatDate } from '../../utils/dateUtils';
import { Lock, Unlock, HelpCircle, CheckCircle, Circle, Bookmark, BarChart3, Edit, Eye, X, Download, Calendar, Clock } from 'lucide-react';
import FilePreviewModal from '../files/FilePreviewModal';
import { normalizeLegacyFiles, type NormalizedFile } from '../../utils/fileTypes';
import AssignmentFileUploadSection from './AssignmentFileUploadSection';
import { isPaperUploadQuiz } from '../../utils/quizSubmissionMode';
import FileAttachmentChips from '../files/FileAttachmentChips';
import { fetchCourseLifecycleStatus } from '../../services/gradingApi';
import ScrollableQuizSidebar from './ScrollableQuizSidebar';
import MobileQuizChrome, {
  MobileQuizProgress,
  MobileQuestionPills,
} from './MobileQuizChrome';
import TimedQuizStartScreen from './TimedQuizStartScreen';
import logger from '../../utils/logger';
import ConfirmationModal from '../common/ConfirmationModal';
import BackButton from '../common/BackButton';

interface ViewAssignmentProps {
  courseId?: string;
}

interface Question {
  _id?: string;
  id?: string;
  type: 'text' | 'multiple-choice' | 'matching';
  text: string;
  points: number;
  options?: {
    text: string;
    isCorrect?: boolean;
  }[];
  leftItems?: {
    id: string;
    text: string;
  }[];
  rightItems?: {
    id: string;
    text: string;
  }[];
}

interface User {
  _id: string;
  role: 'student' | 'teacher' | 'admin';
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface Assignment {
  _id: string;
  title: string;
  description?: string;
  content?: string;
  dueDate: string;
  availableFrom?: string;
  questions?: Question[];
  attachments?: string[];
  attachmentFiles?: Array<Record<string, unknown>>;
  fileAssets?: Array<string | Record<string, unknown>>;
  published?: boolean;
  totalPoints?: number;
  module?: string | { _id: string };
  isGradedQuiz?: boolean;
  quizSubmissionMode?: 'online' | 'paper_upload';
  allowStudentUploads?: boolean;
  isTimedQuiz?: boolean;
  quizTimeLimit?: number;
  isGroupAssignment?: boolean;
  groupSet?: string;
  group?: string;
  isOfflineAssignment?: boolean;
  displayMode?: 'single' | 'scrollable';
  showCorrectAnswers?: boolean;
  showStudentAnswers?: boolean;
  createdBy?: {
    _id: string;
  };
}

function isQuizAssignment(assignment: Pick<Assignment, 'isGradedQuiz' | 'group'>): boolean {
  if (assignment.isGradedQuiz === true) return true;
  const group = (assignment.group || '').trim().toLowerCase();
  return group === 'quizzes' || group.includes('quiz');
}

function courseWorkListPath(
  courseId: string | undefined,
  assignment: Pick<Assignment, 'isGradedQuiz' | 'group'>
): string {
  if (!courseId) return '/dashboard';
  return `/courses/${courseId}/${isQuizAssignment(assignment) ? 'quizzes' : 'assignments'}`;
}

interface Submission {
  _id: string;
  assignment: string | Assignment;
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  submittedAt: string;
  answers?: Record<string, string | Record<number, string>>;
  grade?: number | null;
  finalGrade?: number | null;
  feedback?: string;
  files?: Array<string | { url?: string; path?: string; name?: string; originalname?: string }>;
  autoGraded?: boolean;
  autoGrade?: number;
  teacherApproved?: boolean;
  questionGrades?: Record<string, number> | Map<string, number>;
  autoQuestionGrades?: Record<string, number> | Map<string, number>;
  teacherFeedbackFiles?: Array<string | { url?: string; path?: string; name?: string; originalname?: string }>;
  showCorrectAnswers?: boolean;
  showStudentAnswers?: boolean;
  timeSpent?: number;
  gradeVisibility?: {
    mode: 'hidden' | 'score_only' | 'score_and_feedback';
    scoreVisible: boolean;
    feedbackVisible: boolean;
  };
}

interface UploadedFile {
  name: string;
  url: string;
  size?: number;
}

function toPreviewFile(file: string | Record<string, unknown>): NormalizedFile {
  const [normalized] = normalizeLegacyFiles([file]);
  return normalized || { name: 'attachment', url: '', status: 'done' };
}

interface QuestionStat {
  questionIndex: number;
  correctCount: number;
  incorrectCount: number;
  averagePoints: number;
}

interface EngagementStats {
  averageTimeSpent: number;
  averageAttemptsPerStudent: number;
  peakHour: number;
  peakDay: string;
  lateSubmissions: number;
  totalSubmissions: number;
}

interface SubmissionStats {
  totalStudents: number;
  submittedCount: number;
  averageGrade: number;
  averageTime: number;
  questionStats: QuestionStat[];
  engagementStats: EngagementStats;
}

type Answers = Record<number, string | Record<number, string>>;

function getAnswerForQuestion(
  answers: Answers,
  questionIndex: number
): string | Record<number, string> | undefined {
  const key = questionIndex.toString();
  if (answers[questionIndex] !== undefined) return answers[questionIndex];
  if ((answers as Record<string, string | Record<number, string>>)[key] !== undefined) {
    return (answers as Record<string, string | Record<number, string>>)[key];
  }
  return undefined;
}

function formatTextAnswer(value: string | Record<number, string> | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function isTextLikeQuestion(q: Question): boolean {
  const isMultipleChoice =
    q.type === 'multiple-choice' && q.options && Array.isArray(q.options) && q.options.length > 0;
  const isMatching =
    q.type === 'matching' && q.leftItems && Array.isArray(q.leftItems) && q.leftItems.length > 0;
  return !isMultipleChoice && !isMatching;
}

function parseStoredAnswer(
  answer: unknown,
  questionType?: string
): string | Record<number, string> {
  if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
    return answer as Record<number, string>;
  }
  if (typeof answer === 'number') return String(answer);
  if (typeof answer !== 'string') return answer != null ? String(answer) : '';
  if (questionType === 'matching' || answer.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(answer);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<number, string>;
      }
    } catch {
      // plain text
    }
  }
  return answer;
}

function parseSubmissionAnswers(raw: unknown, questions?: Question[]): Answers {
  const parsed: Answers = {};
  if (!raw) return parsed;

  const entries: [string, unknown][] = [];
  if (raw instanceof Map) {
    raw.forEach((value, key) => entries.push([String(key), value]));
  } else if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => entries.push([key, value]));
  }

  entries.forEach(([questionIndex, answer]) => {
    const idx = Number(questionIndex);
    parsed[idx] = parseStoredAnswer(answer, questions?.[idx]?.type);
  });

  return parsed;
}

function getAssignmentMaxPoints(assignment: Assignment): number {
  const fromQuestions = assignment.questions?.reduce((sum, q) => sum + (q.points || 0), 0) ?? 0;
  if (fromQuestions > 0) return fromQuestions;
  return assignment.totalPoints ?? 0;
}

function resolveSubmissionEarnedPoints(submission: Submission): number | null {
  if (submission.gradeVisibility?.scoreVisible === false) return null;
  if (submission.gradeVisibility?.mode === 'hidden') return null;
  if (typeof submission.finalGrade === 'number') return submission.finalGrade;
  if (typeof submission.grade === 'number') return submission.grade;
  if (submission.autoGraded && typeof submission.autoGrade === 'number') return submission.autoGrade;
  return null;
}

function formatPointsValue(value: number): string {
  const num = Number(value);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.?0+$/, '');
}

function getAssignmentGradeScore(
  submission: Submission | null,
  assignment: Assignment
): { earned: number; maxPoints: number } | null {
  if (!submission) return null;
  const earned = resolveSubmissionEarnedPoints(submission);
  if (earned === null) return null;
  const maxPoints = getAssignmentMaxPoints(assignment);
  if (maxPoints <= 0) return null;
  return { earned, maxPoints };
}

function AssignmentGradeBadge({
  score,
  compact = false,
}: {
  score: { earned: number; maxPoints: number };
  compact?: boolean;
}) {
  const earned = formatPointsValue(score.earned);
  const max = formatPointsValue(score.maxPoints);
  const isPerfect = score.maxPoints > 0 && score.earned >= score.maxPoints;

  if (compact) {
    return (
      <div
        className="inline-flex items-baseline gap-0.5 rounded-lg bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-800/60"
        title={`Score: ${earned} / ${max} pts`}
      >
        <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{earned}</span>
        <span className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/70">/{max}</span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm dark:border-slate-700/80 dark:from-slate-900/80 dark:to-slate-900/40">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          isPerfect
            ? 'bg-emerald-100 ring-1 ring-emerald-200/80 dark:bg-emerald-900/40 dark:ring-emerald-800/60'
            : 'bg-indigo-100 ring-1 ring-indigo-200/80 dark:bg-indigo-900/40 dark:ring-indigo-800/60'
        }`}
      >
        <CheckCircle
          className={`h-5 w-5 ${
            isPerfect ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
          }`}
          aria-hidden
        />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Your score
        </p>
        <p className="mt-0.5 tabular-nums leading-none">
          <span
            className={`text-2xl font-bold ${
              isPerfect ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
            }`}
          >
            {earned}
          </span>
          <span className="ml-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">/ {max} pts</span>
        </p>
      </div>
    </div>
  );
}

// Fisher-Yates shuffle algorithm for proper randomization
const shuffleArray = <T,>(array: T[]): T[] => {
  if (!Array.isArray(array) || array.length === 0) {
    return [];
  }
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const ViewAssignment: React.FC<ViewAssignmentProps> = ({ courseId: propCourseId }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseId, setCourseId] = useState<string | undefined>(propCourseId);
  
  // Track courseId changes
  useEffect(() => {
    // courseId tracking
  }, [courseId, propCourseId]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState<boolean>(false);
  const [studentGroupId, setStudentGroupId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [quizDeadlineAt, setQuizDeadlineAt] = useState<Date | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [courseFinalized, setCourseFinalized] = useState<boolean>(false);
  const [showTimer, setShowTimer] = useState<boolean>(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showUploadSection, setShowUploadSection] = useState<boolean>(false);
  const [showQuestionPicker, setShowQuestionPicker] = useState<boolean>(false);
  const [shuffledOptions, setShuffledOptions] = useState<Record<number, Question['rightItems']>>({});
  const [previewModalFile, setPreviewModalFile] = useState<NormalizedFile | null>(null);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
  const handleSubmitRef = useRef<(() => Promise<void>) | null>(null);

  // Teacher analytics state
  const [submissionStats, setSubmissionStats] = useState<SubmissionStats>({
    totalStudents: 0,
    submittedCount: 0,
    averageGrade: 0,
    averageTime: 0,
    questionStats: [],
    engagementStats: {
      averageTimeSpent: 0,
      averageAttemptsPerStudent: 0,
      peakHour: 0,
      peakDay: 'Monday',
      lateSubmissions: 0,
      totalSubmissions: 0
    }
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const SUBMISSIONS_PAGE_SIZE = 100;

  // Define instructor and student checks early
  const isInstructor = user?.role === 'teacher' || user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const studentPreviewParam = searchParams.get('studentPreview');
  const studentPreviewMode =
    studentPreviewParam === '1' ||
    studentPreviewParam === 'true' ||
    studentPreviewParam === 'yes';
  const viewAsStudent = isInstructor && studentPreviewMode;
  const showStudentExperience = isStudent || viewAsStudent;

  const enterStudentPreview = () => {
    const next = new URLSearchParams(searchParams);
    next.set('studentPreview', '1');
    setSearchParams(next, { replace: true });
  };

  const exitStudentPreview = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('studentPreview');
    setSearchParams(next, { replace: true });
  };

  const queueDraftSave = (draftAnswers: Answers, draftUploadedFiles: UploadedFile[]) => {
    if (!user?._id || !id || user.role !== 'student' || submission) return;
    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }
    draftSaveTimeoutRef.current = window.setTimeout(() => {
      const draftKey = `assignment_draft_${id}_${user._id}`;
      try {
        const existingDraft = localStorage.getItem(draftKey);
        const draft = existingDraft ? JSON.parse(existingDraft) : {};
        draft.answers = draftAnswers;
        draft.uploadedFiles = draftUploadedFiles;
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (e) {
        logger.error('Error saving draft', e instanceof Error ? e : new Error(String(e)));
      }
    }, 600);
  };

  const fetchSubmissionPages = async (assignmentId: string) => {
    let nextCursor: string | null = null;
    let hasMore = true;
    const all: Submission[] = [];

    while (hasMore) {
      const params: Record<string, string | number> = { limit: SUBMISSIONS_PAGE_SIZE };
      if (nextCursor) params.cursor = nextCursor;
      const page = await api.get(`/submissions/assignment/${assignmentId}`, { params });
      const items = Array.isArray(page.data?.data) ? page.data.data : [];
      all.push(...items);
      hasMore = Boolean(page.data?.hasMore);
      nextCursor = page.data?.nextCursor || null;
      if (!nextCursor) {
        hasMore = false;
      }
    }

    return all;
  };

  useEffect(() => {
    let storedUser = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        storedUser = JSON.parse(userStr);
      }
    } catch (e) {
      logger.error('Error parsing user from localStorage', e);
    }
    setUser(storedUser);
    // Add a timeout fallback in case user is not set
    const timeout = setTimeout(() => {
      if (!storedUser) {
        setError('User not found. Please log in again.');
        setLoading(false);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    return () => {
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSubmission(null); // Clear submission state when user changes
  }, [user, id]);

  /** Blank slate for teacher student preview — no real submission or saved answers. */
  useEffect(() => {
    if (!viewAsStudent || !assignment?.questions?.length) return;

    setSubmission(null);
    setUploadedFiles([]);
    setQuizStarted(false);
    setQuizStartTime(null);
    setTimeLeft(null);
    setCurrentQuestion(0);
    setAnsweredQuestions(new Set());
    setMarkedQuestions(new Set());
    setShowUploadSection(false);

    const initialAnswers: Answers = {};
    const shuffled: Record<number, Question['rightItems']> = {};
    assignment.questions.forEach((question: Question, index: number) => {
      initialAnswers[index] = question.type === 'matching' ? {} : '';
      if (question.type === 'matching' && Array.isArray(question.rightItems) && question.rightItems.length > 0) {
        shuffled[index] = shuffleArray([...question.rightItems]);
      }
    });
    setAnswers(initialAnswers);
    setShuffledOptions(shuffled);
  }, [viewAsStudent, assignment?._id]);

  // Fetch submission statistics for teachers
  const fetchSubmissionStats = async () => {
    if (!isInstructor || !assignment?._id || studentPreviewMode) return;
    
    try {
      setLoadingStats(true);
      const response = await api.get(`/assignments/${assignment._id}/stats`);
      
      if (response.data.success) {
        setSubmissionStats(response.data.stats);
      }
    } catch (error) {
      logger.error('Error fetching submission stats', error instanceof Error ? error : new Error(String(error)));
      // Fallback: calculate basic stats from submissions
      try {
        const submissions = await fetchSubmissionPages(assignment._id);
        const questionStats = assignment.questions?.map((q: Question, index: number) => ({
          questionIndex: index,
          correctCount: 0,
          incorrectCount: 0,
          averagePoints: 0
        })) || [];
        
        const stats: SubmissionStats = {
          totalStudents: submissions.length,
          submittedCount: submissions.filter((s: any) => s.submittedAt).length,
          averageGrade: submissions.length > 0 
            ? submissions.reduce((sum: number, s: any) => sum + (s.grade || 0), 0) / submissions.length 
            : 0,
          averageTime: assignment.isTimedQuiz && submissions.length > 0
            ? submissions.reduce((sum: number, s: any) => sum + (s.timeSpent || 0), 0) / submissions.length
            : 0,
          questionStats: questionStats,
          engagementStats: {
            averageTimeSpent: 0,
            averageAttemptsPerStudent: 0,
            peakHour: 0,
            peakDay: 'Monday',
            lateSubmissions: 0,
            totalSubmissions: 0
          }
        };
        
        setSubmissionStats(stats);
      } catch (err) {
        logger.error('Error calculating basic stats', err instanceof Error ? err : new Error(String(err)));
        // Set default stats if all else fails
        setSubmissionStats({
          totalStudents: 0,
          submittedCount: 0,
          averageGrade: 0,
          averageTime: 0,
          questionStats: [],
          engagementStats: {
            averageTimeSpent: 0,
            averageAttemptsPerStudent: 0,
            peakHour: 0,
            peakDay: 'Monday',
            lateSubmissions: 0,
            totalSubmissions: 0
          }
        });
      }
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        const assignmentRes = await api.get(`/assignments/${id}`);
        // Check if response is HTML
        if (typeof assignmentRes.data === 'string' && assignmentRes.data.trim().startsWith('<!DOCTYPE')) {
          setError('API configuration error: Unable to reach backend server');
          setLoading(false);
          return;
        }
        const assignmentData = assignmentRes.data?.data || assignmentRes.data;
        // Ensure questions and attachments are arrays
        if (assignmentData && typeof assignmentData === 'object') {
          assignmentData.questions = Array.isArray(assignmentData.questions) ? assignmentData.questions : [];
          assignmentData.attachments = Array.isArray(assignmentData.attachments) ? assignmentData.attachments : [];
        }
        setAssignment(assignmentData);
        
        // Fetch courseId if not provided
        if (!courseId && assignmentData?.module) {
          const moduleId = typeof assignmentData.module === 'string' 
            ? assignmentData.module 
            : assignmentData.module._id;
          try {
            const moduleRes = await api.get(`/modules/view/${moduleId}`);
            if (moduleRes.data.success) {
              const fetchedCourseId = moduleRes.data.data.course._id || moduleRes.data.data.course;
              setCourseId(fetchedCourseId);
            }
          } catch (err) {
            logger.error('Error fetching module for courseId', err);
          }
        }

        // Initialize shuffled options for matching questions
        if (assignmentData.questions && Array.isArray(assignmentData.questions)) {
          const shuffled: Record<number, Question['rightItems']> = {};
          assignmentData.questions.forEach((question: Question, index: number) => {
            if (question.type === 'matching' && Array.isArray(question.rightItems) && question.rightItems.length > 0) {
              // Shuffle the rightItems to randomize the order using Fisher-Yates algorithm
              shuffled[index] = shuffleArray([...question.rightItems]);
            }
          });
          setShuffledOptions(shuffled);
        }

        // Initialize answers object for student submission
        if (assignmentData.questions && Array.isArray(assignmentData.questions)) {
          const initialAnswers: Answers = {};
          assignmentData.questions.forEach((q: Question, index: number) => {
            if (q.type === 'matching') {
              initialAnswers[index] = {}; // Object for matching questions
            } else {
              initialAnswers[index] = ''; // String for other question types
            }
          });
          setAnswers(initialAnswers);
        }

        // If group assignment, fetch student's group
        if (assignmentData.isGroupAssignment && assignmentData.groupSet && user?.role === 'student') {
          const userId = user._id;
          const groupsRes = await api.get(`/groups/sets/${assignmentData.groupSet}/groups`);
          const groupsData = Array.isArray(groupsRes.data) ? groupsRes.data : [];
          const userGroup = groupsData.find((group: any) =>
            Array.isArray(group.members) && group.members.some((member: any) => String(member._id) === String(userId))
          );
          setStudentGroupId(userGroup ? userGroup._id : null);
        }

        // Always fetch submission for the current user
        let hasSubmission = false;
        if (user?.role === 'student') {
          try {
            const submissionRes = await api.get(`/submissions/student/${id}`);
            
            if (submissionRes.data) {
              hasSubmission = true;
              setSubmission(submissionRes.data);
              if (submissionRes.data?.answers) {
                setAnswers(parseSubmissionAnswers(submissionRes.data.answers, assignmentData.questions));
              }
            }
          } catch (err) {
            setSubmission(null);
            hasSubmission = false;
          }
          
          // Load saved draft from localStorage if no submission exists
          if (!hasSubmission && assignmentData.questions && Array.isArray(assignmentData.questions)) {
            const draftKey = `assignment_draft_${id}_${user._id}`;
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
              try {
                const draft = JSON.parse(savedDraft);
                if (draft.answers) {
                  // Merge saved answers with initial structure
                  const initialAnswers: Record<string, string | Record<number, string>> = {};
                  assignmentData.questions.forEach((q: Question, index: number) => {
                    if (q.type === 'matching') {
                      initialAnswers[index.toString()] = {}; // Object for matching questions
                    } else {
                      initialAnswers[index.toString()] = ''; // String for other question types
                    }
                  });
                  const mergedAnswers: Record<string, string | Record<number, string>> = { ...initialAnswers };
                  Object.keys(draft.answers).forEach((key: string) => {
                    try {
                      // Try to parse matching question answers
                      const answerValue = draft.answers[key];
                      mergedAnswers[key] = typeof answerValue === 'string' && answerValue.startsWith('{') 
                        ? JSON.parse(answerValue) 
                        : answerValue;
                    } catch {
                      mergedAnswers[key] = draft.answers[key];
                    }
                  });
                  setAnswers(mergedAnswers);
                }
                if (draft.uploadedFiles) {
                  setUploadedFiles(draft.uploadedFiles);
                }
              } catch (e) {
                logger.error('Error loading draft', e);
              }
            }
          }
        } else if (
          (user?.role === 'teacher' || user?.role === 'admin') &&
          !studentPreviewMode
        ) {
          try {
            const submissionRes = await api.get(`/submissions/assignment/${id}`);
            const submissionList = Array.isArray(submissionRes.data?.data)
              ? submissionRes.data.data
              : Array.isArray(submissionRes.data) ? submissionRes.data : [];
            const first = submissionList[0] || null;
            setSubmission(first);
            if (first?.answers) {
              setAnswers(parseSubmissionAnswers(first.answers, assignmentData.questions));
            }
          } catch (err) {
            setSubmission(null);
          }
        } else if (studentPreviewMode) {
          setSubmission(null);
        }

        setLoading(false);
      } catch (err) {
        logger.error('Error fetching assignment details', err instanceof Error ? err : new Error(String(err)));
        setError('Error fetching assignment details');
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [id, user, studentPreviewMode]);

  // Fetch submission stats when assignment is loaded and user is instructor
  useEffect(() => {
    if (assignment && isInstructor && !studentPreviewMode) {
      fetchSubmissionStats();
    }
  }, [assignment, isInstructor, studentPreviewMode]);

  useEffect(() => {
    if (!courseId) return;
    fetchCourseLifecycleStatus(courseId)
      .then((res) => {
        const status = res?.data?.status;
        const finalized = res?.data?.finalized === true || status === 'FINALIZED';
        setCourseFinalized(finalized);
      })
      .catch(() => {});
  }, [courseId]);

  // Update answeredQuestions when answers are loaded or changed
  useEffect(() => {
    if (assignment?.questions) {
      const answered = new Set<number>();
      assignment.questions.forEach((_, index) => {
        const answer = answers[index];
        const isAnswered = typeof answer === 'object' && answer !== null ? 
          Object.keys(answer).length > 0 && Object.values(answer).some(v => {
            if (v === null || v === undefined) return false;
            return typeof v === 'string' ? v.trim() !== '' : String(v).trim() !== '';
          }) :
          answer !== null && answer !== undefined && (typeof answer === 'string' ? answer.trim() !== '' : String(answer).trim() !== '');
        if (isAnswered) {
          answered.add(index);
        }
      });
      setAnsweredQuestions(answered);
    }
  }, [answers, assignment?.questions]);

  // Timer logic for timed quizzes
  useEffect(() => {
    if (assignment?.isTimedQuiz && assignment?.quizTimeLimit && user?.role === 'student' && !submission) {
      api.get(`/assignments/${id}/quiz/attempt`, {
        params: studentGroupId ? { groupId: studentGroupId } : undefined,
      }).then((res) => {
        const attempt = res.data?.data;
        if (attempt?.attemptStatus === 'in_progress') {
          setQuizStarted(true);
          setQuizStartTime(attempt.attemptStartedAt ? new Date(attempt.attemptStartedAt) : new Date(attempt.serverTime));
          setQuizDeadlineAt(attempt.attemptDeadlineAt ? new Date(attempt.attemptDeadlineAt) : null);
          setTimeLeft(typeof attempt.remainingSeconds === 'number' ? attempt.remainingSeconds : null);
        }
      }).catch(() => {
        // The start button can still initialize a server-authoritative attempt.
      });
    }
  }, [assignment, user, submission, id, studentGroupId]);

  useEffect(() => {
    // Only run timer if quiz is started, no submission exists, and user is actively taking the quiz
    if (
      quizStarted &&
      quizStartTime &&
      assignment?.isTimedQuiz &&
      assignment?.quizTimeLimit &&
      !submission &&
      user?.role === 'student' &&
      !viewAsStudent &&
      !hasAutoSubmitted &&
      !isSubmitting
    ) {
      const timer = setInterval(() => {
        const now = new Date();
        const remaining = quizDeadlineAt
          ? Math.ceil((quizDeadlineAt.getTime() - now.getTime()) / 1000)
          : ((assignment.quizTimeLimit || 0) * 60) -
            Math.floor((now.getTime() - (quizStartTime?.getTime() || 0)) / 1000);
        
        if (remaining <= 0) {
          // Time's up! Auto-submit the quiz
          clearInterval(timer);
          setTimeLeft(0);
          setHasAutoSubmitted(true);
          
          // Auto-submit the assignment/quiz
          if (user && user.role === 'student' && !viewAsStudent && !submission && handleSubmitRef.current) {
            handleSubmitRef.current().catch(err => {
              logger.error('Auto-submit error', err instanceof Error ? err : new Error(String(err)));
              setError('Error auto-submitting quiz. Please submit manually.');
            });
          }
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, quizStartTime, quizDeadlineAt, assignment, submission, user, hasAutoSubmitted, isSubmitting, id]);

  const startQuiz = async () => {
    if (assignment?.isTimedQuiz && assignment?.quizTimeLimit && user?._id) {
      setIsStartingQuiz(true);
      try {
        const res = await api.post(`/assignments/${id}/quiz/start`, {
          groupId: studentGroupId || undefined,
        });
        const attempt = res.data?.data;
        setQuizStartTime(attempt?.attemptStartedAt ? new Date(attempt.attemptStartedAt) : new Date());
        setQuizDeadlineAt(attempt?.attemptDeadlineAt ? new Date(attempt.attemptDeadlineAt) : null);
        setQuizStarted(attempt?.attemptStatus === 'in_progress');
        setTimeLeft(typeof attempt?.remainingSeconds === 'number' ? attempt.remainingSeconds : (assignment.quizTimeLimit || 0) * 60);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Unable to start timed quiz.');
      } finally {
        setIsStartingQuiz(false);
      }
    }
  };

  const handleUploadedFilesChange = (files: NormalizedFile[]) => {
    const mapped = files.map((f) => ({
      name: f.name,
      url: f.url,
      size: f.size,
      fileAssetId: f.fileAssetId,
    }));
    setUploadedFiles(mapped);
    queueDraftSave(answers, mapped);
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0 Hours, 0 Minutes, 0 Seconds';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours} Hour${hours !== 1 ? 's' : ''}, ${minutes} Minute${minutes !== 1 ? 's' : ''}, ${secs} Second${secs !== 1 ? 's' : ''}`;
  };

  const handleAnswerChange = (questionIndex: number, value: string | Record<number, string>) => {
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionIndex]: value
      };
      
      queueDraftSave(newAnswers, uploadedFiles);
      
      return newAnswers;
    });
    
    // Update answered questions tracking
    const isAnswered = typeof value === 'object' && value !== null ? 
      Object.keys(value).length > 0 && Object.values(value).some(v => {
        if (v === null || v === undefined) return false;
        return typeof v === 'string' ? v.trim() !== '' : String(v).trim() !== '';
      }) :
      value !== null && value !== undefined && (typeof value === 'string' ? value.trim() !== '' : String(value).trim() !== '');
    
    if (isAnswered) {
      setAnsweredQuestions(prev => new Set([...prev, questionIndex]));
    } else {
      setAnsweredQuestions(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionIndex);
        return newSet;
      });
    }
  };

  const navigateToQuestion = (questionIndex: number) => {
    setCurrentQuestion(questionIndex);
  };

  const nextQuestion = () => {
    if (assignment?.questions && currentQuestion < assignment.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const toggleMarkQuestion = (questionIndex: number) => {
    setMarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionIndex)) {
        newSet.delete(questionIndex);
      } else {
        newSet.add(questionIndex);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!user || user.role !== 'student') return;
    if (assignment?.isGroupAssignment && !studentGroupId) {
      setError('You are not a member of any group for this group assignment.');
      return;
    }
    if (isPaperUploadQuiz(assignment) && uploadedFiles.length === 0) {
      setError('Please upload at least one file before submitting your quiz.');
      return;
    }
    setIsSubmitting(true);
    try {
      // Prepare answers for submission
      const submissionAnswers: Record<string, string> = {};
      Object.keys(answers).forEach(questionIndex => {
        const answer = answers[parseInt(questionIndex)];
        if (answer && typeof answer === 'object') {
          // For matching questions, convert object to string
          submissionAnswers[questionIndex] = JSON.stringify(answer);
        } else {
          submissionAnswers[questionIndex] = String(answer || '');
        }
      });

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setIsSubmitting(false);
        return;
      }
      
      // Extract file objects with URL and original name
      const fileObjects = uploadedFiles.map((file: UploadedFile) => {
        // If file is an object with url and name, use it; otherwise create object from string URL
        if (file.url) {
          return {
            url: file.url,
            name: file.name || file.url.split('/').pop() || 'file',
            originalname: file.name || file.url.split('/').pop() || 'file'
          };
        }
        return {
          url: '',
          name: file.name || 'file',
          originalname: file.name || 'file'
        };
      });
      
      const payload: {
        assignment: string | undefined;
        answers: Record<string, string>;
        submittedAt: Date;
        uploadedFiles: Array<{ url: string; name: string; originalname: string }>;
        groupId?: string | null;
      } = {
        assignment: id,
        answers: submissionAnswers,
        submittedAt: new Date(),
        uploadedFiles: fileObjects
      };
      if (assignment?.isGroupAssignment) {
        payload.groupId = studentGroupId;
      }
      

      
      const response = await api.post(`/submissions`, payload);
      

      setSubmission(response.data);
      setError('');
      
      // Clear draft from localStorage after successful submission
      if (user?._id && id) {
        const draftKey = `assignment_draft_${id}_${user._id}`;
        localStorage.removeItem(draftKey);
      }
      
      // Dispatch event to refresh ToDo panel
      window.dispatchEvent(new Event('assignmentSubmitted'));
    } catch (err: any) {
      logger.error('Submit error', err instanceof Error ? err : new Error(String(err)), { status: err.response?.status, data: err.response?.data });
      setError(err.response?.data?.message || 'Error submitting assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return;
    setShowDeleteConfirm(true);
  };
    
  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/assignments/${id}`);
      navigate(-1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting assignment');
    }
  };

  const handleTogglePublish = async () => {
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return;
    setIsPublishing(true);
    try {
      const res = await api.patch(`/assignments/${id}/publish`, {});
      setAssignment(prev => prev ? ({ ...prev, published: res.data.published }) : null);
    } catch (err: any) {
      logger.error('Error toggling assignment publish', err instanceof Error ? err : new Error(String(err)));
      setError(err.response?.data?.message || 'Error toggling publish status');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!assignment) {
    return <div className="text-gray-900 dark:text-gray-100 dark:text-gray-100">Assignment not found</div>;
  }

  const isCreator = isInstructor && assignment?.createdBy?._id === user?._id;
  const isPastDue = new Date() > new Date(assignment?.dueDate);
  /** Teachers previewing as student can interact even if the real due date passed. */
  const effectivePastDue = viewAsStudent ? false : isPastDue;
  const canInteractAsStudent = showStudentExperience && !effectivePastDue;
  const isTeacherDashboard = isInstructor && !studentPreviewMode;
  /** In student preview, ignore any loaded submission so the UI stays blank. */
  const activeSubmission = viewAsStudent ? null : submission;
  /** Students must start timed quizzes first; teachers in preview see questions immediately. */
  const canShowQuestionPanel =
    !isTeacherDashboard &&
    (viewAsStudent ||
      !assignment.isTimedQuiz ||
      quizStarted ||
      !!activeSubmission ||
      effectivePastDue);
  const showTimedQuizChrome = !viewAsStudent && !!assignment.isTimedQuiz;
  const paperUploadQuiz = isPaperUploadQuiz(assignment);
  const showStudentUploadSection =
    canInteractAsStudent &&
    !activeSubmission &&
    !assignment.isTimedQuiz &&
    (paperUploadQuiz ||
      (Boolean(assignment.allowStudentUploads) &&
        !assignment.isGradedQuiz &&
        assignment.group !== 'Quizzes'));
  const assignmentGradeScore =
    isStudent && submission ? getAssignmentGradeScore(submission, assignment) : null;
  const isScrollableQuiz = assignment.displayMode !== 'single';
  const isQuizTakingMode =
    isStudent &&
    !activeSubmission &&
    !effectivePastDue &&
    canShowQuestionPanel &&
    canInteractAsStudent &&
    !!assignment.questions?.length &&
    (!assignment.isTimedQuiz || quizStarted);
  const showMobileQuizChrome = isQuizTakingMode;
  const showTimedQuizStartScreen =
    showTimedQuizChrome &&
    !!assignment.quizTimeLimit &&
    canInteractAsStudent &&
    !activeSubmission &&
    !quizStarted;
  const showMobileQuizLayout = showMobileQuizChrome || showTimedQuizStartScreen;
  const timedQuizTotalPoints =
    assignment.questions?.reduce((sum, q) => sum + (q.points || 0), 0) ?? assignment.totalPoints ?? 0;
  const isQuiz = isQuizAssignment(assignment);
  const listFallbackPath = courseWorkListPath(courseId, assignment);
  const showStudentSubmitButton =
    isStudent && !activeSubmission && (!assignment.isTimedQuiz || quizStarted);
  const showMobileAssignmentSubmitBar = showStudentSubmitButton && !showMobileQuizChrome;
  const hasAssignmentInfoContent =
    !!activeSubmission ||
    !!assignmentGradeScore ||
    (isStudent && typeof submission?.feedback === 'string' && submission.feedback.trim() !== '') ||
    (isStudent && (submission?.teacherFeedbackFiles?.length ?? 0) > 0) ||
    (isStudent && submission?.gradeVisibility?.mode === 'hidden') ||
    (isStudent && !!submission?.autoGraded) ||
    (isStudent && (submission?.files?.length ?? 0) > 0) ||
    isInstructor ||
    (isCreator && !viewAsStudent);
  const hideAssignmentInfoOnMobile = showMobileQuizLayout || !hasAssignmentInfoContent;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3 gap-2">
          <BackButton 
            fallbackPath={listFallbackPath}
            useFallbackPath
            alwaysShow
            className="flex-shrink-0"
            ariaLabel={isQuiz ? 'Go back to quizzes' : 'Go back to assignments'}
          />
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate px-2 flex-1 text-center">{assignment.title}</h1>
          {isStudent && assignmentGradeScore && (
            <AssignmentGradeBadge score={assignmentGradeScore} compact />
          )}
          <div className="w-10 flex-shrink-0" aria-hidden />
        </div>
      </nav>

      <div className={`w-full px-0 sm:px-4 lg:px-8 py-2 sm:py-6 lg:py-8 ${showMobileQuizLayout ? 'pt-[calc(3.5rem+1.25rem)] pb-2' : 'pt-[calc(3.5rem+1.25rem)]'} lg:pt-4 max-w-full overflow-x-hidden ${showMobileQuizLayout ? 'mobile-quiz-chrome-clearance' : 'mobile-bottom-nav-clearance'}`}>
        <div className={`bg-white dark:bg-slate-900 sm:shadow-sm sm:ring-1 sm:ring-slate-200/80 dark:sm:ring-slate-700/80 sm:rounded-2xl max-w-full overflow-hidden ${hideAssignmentInfoOnMobile ? 'hidden sm:block sm:p-6' : 'p-3 sm:p-6'}`}>
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between max-w-full">
            <div className="flex-1 min-w-0 w-full max-w-full">
              <div className={`flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between sm:border-b-0 sm:pb-0 ${showMobileQuizLayout || !activeSubmission ? 'hidden sm:flex' : 'border-b border-slate-200/80 pb-4 dark:border-slate-700/80'}`}>
                <div className="min-w-0 flex-1">
                  <h1 className="hidden sm:block text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-words sm:text-3xl">
                    {assignment.title}
                  </h1>
                  <div className={`mt-0 flex flex-wrap items-center gap-2 sm:mt-3 ${showMobileQuizLayout ? 'hidden sm:flex' : ''}`}>
                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-100/90 px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700/80">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                      <span>Due {safeFormatDate(assignment.dueDate, 'MMM d, yyyy, h:mm a')}</span>
                    </span>
                    {activeSubmission && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                        <span>Submitted {safeFormatDate(activeSubmission.submittedAt, 'MMM d, yyyy, h:mm a')}</span>
                      </span>
                    )}
                  </div>
                </div>
                {isStudent && assignmentGradeScore && (
                  <div className="hidden sm:block">
                    <AssignmentGradeBadge score={assignmentGradeScore} />
                  </div>
                )}
              </div>
              {isStudent && assignmentGradeScore && (
                <div className="mt-4 sm:hidden">
                  <AssignmentGradeBadge score={assignmentGradeScore} />
                </div>
              )}
            {/* Show feedback if student and feedback exists */}
            {isStudent && submission && typeof submission.feedback === 'string' && submission.feedback.trim() !== '' && (
              <div className="mt-4 bg-gradient-to-r from-yellow-50 to-yellow-50/50 dark:from-yellow-900/30 dark:to-yellow-900/10 border-l-4 border-yellow-400 dark:border-yellow-500 shadow-sm sm:shadow-md rounded-lg p-3 sm:p-4 overflow-hidden max-w-full transition-all duration-200">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-1 h-5 bg-yellow-400 dark:bg-yellow-500 rounded-full"></div>
                  <div className="text-yellow-800 dark:text-yellow-200 font-semibold text-sm sm:text-base break-words">Instructor Feedback</div>
                </div>
                <div className="text-yellow-900 dark:text-yellow-100 whitespace-pre-line break-words overflow-wrap-anywhere text-sm sm:text-base leading-relaxed pl-3">{submission.feedback}</div>
              </div>
            )}

            {/* Show teacher feedback files if student and files exist */}
            {isStudent && submission && submission.teacherFeedbackFiles && submission.teacherFeedbackFiles.length > 0 && (
              <div className="mt-4 bg-gradient-to-r from-indigo-50 to-indigo-50/50 dark:from-indigo-900/30 dark:to-indigo-900/10 border-l-4 border-indigo-400 dark:border-indigo-500 shadow-sm sm:shadow-md rounded-lg p-3 sm:p-4 overflow-hidden max-w-full transition-all duration-200">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-1 h-5 bg-indigo-400 dark:bg-indigo-500 rounded-full"></div>
                  <div className="text-indigo-800 dark:text-indigo-200 font-semibold text-sm sm:text-base break-words">Instructor Feedback Files</div>
                </div>
                <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 mb-3 break-words pl-3">
                  Your instructor has uploaded annotated files with feedback:
                </p>
                <div className="space-y-2.5 max-w-full">
                  {submission.teacherFeedbackFiles.map((file, index) => {
                    const fileUrl = typeof file === 'string' ? file : (file.url || file.path || '');
                    const fileName = typeof file === 'string' 
                      ? file.split('/').pop() || `Feedback File ${index + 1}`
                      : (file.name || file.originalname || `Feedback File ${index + 1}`);
                    return (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 sm:p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-200/50 dark:border-indigo-700/50 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden max-w-full">
                        <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex-shrink-0 w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className="text-sm sm:text-sm text-gray-900 dark:text-gray-100 break-all overflow-wrap-anywhere word-break break-word flex-1 min-w-0 font-medium">{fileName}</span>
                        </div>
                        <div className="flex items-center space-x-3 sm:ml-2 flex-shrink-0 self-start sm:self-center pl-11 sm:pl-0">
                          <button
                            type="button"
                            onClick={() => setPreviewModalFile(toPreviewFile(file))}
                            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-200 flex-shrink-0 active:scale-95"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs font-medium sm:hidden">Preview</span>
                          </button>
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors duration-200 flex-shrink-0 active:scale-95 shadow-sm"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-xs font-medium">Download</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Show auto-grading status for students */}
            {isStudent && submission?.gradeVisibility?.mode === 'hidden' && (
              <div className="mt-4 rounded border-l-4 border-amber-400 bg-amber-50 p-4 text-amber-900 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-100">
                Your work has been received. Your grade is awaiting instructor release.
              </div>
            )}
            {isStudent && submission && submission.autoGraded && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 rounded">
                <div className="text-blue-800 dark:text-blue-200 font-semibold mb-1">
                  {submission.teacherApproved ? 'Grading Complete' : 'Auto-Graded'}
                </div>
                <div className="text-blue-900 dark:text-blue-100">
                  {submission.teacherApproved ? (
                    <>
                      <div>Final Grade: {(() => {
                        const grade = Number(submission.finalGrade || submission.grade);
                        return Number.isInteger(grade) ? grade.toString() : grade.toFixed(2);
                      })()} points</div>
                      <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Multiple choice questions were auto-graded. Other questions were graded by your instructor.
                      </div>
                    </>
                  ) : (
                    <>
                      <div>Auto-Grade: {(() => {
                        const grade = Number(submission.autoGrade);
                        return Number.isInteger(grade) ? grade.toString() : grade.toFixed(2);
                      })()} points</div>
                      <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Multiple choice questions have been auto-graded. Your instructor will review and approve the final grade.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Show submitted files for students */}
            {isStudent && submission && submission.files && submission.files.length > 0 && (
              <div className="mt-4 bg-gradient-to-r from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm sm:shadow-md rounded-lg p-3 sm:p-4 overflow-hidden max-w-full transition-all duration-200">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-1 h-5 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Your Submitted Files:</h3>
                </div>
                <div className="space-y-2.5 max-w-full">
                  {submission.files.map((file, index) => {
                    const fileUrl = typeof file === 'string' ? file : (file.url || file.path || '');
                    const fileName = typeof file === 'string' 
                      ? file.split('/').pop() || `File ${index + 1}`
                      : (file.name || file.originalname || `File ${index + 1}`);
                    return (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 p-3 bg-white dark:bg-gray-900 border border-gray-200/50 dark:border-gray-600/50 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden max-w-full">
                        <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex-shrink-0 w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all overflow-wrap-anywhere word-break break-word">{fileName}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 sm:ml-2 flex-shrink-0 self-start sm:self-center pl-11 sm:pl-0">
                          <button
                            type="button"
                            onClick={() => setPreviewModalFile(toPreviewFile(file))}
                            className="flex items-center space-x-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex-shrink-0 active:scale-95"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs font-medium sm:hidden">Preview</span>
                          </button>
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors duration-200 flex-shrink-0 active:scale-95 shadow-sm"
                            title="Open in new tab"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-xs font-medium">Open</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


          </div>
          <div className={`flex space-x-2 ${isQuizTakingMode ? 'hidden sm:flex' : ''}`}>
            {showStudentSubmitButton && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="hidden sm:inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            )}
            {isInstructor && !studentPreviewMode && (
              <button
                type="button"
                onClick={enterStudentPreview}
                className="inline-flex items-center px-4 py-2 border border-amber-300 dark:border-amber-600 text-sm font-medium rounded-md text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60"
              >
                <Eye className="h-4 w-4 mr-2" />
                Student preview
              </button>
            )}
            {isCreator && !viewAsStudent && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 dark:bg-red-500 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 dark:hover:bg-red-600 dark:bg-red-500"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        </div>



        {!isTeacherDashboard && (assignment.fileAssets?.length || assignment.attachments?.length) ? (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Attachments</h3>
            <FileAttachmentChips
              attachmentSources={{
                attachmentFiles: assignment.attachmentFiles,
                attachments: assignment.attachments,
                fileAssets: assignment.fileAssets,
              }}
              className="mt-2"
            />
          </div>
        ) : null}

        {showStudentUploadSection && (
          <AssignmentFileUploadSection
            uploadedFiles={uploadedFiles}
            onFilesChange={handleUploadedFilesChange}
            courseId={courseId}
            assignmentId={id}
            finalized={courseFinalized}
            disabled={viewAsStudent}
          />
        )}

        {paperUploadQuiz && canInteractAsStudent && !activeSubmission && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Upload photos or files of your completed quiz work, then submit when you are ready.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || uploadedFiles.length === 0}
              className="mt-4 inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        )}

        {viewAsStudent && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Eye className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">Student preview</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    You are viewing this assignment as students see it. Answers and uploads are not saved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={exitStudentPreview}
                className="inline-flex items-center justify-center rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900/50"
              >
                Exit student preview
              </button>
            </div>
          </div>
        )}

        {/* Timed quiz start screen — students only (not teacher preview) */}
        {showTimedQuizStartScreen && (
          <TimedQuizStartScreen
            quizTimeLimit={assignment.quizTimeLimit!}
            questionCount={assignment.questions?.length ?? 0}
            totalPoints={timedQuizTotalPoints}
            dueDate={assignment.dueDate}
            displayMode={assignment.displayMode === 'scrollable' ? 'scrollable' : 'single'}
            onStart={startQuiz}
            isStarting={isStartingQuiz}
          />
        )}

        {/* Teacher Analytics Dashboard - Always show for teachers */}
        {isTeacherDashboard && (
          <div className="mt-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <div>
                          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">Assignment Analytics</h3>
                          <p className="text-blue-700 dark:text-blue-300">Real-time statistics and performance metrics</p>
                        </div>
                      </div>
                      {loadingStats && (
                        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
                          <span>Loading stats...</span>
                        </div>
                      )}
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Submissions</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                              {submissionStats.submittedCount}/{submissionStats.totalStudents}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                              {submissionStats.totalStudents > 0 
                                ? `${((submissionStats.submittedCount / submissionStats.totalStudents) * 100).toFixed(1)}% submitted`
                                : '0% submitted'
                              }
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-blue-400 dark:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400 dark:text-green-400">Submitted</p>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{submissionStats.submittedCount}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                              {submissionStats.totalStudents > 0 
                                ? `${((submissionStats.submittedCount / submissionStats.totalStudents) * 100).toFixed(1)}% completion`
                                : '0% completion'
                              }
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-green-400 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Average Grade</p>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                              {submissionStats.averageGrade > 0 ? submissionStats.averageGrade.toFixed(1) : '0'} pts
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                              {assignment.questions && assignment.questions.length > 0 
                                ? `${assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)} total possible`
                                : assignment.totalPoints 
                                  ? `${assignment.totalPoints} total possible`
                                  : 'No points specified'}
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-purple-400 dark:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>


                    </div>

                    {/* Engagement Metrics */}
                    <div className="mb-8 grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
                      <div className="flex h-full min-h-0 flex-col rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-gray-800">
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 dark:text-indigo-400">Avg. Time Spent</p>
                            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                              {submissionStats.engagementStats.averageTimeSpent > 0 
                                ? `${Math.floor(submissionStats.engagementStats.averageTimeSpent / 60)}:${(submissionStats.engagementStats.averageTimeSpent % 60).toString().padStart(2, '0')}`
                                : '0:00'
                              }
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                              {assignment.isTimedQuiz ? 'Timed quiz' : 'Not timed'}
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-indigo-400 dark:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex h-full min-h-0 flex-col rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-gray-800">
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-teal-600 dark:text-teal-400">Avg. Attempts</p>
                            <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                              {submissionStats.engagementStats.averageAttemptsPerStudent.toFixed(1)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                              per student
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-teal-400 dark:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex h-full min-h-0 flex-col rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-gray-800">
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-pink-600 dark:text-pink-400">Peak Activity</p>
                            <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                              {submissionStats.engagementStats.peakDay}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                              {submissionStats.engagementStats.peakHour}:00
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-pink-400 dark:text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Assignment Details — flex row so all three cards share the same height */}
                    <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
                      <div className="flex min-h-0 flex-1 basis-0 flex-col rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-800 dark:bg-gray-800">
                        <h4 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">Assignment Info</h4>
                        <div className="min-h-0 flex-1 space-y-2 text-sm">
                          {assignment.questions && assignment.questions.length > 0 && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Questions:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{assignment.questions.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Total Points:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)}</span>
                              </div>
                            </>
                          )}
                          {(!assignment.questions || assignment.questions.length === 0) && assignment.totalPoints && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Total Points:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{assignment.totalPoints}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Type:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{assignment.group || (assignment.isOfflineAssignment ? 'Offline Assignment' : 'Assignment')}</span>
                          </div>
                          {assignment.isTimedQuiz && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Time Limit:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{assignment.quizTimeLimit} minutes</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-1 basis-0 flex-col rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-800 dark:bg-gray-800">
                        <h4 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">Submission Status</h4>
                        <div className="min-h-0 flex-1 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Published:</span>
                            <span className={`font-medium ${assignment.published ? 'text-green-600 dark:text-green-400 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {assignment.published ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Due Date:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{safeFormatDate(assignment.dueDate, 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Past Due:</span>
                            <span className={`font-medium ${isPastDue ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400 dark:text-green-400'}`}>
                              {isPastDue ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-1 basis-0 flex-col rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-800 dark:bg-gray-800">
                        <h4 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">Quick Actions</h4>
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                          <button
                            onClick={() => navigate(`/assignments/${id}/grade`)}
                            className="w-full text-left px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/70 rounded-md transition-colors flex items-center space-x-2 text-gray-900 dark:text-gray-100 dark:text-gray-100"
                          >
                            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span>Grade Submissions</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/assignments/${id}/edit`)}
                            className="w-full text-left px-3 py-2 text-sm bg-green-50 dark:bg-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/70 rounded-md transition-colors flex items-center space-x-2 text-gray-900 dark:text-gray-100 dark:text-gray-100"
                          >
                            <Edit className="h-4 w-4 text-green-600 dark:text-green-400 dark:text-green-400" />
                            <span>Edit Assignment</span>
                          </button>
                          <button
                            onClick={handleTogglePublish}
                            className="w-full text-left px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/70 rounded-md transition-colors flex items-center space-x-2 text-gray-900 dark:text-gray-100 dark:text-gray-100"
                          >
                            {assignment.published ? (
                              <>
                                <Lock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span>Unpublish</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span>Publish</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={enterStudentPreview}
                            className="w-full text-left px-3 py-2 text-sm bg-amber-50 dark:bg-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/70 rounded-md transition-colors flex items-center space-x-2 text-gray-900 dark:text-gray-100"
                          >
                            <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span>Student preview</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
            </div>
        )}

        {/* Assignment Questions Section */}
        {assignment.questions && assignment.questions.length > 0 && (() => {
          // Check if we should show questions to students after activeSubmission
          const isQuiz = assignment.isGradedQuiz || assignment.group === 'Quizzes';
          const shouldShowQuestions =
            viewAsStudent ||
            !showStudentExperience ||
            !activeSubmission ||
            effectivePastDue ||
            (isStudent && !!activeSubmission) ||
            (activeSubmission?.showCorrectAnswers || assignment.showCorrectAnswers ||
              activeSubmission?.showStudentAnswers || assignment.showStudentAnswers);

          return (
            <div className={hideAssignmentInfoOnMobile ? 'mt-3 lg:mt-8' : 'mt-8'}>
              {/* Show questions for students, but not in teacher dashboard */}
              {canShowQuestionPanel && shouldShowQuestions ? (
                canInteractAsStudent && !activeSubmission && assignment.displayMode === 'single' ? (
                // Student answering view with sidebar (single question mode)
                <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                  {/* Main content area */}
                  <div className="min-w-0 flex-1">
                    {showMobileQuizChrome && assignment.questions && (
                      <div className="mb-3 mt-2 space-y-3 px-3 sm:mt-0 sm:px-0">
                        <MobileQuizProgress
                          answeredCount={answeredQuestions.size}
                          totalQuestions={assignment.questions.length}
                          currentQuestion={currentQuestion}
                          mode="single"
                          timeLeft={timeLeft}
                          showTimer={showTimedQuizChrome && showTimer && quizStarted}
                          formatTime={formatTime}
                        />
                        <MobileQuestionPills
                          totalQuestions={assignment.questions.length}
                          currentQuestion={currentQuestion}
                          answeredQuestions={answeredQuestions}
                          markedQuestions={markedQuestions}
                          onSelectQuestion={navigateToQuestion}
                        />
                      </div>
                    )}
                    {!showUploadSection ? (
                      // Questions view
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
                        <div className="mb-4 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                Question {currentQuestion + 1}
                              </h3>
                              <button
                                type="button"
                                onClick={() => toggleMarkQuestion(currentQuestion)}
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                                  markedQuestions.has(currentQuestion)
                                    ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                }`}
                                aria-label={markedQuestions.has(currentQuestion) ? 'Remove bookmark' : 'Bookmark question'}
                              >
                                <Bookmark
                                  size={18}
                                  strokeWidth={2}
                                  className={`shrink-0 ${markedQuestions.has(currentQuestion) ? 'fill-current' : ''}`}
                                />
                              </button>
                            </div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:text-base">
                              {assignment.questions[currentQuestion].points} pts
                            </span>
                          </div>
                        </div>
                        
                        <div className="mb-6">
                          <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100 sm:text-lg">{assignment.questions[currentQuestion].text}</p>
                        </div>
                        
                        {/* Text input area - ALWAYS show for questions that are NOT multiple-choice or matching */}
                        {(() => {
                          const q = assignment.questions[currentQuestion];
                          if (!q) return null;
                          
                          // Only hide textarea if it's a valid multiple-choice or matching question
                          const isMultipleChoice = q.type === 'multiple-choice' && q.options && Array.isArray(q.options) && q.options.length > 0;
                          const isMatching = q.type === 'matching' && q.leftItems && Array.isArray(q.leftItems) && q.leftItems.length > 0;
                          
                          // If it's multiple-choice or matching, don't show textarea (they have their own UI)
                          if (isMultipleChoice || isMatching) {
                            return null;
                          }
                          
                          // For ALL other questions (text, or any other type), show textarea
                          return (
                            <div className="mt-4">
                              <label htmlFor={`question-${currentQuestion}-answer`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Your Answer:
                              </label>
                              {activeSubmission && isStudent ? (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                    {formatTextAnswer(getAnswerForQuestion(answers, currentQuestion)) ||
                                      'No answer provided'}
                                  </p>
                                </div>
                              ) : (
                                <textarea
                                  id={`question-${currentQuestion}-answer`}
                                  name={`question-${currentQuestion}-answer`}
                                  className="w-full min-h-[120px] sm:min-h-[128px] p-3 sm:p-4 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-y text-sm sm:text-base"
                                  value={formatTextAnswer(getAnswerForQuestion(answers, currentQuestion))}
                                  onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                                  placeholder="Enter your answer here..."
                                  rows={5}
                                  disabled={!!activeSubmission || !canInteractAsStudent}
                                />
                              )}
                            </div>
                          );
                        })()}
                        
                        {assignment.questions[currentQuestion].type === 'multiple-choice' && assignment.questions[currentQuestion].options && (
                          <div className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-slate-200 dark:sm:divide-slate-700">
                            {assignment.questions[currentQuestion].options?.map((option, optionIndex) => (
                              <div key={optionIndex} className="sm:relative sm:py-2">
                                <input
                                  type="radio"
                                  id={`question-${currentQuestion}-option-${optionIndex}`}
                                  name={`question-${currentQuestion}`}
                                  value={option.text}
                                  checked={answers[currentQuestion] === option.text}
                                  onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                                  className="sr-only"
                                />
                                <label
                                  htmlFor={`question-${currentQuestion}-option-${optionIndex}`}
                                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition active:scale-[0.99] sm:min-h-0 sm:rounded-none sm:border-0 sm:px-0 sm:py-2 ${
                                    answers[currentQuestion] === option.text
                                      ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40'
                                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
                                  }`}
                                >
                                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                    answers[currentQuestion] === option.text
                                      ? 'border-indigo-500 bg-indigo-500'
                                      : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                                  }`}>
                                    {answers[currentQuestion] === option.text && (
                                      <div className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />
                                    )}
                                  </div>
                                  <span className="text-sm text-slate-900 dark:text-slate-100 sm:text-base">{option.text}</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        
                        {assignment.questions[currentQuestion].type === 'matching' && (
                          <div className="space-y-4">
                            {/* Check if matching question has data */}
                            {assignment.questions[currentQuestion].leftItems && 
                             assignment.questions[currentQuestion].rightItems && 
                             assignment.questions[currentQuestion].leftItems.length > 0 && 
                             assignment.questions[currentQuestion].rightItems && assignment.questions[currentQuestion].rightItems.length > 0 ? (
                              <>
                                {/* Only show reference columns for teachers/admins, not for students */}
                                {(user?.role === 'teacher' || user?.role === 'admin') && !viewAsStudent && (
                                  <div className="grid grid-cols-2 gap-6 mb-6">
                                    {/* Left Column - Items to match */}
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Left Items</h4>
                                      <div className="space-y-2">
                                        {assignment.questions[currentQuestion].leftItems?.map((leftItem, idx) => (
                                          <div key={leftItem.id || idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-900 dark:text-gray-100">{leftItem.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    {/* Right Column - Correct matches */}
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Right Items (Correct Matches)</h4>
                                      <div className="space-y-2">
                                        {assignment.questions && assignment.questions[currentQuestion]?.rightItems?.map((rightItem, idx) => {
                                          const currentQ = assignment.questions?.[currentQuestion];
                                          const matchingLeft = currentQ?.leftItems?.find(left => left.id === rightItem.id);
                                          return (
                                            <div key={rightItem.id || idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                              <span className="text-sm text-gray-900 dark:text-gray-100">{rightItem.text}</span>
                                              {matchingLeft && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">← {matchingLeft.text}</span>
                                              )}
                                          </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Student matching interface */}
                                {canInteractAsStudent && !activeSubmission && (
                                  <div className="space-y-3">
                                    {assignment.questions && assignment.questions[currentQuestion]?.leftItems?.map((leftItem, leftIndex) => {
                                      const currentQ = assignment.questions?.[currentQuestion];
                                      const questionShuffledOptions = shuffledOptions[currentQuestion] || 
                                        (Array.isArray(currentQ?.rightItems) && 
                                         currentQ?.rightItems && currentQ.rightItems.length > 0 ? 
                                         shuffleArray([...currentQ.rightItems]) : []);
                                      
                                      const currentAnswers = answers[currentQuestion] || {};
                                      const selectedOptions = Object.values(currentAnswers).filter(option => option !== '');
                                      const availableOptions = questionShuffledOptions.filter(option => 
                                        currentAnswers[leftIndex] === option.text ||
                                        !selectedOptions.includes(option.text)
                                      );
                                      
                                      return (
                                        <div key={leftItem.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                                          <div className="flex-1">
                                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{leftItem.text}</span>
                                        </div>
                                          <div className="flex items-center space-x-2 ml-4">
                                        <select
                                              value={typeof answers[currentQuestion] === 'object' ? (answers[currentQuestion] as Record<number, string>)[leftIndex] || '' : ''}
                                          onChange={(e) => {
                                                const newAnswers: Record<string, string | Record<number, string>> = { ...answers };
                                                if (!newAnswers[currentQuestion]) newAnswers[currentQuestion] = {};
                                                (newAnswers[currentQuestion] as Record<number, string>)[leftIndex] = e.target.value;
                                                handleAnswerChange(currentQuestion, newAnswers[currentQuestion] as Record<number, string>);
                                          }}
                                              className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-w-[150px]"
                                        >
                                              <option value="">Choose...</option>
                                              {availableOptions.map((option, optionIndex) => (
                                                <option key={optionIndex} value={option.text}>
                                                  {option.text}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                  </div>
                                      );
                                    })}
                                </div>
                                )}
                                
                                {/* Show answers for submitted assignments */}
                                {activeSubmission && (() => {
                                  const currentSubmission: Submission = activeSubmission; // Type assertion for IIFE
                                  const isQuiz = assignment.isGradedQuiz || assignment.group === 'Quizzes';
                                  const showFeedback = (currentSubmission.showCorrectAnswers || assignment.showCorrectAnswers || currentSubmission.showStudentAnswers || assignment.showStudentAnswers || currentSubmission.autoGraded);
                                  
                                  if (!showFeedback) return null;
                                  
                                  return (
                                    <div className="space-y-3">
                                      {assignment.questions && assignment.questions[currentQuestion]?.leftItems?.map((leftItem, leftIndex) => {
                                        const currentQ = assignment.questions?.[currentQuestion];
                                        const studentMatch = typeof answers[currentQuestion] === 'object' ? 
                                          (answers[currentQuestion] as Record<number, string>)[leftIndex] : '';
                                        const correctRightItem = currentQ?.rightItems?.find(rightItem => 
                                          rightItem.id === leftItem.id
                                        );
                                        const isCorrect = studentMatch === (correctRightItem?.text || '');
                                        const showCorrectAnswer = currentSubmission.showCorrectAnswers || assignment.showCorrectAnswers;
                                        
                                        return (
                                          <div key={leftItem.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                                            isCorrect 
                                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                          }`}>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{leftItem.text}</span>
                                              <span className="text-gray-500 dark:text-gray-300">→</span>
                                              <span className="text-gray-900 dark:text-gray-100">{studentMatch || 'No answer'}</span>
                                            </div>
                                            {isCorrect ? (
                                              <span className="text-green-600 dark:text-green-400 text-sm">✓ Correct</span>
                                            ) : (
                                              <span className="text-red-600 dark:text-red-400 text-sm">
                                                {showCorrectAnswer ? `✗ Should be: ${correctRightItem?.text || 'N/A'}` : '✗ Incorrect'}
                                              </span>
                                            )}
                                    </div>
                                        );
                                      })}
                                </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <div className="text-gray-500 dark:text-gray-400 text-sm">Matching question data is incomplete.</div>
                            )}
                          </div>
                        )}
                        
                        <div className="mt-8 hidden border-t border-slate-200 pt-6 lg:flex lg:justify-between dark:border-slate-700">
                          <button
                            onClick={() => navigateToQuestion(0)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-700"
                          >
                            Back to Questions
                          </button>
                          
                          {currentQuestion === assignment.questions.length - 1 ? (
                            isStudent ? (
                              <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                              >
                                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                              </button>
                            ) : null
                          ) : (
                            <button
                              onClick={nextQuestion}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              Next Question
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                      <AssignmentFileUploadSection
                        uploadedFiles={uploadedFiles}
                        onFilesChange={handleUploadedFilesChange}
                        courseId={courseId}
                        assignmentId={id}
                        finalized={courseFinalized}
                        disabled={viewAsStudent}
                      />
                        <div className="mt-8 hidden border-t border-slate-200 pt-6 lg:flex lg:justify-between dark:border-slate-700">
                          <button
                            onClick={() => navigateToQuestion(0)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Back to Questions
                          </button>
                          
                          {currentQuestion === assignment.questions.length - 1 ? (
                            isStudent ? (
                              <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600"
                              >
                                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                              </button>
                            ) : null
                          ) : (
                            <button
                              onClick={nextQuestion}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
                            >
                              Next Question
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Sidebar — desktop only */}
                  <div className="hidden w-80 shrink-0 rounded-lg bg-slate-50 p-4 dark:bg-slate-800 lg:block">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Questions</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {assignment.questions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => navigateToQuestion(index)}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-sm ${
                              currentQuestion === index
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'hover:bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {answeredQuestions.has(index) && markedQuestions.has(index) ? (
                                <div className="relative">
                                  <Circle className="h-4 w-4 text-green-600 dark:text-green-400 fill-current" />
                                  <Bookmark className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                                </div>
                              ) : answeredQuestions.has(index) ? (
                                <Circle className="h-4 w-4 text-green-600 dark:text-green-400 fill-current" />
                              ) : markedQuestions.has(index) ? (
                                <Bookmark className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-gray-400" />
                              )}
                              <span>Question {index + 1}</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{question.points} pts</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                                          <div className="border-t pt-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <div className="flex items-center justify-between">
                            <span>Progress</span>
                            <span>{answeredQuestions.size} of {assignment.questions.length} answered</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(answeredQuestions.size / assignment.questions.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Timer Display for timed quizzes - under the progress bar */}
                      {showTimedQuizChrome && (
                        <div className="mt-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <div className="flex items-center justify-between">
                              <span>Time Remaining:</span>
                              <button 
                                onClick={() => setShowTimer(!showTimer)}
                                className="text-blue-600 hover:text-blue-800 underline text-xs"
                              >
                                {showTimer ? 'Hide' : 'Show'}
                              </button>
                            </div>
                          </div>
                          {showTimer && (
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Attempt due: {safeFormatDate(assignment.dueDate, 'MMM d \'at\' h:mm a')}
                              </div>
                              {quizStarted && timeLeft !== null ? (
                                <div
                                  className={`text-sm font-medium ${timeLeft <= 300 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}
                                  role="status"
                                  aria-live="polite"
                                  aria-label={`Server-synced time remaining ${formatTime(timeLeft)}`}
                                >
                                  {formatTime(timeLeft)}
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {assignment.quizTimeLimit} minutes
                                </div>
                              )}
                              {!quizStarted && (
                                <button
                                  onClick={startQuiz}
                                  className="mt-2 w-full bg-indigo-600 dark:bg-indigo-500 text-white text-sm py-2 px-3 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600"
                                >
                                  Start Quiz
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                // Teacher/Admin view, submitted view, or scrollable mode - show all questions
                <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">
                  {/* Main content area */}
                  <div className="min-w-0 flex-1">
                    {showMobileQuizChrome && (
                      <div className="mb-4 mt-2 lg:mt-0">
                        <MobileQuizProgress
                        answeredCount={answeredQuestions.size}
                        totalQuestions={assignment.questions.length}
                        currentQuestion={currentQuestion}
                        mode="scrollable"
                        timeLeft={timeLeft}
                        showTimer={showTimedQuizChrome && showTimer && quizStarted}
                        formatTime={formatTime}
                      />
                      </div>
                    )}
                    <h3 className="mb-3 hidden text-lg font-semibold text-slate-900 dark:text-slate-100 sm:mb-4 sm:block">
                      Questions
                    </h3>
                    <div className="space-y-4 sm:space-y-6">
                                              {assignment.questions.map((question, index) => {
                        // Check if this is a submitted quiz and we should show feedback
                        const isQuiz = assignment.isGradedQuiz || assignment.group === 'Quizzes';
                        let isCorrect = false;
                        let showFeedback = false;
                        let correctAnswer = null;
                        if (activeSubmission && isQuiz && 
                            (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) &&
                            (question.type === 'multiple-choice' || question.type === 'matching')) {
                          showFeedback = true;
                          // Use the parsed answers from state instead of raw activeSubmission answers
                          const studentAnswer = answers[index];
                          
                          if (question.type === 'multiple-choice' && question.options) {
                            const correctOption = question.options.find(opt => opt.isCorrect);
                            isCorrect = studentAnswer === correctOption?.text;
                          } else                           if (question.type === 'matching' && question.leftItems && question.rightItems) {
                            // For matching questions, check if all matches are correct
                            if (studentAnswer && typeof studentAnswer === 'object') {
                              let correctMatches = 0;
                              let totalMatches = 0;
                              

                              
                              for (let j = 0; j < question.leftItems.length; j++) {
                                const leftItem = question.leftItems[j];
                                const studentMatch = studentAnswer[j];
                                const correctRightItem = question.rightItems.find(rightItem => 
                                  rightItem.id === leftItem.id
                                );
                                
                                
                                
                                if (correctRightItem && studentMatch === correctRightItem.text) {
                                  correctMatches++;
                                }
                                totalMatches++;
                              }
                              
                              isCorrect = correctMatches === totalMatches && totalMatches > 0;

                            }
                          }
                        }
                        
                        // For teacher preview, show correct answers
                        if (isTeacherDashboard && question.type === 'multiple-choice' && question.options) {
                          correctAnswer = question.options.find(opt => opt.isCorrect)?.text;
                        }
                        
                        // Enhanced teacher preview styling
                        const isTeacherDashboardMode = isTeacherDashboard;
                        
                        // Determine feedback mode
                        const showFullFeedback = activeSubmission && isQuiz && 
                          (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.autoGraded);
                        const showOnlyCorrectHighlight = activeSubmission && isQuiz && 
                          (activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && 
                          !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.autoGraded);
                        const feedbackEnabled = showFullFeedback || showOnlyCorrectHighlight;
                        

                                                  
                                                  return (
                            <div key={question.id || question._id || index} className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6 sm:shadow-md ${
                              isTeacherDashboard 
                                ? 'border-blue-400 bg-blue-50 shadow-blue-100 dark:bg-blue-950/30' 
                                : (() => {
                                    // Determine feedback mode for border colors
                                    const showFullFeedbackForBorder = activeSubmission && activeSubmission.autoGraded;
                                    const showOnlyCorrectForBorder = activeSubmission && isQuiz && 
                                      (activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && 
                                      !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.autoGraded);
                                    
                                    if (activeSubmission && (activeSubmission.autoGraded || (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.showStudentAnswers || assignment.showStudentAnswers)) && (question.type === 'multiple-choice' || question.type === 'matching')) {
                                      if (question.type === 'multiple-choice') {
                                        const studentAnswer = answers[index];
                                        const correctOption = question.options?.find(opt => opt.isCorrect);
                                        const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                        
                                        if (showFullFeedbackForBorder || (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers)) {
                                          // Full feedback: green/red
                                          return isCorrect 
                                            ? 'border-green-500 dark:border-green-500' 
                                            : 'border-red-500 dark:border-red-500';
                                        } else if (showOnlyCorrectForBorder) {
                                          // showStudentAnswers: green for correct, red for wrong (but don't show correct answer)
                                          return isCorrect 
                                            ? 'border-green-500 dark:border-green-500' 
                                            : 'border-red-500 dark:border-red-500';
                                        }
                                      } else if (question.type === 'matching') {
                                        const autoGrade = activeSubmission.autoQuestionGrades instanceof Map 
                                          ? activeSubmission.autoQuestionGrades.get(index.toString())
                                          : activeSubmission.autoQuestionGrades?.[index.toString()];
                                        const maxPoints = question.points || 0;
                                        const percentageCorrect = autoGrade && maxPoints > 0 ? autoGrade / maxPoints : 0;
                                        
                                        if (showFullFeedbackForBorder || (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers)) {
                                          // Full feedback: green/red/yellow
                                          if (percentageCorrect === 1) {
                                            return 'border-green-500 dark:border-green-500'; // All correct
                                          } else if (percentageCorrect === 0) {
                                            return 'border-red-500 dark:border-red-500'; // All incorrect
                                          } else {
                                            return 'border-yellow-500 dark:border-yellow-500'; // Partially correct
                                          }
                                        } else if (showOnlyCorrectForBorder) {
                                          // showStudentAnswers: green/red/yellow (but don't show correct answers)
                                          if (percentageCorrect === 1) {
                                            return 'border-green-500 dark:border-green-500'; // All correct
                                          } else if (percentageCorrect === 0) {
                                            return 'border-red-500 dark:border-red-500'; // All incorrect
                                          } else {
                                            return 'border-yellow-500 dark:border-yellow-500'; // Partially correct
                                          }
                                        }
                                      }
                                    }
                                    if (feedbackEnabled && showFeedback) {
                                      if (showFullFeedback) {
                                        // Full feedback: green for correct, red/yellow for wrong
                                        return isCorrect ? 'border-green-500 dark:border-green-400' : 'border-red-500 dark:border-red-400';
                                      } else if (showOnlyCorrectHighlight) {
                                        // Only highlight correct: green for correct, gray for wrong
                                        return isCorrect ? 'border-green-500 dark:border-green-400' : 'border-gray-300 dark:border-gray-600';
                                      }
                                    }
                                    return 'border-slate-200/90 dark:border-slate-700/80';
                                  })()
                            }`}>
                          <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4 sm:rounded-xl sm:bg-slate-50 sm:p-3 dark:sm:bg-slate-800/60">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <span className="inline-flex shrink-0 items-center rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                Q{index + 1}
                              </span>
                              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">
                                Question {index + 1}
                              </h4>
                                {isTeacherDashboard && (
                                  <span className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-full font-bold">
                                    TEACHER PREVIEW
                                  </span>
                                )}
                                {canInteractAsStudent && !activeSubmission && (
                                  <button
                                    type="button"
                                    onClick={() => toggleMarkQuestion(index)}
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                                      markedQuestions.has(index)
                                        ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                    aria-label={markedQuestions.has(index) ? 'Remove bookmark' : 'Bookmark question'}
                                  >
                                    <Bookmark
                                      size={18}
                                      strokeWidth={2}
                                      className={`shrink-0 ${markedQuestions.has(index) ? 'fill-current' : ''}`}
                                    />
                                  </button>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center">
                                {activeSubmission && activeSubmission.autoGraded && (question.type === 'multiple-choice' || question.type === 'matching') ? (
                                  (() => {
                                    const autoGrade = activeSubmission.autoQuestionGrades instanceof Map 
                                      ? activeSubmission.autoQuestionGrades.get(index.toString())
                                      : activeSubmission.autoQuestionGrades?.[index.toString()];
                                    return (
                                      <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                                        {(() => {
                                          const earned = Number(autoGrade || 0);
                                          const total = question.points;
                                          const earnedFormatted = Number.isInteger(earned) ? earned.toString() : earned.toFixed(2);
                                          const totalFormatted = Number.isInteger(total) ? total.toString() : total.toFixed(2);
                                          return `${earnedFormatted} / ${totalFormatted} pts`;
                                        })()}
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                                    {question.points} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          <div className="mb-4">
                            <p className="text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100 sm:text-lg">{question.text}</p>

                            {question.type === 'multiple-choice' && (
                              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Select the correct answer.</p>
                            )}
                          </div>
                          
                          {question.type === 'multiple-choice' && question.options && (
                            <div>
                              {/* Show detailed feedback for submitted assignments */}
                              {activeSubmission && (activeSubmission.autoGraded || (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.showStudentAnswers || assignment.showStudentAnswers)) && (
                                <div className={`mb-4 p-3 sm:p-4 rounded-lg ${
                                  (() => {
                                    const studentAnswer = answers[index];
                                    const correctOption = question.options.find(opt => opt.isCorrect);
                                    const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                    const showFullFeedbackForBox = activeSubmission && isQuiz && 
                                      (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers);
                                    const showOnlyCorrectForBox = activeSubmission && isQuiz && 
                                      (activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && 
                                      !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers);
                                    
                                    if (isCorrect) {
                                      return 'bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-600';
                                    } else if (showFullFeedbackForBox) {
                                      return 'bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-600';
                                    } else if (showOnlyCorrectForBox) {
                                      // showStudentAnswers: red for incorrect (but don't show correct answer)
                                      return 'bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-600';
                                    } else {
                                      return 'bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600';
                                    }
                                  })()
                                }`}>
                                  <div className="text-sm sm:text-base text-blue-800 dark:text-blue-400 font-medium mb-2 sm:mb-3">
                                    Auto-Graded Results
                                  </div>
                                  {(() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = activeSubmission.autoQuestionGrades instanceof Map 
                                      ? activeSubmission.autoQuestionGrades.get(index.toString())
                                      : activeSubmission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    const correctOption = question.options?.find(opt => opt.isCorrect);
                                    const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                    
                                    return (
                                      <div className="space-y-2 sm:space-y-3">
                                        <div className="text-sm sm:text-base text-blue-700 dark:text-blue-400 font-semibold">
                                          {(() => {
                                            const earned = Number(autoGrade || 0);
                                            const total = maxPoints;
                                            const earnedFormatted = Number.isInteger(earned) ? earned.toString() : earned.toFixed(2);
                                            const totalFormatted = Number.isInteger(total) ? total.toString() : total.toFixed(2);
                                            return `${earnedFormatted} / ${totalFormatted} pts`;
                                          })()}
                                        </div>
                                        {/* Option 1: showCorrectAnswers - Show correctness (green/red) but NOT the correct answer */}
                                        {(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) && !(activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && (
                                          <div className={`text-sm sm:text-base font-medium ${isCorrect ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                                            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                          </div>
                                        )}
                                        {/* Option 2: showStudentAnswers - Show student's answer, mark wrong in red, and show correct answer for wrong ones */}
                                        {(activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) && (
                                          <>
                                            <div>
                                              <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-100 mb-1.5 sm:mb-2">Your Answer:</div>
                                              <div className={`text-sm sm:text-base mb-2 sm:mb-3 break-words ${isCorrect ? 'text-green-600 dark:text-green-300 font-medium' : 'text-red-600 dark:text-red-300 font-medium'}`}>
                                                {typeof studentAnswer === 'string' ? studentAnswer : 'No answer'}
                                                {isCorrect ? ' ✓' : ' ✗'}
                                              </div>
                                            </div>
                                            {!isCorrect && correctOption && (
                                              <div className="mt-2 sm:mt-3">
                                                <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-100 mb-1.5 sm:mb-2">Correct Answer:</div>
                                                <div className="text-sm sm:text-base text-green-600 dark:text-green-300 font-medium break-words">
                                                  {correctOption.text}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              {/* Show regular multiple-choice interface for non-submitted or non-auto-graded assignments */}
                              {(!activeSubmission || (!activeSubmission.autoGraded && !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.showStudentAnswers || assignment.showStudentAnswers))) && (
                                <div className="space-y-2">
                                  {question.options.map((option, optionIndex) => (
                                    <div key={optionIndex} className="relative">
                                      <input
                                        type="radio"
                                        id={`question-${index}-option-${optionIndex}`}
                                        name={`question-${index}`}
                                        value={option.text}
                                        checked={answers[index] === option.text}
                                        onChange={(e) => !activeSubmission && showStudentExperience && handleAnswerChange(index, e.target.value)}
                                        disabled={!!activeSubmission || !canInteractAsStudent}
                                        className="sr-only"
                                      />
                                      <label 
                                        htmlFor={`question-${index}-option-${optionIndex}`} 
                                        className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors touch-manipulation sm:px-4 ${
                                          answers[index] === option.text
                                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40'
                                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
                                        } ${(!!activeSubmission || !canInteractAsStudent) ? 'cursor-not-allowed opacity-60' : ''}`}
                                      >
                                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                          answers[index] === option.text
                                            ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-500'
                                            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                                        }`}>
                                          {answers[index] === option.text && (
                                            <div className="h-2 w-2 rounded-full bg-white" />
                                          )}
                                        </div>
                                        <span className="text-sm leading-snug text-slate-900 dark:text-slate-100">{option.text}</span>
                                        {isTeacherDashboard && option.isCorrect && (
                                          <span className="ml-auto inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                            Correct
                                          </span>
                                        )}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {isTextLikeQuestion(question) && (
                            <div className="mt-4">
                              <label htmlFor={`question-${index}-answer`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Your Answer:
                              </label>
                              {activeSubmission && isStudent ? (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                    {formatTextAnswer(getAnswerForQuestion(answers, index)) ||
                                      'No answer provided'}
                                  </p>
                                </div>
                              ) : (
                                <textarea
                                  id={`question-${index}-answer`}
                                  name={`question-${index}-answer`}
                                  className="w-full min-h-[120px] sm:min-h-[128px] p-3 sm:p-4 border-2 border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-y text-sm sm:text-base"
                                  value={formatTextAnswer(getAnswerForQuestion(answers, index))}
                                  onChange={(e) => !activeSubmission && showStudentExperience && handleAnswerChange(index, e.target.value)}
                                  placeholder={showStudentExperience ? "Enter your answer here..." : "Student's answer will appear here"}
                                  disabled={!!activeSubmission || !canInteractAsStudent}
                                  rows={5}
                                />
                              )}
                            </div>
                          )}
                          
                          {question.type === 'matching' && question.leftItems && question.rightItems && (
                            <div className="space-y-2">
                              
                              {/* Show detailed feedback for submitted assignments */}
                              {activeSubmission && (activeSubmission.autoGraded || (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers || activeSubmission.showStudentAnswers || assignment.showStudentAnswers)) && (
                                <div className={`mb-4 p-3 sm:p-4 rounded-lg ${
                                  (() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = activeSubmission.autoQuestionGrades instanceof Map 
                                      ? activeSubmission.autoQuestionGrades.get(index.toString())
                                      : activeSubmission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    const percentageCorrect = autoGrade && maxPoints > 0 ? autoGrade / maxPoints : 0;
                                    
                                    // Option 1: showCorrectAnswers - just show green/red
                                    const showOption1MatchBox = activeSubmission && isQuiz && 
                                      (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) &&
                                      !(activeSubmission.showStudentAnswers || assignment.showStudentAnswers);
                                    // Option 2: showStudentAnswers - show student answer and correct answer for wrong ones
                                    const showOption2MatchBox = activeSubmission && isQuiz && 
                                      (activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && 
                                      !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers);
                                    
                                    if (percentageCorrect === 1) {
                                      return 'bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-600'; // All correct
                                    } else if (showOption1MatchBox || showOption2MatchBox || activeSubmission.autoGraded) {
                                      // Both options show red/yellow for wrong/partial
                                      if (percentageCorrect > 0) {
                                        return 'bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-600'; // Partially correct
                                      } else {
                                        return 'bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-600'; // All incorrect
                                      }
                                    } else {
                                      return 'bg-gray-50 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600';
                                    }
                                  })()
                                }`}>
                                  <div className="text-sm sm:text-base text-blue-800 dark:text-blue-400 font-medium mb-2 sm:mb-3">
                                    Auto-Graded Results
                                  </div>
                                  {(() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = activeSubmission.autoQuestionGrades instanceof Map 
                                      ? activeSubmission.autoQuestionGrades.get(index.toString())
                                      : activeSubmission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    
                                    return (
                                      <div className="space-y-2 sm:space-y-3">
                                        <div className="text-sm sm:text-base text-blue-700 dark:text-blue-400 font-semibold">
                                          {(() => {
                                            const earned = Number(autoGrade || 0);
                                            const total = maxPoints;
                                            const earnedFormatted = Number.isInteger(earned) ? earned.toString() : earned.toFixed(2);
                                            const totalFormatted = Number.isInteger(total) ? total.toString() : total.toFixed(2);
                                            return `${earnedFormatted} / ${totalFormatted} pts`;
                                          })()}
                                        </div>
                                        <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-100 mb-2 sm:mb-3">Student Answer:</div>
                                        {question.leftItems?.map((leftItem, leftIndex) => {
                                          const studentMatch = typeof studentAnswer === 'object' ? 
                                            (studentAnswer as Record<number, string>)[leftIndex] : '';
                                          const correctRightItem = question.rightItems?.find(rightItem => 
                                            rightItem.id === leftItem.id
                                          );
                                          const isCorrect = studentMatch === (correctRightItem?.text || '');
                                          
                                          return (
                                            <div key={leftItem.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg ${
                                              (() => {
                                                // Option 1: showCorrectAnswers - just show green/red
                                                const showOption1Match = activeSubmission && isQuiz && 
                                                  (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) &&
                                                  !(activeSubmission.showStudentAnswers || assignment.showStudentAnswers);
                                                // Option 2: showStudentAnswers - show student answer and correct answer for wrong ones
                                                const showOption2Match = activeSubmission && isQuiz && 
                                                  (activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && 
                                                  !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers);
                                                
                                                if (isCorrect) {
                                                  return 'bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700';
                                                } else if (showOption1Match || showOption2Match) {
                                                  // Both options show red for incorrect
                                                  return 'bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700';
                                                } else {
                                                  return 'bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700';
                                                }
                                              })()
                                            }`}>
                                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base break-words">{leftItem.text}</span>
                                                <span className="text-gray-500 dark:text-gray-300 flex-shrink-0 text-sm sm:text-base">→</span>
                                                <span className="text-gray-900 dark:text-gray-100 text-sm sm:text-base break-words">{studentMatch || 'No answer'}</span>
                                              </div>
                                              <div className="flex items-center justify-between sm:justify-end space-x-2 sm:ml-4 flex-wrap sm:flex-nowrap gap-2 sm:gap-0">
                                                {isCorrect ? (
                                                  <div className="flex items-center text-green-600 dark:text-green-300">
                                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-xs sm:text-sm font-medium">Correct</span>
                                                  </div>
                                                ) : (
                                                  <div className={`flex items-center ${
                                                    (() => {
                                                      const showOption1Match = activeSubmission && isQuiz && 
                                                        (activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) &&
                                                        !(activeSubmission.showStudentAnswers || assignment.showStudentAnswers);
                                                      const showOption2Match = activeSubmission && isQuiz && 
                                                        (activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && 
                                                        !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers);
                                                      
                                                      if (showOption1Match || showOption2Match) {
                                                        // Both options show red for incorrect
                                                        return 'text-red-600 dark:text-red-300';
                                                      } else {
                                                        return 'text-gray-500 dark:text-gray-300';
                                                      }
                                                    })()
                                                  }`}>
                                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    <span className="text-xs sm:text-sm font-medium">Incorrect</span>
                                                  </div>
                                                )}
                                                {!isCorrect && correctRightItem && (
                                                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-200 ml-0 sm:ml-4 mt-1 sm:mt-0 w-full sm:w-auto">
                                                    {/* Only show correct answer if showStudentAnswers is enabled (Option 2) */}
                                                    {(activeSubmission.showStudentAnswers || assignment.showStudentAnswers) && !(activeSubmission.showCorrectAnswers || assignment.showCorrectAnswers) ? (
                                                      <>Correct: <span className="font-medium text-green-600 dark:text-green-300 break-words">{correctRightItem.text}</span></>
                                                    ) : null}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              {/* Show regular matching interface for non-submitted or non-auto-graded assignments */}
                              {(!activeSubmission || !activeSubmission.autoGraded) && (
                                question.leftItems.map((leftItem, leftIndex) => {
                                  // Use the same shuffled options for all dropdowns in this question
                                  // This ensures consistency - all dropdowns show the same shuffled order
                                  const questionShuffledOptions = shuffledOptions[index] || (Array.isArray(question.rightItems) && question.rightItems.length > 0 ? shuffleArray([...question.rightItems]) : []);
                                  
                                  // Filter out already selected options from other dropdowns
                                  const currentAnswers = answers[index] || {};
                                  const selectedOptions = Object.values(currentAnswers).filter(option => option !== '');
                                  const availableOptions = questionShuffledOptions.filter(option => 
                                    // Include the currently selected option for this dropdown
                                    currentAnswers[leftIndex] === option.text ||
                                    // Include options that haven't been selected in other dropdowns
                                    !selectedOptions.includes(option.text)
                                  );
                                  
                                  return (
                                    <div key={leftItem.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex-1">
                                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{leftItem.text}</span>
                                      </div>
                                      <div className="flex items-center space-x-2 ml-2">
                                        <select
                                          id={`question-${index}-matching-${leftIndex}`}
                                          name={`question-${index}-matching-${leftIndex}`}
                                          value={typeof answers[index] === 'object' ? (answers[index] as Record<number, string>)[leftIndex] || '' : ''}
                                          onChange={(e) => {
                                            if (!activeSubmission && canInteractAsStudent) {
                                              const newAnswers: Record<string, string | Record<number, string>> = { ...answers };
                                              if (!newAnswers[index]) newAnswers[index] = {};
                                              (newAnswers[index] as Record<number, string>)[leftIndex] = e.target.value;
                                              handleAnswerChange(index, newAnswers[index] as Record<number, string>);
                                            }
                                          }}
                                          disabled={!!activeSubmission || !canInteractAsStudent}
                                          className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 min-w-[120px]"
                                        >
                                          <option value="">Choose...</option>
                                          {availableOptions.map((option, optionIndex) => (
                                            <option key={optionIndex} value={option.text}>
                                              {option.text}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                      })}
                    </div>
                    
                    {/* File Upload Section for Students - at the bottom of scrollable mode */}
                    {showStudentUploadSection && (
                      <AssignmentFileUploadSection
                        uploadedFiles={uploadedFiles}
                        onFilesChange={handleUploadedFilesChange}
                        courseId={courseId}
                        assignmentId={id}
                        finalized={courseFinalized}
                        disabled={viewAsStudent}
                      />
                    )}

                    {/* Submit button for scrollable mode — desktop only; mobile uses inline bar at page end */}
                    {isStudent && !activeSubmission && !effectivePastDue && assignment.displayMode === 'scrollable' && (
                      <div className="mt-8 hidden lg:block">
                        <button
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                        </button>
                      </div>
                    )}

                    {/* Teacher Preview Summary */}

                  </div>
                  
                  {/* Sidebar for scrollable mode - only show for students answering */}
                  {canInteractAsStudent && !activeSubmission && (
                    <div className="hidden w-80 shrink-0 lg:block">
                    <ScrollableQuizSidebar
                      totalQuestions={assignment.questions.length}
                      questions={assignment.questions}
                      answeredQuestions={answeredQuestions}
                      markedQuestions={markedQuestions}
                      isTimedQuiz={showTimedQuizChrome}
                      showTimer={showTimer}
                      onToggleTimer={() => setShowTimer(!showTimer)}
                      dueDate={assignment.dueDate}
                      quizStarted={quizStarted}
                      timeLeft={timeLeft}
                      formatTime={formatTime}
                      quizTimeLimit={assignment.quizTimeLimit}
                      onStartQuiz={startQuiz}
                    />
                    </div>
                  )}
                </div>
              )
              ) : null}
            </div>
          );
        })()}

        {showMobileAssignmentSubmitBar && (
          <div className="mt-6 px-3 pb-4 lg:hidden">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
            </button>
          </div>
        )}

      </div>

      {showMobileQuizChrome && (
        <MobileQuizChrome
          mode={isScrollableQuiz ? 'scrollable' : 'single'}
          currentQuestion={currentQuestion}
          totalQuestions={assignment.questions?.length ?? 0}
          questions={assignment.questions ?? []}
          answeredQuestions={answeredQuestions}
          markedQuestions={markedQuestions}
          isSubmitting={isSubmitting}
          showQuestionPicker={showQuestionPicker}
          onOpenQuestionPicker={() => setShowQuestionPicker(true)}
          onCloseQuestionPicker={() => setShowQuestionPicker(false)}
          onSelectQuestion={navigateToQuestion}
          onPrev={prevQuestion}
          onNext={nextQuestion}
          onSubmit={handleSubmit}
        />
      )}

      <FilePreviewModal
        file={previewModalFile}
        open={!!previewModalFile}
        onClose={() => setPreviewModalFile(null)}
      />

      {/* Delete Assignment Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Assignment"
        message="Are you sure you want to delete this assignment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default ViewAssignment; 