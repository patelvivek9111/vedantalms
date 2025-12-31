import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Lock, Unlock, HelpCircle, CheckCircle, Circle, Bookmark, BarChart3, Edit, Eye, ArrowLeft, X, Download } from 'lucide-react';
import { API_URL } from '../../config';
import FilePreview from './FilePreview';
import logger from '../../utils/logger';

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
  published?: boolean;
  totalPoints?: number;
  module?: string | { _id: string };
  isGradedQuiz?: boolean;
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
}

interface UploadedFile {
  name: string;
  url: string;
  size?: number;
}

interface PreviewFile {
  url: string;
  name: string;
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
  const [courseId, setCourseId] = useState<string | undefined>(propCourseId);
  
  // Debug: Log when courseId changes
  useEffect(() => {
    console.log('[CourseId] courseId changed:', courseId, 'propCourseId:', propCourseId);
  }, [courseId, propCourseId]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [studentGroupId, setStudentGroupId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showTimer, setShowTimer] = useState<boolean>(true);
  const [showUploadSection, setShowUploadSection] = useState<boolean>(false);
  const [shuffledOptions, setShuffledOptions] = useState<Record<number, Question['rightItems']>>({});
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  
  // Course-level grade data
  const [courseAverage, setCourseAverage] = useState<number | null>(null); // For teachers
  const [studentCourseGrade, setStudentCourseGrade] = useState<number | null>(null); // For students

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

  // Define instructor and student checks early
  const isInstructor = user?.role === 'teacher' || user?.role === 'admin';
  const isStudent = user?.role === 'student';

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
    setSubmission(null); // Clear submission state when user changes
  }, [user, id]);

  // Fetch submission statistics for teachers
  const fetchSubmissionStats = async () => {
    if (!isInstructor || !assignment?._id) return;
    
    try {
      setLoadingStats(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/assignments/${assignment._id}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSubmissionStats(response.data.stats);
      }
    } catch (error) {
      logger.error('Error fetching submission stats', error instanceof Error ? error : new Error(String(error)));
      // Fallback: calculate basic stats from submissions
      try {
        const token = localStorage.getItem('token');
        const submissionsResponse = await axios.get(`/api/submissions/assignment/${assignment._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const submissions = submissionsResponse.data || [];
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
        
        const assignmentRes = await axios.get(`/api/assignments/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAssignment(assignmentRes.data);
        
        // Fetch courseId if not provided
        if (!courseId && assignmentRes.data?.module) {
          const moduleId = typeof assignmentRes.data.module === 'string' 
            ? assignmentRes.data.module 
            : assignmentRes.data.module._id;
          try {
            const moduleRes = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (moduleRes.data.success) {
              const fetchedCourseId = moduleRes.data.data.course._id || moduleRes.data.data.course;
              console.log('[CourseId] Setting courseId from module:', fetchedCourseId);
              setCourseId(fetchedCourseId);
            }
          } catch (err) {
            logger.error('Error fetching module for courseId', err);
          }
        }

        // Initialize shuffled options for matching questions
        if (assignmentRes.data.questions) {
          const shuffled: Record<number, Question['rightItems']> = {};
          assignmentRes.data.questions.forEach((question: Question, index: number) => {
            if (question.type === 'matching' && Array.isArray(question.rightItems) && question.rightItems.length > 0) {
              // Shuffle the rightItems to randomize the order using Fisher-Yates algorithm
              shuffled[index] = shuffleArray([...question.rightItems]);
            }
          });
          setShuffledOptions(shuffled);
        }

        // Initialize answers object for student submission
        if (assignmentRes.data.questions) {
          const initialAnswers: Answers = {};
          assignmentRes.data.questions.forEach((q: Question, index: number) => {
            if (q.type === 'matching') {
              initialAnswers[index] = {}; // Object for matching questions
            } else {
              initialAnswers[index] = ''; // String for other question types
            }
          });
          setAnswers(initialAnswers);
        }

        // If group assignment, fetch student's group
        if (assignmentRes.data.isGroupAssignment && assignmentRes.data.groupSet && user?.role === 'student') {
          const userId = user._id;
          const groupsRes = await axios.get(`/api/groups/sets/${assignmentRes.data.groupSet}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const userGroup = groupsRes.data.find((group: any) =>
            group.members.some((member: any) => String(member._id) === String(userId))
          );
          setStudentGroupId(userGroup ? userGroup._id : null);
        }

        // Always fetch submission for the current user
        let hasSubmission = false;
        if (user?.role === 'student') {
          try {
            const submissionRes = await axios.get(`/api/submissions/student/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (submissionRes.data) {
              hasSubmission = true;
              setSubmission(submissionRes.data);
              if (submissionRes.data?.answers) {
                // Parse answers back to proper format
                const parsedAnswers: Record<string, string | Record<number, string>> = {};
                Object.keys(submissionRes.data.answers).forEach(questionIndex => {
                  const answer = submissionRes.data.answers[questionIndex];
                  try {
                    // Try to parse as JSON for matching questions
                    parsedAnswers[questionIndex] = JSON.parse(answer);
                  } catch (e) {
                    // If parsing fails, it's a regular string answer
                    parsedAnswers[questionIndex] = answer;
                  }
                });
                setAnswers(parsedAnswers);
              }
            }
          } catch (err) {
            setSubmission(null);
            hasSubmission = false;
          }
          
          // Load saved draft from localStorage if no submission exists
          if (!hasSubmission && assignmentRes.data.questions) {
            const draftKey = `assignment_draft_${id}_${user._id}`;
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
              try {
                const draft = JSON.parse(savedDraft);
                if (draft.answers) {
                  // Merge saved answers with initial structure
                  const initialAnswers: Record<string, string | Record<number, string>> = {};
                  assignmentRes.data.questions.forEach((q: Question, index: number) => {
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
        } else if (user?.role === 'teacher' || user?.role === 'admin') {
          try {
            const submissionRes = await axios.get(`/api/submissions/assignment/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            setSubmission(submissionRes.data[0] || null);
          } catch (err) {
            setSubmission(null);
          }
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
  }, [id, user]);

  // Fetch submission stats when assignment is loaded and user is instructor
  useEffect(() => {
    if (assignment && isInstructor) {
      fetchSubmissionStats();
    }
  }, [assignment, isInstructor]);

  // Fetch course-level grade data
  useEffect(() => {
    const fetchCourseGradeData = async () => {
      console.log('[Course Grade Fetch] Starting fetch', {
        courseId,
        userId: user?._id,
        userRole: user?.role,
        isInstructor,
        isStudent,
        hasToken: !!localStorage.getItem('token')
      });
      
      if (!courseId) {
        console.log('[Course Grade Fetch] No courseId, cannot fetch');
        return;
      }
      
      if (!user) {
        console.log('[Course Grade Fetch] No user, cannot fetch');
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('[Course Grade Fetch] No token, cannot fetch');
          return;
        }

        if (isInstructor) {
          // Fetch course class average for teachers
          console.log('[Course Grade Fetch] Fetching teacher course average for courseId:', courseId);
          try {
            const response = await axios.get(`${API_URL}/api/grades/course/${courseId}/average`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('[Course Grade Fetch] Teacher API response:', response.data);
            if (response.data && response.data.average !== null && response.data.average !== undefined) {
              setCourseAverage(response.data.average);
              console.log('[Course Grade] Teacher course average set:', response.data.average);
            } else {
              console.log('[Course Grade] Teacher response has no average:', response.data);
            }
          } catch (err: any) {
            console.log('[Course Grade] Error fetching course average:', err.response?.data || err.message);
          }
        } else if (isStudent) {
          // Fetch student's overall course grade
          console.log('[Course Grade Fetch] Fetching student course grade for courseId:', courseId);
          try {
            const response = await axios.get(`${API_URL}/api/grades/student/course/${courseId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('[Course Grade Fetch] Student API response:', response.data);
            if (response.data && response.data.totalPercent !== null && response.data.totalPercent !== undefined) {
              setStudentCourseGrade(response.data.totalPercent);
              console.log('[Course Grade] Student course grade set:', response.data.totalPercent);
            } else {
              console.log('[Course Grade] Student response has no totalPercent:', response.data);
            }
          } catch (err: any) {
            console.log('[Course Grade] Error fetching student course grade:', err.response?.data || err.message);
          }
        } else {
          console.log('[Course Grade Fetch] User is neither instructor nor student');
        }
      } catch (err) {
        logger.error('Error fetching course grade data', err instanceof Error ? err : new Error(String(err)));
        console.log('[Course Grade Fetch] General error:', err);
      }
    };

    fetchCourseGradeData();
  }, [courseId, user, isInstructor, isStudent]);

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
      // Check if quiz has been started - but don't auto-start
      // Make timer user-specific by including user ID in the key
      const timerKey = `quiz_start_${id}_${user._id}`;
      const storedStartTime = localStorage.getItem(timerKey);
      if (storedStartTime) {
        // Only restore quiz state if there's no submission and user hasn't completed the quiz
        const startTime = new Date(storedStartTime);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const totalSeconds = (assignment.quizTimeLimit || 0) * 60;
        
        // Only restore if quiz hasn't expired and no submission exists
        if (elapsed < totalSeconds) {
          setQuizStarted(true);
          setQuizStartTime(startTime);
        } else {
          // Clear expired quiz start time
          localStorage.removeItem(timerKey);
        }
      }
    }
  }, [assignment, user, submission, id]);

  useEffect(() => {
    // Only run timer if quiz is started, no submission exists, and user is actively taking the quiz
    if (quizStarted && quizStartTime && assignment?.isTimedQuiz && assignment?.quizTimeLimit && !submission && user?.role === 'student') {
      const timer = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - (quizStartTime?.getTime() || 0)) / 1000); // seconds
        const totalSeconds = (assignment.quizTimeLimit || 0) * 60; // convert minutes to seconds
        const remaining = totalSeconds - elapsed;
        
        if (remaining <= 0) {
          // Time's up! Auto-submit only if no submission exists and user is actively taking quiz
          clearInterval(timer);
          setTimeLeft(0);
          // Don't auto-submit if there's no submission - let the user submit manually
  
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, quizStartTime, assignment, id, submission, user]);

  const startQuiz = () => {
    if (assignment?.isTimedQuiz && assignment?.quizTimeLimit && user?._id) {
      const startTime = new Date();
      setQuizStartTime(startTime);
      setQuizStarted(true);
      // Make timer user-specific by including user ID in the key
      const timerKey = `quiz_start_${id}_${user._id}`;
      localStorage.setItem(timerKey, startTime.toISOString());
      setTimeLeft(assignment.quizTimeLimit);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setIsUploading(false);
        return;
      }
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const newFiles = response.data.files.map((file: any) => ({
        name: file.originalname,
        url: file.path,
        size: file.size
      }));

      setUploadedFiles(prev => {
        const updated = [...prev, ...newFiles];
        
        // Auto-save to localStorage if student and no submission exists
        if (user?.role === 'student' && !submission && id) {
          const draftKey = `assignment_draft_${id}_${user._id}`;
          try {
            const existingDraft = localStorage.getItem(draftKey);
            const draft = existingDraft ? JSON.parse(existingDraft) : {};
            draft.answers = answers;
            draft.uploadedFiles = updated;
            localStorage.setItem(draftKey, JSON.stringify(draft));
          } catch (e) {
            logger.error('Error saving draft', e);
          }
        }
        
        return updated;
      });
    } catch (error) {
      logger.error('Error uploading files', error instanceof Error ? error : new Error(String(error)));
      setError('Error uploading files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      
      // Auto-save to localStorage if student and no submission exists
      if (user?.role === 'student' && !submission && id) {
        const draftKey = `assignment_draft_${id}_${user._id}`;
        try {
          const existingDraft = localStorage.getItem(draftKey);
          const draft = existingDraft ? JSON.parse(existingDraft) : {};
          draft.answers = answers;
          draft.uploadedFiles = updated;
          localStorage.setItem(draftKey, JSON.stringify(draft));
        } catch (e) {
          logger.error('Error saving draft', e);
        }
      }
      
      return updated;
    });
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
      
      // Auto-save to localStorage if student and no submission exists
      if (user?.role === 'student' && !submission && id) {
        const draftKey = `assignment_draft_${id}_${user._id}`;
        try {
          const existingDraft = localStorage.getItem(draftKey);
          const draft = existingDraft ? JSON.parse(existingDraft) : {};
          draft.answers = newAnswers;
          draft.uploadedFiles = uploadedFiles;
          localStorage.setItem(draftKey, JSON.stringify(draft));
        } catch (e) {
          logger.error('Error saving draft', e);
        }
      }
      
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
      

      
      const response = await axios.post(`/api/submissions`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      

      setSubmission(response.data);
      setError('');
      
      // Clear draft from localStorage after successful submission
      if (user?._id && id) {
        const draftKey = `assignment_draft_${id}_${user._id}`;
        localStorage.removeItem(draftKey);
      }
      
      // Dispatch event to refresh ToDo panel
      window.dispatchEvent(new Event('assignmentSubmitted'));
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      logger.error('Submit error', err instanceof Error ? err : new Error(String(err)), { status: axiosError.response?.status, data: axiosError.response?.data });
      setError(axiosError.response?.data?.message || 'Error submitting assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return;
    
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/assignments/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        navigate(-1);
      } catch (err) {
        const axiosError = err as AxiosError<{ message?: string }>;
        setError(axiosError.response?.data?.message || 'Error deleting assignment');
      }
    }
  };

  const handleTogglePublish = async () => {
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return;
    setIsPublishing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `${API_URL}/api/assignments/${id}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignment(prev => prev ? ({ ...prev, published: res.data.published }) : null);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      logger.error('Error toggling assignment publish', err instanceof Error ? err : new Error(String(err)));
      setError(axiosError.response?.data?.message || 'Error toggling publish status');
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
  const isTeacherPreview = isInstructor;
  

  


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate px-2">{assignment.title}</h1>
          {/* Grade Badge - Mobile - Shows Course-Level Data */}
          {(() => {
            console.log('[Grade Badge Mobile Render]', {
              isInstructor,
              isStudent,
              courseAverage,
              studentCourseGrade
            });
            
            if (isInstructor && courseAverage !== null) {
              console.log('[Grade Badge Mobile] Rendering teacher badge:', courseAverage);
              return (
                <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-full">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                    Avg: {courseAverage.toFixed(2)}%
                  </span>
                </div>
              );
            } else if (isStudent && studentCourseGrade !== null) {
              console.log('[Grade Badge Mobile] Rendering student badge:', studentCourseGrade);
              return (
                <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-full">
                  <span className="text-xs font-semibold text-green-800 dark:text-green-200">
                    {studentCourseGrade.toFixed(2)}%
                  </span>
                </div>
              );
            }
            console.log('[Grade Badge Mobile] Not rendering badge');
            return null;
          })()}
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </nav>

      <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pt-16 lg:pt-4 max-w-full overflow-x-hidden">
        <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 shadow rounded-lg p-2 sm:p-4 lg:p-6 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 max-w-full">
            <div className="flex-1 min-w-0 w-full max-w-full">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="hidden lg:block text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 break-words">{assignment.title}</h1>
                {/* Grade Badge - Desktop - Shows Course-Level Data - Visible on all screen sizes */}
                {(() => {
                  console.log('[Grade Badge Desktop Render]', {
                    isInstructor,
                    isStudent,
                    courseAverage,
                    studentCourseGrade,
                    courseId,
                    assignment: assignment ? { title: assignment.title } : null
                  });
                  
                  if (isInstructor && courseAverage !== null) {
                    // Show course class average for teachers
                    console.log('[Grade Badge Desktop] Rendering teacher course average badge:', courseAverage);
                    return (
                      <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-full">
                        <span className="text-xs sm:text-sm font-semibold text-blue-800 dark:text-blue-200">
                          Course Avg: {courseAverage.toFixed(2)}%
                        </span>
                      </div>
                    );
                  } else if (isStudent && studentCourseGrade !== null) {
                    // Show student's overall course grade
                    console.log('[Grade Badge Desktop] Rendering student course grade badge:', studentCourseGrade);
                    return (
                      <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-full">
                        <span className="text-xs sm:text-sm font-semibold text-green-800 dark:text-green-200">
                          Grade: {studentCourseGrade.toFixed(2)}%
                        </span>
                      </div>
                    );
                  }
                  console.log('[Grade Badge Desktop] Not rendering badge - conditions not met');
                  return null;
                })()}
              </div>
              {/* Show assignment title on mobile/tablet (hidden on desktop where it's in the flex above) */}
              <h1 className="lg:hidden text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 break-words mt-2">{assignment.title}</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
              <span className="block sm:inline">Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy, h:mm a')}</span>
              {submission && (
                <span className="block sm:inline sm:ml-4 mt-1 sm:mt-0 text-green-600 dark:text-green-400 dark:text-green-400">Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy, h:mm a')}</span>
              )}
            </p>
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
                            onClick={() => setPreviewFile({ url: fileUrl, name: fileName })}
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
                            onClick={() => setPreviewFile({ url: fileUrl, name: fileName })}
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
                
                {/* File Preview Modal for submitted files */}
                {previewFile && previewFile.url && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
                    <div className="relative max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                      <FilePreview
                        fileUrl={previewFile.url || ''}
                        fileName={previewFile.name || ''}
                        onClose={() => setPreviewFile(null)}
                        showCloseButton={true}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}


          </div>
          <div className="flex space-x-2">
            {isStudent && !submission && !isPastDue && (!assignment.isTimedQuiz || quizStarted) && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:bg-indigo-500"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            )}
            {isCreator && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 dark:bg-red-500 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 dark:hover:bg-red-600 dark:bg-red-500"
              >
                Delete
              </button>
            )}
          </div>
        </div>



        {/* Timer for timed quizzes - Start Quiz button only */}
        {assignment.isTimedQuiz && assignment.quizTimeLimit && isStudent && !submission && !isPastDue && !quizStarted && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Timed Quiz</h3>
              <p className="text-blue-700 dark:text-blue-300 mb-4">
                This quiz has a time limit of {assignment.quizTimeLimit} minutes. 
                Once you start, the timer will begin and cannot be paused.
              </p>
              <button
                onClick={startQuiz}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                Start Quiz
              </button>
            </div>
          </div>
        )}



        {assignment.attachments && assignment.attachments.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Attachments</h3>
            <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
              {assignment.attachments.map((attachment, index) => (
                <li key={index} className="py-3">
                  <a
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 dark:hover:text-indigo-300"
                  >
                    {attachment.split('/').pop()}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* File Upload Section - Always available for students */}
        {isStudent && !submission && !isPastDue && (
          <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">File Upload</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload a file, or choose a file you've already uploaded.
            </p>
            <div className="space-y-4">
              {/* Upload Button */}
              <div>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                    id="file-upload-main"
                  />
                  <label
                    htmlFor="file-upload-main"
                    className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 cursor-pointer ${
                      isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </label>
                  {uploadedFiles.length > 0 && (
                    <button
                      onClick={() => document.getElementById('file-upload-main')?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Another File
                    </button>
                  )}
                </div>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Uploaded Files:</h4>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {file.size ? `${((file.size || 0) / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <button
                            onClick={() => setPreviewFile({ url: file.url, name: file.name })}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* File Preview Modal */}
                  {previewFile && previewFile.url && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
                      <div className="relative max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <FilePreview
                          fileUrl={previewFile.url || ''}
                          fileName={previewFile.name || ''}
                          onClose={() => setPreviewFile(null)}
                          showCloseButton={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teacher Analytics Dashboard - Always show for teachers */}
        {isTeacherPreview && (
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center justify-between">
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

                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center justify-between">
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

                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                        <div className="flex items-center justify-between">
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

                    {/* Assignment Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">Assignment Info</h4>
                        <div className="space-y-2 text-sm">
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

                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">Submission Status</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Published:</span>
                            <span className={`font-medium ${assignment.published ? 'text-green-600 dark:text-green-400 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {assignment.published ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Due Date:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Past Due:</span>
                            <span className={`font-medium ${isPastDue ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400 dark:text-green-400'}`}>
                              {isPastDue ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">Quick Actions</h4>
                        <div className="space-y-2">
                          <button
                            onClick={() => navigate(`/assignments/${id}/grade`)}
                            className="w-full text-left px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/70 rounded-md transition-colors flex items-center space-x-2 text-gray-900 dark:text-gray-100 dark:text-gray-100"
                          >
                            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span>Grade Submissions</span>
                          </button>
                          <button
                            onClick={() => {
                              if (courseId) {
                                navigate(`/courses/${courseId}/assignments/${id}/edit`);
                              } else {
                                navigate(`/assignments/${id}/edit`);
                              }
                            }}
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
                        </div>
                      </div>
                    </div>
                  </div>
            </div>
        )}

        {/* Assignment Questions Section */}
        {assignment.questions && assignment.questions.length > 0 && (() => {
          // Check if we should show questions to students after submission
          const isQuiz = assignment.isGradedQuiz || assignment.group === 'Quizzes';
          const shouldShowQuestions = !isStudent || !submission || isPastDue || 
            (isQuiz && 
             (submission?.showCorrectAnswers || assignment.showCorrectAnswers || 
              submission?.showStudentAnswers || assignment.showStudentAnswers));
          
          return (
            <div className="mt-8">
              {/* Show questions for students, but not in teacher preview */}
              {(
                !isTeacherPreview && (!assignment.isTimedQuiz || quizStarted || !isStudent || submission || isPastDue) && shouldShowQuestions
              ) ? (
              assignment.displayMode === 'single' && isStudent && !submission && !isPastDue ? (
                // Student answering view with sidebar (single question mode)
                <div className="flex gap-6">
                  {/* Main content area */}
                  <div className="flex-1">
                    {!showUploadSection ? (
                      // Questions view
                      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                        <div className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 rounded-lg p-3 mb-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                                Question {currentQuestion + 1}
                              </h3>
                              <button
                                onClick={() => toggleMarkQuestion(currentQuestion)}
                                className={`p-1 rounded border ${
                                  markedQuestions.has(currentQuestion)
                                    ? 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                                    : 'bg-gray-100 dark:bg-gray-700 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-50 dark:bg-gray-7000'
                                }`}
                              >
                                {markedQuestions.has(currentQuestion) ? (
                                  <Bookmark className="h-3 w-3 fill-current" />
                                ) : (
                                  <Bookmark className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <span className="text-base font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                              {assignment.questions[currentQuestion].points} pts
                            </span>
                          </div>
                        </div>
                        <div className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 mb-4"></div>
                        
                        <div className="mb-6">
                          <p className="text-lg text-gray-900 dark:text-gray-100 dark:text-gray-100 leading-relaxed">{assignment.questions[currentQuestion].text}</p>
                        </div>
                        
                        {assignment.questions[currentQuestion].type === 'multiple-choice' && assignment.questions[currentQuestion].options && (
                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {assignment.questions[currentQuestion].options?.map((option, optionIndex) => (
                              <div key={optionIndex} className="relative py-2">
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
                                  className="flex items-center space-x-3 cursor-pointer"
                                >
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    answers[currentQuestion] === option.text
                                      ? 'border-indigo-500 bg-indigo-500'
                                      : 'border-gray-300 bg-white dark:bg-gray-800'
                                  }`}>
                                    {answers[currentQuestion] === option.text && (
                                      <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-800"></div>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">{option.text}</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {assignment.questions[currentQuestion].type === 'text' && (
                          <div className="mt-4">
                            {submission ? (
                              <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Answer:</p>
                                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                  {typeof answers[currentQuestion] === 'string' && answers[currentQuestion] 
                                    ? answers[currentQuestion] 
                                    : 'No answer provided'}
                                </p>
                              </div>
                            ) : (
                              <textarea
                                id={`question-${currentQuestion}-answer`}
                                name={`question-${currentQuestion}-answer`}
                                className="w-full h-32 p-4 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                value={typeof answers[currentQuestion] === 'string' ? answers[currentQuestion] : ''}
                                onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                                placeholder="Enter your answer here"
                              />
                            )}
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
                                {(user?.role === 'teacher' || user?.role === 'admin') && (
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
                                {isStudent && !submission && !isPastDue && (
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
                                {submission && (() => {
                                  const currentSubmission: Submission = submission; // Type assertion for IIFE
                                  const isQuiz = assignment.isGradedQuiz || assignment.group === 'Quizzes';
                                  const showFeedback = isQuiz && (currentSubmission.showCorrectAnswers || assignment.showCorrectAnswers || currentSubmission.showStudentAnswers || assignment.showStudentAnswers || currentSubmission.autoGraded);
                                  
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
                                              <span className="text-gray-500 dark:text-gray-400">→</span>
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
                        
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => navigateToQuestion(0)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-700"
                          >
                            Back to Questions
                          </button>
                          
                          {currentQuestion === assignment.questions.length - 1 ? (
                            <button
                              onClick={handleSubmit}
                              disabled={isSubmitting}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                            >
                              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                            </button>
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
                      // Upload section
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Files</h3>
                          <div className="space-y-4">
                            {/* Upload Button */}
                            <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
                              <div className="flex items-center space-x-4">
                                <input
                                  type="file"
                                  multiple
                                  onChange={handleFileUpload}
                                  disabled={isUploading}
                                  className="hidden"
                                  id="file-upload-final"
                                />
                                <label
                                  htmlFor="file-upload-final"
                                className={`inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                  {isUploading ? 'Uploading...' : 'Upload File'}
                                </label>
                                {uploadedFiles.length > 0 && (
                                  <button
                                    onClick={() => document.getElementById('file-upload-final')?.click()}
                                  className="inline-flex items-center px-4 py-2 border border-pink-500 dark:border-pink-600 rounded-md shadow-sm text-sm font-medium text-pink-600 dark:text-pink-400 bg-white dark:bg-gray-800 hover:bg-pink-50 dark:hover:bg-pink-900/20"
                                  >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add Another File
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Uploaded Files List */}
                            {uploadedFiles.length > 0 && (
                              <div className="mt-4">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Uploaded Files:</h4>
                                <div className="space-y-2">
                                  {uploadedFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{file.size ? `${((file.size || 0) / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 ml-2">
                                        <button
                                          onClick={() => setPreviewFile({ url: file.url, name: file.name })}
                                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                                          title="Preview file"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => removeFile(index)}
                                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
                                          title="Remove file"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {/* File Preview Modal */}
                                {previewFile && previewFile.url && (
                                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPreviewFile(null)}>
                                    <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                                      <FilePreview
                                        fileUrl={previewFile.url || ''}
                                        fileName={previewFile.name || ''}
                                        onClose={() => setPreviewFile(null)}
                                        showCloseButton={true}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => navigateToQuestion(0)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Back to Questions
                          </button>
                          
                          {currentQuestion === assignment.questions.length - 1 ? (
                            <button
                              onClick={handleSubmit}
                              disabled={isSubmitting}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600"
                            >
                              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                            </button>
                          ) : (
                            <button
                              onClick={nextQuestion}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
                            >
                              Next Question
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Sidebar */}
                  <div className="w-80 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
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
                      {assignment.isTimedQuiz && (
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
                                Attempt due: {format(new Date(assignment.dueDate), 'MMM d \'at\' h:mm a')}
                              </div>
                              {quizStarted && timeLeft !== null ? (
                                <div className={`text-sm font-medium ${timeLeft <= 300 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
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
                <div className="flex gap-6 items-start">
                  {/* Main content area */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-4">Questions</h3>
                    <div className="space-y-6">
                                              {assignment.questions.map((question, index) => {
                        // Check if this is a submitted quiz and we should show feedback
                        const isQuiz = assignment.isGradedQuiz || assignment.group === 'Quizzes';
                        let isCorrect = false;
                        let showFeedback = false;
                        let correctAnswer = null;
                        if (submission && isQuiz && 
                            (submission.showCorrectAnswers || assignment.showCorrectAnswers) &&
                            (question.type === 'multiple-choice' || question.type === 'matching')) {
                          showFeedback = true;
                          // Use the parsed answers from state instead of raw submission answers
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
                        if (isTeacherPreview && question.type === 'multiple-choice' && question.options) {
                          correctAnswer = question.options.find(opt => opt.isCorrect)?.text;
                        }
                        
                        // Enhanced teacher preview styling
                        const isTeacherPreviewMode = isTeacherPreview;
                        
                        // Determine feedback mode
                        const showFullFeedback = submission && isQuiz && 
                          (submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.autoGraded);
                        const showOnlyCorrectHighlight = submission && isQuiz && 
                          (submission.showStudentAnswers || assignment.showStudentAnswers) && 
                          !(submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.autoGraded);
                        const feedbackEnabled = showFullFeedback || showOnlyCorrectHighlight;
                        

                                                  
                                                  return (
                            <div key={question.id || question._id || index} className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-4 sm:p-6 shadow-sm ${
                              isTeacherPreview 
                                ? 'border-blue-400 bg-blue-50 shadow-blue-100' 
                                : (() => {
                                    // Determine feedback mode for border colors
                                    const showFullFeedbackForBorder = submission && submission.autoGraded;
                                    const showOnlyCorrectForBorder = submission && isQuiz && 
                                      (submission.showStudentAnswers || assignment.showStudentAnswers) && 
                                      !(submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.autoGraded);
                                    
                                    if (submission && (submission.autoGraded || (isQuiz && (submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.showStudentAnswers || assignment.showStudentAnswers))) && (question.type === 'multiple-choice' || question.type === 'matching')) {
                                      if (question.type === 'multiple-choice') {
                                        const studentAnswer = answers[index];
                                        const correctOption = question.options?.find(opt => opt.isCorrect);
                                        const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                        
                                        if (showFullFeedbackForBorder || (submission.showCorrectAnswers || assignment.showCorrectAnswers)) {
                                          // Full feedback: green/red
                                          return isCorrect 
                                            ? 'border-green-500 dark:border-green-400' 
                                            : 'border-red-500 dark:border-red-400';
                                        } else if (showOnlyCorrectForBorder) {
                                          // showStudentAnswers: green for correct, red for wrong (but don't show correct answer)
                                          return isCorrect 
                                            ? 'border-green-500 dark:border-green-400' 
                                            : 'border-red-500 dark:border-red-400';
                                        }
                                      } else if (question.type === 'matching') {
                                        const autoGrade = submission.autoQuestionGrades instanceof Map 
                                          ? submission.autoQuestionGrades.get(index.toString())
                                          : submission.autoQuestionGrades?.[index.toString()];
                                        const maxPoints = question.points || 0;
                                        const percentageCorrect = autoGrade && maxPoints > 0 ? autoGrade / maxPoints : 0;
                                        
                                        if (showFullFeedbackForBorder || (submission.showCorrectAnswers || assignment.showCorrectAnswers)) {
                                          // Full feedback: green/red/yellow
                                          if (percentageCorrect === 1) {
                                            return 'border-green-500 dark:border-green-400'; // All correct
                                          } else if (percentageCorrect === 0) {
                                            return 'border-red-500 dark:border-red-400'; // All incorrect
                                          } else {
                                            return 'border-yellow-500 dark:border-yellow-400'; // Partially correct
                                          }
                                        } else if (showOnlyCorrectForBorder) {
                                          // showStudentAnswers: green/red/yellow (but don't show correct answers)
                                          if (percentageCorrect === 1) {
                                            return 'border-green-500 dark:border-green-400'; // All correct
                                          } else if (percentageCorrect === 0) {
                                            return 'border-red-500 dark:border-red-400'; // All incorrect
                                          } else {
                                            return 'border-yellow-500 dark:border-yellow-400'; // Partially correct
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
                                    return 'border-gray-200 dark:border-gray-700';
                                  })()
                            }`}>
                          <div className={`rounded-lg p-3 sm:p-4 mb-3 ${isTeacherPreview ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Question {index + 1}</h4>
                                {isTeacherPreview && (
                                  <span className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-full font-bold">
                                    TEACHER PREVIEW
                                  </span>
                                )}
                                {isStudent && !submission && !isPastDue && (
                                  <button
                                    onClick={() => toggleMarkQuestion(index)}
                                    className={`p-1 rounded border ${
                                      markedQuestions.has(index)
                                        ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                        : 'bg-gray-100 dark:bg-gray-700 border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                  >
                                    {markedQuestions.has(index) ? (
                                      <Bookmark className="h-3 w-3 fill-current" />
                                    ) : (
                                      <Bookmark className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {submission && submission.autoGraded && (question.type === 'multiple-choice' || question.type === 'matching') ? (
                                  (() => {
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
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
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-700 mb-3"></div>
                          
                          <div className="mb-4">
                            <p className="text-base sm:text-lg text-gray-900 dark:text-gray-100 leading-relaxed">{question.text}</p>

                            {question.type === 'multiple-choice' && (
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Select the correct answer.</p>
                            )}
                          </div>
                          
                          {question.type === 'multiple-choice' && question.options && (
                            <div>
                              {/* Show detailed feedback for submitted assignments */}
                              {submission && (submission.autoGraded || (isQuiz && (submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.showStudentAnswers || assignment.showStudentAnswers))) && (
                                <div className={`mb-4 p-3 sm:p-4 rounded-lg ${
                                  (() => {
                                    const studentAnswer = answers[index];
                                    const correctOption = question.options.find(opt => opt.isCorrect);
                                    const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                    const showFullFeedbackForBox = submission && isQuiz && 
                                      (submission.showCorrectAnswers || assignment.showCorrectAnswers);
                                    const showOnlyCorrectForBox = submission && isQuiz && 
                                      (submission.showStudentAnswers || assignment.showStudentAnswers) && 
                                      !(submission.showCorrectAnswers || assignment.showCorrectAnswers);
                                    
                                    if (isCorrect) {
                                      return 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700';
                                    } else if (showFullFeedbackForBox) {
                                      return 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700';
                                    } else if (showOnlyCorrectForBox) {
                                      // showStudentAnswers: red for incorrect (but don't show correct answer)
                                      return 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700';
                                    } else {
                                      return 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';
                                    }
                                  })()
                                }`}>
                                  <div className="text-sm sm:text-base text-blue-800 dark:text-blue-300 font-medium mb-2 sm:mb-3">
                                    Auto-Graded Results
                                  </div>
                                  {(() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    const correctOption = question.options?.find(opt => opt.isCorrect);
                                    const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                    
                                    return (
                                      <div className="space-y-2 sm:space-y-3">
                                        <div className="text-sm sm:text-base text-blue-700 dark:text-blue-300 font-semibold">
                                          {(() => {
                                            const earned = Number(autoGrade || 0);
                                            const total = maxPoints;
                                            const earnedFormatted = Number.isInteger(earned) ? earned.toString() : earned.toFixed(2);
                                            const totalFormatted = Number.isInteger(total) ? total.toString() : total.toFixed(2);
                                            return `${earnedFormatted} / ${totalFormatted} pts`;
                                          })()}
                                        </div>
                                        {/* Always show student answer if either option is enabled */}
                                        {((submission.showStudentAnswers || assignment.showStudentAnswers || submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.autoGraded)) && (
                                          <div>
                                            <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student Answer:</div>
                                            <div className="text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-2 break-words">{typeof studentAnswer === 'string' ? studentAnswer : 'No answer'}</div>
                                          </div>
                                        )}
                                        {/* showStudentAnswers: Show correctness (green/red) but NOT the correct answer */}
                                        {(submission.showStudentAnswers || assignment.showStudentAnswers) && !(submission.showCorrectAnswers || assignment.showCorrectAnswers) && (
                                          <div className={`text-sm sm:text-base font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                          </div>
                                        )}
                                        {/* showCorrectAnswers: Show correctness (green/red) AND show the correct answer for wrong ones */}
                                        {(submission.showCorrectAnswers || assignment.showCorrectAnswers) && (
                                          <div className={`text-sm sm:text-base font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {isCorrect ? '✓ Correct!' : `✗ Incorrect. Correct answer: ${correctOption?.text || 'Unknown'}`}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              {/* Show regular multiple-choice interface for non-submitted or non-auto-graded assignments */}
                              {(!submission || (!submission.autoGraded && !(isQuiz && (submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.showStudentAnswers || assignment.showStudentAnswers)))) && (
                                <div className="divide-y divide-gray-200">
                                  {question.options.map((option, optionIndex) => (
                                    <div key={optionIndex} className="relative py-2">
                                      <input
                                        type="radio"
                                        id={`question-${index}-option-${optionIndex}`}
                                        name={`question-${index}`}
                                        value={option.text}
                                        checked={answers[index] === option.text}
                                        onChange={(e) => !submission && isStudent && handleAnswerChange(index, e.target.value)}
                                        disabled={!!submission || !isStudent || isPastDue || isTeacherPreview}
                                        className="sr-only"
                                      />
                                      <label 
                                        htmlFor={`question-${index}-option-${optionIndex}`} 
                                        className={`flex items-center space-x-3 cursor-pointer ${(!!submission || !isStudent || isPastDue || isTeacherPreview) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                          answers[index] === option.text
                                            ? 'border-indigo-500 bg-indigo-500'
                                            : 'border-gray-300 bg-white dark:bg-gray-800'
                                        }`}>
                                          {answers[index] === option.text && (
                                            <div className="w-2 h-2 rounded-full bg-white dark:bg-gray-800"></div>
                                          )}
                                        </div>
                                        <span className="text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">{option.text}</span>
                                        {isTeacherPreview && option.isCorrect && (
                                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Correct Answer
                                          </span>
                                        )}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {question.type === 'text' && (
                            <div className="mt-4">
                              <textarea
                                id={`question-${index}-answer`}
                                name={`question-${index}-answer`}
                                className="w-full h-32 p-4 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                                value={typeof answers[index] === 'string' ? answers[index] : ''}
                                onChange={(e) => !submission && isStudent && handleAnswerChange(index, e.target.value)}
                                placeholder={isStudent ? "Enter your answer here" : "Student's answer will appear here"}
                                disabled={!!submission || !isStudent || isPastDue || isTeacherPreview}
                              />
                            </div>
                          )}
                          
                          {question.type === 'matching' && question.leftItems && question.rightItems && (
                            <div className="space-y-2">
                              
                              {/* Show detailed feedback for submitted assignments */}
                              {submission && (submission.autoGraded || (isQuiz && (submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.showStudentAnswers || assignment.showStudentAnswers))) && (
                                <div className={`mb-4 p-3 sm:p-4 rounded-lg ${
                                  (() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    const percentageCorrect = autoGrade && maxPoints > 0 ? autoGrade / maxPoints : 0;
                                    
                                    const showFullFeedbackForMatchBox = submission && isQuiz && 
                                      (submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.autoGraded);
                                    const showOnlyCorrectForMatchBox = submission && isQuiz && 
                                      (submission.showStudentAnswers || assignment.showStudentAnswers) && 
                                      !(submission.showCorrectAnswers || assignment.showCorrectAnswers || submission.autoGraded);
                                    
                                    if (percentageCorrect === 1) {
                                      return 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'; // All correct
                                    } else if (showFullFeedbackForMatchBox) {
                                      // Full feedback: show red/yellow for wrong/partial
                                      if (percentageCorrect > 0) {
                                        return 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700'; // Partially correct
                                      } else {
                                        return 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'; // All incorrect
                                      }
                                    } else if (showOnlyCorrectForMatchBox) {
                                      // Only highlight correct: gray for wrong/partial
                                      return 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';
                                    } else {
                                      return 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';
                                    }
                                  })()
                                }`}>
                                  <div className="text-sm sm:text-base text-blue-800 dark:text-blue-300 font-medium mb-2 sm:mb-3">
                                    Auto-Graded Results
                                  </div>
                                  {(() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    
                                    return (
                                      <div className="space-y-2 sm:space-y-3">
                                        <div className="text-sm sm:text-base text-blue-700 dark:text-blue-300 font-semibold">
                                          {(() => {
                                            const earned = Number(autoGrade || 0);
                                            const total = maxPoints;
                                            const earnedFormatted = Number.isInteger(earned) ? earned.toString() : earned.toFixed(2);
                                            const totalFormatted = Number.isInteger(total) ? total.toString() : total.toFixed(2);
                                            return `${earnedFormatted} / ${totalFormatted} pts`;
                                          })()}
                                        </div>
                                        <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Student Answer:</div>
                                        {question.leftItems?.map((leftItem, leftIndex) => {
                                          const studentMatch = typeof studentAnswer === 'object' ? 
                                            (studentAnswer as Record<number, string>)[leftIndex] : '';
                                          const correctRightItem = question.rightItems?.find(rightItem => 
                                            rightItem.id === leftItem.id
                                          );
                                          const isCorrect = studentMatch === (correctRightItem?.text || '');
                                          
                                          return (
                                            <div key={leftItem.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 sm:p-3 rounded-lg ${
                                              (() => {
                                                const showFullFeedbackForMatch = submission && isQuiz && 
                                                  (submission.showCorrectAnswers || assignment.showCorrectAnswers);
                                                const showOnlyCorrectForMatch = submission && isQuiz && 
                                                  (submission.showStudentAnswers || assignment.showStudentAnswers) && 
                                                  !(submission.showCorrectAnswers || assignment.showCorrectAnswers);
                                                
                                                if (isCorrect) {
                                                  return 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700';
                                                } else if (showFullFeedbackForMatch || showOnlyCorrectForMatch) {
                                                  // Both options show red for incorrect
                                                  return 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700';
                                                } else {
                                                  return 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';
                                                }
                                              })()
                                            }`}>
                                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base break-words">{leftItem.text}</span>
                                                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">→</span>
                                                <span className="text-gray-900 dark:text-gray-100 text-sm sm:text-base break-words">{studentMatch || 'No answer'}</span>
                                              </div>
                                              <div className="flex items-center justify-between sm:justify-end space-x-2 sm:ml-4">
                                                {isCorrect ? (
                                                  <div className="flex items-center text-green-600 dark:text-green-400">
                                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-xs sm:text-sm font-medium">Correct</span>
                                                  </div>
                                                ) : (
                                                  <div className={`flex items-center ${
                                                    (() => {
                                                      const showFullFeedbackForMatch = submission && isQuiz && 
                                                        (submission.showCorrectAnswers || assignment.showCorrectAnswers);
                                                      const showOnlyCorrectForMatch = submission && isQuiz && 
                                                        (submission.showStudentAnswers || assignment.showStudentAnswers) && 
                                                        !(submission.showCorrectAnswers || assignment.showCorrectAnswers);
                                                      
                                                      if (showFullFeedbackForMatch || showOnlyCorrectForMatch) {
                                                        // Both options show red for incorrect
                                                        return 'text-red-600 dark:text-red-400';
                                                      } else {
                                                        return 'text-gray-500 dark:text-gray-400';
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
                                                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 ml-2 sm:ml-4">
                                                    {/* Only show correct answer if showCorrectAnswers is enabled (not showStudentAnswers alone) */}
                                                    {(submission.showCorrectAnswers || assignment.showCorrectAnswers) ? (
                                                      <>Correct: <span className="font-medium">{correctRightItem.text}</span></>
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
                              {(!submission || !submission.autoGraded) && (
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
                                            if (!submission && isStudent && !isPastDue) {
                                              const newAnswers: Record<string, string | Record<number, string>> = { ...answers };
                                              if (!newAnswers[index]) newAnswers[index] = {};
                                              (newAnswers[index] as Record<number, string>)[leftIndex] = e.target.value;
                                              handleAnswerChange(index, newAnswers[index] as Record<number, string>);
                                            }
                                          }}
                                          disabled={!!submission || !isStudent || isPastDue}
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
                    {isStudent && !submission && !isPastDue && (
                      <div className="mt-6 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Files</h3>
                        <div className="space-y-4">
                          {/* Upload Button */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
                            <div className="flex items-center space-x-4">
                              <input
                                type="file"
                                multiple
                                onChange={handleFileUpload}
                                disabled={isUploading}
                                className="hidden"
                                id="file-upload-scrollable"
                              />
                              <label
                                htmlFor="file-upload-scrollable"
                                className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-700 cursor-pointer ${
                                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                {isUploading ? 'Uploading...' : 'Upload File'}
                              </label>
                              {uploadedFiles.length > 0 && (
                                <button
                                  onClick={() => document.getElementById('file-upload-scrollable')?.click()}
                                  className="inline-flex items-center px-4 py-2 border border-pink-500 rounded-md shadow-sm text-sm font-medium text-pink-600 bg-white dark:bg-gray-800 hover:bg-pink-50"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Add Another File
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Uploaded Files List */}
                          {uploadedFiles.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Uploaded Files:</h4>
                              <div className="space-y-2">
                                {uploadedFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{file.size ? `${((file.size || 0) / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-2">
                                      <button
                                        onClick={() => setPreviewFile({ url: file.url, name: file.name })}
                                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                                        title="Preview file"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => removeFile(index)}
                                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                                        title="Remove file"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* File Preview Modal */}
                              {previewFile && previewFile.url && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPreviewFile(null)}>
                                  <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                                    <FilePreview
                                      fileUrl={previewFile.url || ''}
                                      fileName={previewFile.name || ''}
                                      onClose={() => setPreviewFile(null)}
                                      showCloseButton={true}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Submit button for scrollable mode */}
                    {isStudent && !submission && !isPastDue && assignment.displayMode === 'scrollable' && (
                      <div className="mt-8">
                        <button
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                        </button>
                      </div>
                    )}

                    {/* Teacher Preview Summary */}

                  </div>
                  
                  {/* Sidebar for scrollable mode - only show for students answering */}
                  {isStudent && !submission && !isPastDue && (
                    <div className="w-80 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 self-start">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Questions</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {assignment.questions.map((question, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                // Scroll to the question
                                const questionElement = document.getElementById(`question-${index}-answer`) || 
                                                     document.querySelector(`[name="question-${index}"]`);
                                if (questionElement) {
                                  questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-md text-sm hover:bg-gray-100 dark:bg-gray-700`}
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
                      
                      {/* Timer Display for timed quizzes - now under the progress bar */}
                      {assignment.isTimedQuiz && (
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
                                Attempt due: {format(new Date(assignment.dueDate), 'MMM d \'at\' h:mm a')}
                              </div>
                              {quizStarted && timeLeft !== null ? (
                                <div className={`text-sm font-medium ${timeLeft <= 300 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
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
                  )}
                </div>
              )
            ) : null}
            </div>
          );
        })()}

        </div>
      </div>
    </div>
  );
};

export default ViewAssignment; 