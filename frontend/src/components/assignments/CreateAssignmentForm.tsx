import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../../utils/authToken';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { API_URL } from '../../config';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, RefreshCw } from 'lucide-react';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FloatingLabelTextarea from '../common/FloatingLabelTextarea';
import FloatingLabelSelect from '../common/FloatingLabelSelect';
import DatePicker from '../common/DatePicker';
import FormFieldGroup from '../common/FormFieldGroup';
import {
  FormCheckboxOption,
  FormRadioOption,
  FormNavBar,
} from '../common/FormControls';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_ADD,
  BTN_ADD_SM,
  BTN_ICON,
  BTN_ICON_DANGER,
  FORM_INPUT,
  FORM_SELECT,
  INFO_CALLOUT,
} from '../common/formStyles';
import { useDraftManager } from '../../hooks/useDraftManager';
import ConfirmationModal from '../common/ConfirmationModal';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import GradingPeriodPicker from '../grades/GradingPeriodPicker';
import GradingPeriodsModal from '../grades/GradingPeriodsModal';
import { normalizeAttachmentSources } from '../../utils/fileTypes';
import type { NormalizedFile } from '../../utils/fileTypes';

const FORM_STEPS = [
  { id: 1, label: 'Basic details' },
  { id: 2, label: 'Description' },
  { id: 3, label: 'Questions & files' },
] as const;

function FormStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {FORM_STEPS.map((step, index) => {
          const active = currentStep >= step.id;
          const current = currentStep === step.id;
          return (
            <React.Fragment key={step.id}>
              <div className={`flex items-center gap-3 ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                    current
                      ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                      : active
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {step.id}
                </div>
                <span className={`text-sm ${current ? 'font-semibold' : 'font-medium'}`}>{step.label}</span>
              </div>
              {index < FORM_STEPS.length - 1 ? (
                <div
                  className={`hidden h-px flex-1 sm:block ${currentStep > step.id ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-700'}`}
                  aria-hidden
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface CreateAssignmentFormProps {
  moduleId: string;
  editMode?: boolean;
  assignmentData?: any;
  /** When set, skips outer card + duplicate title (parent provides page chrome). */
  layout?: 'page' | 'embedded';
}

interface Module {
  _id: string;
  title: string;
  course: string;
}

type QuestionType = 'text' | 'multiple-choice' | 'matching';

function questionTypeLabel(type: QuestionType): string {
  if (type === 'text') return 'Text entry';
  if (type === 'multiple-choice') return 'Multiple choice';
  return 'Matching';
}

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: {
    text: string;
    isCorrect: boolean;
  }[];
  // For matching questions
  leftItems?: {
    id: string;
    text: string;
  }[];
  rightItems?: {
    id: string;
    text: string;
  }[];
}

interface FormData {
  title: string;
  description: string;
  availableFrom: string;
  dueDate: string;
  attachments: File[];
  moduleId: string;
  totalPoints: number;
  questions: Question[];
  isGroupAssignment: boolean;
  groupSetId: string | null;
  allowStudentUploads: boolean;
  displayMode: 'single' | 'scrollable';
  isGradedQuiz: boolean;
  quizSubmissionMode: 'online' | 'paper_upload';
  isTimedQuiz: boolean;
  quizTimeLimit: number; // in minutes
  showCorrectAnswers: boolean; // Show correct answers to students after submission
  showStudentAnswers: boolean; // Show student answers after submission
  gradeReleaseMode: 'immediate' | 'manual' | 'on_grade';
  defaultGradeHidden: boolean;
  lockAfterDue: boolean;
  isOfflineAssignment: boolean; // Offline/paper-based assignment (manual grade entry)
}

interface GroupSet {
  _id: string;
  name: string;
  course: string;
  allowSelfSignup: boolean;
}

const CreateAssignmentForm: React.FC<CreateAssignmentFormProps> = ({
  moduleId,
  editMode = false,
  assignmentData = null,
  layout = 'page',
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [modules, setModules] = useState<Module[]>([]);
  const [groupSets, setGroupSets] = useState<GroupSet[]>([]);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    availableFrom: '', // Blank for new assignments
    dueDate: '', // Blank for new assignments
    attachments: [],
    moduleId: '',
    totalPoints: 0,
    questions: [],
    isGroupAssignment: false,
    groupSetId: null,
    allowStudentUploads: false,
    displayMode: 'single',
    isGradedQuiz: false,
    quizSubmissionMode: 'online',
    isTimedQuiz: false,
    quizTimeLimit: 60,
    showCorrectAnswers: false,
    showStudentAnswers: false,
    gradeReleaseMode: 'immediate',
    defaultGradeHidden: false,
    lockAfterDue: true,
    isOfflineAssignment: false
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOption, setNewOption] = useState({ text: '', isCorrect: false });
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseGroups, setCourseGroups] = useState<{ name: string; weight: number }[]>([]);
  const [gradingPeriodId, setGradingPeriodId] = useState<string | null>(null);
  const [showGradingPeriodsModal, setShowGradingPeriodsModal] = useState(false);
  // Initialize group from URL param, assignmentData, or empty string
  const [group, setGroup] = useState(searchParams.get('group') || '');
  const [currentStep, setCurrentStep] = useState(1);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<NormalizedFile[]>([]);
  const [removeAssetIds, setRemoveAssetIds] = useState<string[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [hasSubmissions, setHasSubmissions] = useState(false);
  const [totalPointsInput, setTotalPointsInput] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Draft manager
  const formId = editMode ? `assignment-edit-${assignmentData?._id}` : `assignment-create-${moduleId}`;
  const { draft, isDraftSaved, saveDraft, autoSave, clearDraft } = useDraftManager<FormData>({
    formId,
    autoSaveDelay: 2000
  });

  // Load draft on mount (only for create mode)
  useEffect(() => {
    if (!editMode && draft) {
      setFormData(draft);
    }
  }, [editMode, draft]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (!editMode && formData.title) {
      autoSave(formData);
    }
  }, [formData, editMode, autoSave]);

  // Reset form function
  const handleResetForm = () => {
    setShowResetConfirm(true);
  };

  const confirmResetForm = () => {
    setShowResetConfirm(false);
      clearDraft();
      setFormData({
        title: '',
        description: '',
        availableFrom: '',
        dueDate: '',
        attachments: [],
        moduleId: '',
        totalPoints: 0,
        questions: [],
        isGroupAssignment: false,
        groupSetId: null,
        allowStudentUploads: false,
        displayMode: 'single',
        isGradedQuiz: false,
        quizSubmissionMode: 'online',
        isTimedQuiz: false,
        quizTimeLimit: 60,
        showCorrectAnswers: false,
        showStudentAnswers: false,
        gradeReleaseMode: 'immediate',
        defaultGradeHidden: false,
        lockAfterDue: true,
        isOfflineAssignment: false
      });
      setTotalPointsInput('');
      setFieldErrors({});
      setCurrentStep(1);
      setNewOption({ text: '', isCorrect: false });
  };

  useEffect(() => {
    const fetchModules = async () => {
      if (!moduleId) {
        setError('Module ID is required');
        return;
      }

      try {
        const token = getMemoryAuthToken();
        // First get the current module to get its course ID
        const moduleResponse = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (moduleResponse.data.success) {
          const courseId = moduleResponse.data.data.course._id || moduleResponse.data.data.course;
          setCourseId(courseId);
          // Fetch course to get groups
          const courseRes = await axios.get(`${API_URL}/api/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (courseRes.data.success) {
            setCourseGroups(courseRes.data.data.groups || []);
            // If group param exists in URL and the group exists in course groups, set it
            const groupParam = searchParams.get('group');
            if (groupParam && (courseRes.data.data.groups || []).some((g: any) => g.name === groupParam)) {
              setGroup(groupParam);
            }
            // Set isGradedQuiz from URL parameter if it exists
            const isGradedQuizParam = searchParams.get('isGradedQuiz');
            if (isGradedQuizParam === 'true') {
              setFormData(prev => ({ ...prev, isGradedQuiz: true }));
            }
          }
          // Then fetch all modules for that course
          const modulesResponse = await axios.get(`${API_URL}/api/modules/${courseId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (modulesResponse.data.success) {
            setModules(modulesResponse.data.data);
          } else {
            setError('Error fetching modules for the course');
          }
        } else {
          setError('Error fetching current module');
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Module not found. Please make sure you are accessing a valid module.');
          // Redirect to course page after 3 seconds
          setTimeout(() => {
            if (courseId) {
              navigate(`/courses/${courseId}`);
            } else {
              navigate('/dashboard');
            }
          }, 3000);
        } else if (err.response?.status === 401) {
          setError('Please log in to access this page.');
        } else {
          setError('Error fetching modules. Please try again later.');
        }
      }
    };

    fetchModules();
  }, [moduleId, navigate, searchParams]);

  useEffect(() => {
    const fetchGroupSets = async () => {
      if (!courseId) return;
      try {
        const token = getMemoryAuthToken();
        const response = await axios.get(`${API_URL}/api/groups/sets/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupSets(response.data);
      } catch (err: any) {
        }
    };
    fetchGroupSets();
  }, [courseId]);

  // Populate form with existing assignment data when in edit mode
  useEffect(() => {
    if (editMode && assignmentData) {
      
      // Fetch submission count for this assignment
      const fetchSubmissionCount = async () => {
        try {
          const token = getMemoryAuthToken();
          const response = await axios.get(`${API_URL}/api/submissions/assignment/${assignmentData._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const submissions = Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data) ? response.data : [];
          setSubmissionCount(submissions.length);
          setHasSubmissions(submissions.length > 0);
        } catch (err) {
          setSubmissionCount(0);
          setHasSubmissions(false);
        }
      };
      
      fetchSubmissionCount();
      
      // For existing assignments that don't have availableFrom, use dueDate as fallback
      let availableFromDate = '';
      if (assignmentData.availableFrom) {
        availableFromDate = format(new Date(assignmentData.availableFrom), "yyyy-MM-dd'T'HH:mm");
      } else if (assignmentData.dueDate) {
        // If no availableFrom exists, use dueDate as a fallback
        availableFromDate = format(new Date(assignmentData.dueDate), "yyyy-MM-dd'T'HH:mm");
      }
      
      // Ensure boolean values are properly converted
      const allowStudentUploads = Boolean(assignmentData.allowStudentUploads);
      
      // Strip HTML tags from description for editing
      const stripHtml = (html: string) => {
        if (!html) return '';
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
      };
      
      // Ensure questions array is properly formatted with required fields
      let questions: Question[] = [];
      if (Array.isArray(assignmentData.questions) && assignmentData.questions.length > 0) {
        questions = assignmentData.questions.map((q: any) => ({
          id: q.id || q._id || Math.random().toString(36).substr(2, 9),
          type: (q.type || 'text') as 'text' | 'multiple-choice' | 'matching',
          text: q.text || '',
          points: q.points || 0,
          options: q.options || [],
          leftItems: q.leftItems || [],
          rightItems: q.rightItems || []
        }));
      }
      
      const formDataToSet = {
        title: assignmentData.title || '',
        description: stripHtml(assignmentData.description || ''),
        availableFrom: availableFromDate,
        dueDate: assignmentData.dueDate ? format(new Date(assignmentData.dueDate), "yyyy-MM-dd'T'HH:mm") : '',
        attachments: [],
        moduleId:
          typeof assignmentData.module === 'string'
            ? assignmentData.module
            : assignmentData.module?._id || '',
        totalPoints: questions.reduce((sum, q) => sum + (q.points || 0), 0) || assignmentData.totalPoints || 0,
        questions: questions,
        isGroupAssignment: Boolean(assignmentData.isGroupAssignment),
        groupSetId: assignmentData.groupSet || null,
        allowStudentUploads: allowStudentUploads,
        displayMode: assignmentData.displayMode || 'single',
        isGradedQuiz: Boolean(assignmentData.isGradedQuiz),
        quizSubmissionMode:
          assignmentData.quizSubmissionMode === 'paper_upload' ? ('paper_upload' as const) : ('online' as const),
        isTimedQuiz: Boolean(assignmentData.isTimedQuiz),
        quizTimeLimit: assignmentData.quizTimeLimit || 60,
        showCorrectAnswers: Boolean(assignmentData.showCorrectAnswers),
        showStudentAnswers: Boolean(assignmentData.showStudentAnswers),
        gradeReleaseMode: assignmentData.gradeReleaseMode || 'immediate',
        defaultGradeHidden: Boolean(assignmentData.defaultGradeHidden),
        lockAfterDue: assignmentData.lockAfterDue !== false,
        isOfflineAssignment: Boolean(assignmentData.isOfflineAssignment)
      };
      
      setFormData(formDataToSet);
      // Set group from assignmentData if in edit mode, otherwise keep URL param value
      if (!group) {
        setGroup(assignmentData.group || '');
      }
      setGradingPeriodId(assignmentData.gradingPeriodId ? String(assignmentData.gradingPeriodId) : null);
      setExistingAttachments(assignmentData.attachments || []);
      setAttachmentFiles(normalizeAttachmentSources(assignmentData));
      // Set totalPointsInput for offline assignments in edit mode
      if (assignmentData.isOfflineAssignment || assignmentData.quizSubmissionMode === 'paper_upload') {
        const calculatedTotalPoints = assignmentData.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignmentData.totalPoints || 0;
        if (calculatedTotalPoints > 0) {
          setTotalPointsInput(calculatedTotalPoints.toString());
        }
      }
    }
  }, [editMode, assignmentData]);

  const addQuestion = (type: 'text' | 'multiple-choice' | 'matching') => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: '',
      points: 1,
    };
    if (type === 'multiple-choice') {
      newQuestion.options = [];
    }
    if (type === 'matching') {
      newQuestion.leftItems = [];
      newQuestion.rightItems = [];
    }
    const newQuestions = [...formData.questions, newQuestion];
    const newTotalPoints = newQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
    setFormData(prev => ({
      ...prev,
      questions: newQuestions,
      totalPoints: newTotalPoints
    }));
  };

  const removeQuestion = (index: number) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    const newTotalPoints = newQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
    setFormData({
      ...formData,
      questions: newQuestions,
      totalPoints: newTotalPoints
    });
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...formData.questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...formData.questions];
    (newQuestions[index] as any)[field] = value;
    
    // Recalculate total points from scratch
    const newTotalPoints = newQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
    
    setFormData({
      ...formData,
      questions: newQuestions,
      totalPoints: newTotalPoints
    });
  };

  const addOption = (questionIndex: number) => {
    if (newOption.text.trim()) {
      const newQuestions = [...formData.questions];
      newQuestions[questionIndex].options = [
        ...(newQuestions[questionIndex].options || []),
        { ...newOption }
      ];
      setFormData({ ...formData, questions: newQuestions });
      setNewOption({ text: '', isCorrect: false });
    }
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex].options = newQuestions[questionIndex].options?.filter(
      (_, i) => i !== optionIndex
    );
    setFormData({ ...formData, questions: newQuestions });
  };

  // Inline validation functions
  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, title: 'Title is required' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const validateDates = () => {
    let isValid = true;
    if (!formData.availableFrom || formData.availableFrom.trim() === '') {
      setFieldErrors(prev => ({ ...prev, availableFrom: 'Available from date is required' }));
      isValid = false;
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.availableFrom;
        return newErrors;
      });
    }
    if (!formData.dueDate || formData.dueDate.trim() === '') {
      setFieldErrors(prev => ({ ...prev, dueDate: 'Due date is required' }));
      isValid = false;
    } else if (formData.availableFrom && new Date(formData.availableFrom) >= new Date(formData.dueDate)) {
      setFieldErrors(prev => ({ ...prev, dueDate: 'Due date must be after available from date' }));
      isValid = false;
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.dueDate;
        return newErrors;
      });
    }
    return isValid;
  };

  const validateStep1 = () => {
    const isTitleValid = validateTitle(formData.title);
    const areDatesValid = validateDates();
    if (!(formData.isGroupAssignment && formData.groupSetId) && !formData.moduleId) {
      setError('Please select a module');
      return false;
    }
    if (formData.isGroupAssignment && !formData.groupSetId) {
      setError('Please select a group set for the group assignment');
      return false;
    }
    setError('');
    return isTitleValid && areDatesValid;
  };

  const validateStep2 = () => {
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    setError('');
    return true;
  };

  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  const handleCancel = () => {
    const selectedModuleId =
      formData.moduleId && formData.moduleId.trim() !== '' ? formData.moduleId : moduleId || null;
    const isGroupAssignment = formData.isGroupAssignment && formData.groupSetId;

    if (courseId) {
      if (editMode) {
        navigate(`/courses/${courseId}/${formData.isGradedQuiz ? 'quizzes' : 'assignments'}`);
        return;
      }
      if (selectedModuleId && !isGroupAssignment) {
        navigate(`/courses/${courseId}/modules?expand=${selectedModuleId}`);
        return;
      }
      navigate(`/courses/${courseId}/${formData.isGradedQuiz ? 'quizzes' : 'assignments'}`);
      return;
    }

    if (selectedModuleId) {
      navigate(`/modules/${selectedModuleId}/assignments`);
      return;
    }

    if (editMode) {
      navigate(-1);
      return;
    }

    navigate('/dashboard');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Final validation (show messages — step 1 fields may be off-screen)
    if (!validateTitle(formData.title)) {
      setError('Title is required. Go back to step 1 to fix it.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required. Go back to step 2 to add it.');
      return;
    }
    if (!validateDates()) {
      setError('Check Available from and Due date on step 1 — due must be after available from.');
      return;
    }
    // Only require module if not a group assignment, or if group assignment but no group set selected
    if (!(formData.isGroupAssignment && formData.groupSetId) && !formData.moduleId) {
      setError('Please select a module');
      return;
    }
    if (!formData.dueDate) {
      setError('Due date is required');
      return;
    }
    if (formData.isGroupAssignment && !formData.groupSetId) {
      setError('Please select a group set for the group assignment');
      return;
    }
    // For offline assignments, totalPoints is required
    if (formData.isOfflineAssignment && (!formData.totalPoints || formData.totalPoints <= 0)) {
      setError('Total points is required for offline assignments');
      return;
    }
    if (
      formData.isGradedQuiz &&
      formData.quizSubmissionMode === 'paper_upload' &&
      (!formData.totalPoints || formData.totalPoints <= 0)
    ) {
      setError('Total points is required for paper upload quizzes');
      return;
    }

    // Clear draft on successful submit
    if (!editMode) {
      clearDraft();
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      const moduleIdValue =
        typeof formData.moduleId === 'string'
          ? formData.moduleId
          : (formData.moduleId as { _id?: string })?._id || '';
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('availableFrom', formData.availableFrom);
      formDataToSend.append('dueDate', formData.dueDate);
      if (moduleIdValue) formDataToSend.append('moduleId', moduleIdValue);
      formDataToSend.append('totalPoints', formData.totalPoints.toString());
      formDataToSend.append('questions', JSON.stringify(formData.questions));
      formDataToSend.append('isGroupAssignment', formData.isGroupAssignment.toString());
      formDataToSend.append('allowStudentUploads', formData.allowStudentUploads.toString());
      formDataToSend.append('displayMode', formData.displayMode);
      formDataToSend.append('isGradedQuiz', formData.isGradedQuiz.toString());
      formDataToSend.append('quizSubmissionMode', formData.quizSubmissionMode);
      if (formData.isGradedQuiz && formData.quizSubmissionMode === 'paper_upload') {
        formDataToSend.set('questions', JSON.stringify([]));
        formDataToSend.set('allowStudentUploads', 'true');
        formDataToSend.set('isTimedQuiz', 'false');
      }
      formDataToSend.append('isTimedQuiz', formData.isTimedQuiz.toString());
      formDataToSend.append('quizTimeLimit', formData.quizTimeLimit.toString());
      formDataToSend.append('showCorrectAnswers', formData.showCorrectAnswers.toString());
      formDataToSend.append('showStudentAnswers', formData.showStudentAnswers.toString());
      formDataToSend.append('gradeReleaseMode', formData.gradeReleaseMode);
      formDataToSend.append('defaultGradeHidden', formData.defaultGradeHidden.toString());
      formDataToSend.append('lockAfterDue', formData.lockAfterDue.toString());
      formDataToSend.append('isOfflineAssignment', formData.isOfflineAssignment.toString());
      if (formData.isGroupAssignment && formData.groupSetId) {
        formDataToSend.append('groupSet', formData.groupSetId);
      }
      if (group) {
        formDataToSend.append('group', group);
      }
      if (gradingPeriodId) {
        formDataToSend.append('gradingPeriodId', gradingPeriodId);
      } else if (editMode) {
        formDataToSend.append('gradingPeriodId', '');
      }
      const removeSet = new Set(removeAssetIds.map(String));
      const fileAssetIds = attachmentFiles
        .map((f) => f.fileAssetId)
        .filter((id): id is string => Boolean(id) && !removeSet.has(String(id)));
      if (fileAssetIds.length) {
        formDataToSend.append('fileAssetIds', JSON.stringify(fileAssetIds));
      }
      if (removeAssetIds.length) {
        formDataToSend.append('removeFileAssetIds', JSON.stringify(removeAssetIds));
      }


      const token = getMemoryAuthToken();
      
      if (editMode && assignmentData) {
        // Update existing assignment
        const response = await axios.put(`${API_URL}/api/assignments/${assignmentData._id}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data?.success !== false) {
          navigate(-1);
        } else {
          setError(response.data?.message || 'Update failed');
        }
      } else {
        // Create new assignment
        const response = await axios.post(`${API_URL}/api/assignments`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data) {
          // Determine where to redirect based on assignment/quiz type and module
          // Use the module ID from the form (user's selection) or fallback to URL param
          const selectedModuleId = (formData.moduleId && formData.moduleId.trim() !== '') 
            ? formData.moduleId 
            : (moduleId || null);
          
          // Also check if it's a group assignment (which might not have a module)
          const isGroupAssignment = formData.isGroupAssignment && formData.groupSetId;
          
          if (selectedModuleId && !isGroupAssignment && courseId) {
            // If assignment has a module, navigate to course modules page with module to expand
            navigate(`/courses/${courseId}/modules?expand=${selectedModuleId}`);
          } else if (courseId) {
            // If no module or group assignment, navigate to appropriate page based on quiz type
            if (formData.isGradedQuiz) {
              // Navigate to quizzes page
              navigate(`/courses/${courseId}/quizzes`);
            } else {
              // Navigate to assignments page
              navigate(`/courses/${courseId}/assignments`);
            }
          } else {
            // Fallback to dashboard if no courseId available
            navigate('/dashboard');
          }
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(`You are not authorized to ${editMode ? 'update' : 'create'} assignments. Please contact your administrator.`);
      } else if (err.response?.status === 400 && err.response?.data?.submissionCount) {
        setError(`${err.response.data.message} (${err.response.data.submissionCount} submission${err.response.data.submissionCount !== 1 ? 's' : ''} exist)`);
      } else {
        const msg =
          err.response?.data?.message ||
          err.message ||
          `Error ${editMode ? 'updating' : 'creating'} assignment`;
        setError(msg);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const embedded = layout === 'embedded';

  const formInner = (
    <>
      {!embedded && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            {editMode
              ? formData.isGradedQuiz
                ? 'Edit quiz'
                : 'Edit assignment'
              : formData.isGradedQuiz
                ? 'Create quiz'
                : 'Create assignment'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {editMode
              ? 'Update settings, content, and grading options.'
              : 'Complete each step to publish a new assignment or quiz for your course.'}
          </p>
        </div>
      )}

      <FormStepIndicator currentStep={currentStep} />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Warning for assignments with submissions */}
      {editMode && hasSubmissions && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-4 text-amber-950 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-100 sm:px-5"
        >
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                This assignment has {submissionCount} submission{submissionCount !== 1 ? 's' : ''}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
                Some edits are limited while submissions exist. You can still update titles, dates, descriptions, and
                adjust question text, options, and points. You cannot add or remove questions or change question types.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Draft saved indicator and reset button */}
        {!editMode && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            {isDraftSaved ? (
              <div className="flex items-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Save className="mr-2 h-4 w-4" />
                Draft saved automatically
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">Your progress is saved as you type.</div>
            )}
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              title="Clear form and start fresh"
            >
              <RefreshCw className="h-4 w-4" />
              Reset form
            </button>
          </div>
        )}

        {/* Step 1: Basic Details */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <FormFieldGroup
              title="Basic Information"
              description="Enter the title and select the module for this assignment"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FloatingLabelInput
                  id="assignment-title"
                  name="title"
                  type="text"
                  label="Assignment Title"
                  required
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (fieldErrors.title) {
                      validateTitle(e.target.value);
                    }
                  }}
                  onBlur={(e) => validateTitle(e.target.value)}
                  error={fieldErrors.title}
                  showCharacterCount
                  maxLength={200}
                />
                {!(formData.isGroupAssignment && formData.groupSetId) && (
                  <FloatingLabelSelect
                    id="assignment-module"
                    name="moduleId"
                    label="Module"
                    required={!formData.isGroupAssignment}
                    disabled={formData.isGroupAssignment}
                    value={formData.moduleId}
                    onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })}
                    options={[
                      ...modules.map((module) => ({
                        value: module._id,
                        label: module.title
                      }))
                    ]}
                  />
                )}
              </div>
            </FormFieldGroup>
            <FormFieldGroup
              title="Assignment options"
              description="Choose the assignment type, group, and quiz settings"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormCheckboxOption
                  id="isGroupAssignment"
                  checked={formData.isGroupAssignment}
                  onChange={(e) => setFormData({ ...formData, isGroupAssignment: e.target.checked })}
                  title="Group assignment"
                  description="Students submit as a team using a group set."
                />
                <div>
                  <label htmlFor="assignment-group" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Assignment group
                  </label>
                  <select
                    id="assignment-group"
                    name="group"
                    value={group}
                    onChange={e => setGroup(e.target.value)}
                    className={FORM_SELECT}
                  >
                    <option value="">Select a group</option>
                    {courseGroups.map((g) => (
                      <option key={g.name} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <FormCheckboxOption
                  id="isGradedQuiz"
                  checked={formData.isGradedQuiz}
                  onChange={(e) => setFormData({
                    ...formData,
                    isGradedQuiz: e.target.checked,
                    quizSubmissionMode: e.target.checked ? formData.quizSubmissionMode : 'online',
                    gradeReleaseMode: e.target.checked ? 'manual' : formData.gradeReleaseMode,
                    defaultGradeHidden: e.target.checked ? true : formData.defaultGradeHidden,
                  })}
                  title="Graded quiz"
                  description="Create an auto-graded or paper-upload quiz instead of a standard assignment."
                />
                <FormCheckboxOption
                  id="isOfflineAssignment"
                  checked={formData.isOfflineAssignment}
                  onChange={(e) => setFormData({ ...formData, isOfflineAssignment: e.target.checked })}
                  title="Offline assignment"
                  description="Paper-based work with manual grade entry in the gradebook."
                />
              </div>
            </FormFieldGroup>

            {/* Graded quiz options */}
            {formData.isGradedQuiz && (
              <FormFieldGroup
                title="Quiz settings"
                description="Configure how students take and submit this quiz"
              >
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">How will students submit?</p>
                  <FormRadioOption
                    id="quizModeOnline"
                    name="quizSubmissionMode"
                    checked={formData.quizSubmissionMode === 'online'}
                    onChange={() => setFormData({ ...formData, quizSubmissionMode: 'online' })}
                    title="Online quiz"
                    description="Students answer questions in the browser."
                  />
                  <FormRadioOption
                    id="quizModePaper"
                    name="quizSubmissionMode"
                    checked={formData.quizSubmissionMode === 'paper_upload'}
                    onChange={() => setFormData({
                      ...formData,
                      quizSubmissionMode: 'paper_upload',
                      allowStudentUploads: true,
                      isTimedQuiz: false,
                      questions: [],
                      gradeReleaseMode: 'manual',
                      defaultGradeHidden: true,
                    })}
                    title="Paper upload quiz"
                    description="Students upload photos or files of completed work."
                  />
                </div>

                {formData.quizSubmissionMode === 'online' && (
              <div className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Quiz timer</p>
                  <div className="mt-3 space-y-3">
                    <FormRadioOption
                      id="noTimer"
                      name="timerOption"
                      checked={!formData.isTimedQuiz}
                      onChange={() => setFormData({ ...formData, isTimedQuiz: false })}
                      title="No timer"
                      description="Students have unlimited time to complete the quiz."
                    />
                    <FormRadioOption
                      id="withTimer"
                      name="timerOption"
                      checked={formData.isTimedQuiz}
                      onChange={() => setFormData({ ...formData, isTimedQuiz: true })}
                      title="Timed quiz"
                      description="Automatically submit when the time limit is reached."
                    />
                  </div>
                </div>

                {formData.isTimedQuiz && (
                  <div>
                    <label htmlFor="quiz-time-limit" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Time limit (minutes)
                    </label>
                    <input
                      type="number"
                      id="quiz-time-limit"
                      name="quizTimeLimit"
                      value={formData.quizTimeLimit}
                      onChange={(e) => setFormData({ ...formData, quizTimeLimit: parseInt(e.target.value) || 60 })}
                      min="1"
                      max="480"
                      className={`${FORM_SELECT} mt-1`}
                      placeholder="60"
                    />
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      Timed quizzes use the server clock. Refreshing or leaving the page will not reset the timer.
                    </p>
                  </div>
                )}

                {/* Quiz Feedback Options */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Feedback after submission</p>
                  <FormRadioOption
                    id="feedbackNone"
                    name="feedbackOption"
                    checked={!formData.showCorrectAnswers && !formData.showStudentAnswers}
                    onChange={() => setFormData({ ...formData, showCorrectAnswers: false, showStudentAnswers: false })}
                    title="No feedback"
                    description="Students will not see results after submitting."
                  />
                  <FormRadioOption
                    id="showCorrectAnswers"
                    name="feedbackOption"
                    checked={formData.showCorrectAnswers && !formData.showStudentAnswers}
                    onChange={() => setFormData({ ...formData, showCorrectAnswers: true, showStudentAnswers: false })}
                    title="Show correctness only"
                    description="Highlight which questions were answered correctly."
                  />
                  <FormRadioOption
                    id="showStudentAnswers"
                    name="feedbackOption"
                    checked={formData.showStudentAnswers && !formData.showCorrectAnswers}
                    onChange={() => setFormData({ ...formData, showStudentAnswers: true, showCorrectAnswers: false })}
                    title="Show answers and correctness"
                    description="Display student responses with correct answers for missed items."
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    You can change these options later on the grading page for individual submissions.
                  </p>
                </div>
              </div>
                )}

                {formData.quizSubmissionMode === 'paper_upload' && (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                    Students must upload at least one file when submitting. You will grade their uploads manually in the gradebook.
                  </p>
                )}
              </FormFieldGroup>
            )}

            {formData.isGroupAssignment && (
              <FormFieldGroup title="Group set" description="Select which group set this assignment belongs to">
                <div>
                  <label htmlFor="assignment-group-set" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Group set
                  </label>
                  <select
                    id="assignment-group-set"
                    name="groupSetId"
                    value={formData.groupSetId || ''}
                    onChange={(e) => setFormData({ ...formData, groupSetId: e.target.value || null })}
                    required={formData.isGroupAssignment}
                    className={FORM_SELECT}
                  >
                    <option value="">Select a group set</option>
                    {groupSets.map((set) => (
                      <option key={set._id} value={set._id}>{set.name} {set.allowSelfSignup ? '(Self-signup enabled)' : ''}</option>
                    ))}
                  </select>
                  {formData.isGroupAssignment && !formData.groupSetId && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">Please select a group set for the group assignment</p>
                  )}
                </div>
              </FormFieldGroup>
            )}
            <FormFieldGroup
              title="Schedule"
              description="Set when the assignment becomes available and when it's due"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DatePicker
                  id="assignment-available-from"
                  name="availableFrom"
                  label="Available From"
                  showTime={true}
                  required
                  value={formData.availableFrom}
                  onChange={(e) => {
                    setFormData({ ...formData, availableFrom: e.target.value });
                    if (fieldErrors.availableFrom || fieldErrors.dueDate) {
                      validateDates();
                    }
                  }}
                  onBlur={validateDates}
                  error={fieldErrors.availableFrom}
                />
                <DatePicker
                  id="assignment-due-date"
                  name="dueDate"
                  label="Due Date"
                  showTime={true}
                  required
                  value={formData.dueDate}
                  onChange={(e) => {
                    setFormData({ ...formData, dueDate: e.target.value });
                    if (fieldErrors.dueDate) {
                      validateDates();
                    }
                  }}
                  onBlur={validateDates}
                  error={fieldErrors.dueDate}
                  helperText={formData.availableFrom ? `Must be after ${new Date(formData.availableFrom).toLocaleString()}` : ''}
                />
              </div>
              <GradingPeriodPicker
                courseId={courseId}
                value={gradingPeriodId}
                onChange={setGradingPeriodId}
                onManagePeriods={() => setShowGradingPeriodsModal(true)}
              />
            </FormFieldGroup>
            <FormNavBar>
              <button type="button" onClick={nextStep} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                Save & Continue
              </button>
            </FormNavBar>
          </div>
        )}
        {/* Step 2: Description */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <FormFieldGroup
              title="Assignment Description"
              description="Provide a detailed description of the assignment"
            >
              <FloatingLabelTextarea
                id="assignment-description"
                name="description"
                label="Description"
                required
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                showCharacterCount
                maxLength={2000}
                placeholder="Enter a detailed description of the assignment..."
              />
            </FormFieldGroup>

            {formData.isGradedQuiz && formData.quizSubmissionMode === 'paper_upload' ? (
              <div className={INFO_CALLOUT}>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Paper upload quiz</p>
                <p className="mt-1 text-sm leading-relaxed text-blue-700 dark:text-blue-300">
                  Student file uploads are required for paper quizzes. Students will submit photos or scans of their completed work.
                </p>
              </div>
            ) : (
              <FormFieldGroup
                title="Student submissions"
                description="Control whether students can attach files when submitting"
              >
                <FormCheckboxOption
                  id="allowStudentUploads"
                  checked={formData.allowStudentUploads}
                  onChange={(e) => setFormData({ ...formData, allowStudentUploads: e.target.checked })}
                  title="Allow students to upload files"
                  description="Students can attach documents, images, or other files with their submission."
                />
              </FormFieldGroup>
            )}

            {!(formData.isGradedQuiz && formData.quizSubmissionMode === 'paper_upload') && !formData.isOfflineAssignment && (
              <FormFieldGroup
                title="Assignment display mode"
                description="Choose how students navigate questions during the assignment"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormRadioOption
                    id="displayModeSingle"
                    name="displayMode"
                    checked={formData.displayMode === 'single'}
                    onChange={() => setFormData({ ...formData, displayMode: 'single' })}
                    title="Single question view"
                    description="Show one question at a time with next/previous navigation."
                  />
                  <FormRadioOption
                    id="displayModeScrollable"
                    name="displayMode"
                    checked={formData.displayMode === 'scrollable'}
                    onChange={() => setFormData({ ...formData, displayMode: 'scrollable' })}
                    title="Scrollable view"
                    description="Show all questions on one scrollable page."
                  />
                </div>
              </FormFieldGroup>
            )}

            <FormNavBar onBack={prevStep}>
              <button type="button" onClick={() => setPreview(!preview)} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                {preview ? 'Edit' : 'Preview'}
              </button>
              <button type="button" onClick={nextStep} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                Continue
              </button>
            </FormNavBar>
          </div>
        )}
        {/* Step 3: Questions & Files */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Offline assignments and paper upload quizzes use total points + attachments only */}
            {formData.isOfflineAssignment || (formData.isGradedQuiz && formData.quizSubmissionMode === 'paper_upload') ? (
              <FormFieldGroup
                title={
                  formData.isGradedQuiz && formData.quizSubmissionMode === 'paper_upload'
                    ? 'Paper upload quiz'
                    : 'Offline assignment'
                }
                description="Set points and attach any reference materials"
              >
                <div className={INFO_CALLOUT}>
                  <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-300">
                    {formData.isGradedQuiz && formData.quizSubmissionMode === 'paper_upload'
                      ? 'Set the total points and attach a blank quiz if needed. Students will upload photos or files of their completed work for you to grade.'
                      : 'Since this is a paper-based assignment, specify the total points. Students complete the work on paper and you enter grades manually in the gradebook.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="totalPoints" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Total points <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="totalPoints"
                    name="totalPoints"
                    min="0"
                    step="0.01"
                    value={totalPointsInput}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setTotalPointsInput(inputValue);
                      if (inputValue === '' || inputValue === null) {
                        setFormData({ ...formData, totalPoints: 0 });
                      } else {
                        const value = parseFloat(inputValue);
                        if (!isNaN(value) && value >= 0) {
                          setFormData({ ...formData, totalPoints: value });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value) || value <= 0) {
                        setTotalPointsInput('');
                        setFormData({ ...formData, totalPoints: 0 });
                      } else {
                        setTotalPointsInput(value.toString());
                        setFormData({ ...formData, totalPoints: value });
                      }
                    }}
                    className={`${FORM_INPUT} mt-1.5 max-w-xs`}
                    placeholder="e.g. 100"
                  />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Maximum points possible for this assignment.
                  </p>
                </div>

                <FileAttachmentPanel
                  files={attachmentFiles}
                  onChange={setAttachmentFiles}
                  courseId={courseId || undefined}
                  assignmentId={editMode ? assignmentData?._id : undefined}
                  category="assignment"
                  label="Drop offline assignment attachments here or browse"
                  onRemoveFile={(file) => {
                    if (file.fileAssetId) setRemoveAssetIds((prev) => [...prev, file.fileAssetId!]);
                  }}
                />
              </FormFieldGroup>
            ) : (
              <>
                <FormFieldGroup title="Scoring" description="Total points are calculated from your questions">
                  <div className="inline-flex items-baseline gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/60 px-5 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                    <span className="text-3xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                      {Number.isFinite(formData.totalPoints) ? formData.totalPoints : 0}
                    </span>
                    <span className="text-sm font-medium text-indigo-600/80 dark:text-indigo-400/80">total points</span>
                  </div>
                </FormFieldGroup>

                <FormFieldGroup
                  title="Questions"
                  description="Add and configure assignment questions"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => addQuestion('text')}
                      disabled={editMode && hasSubmissions}
                      className={BTN_ADD}
                      title={editMode && hasSubmissions ? 'Cannot add questions after students have submitted' : ''}
                    >
                      <Plus className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      Add text question
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion('multiple-choice')}
                      disabled={editMode && hasSubmissions}
                      className={BTN_ADD}
                      title={editMode && hasSubmissions ? 'Cannot add questions after students have submitted' : ''}
                    >
                      <Plus className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      Add multiple choice
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion('matching')}
                      disabled={editMode && hasSubmissions}
                      className={BTN_ADD}
                      title={editMode && hasSubmissions ? 'Cannot add questions after students have submitted' : ''}
                    >
                      <Plus className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      Add matching question
                    </button>
                  </div>

                  {formData.questions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No questions yet. Use the buttons above to add your first question.
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {formData.questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                              Question {index + 1}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {questionTypeLabel(question.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label htmlFor={`question-points-${index}`} className="sr-only">
                              Points for question {index + 1}
                            </label>
                            <input
                              type="number"
                              id={`question-points-${index}`}
                              name={`question-points-${index}`}
                              value={question.points}
                              onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 0)}
                              onClick={(e) => {
                                if (question.points === 0) {
                                  e.currentTarget.value = '';
                                }
                              }}
                              min="0"
                              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">pts</span>
                            <button
                              type="button"
                              onClick={() => removeQuestion(index)}
                              disabled={editMode && hasSubmissions}
                              className={BTN_ICON_DANGER}
                              title={editMode && hasSubmissions ? 'Cannot remove questions after students have submitted' : 'Remove question'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() => moveQuestion(index, 'up')}
                                className={BTN_ICON}
                                title="Move up"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                            ) : null}
                            {index < formData.questions.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => moveQuestion(index, 'down')}
                                className={BTN_ICON}
                                title="Move down"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <input
                            type="text"
                            id={`question-text-${index}`}
                            name={`question-text-${index}`}
                            value={question.text}
                            onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                            placeholder="Enter question text"
                            className={FORM_INPUT}
                          />

                          {question.type === 'multiple-choice' && (
                            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Answer options</h4>
                              {question.options?.map((option, optionIndex) => (
                                <div
                                  key={optionIndex}
                                  className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                                    option.isCorrect
                                      ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30'
                                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`question-${index}-correct`}
                                    checked={option.isCorrect}
                                    onChange={() => {
                                      const newQuestions = [...formData.questions];
                                      newQuestions[index].options = newQuestions[index].options?.map((opt, i) => ({
                                        ...opt,
                                        isCorrect: i === optionIndex,
                                      }));
                                      setFormData({ ...formData, questions: newQuestions });
                                    }}
                                    className="h-4 w-4 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                    title="Mark as correct answer"
                                  />
                                  <input
                                    type="text"
                                    value={option.text}
                                    onChange={(e) => {
                                      const newQuestions = [...formData.questions];
                                      if (newQuestions[index].options) {
                                        newQuestions[index].options![optionIndex].text = e.target.value;
                                        setFormData({ ...formData, questions: newQuestions });
                                      }
                                    }}
                                    className={`${FORM_INPUT} min-w-0 flex-1 border-0 bg-transparent py-1.5 shadow-none focus:ring-0`}
                                    placeholder="Option text"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeOption(index, optionIndex)}
                                    className={BTN_ICON_DANGER}
                                    title="Remove option"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="text"
                                  id={`new-option-${index}`}
                                  name={`new-option-${index}`}
                                  value={newOption.text}
                                  onChange={(e) => setNewOption({ ...newOption, text: e.target.value })}
                                  placeholder="Add new option"
                                  className={`${FORM_INPUT} min-w-0 flex-1`}
                                />
                                <button type="button" onClick={() => addOption(index)} className={BTN_ADD_SM}>
                                  Add option
                                </button>
                              </div>
                            </div>
                          )}

                          {question.type === 'matching' && (
                            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                              <div>
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Matching pairs</h4>
                                {question.leftItems && question.leftItems.map((left, idx) => (
                                  <div key={left.id} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input
                                      type="text"
                                      className={`${FORM_INPUT} min-w-0 flex-1`}
                                      value={left.text}
                                      onChange={(e) => {
                                        const updated = [...(question.leftItems || [])];
                                        updated[idx].text = e.target.value;
                                        updateQuestion(index, 'leftItems', updated);
                                      }}
                                      placeholder="Prompt (e.g., Red)"
                                    />
                                    <span className="hidden shrink-0 text-slate-400 sm:inline" aria-hidden>
                                      →
                                    </span>
                                    <input
                                      type="text"
                                      className={`${FORM_INPUT} min-w-0 flex-1`}
                                      value={question.rightItems && question.rightItems[idx] ? question.rightItems[idx].text : ''}
                                      onChange={(e) => {
                                        const updated = [...(question.rightItems || [])];
                                        if (!updated[idx]) updated[idx] = { id: left.id, text: '' };
                                        updated[idx].text = e.target.value;
                                        updated[idx].id = left.id;
                                        updateQuestion(index, 'rightItems', updated);
                                      }}
                                      placeholder="Correct match (e.g., Green)"
                                    />
                                    <button
                                      type="button"
                                      className={`${BTN_SECONDARY} shrink-0 px-3 py-1.5 text-xs`}
                                      onClick={() => {
                                        const newLeft = (question.leftItems || []).filter((_, i) => i !== idx);
                                        const newRight = (question.rightItems || []).filter((_, i) => i !== idx);
                                        updateQuestion(index, 'leftItems', newLeft);
                                        updateQuestion(index, 'rightItems', newRight);
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className={`${BTN_ADD} mt-3`}
                                  onClick={() => {
                                    const newId = Math.random().toString(36).substr(2, 9);
                                    updateQuestion(index, 'leftItems', [...(question.leftItems || []), { id: newId, text: '' }]);
                                    updateQuestion(index, 'rightItems', [...(question.rightItems || []), { id: newId, text: '' }]);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Add pair
                                </button>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Distractor options (right side only)
                                </h4>
                                {(question.rightItems || []).slice((question.leftItems || []).length).map((right, idx) => (
                                  <div key={right.id || idx} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input
                                      type="text"
                                      className={`${FORM_INPUT} min-w-0 flex-1`}
                                      value={right.text}
                                      onChange={(e) => {
                                        const base = question.leftItems ? question.leftItems.length : 0;
                                        const updated = [...(question.rightItems || [])];
                                        updated[base + idx].text = e.target.value;
                                        updateQuestion(index, 'rightItems', updated);
                                      }}
                                      placeholder="Distractor (e.g., Aqua)"
                                    />
                                    <button
                                      type="button"
                                      className={`${BTN_SECONDARY} shrink-0 px-3 py-1.5 text-xs`}
                                      onClick={() => {
                                        const base = question.leftItems ? question.leftItems.length : 0;
                                        const updated = [...(question.rightItems || [])];
                                        updated.splice(base + idx, 1);
                                        updateQuestion(index, 'rightItems', updated);
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  className={`${BTN_ADD} mt-3`}
                                  onClick={() => {
                                    updateQuestion(index, 'rightItems', [
                                      ...(question.rightItems || []),
                                      { id: Math.random().toString(36).substr(2, 9), text: '' },
                                    ]);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Add distractor
                                </button>
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Preview
                                </p>
                                {(question.leftItems || []).map((left) => (
                                  <div key={left.id} className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <span className="min-w-0 flex-1 break-words text-sm text-slate-900 dark:text-slate-100">
                                      {left.text || <em className="text-slate-400">Prompt</em>}
                                    </span>
                                    <select className={`${FORM_INPUT} min-w-0 flex-1 py-2`} disabled>
                                      <option>[ Choose ]</option>
                                      {shuffleArray((question.rightItems || []).map((r) => r.text)).map((opt, i) => (
                                        <option key={i}>{opt}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </FormFieldGroup>

                <FormFieldGroup title="Attachments" description="Optional files for students to download">
                  <FileAttachmentPanel
                    files={attachmentFiles}
                    onChange={setAttachmentFiles}
                    courseId={courseId || undefined}
                    assignmentId={editMode ? assignmentData?._id : undefined}
                    category="assignment"
                    label="Drop assignment attachments here or browse"
                    onRemoveFile={(file) => {
                      if (file.fileAssetId) setRemoveAssetIds((prev) => [...prev, file.fileAssetId!]);
                    }}
                  />
                </FormFieldGroup>
              </>
            )}
            
            {/* Navigation buttons for both offline and regular assignments */}
            <FormNavBar onBack={prevStep}>
              <button type="button" onClick={() => setPreview(!preview)} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                {preview ? 'Edit' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={`${BTN_SECONDARY} w-full sm:w-auto`}
              >
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                {isSubmitting
                  ? 'Saving…'
                  : editMode
                    ? formData.isGradedQuiz
                      ? 'Update quiz'
                      : 'Update assignment'
                    : formData.isGradedQuiz
                      ? 'Create quiz'
                      : 'Create assignment'}
              </button>
            </FormNavBar>
          </div>
        )}
      </form>

      {preview && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h3 className="mb-4 break-words text-xl font-semibold text-slate-900 dark:text-slate-100">{formData.title}</h3>
          <div className="prose max-w-none overflow-x-hidden">
            <ReactMarkdown>{formData.description}</ReactMarkdown>
          </div>
          <div className="mt-4 space-y-2 text-sm text-gray-500 dark:text-gray-400">
            <p>Total Points: {formData.totalPoints}</p>
            <p>Available From: {new Date(formData.availableFrom).toLocaleString()}</p>
            <p>Due: {new Date(formData.dueDate).toLocaleString()}</p>
            {formData.allowStudentUploads && (
              <p className="text-blue-600 font-medium">✓ Students can upload files</p>
            )}
            <p>Display Mode: {formData.displayMode === 'single' ? 'Single Question View' : 'Scrollable View'}</p>
          </div>
          <div className="mt-6 space-y-6 overflow-x-hidden">
            {formData.questions.map((question, index) => (
              <div key={question.id} className="border-t pt-4 overflow-x-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium break-words">Question {index + 1} ({question.points} points)</h4>
                    <p className="mt-1 break-words">{question.text}</p>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{question.type === 'text' ? 'Text Entry' : question.type === 'multiple-choice' ? 'Multiple Choice' : 'Matching'}</span>
                </div>
                {question.type === 'multiple-choice' && question.options && (
                  <div className="mt-4 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked={option.isCorrect}
                          readOnly
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700"
                        />
                        <span className={option.isCorrect ? 'text-green-600 font-medium' : ''}>
                          {option.text}
                          {option.isCorrect && ' (Correct)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {question.type === 'text' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Answer Field (Student View):
                    </label>
                    <textarea
                      className="w-full min-h-[120px] p-3 sm:p-4 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-y text-sm sm:text-base"
                      placeholder="Student's answer will appear here..."
                      readOnly
                      rows={5}
                    />
                  </div>
                )}
                {question.type === 'matching' && (
                  <div className="mt-4 space-y-2 overflow-x-hidden">
                    <h4 className="font-medium">Matching Pairs:</h4>
                    {(question.leftItems || []).map((left, idx) => (
                      <div key={left.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <span className="flex-1 min-w-0 text-sm break-words">{left.text || <em>Prompt</em>}</span>
                        <span className="hidden sm:inline mx-2 flex-shrink-0">→</span>
                        <select className="flex-1 min-w-0 border border-gray-300 bg-white text-gray-900 p-2 rounded text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" disabled>
                          <option>[ Choose ]</option>
                          {shuffleArray((question.rightItems || []).map(r => r.text)).map((opt, i) => (
                            <option key={i}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {formData.isGroupAssignment && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <h4 className="text-sm font-medium text-blue-800">Group Assignment</h4>
              <p className="mt-1 text-sm text-blue-600">
                This is a group assignment. Students will submit as a group.
                {formData.groupSetId && (
                  <span>
                    {' '}Using group set: {groupSets.find(set => set._id === formData.groupSetId)?.name}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reset Form Confirmation Modal */}
      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmResetForm}
        title="Clear Form"
        message="Are you sure you want to clear all fields and start fresh? This will delete your saved draft."
        confirmText="Clear"
        cancelText="Cancel"
        variant="warning"
      />
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="w-full overflow-x-hidden">{formInner}</div>
      ) : (
        <div className="min-h-screen overflow-x-hidden bg-slate-50/80 px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-6 lg:px-8">
          <div className="mx-auto max-w-4xl overflow-x-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:p-8">
            {formInner}
          </div>
        </div>
      )}
      {courseId && (
        <GradingPeriodsModal
          show={showGradingPeriodsModal}
          courseId={courseId}
          onClose={() => setShowGradingPeriodsModal(false)}
        />
      )}
    </>
  );
};

// Helper function to shuffle options for preview
function shuffleArray<T>(array: T[]): T[] {
  return array.slice().sort(() => Math.random() - 0.5);
}

export default CreateAssignmentForm; 