import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { API_URL } from '../../config';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface CreateAssignmentFormProps {
  moduleId: string;
  editMode?: boolean;
  assignmentData?: any;
}

interface Module {
  _id: string;
  title: string;
  course: string;
}

interface Question {
  id: string;
  type: 'text' | 'multiple-choice' | 'matching';
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
  isTimedQuiz: boolean;
  quizTimeLimit: number; // in minutes
  showCorrectAnswers: boolean; // Show correct answers to students after submission
  showStudentAnswers: boolean; // Show student answers after submission
  isOfflineAssignment: boolean; // Offline/paper-based assignment (manual grade entry)
}

interface GroupSet {
  _id: string;
  name: string;
  course: string;
  allowSelfSignup: boolean;
}

const CreateAssignmentForm: React.FC<CreateAssignmentFormProps> = ({ moduleId, editMode = false, assignmentData = null }) => {
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
    isTimedQuiz: false,
    quizTimeLimit: 60,
    showCorrectAnswers: false,
    showStudentAnswers: false,
    isOfflineAssignment: false
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [newOption, setNewOption] = useState({ text: '', isCorrect: false });
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseGroups, setCourseGroups] = useState<{ name: string; weight: number }[]>([]);
  // Initialize group from URL param, assignmentData, or empty string
  const [group, setGroup] = useState(searchParams.get('group') || '');
  const [currentStep, setCurrentStep] = useState(1);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [hasSubmissions, setHasSubmissions] = useState(false);
  const [totalPointsInput, setTotalPointsInput] = useState<string>('');

  useEffect(() => {
    const fetchModules = async () => {
      if (!moduleId) {
        setError('Module ID is required');
        return;
      }

      try {
        const token = localStorage.getItem('token');
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
        console.error('Error fetching modules:', err);
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
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/groups/sets/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupSets(response.data);
      } catch (err: any) {
        console.error('Error fetching group sets:', err);
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
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/submissions/assignment/${assignmentData._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setSubmissionCount(response.data.length);
          setHasSubmissions(response.data.length > 0);
        } catch (err) {
          console.error('Error fetching submission count:', err);
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
      
      console.log('Loading assignment for edit - Questions:', questions);
      
      const formDataToSet = {
        title: assignmentData.title || '',
        description: stripHtml(assignmentData.description || ''),
        availableFrom: availableFromDate,
        dueDate: assignmentData.dueDate ? format(new Date(assignmentData.dueDate), "yyyy-MM-dd'T'HH:mm") : '',
        attachments: [],
        moduleId: assignmentData.module || '',
        totalPoints: questions.reduce((sum, q) => sum + (q.points || 0), 0) || assignmentData.totalPoints || 0,
        questions: questions,
        isGroupAssignment: Boolean(assignmentData.isGroupAssignment),
        groupSetId: assignmentData.groupSet || null,
        allowStudentUploads: allowStudentUploads,
        displayMode: assignmentData.displayMode || 'single',
        isGradedQuiz: Boolean(assignmentData.isGradedQuiz || assignmentData.isTimedQuiz || assignmentData.showCorrectAnswers || assignmentData.showStudentAnswers),
        isTimedQuiz: Boolean(assignmentData.isTimedQuiz),
        quizTimeLimit: assignmentData.quizTimeLimit || 60,
        showCorrectAnswers: Boolean(assignmentData.showCorrectAnswers),
        showStudentAnswers: Boolean(assignmentData.showStudentAnswers),
        isOfflineAssignment: Boolean(assignmentData.isOfflineAssignment)
      };
      
      setFormData(formDataToSet);
      // Set group from assignmentData if in edit mode, otherwise keep URL param value
      if (!group) {
        setGroup(assignmentData.group || '');
      }
      setExistingAttachments(assignmentData.attachments || []);
      // Set totalPointsInput for offline assignments in edit mode
      if (assignmentData.isOfflineAssignment) {
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

  const validateStep1 = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (!(formData.isGroupAssignment && formData.groupSetId) && !formData.moduleId) {
      setError('Please select a module');
      return false;
    }
    if (formData.isGroupAssignment && !formData.groupSetId) {
      setError('Please select a group set for the group assignment');
      return false;
    }
    if (!formData.availableFrom || formData.availableFrom.trim() === '') {
      setError('Available from date is required');
      return false;
    }
    if (!formData.dueDate || formData.dueDate.trim() === '') {
      setError('Due date is required');
      return false;
    }
    // Check if availableFrom is before dueDate
    if (new Date(formData.availableFrom) >= new Date(formData.dueDate)) {
      setError('Available from date must be before due date');
      return false;
    }
    setError('');
    return true;
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Final validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
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

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('availableFrom', formData.availableFrom);
      formDataToSend.append('dueDate', formData.dueDate);
      formDataToSend.append('moduleId', formData.moduleId);
      formDataToSend.append('totalPoints', formData.totalPoints.toString());
      formDataToSend.append('questions', JSON.stringify(formData.questions));
      formDataToSend.append('isGroupAssignment', formData.isGroupAssignment.toString());
      formDataToSend.append('allowStudentUploads', formData.allowStudentUploads.toString());
      formDataToSend.append('displayMode', formData.displayMode);
      formDataToSend.append('isGradedQuiz', formData.isGradedQuiz.toString());
      formDataToSend.append('isTimedQuiz', formData.isTimedQuiz.toString());
      formDataToSend.append('quizTimeLimit', formData.quizTimeLimit.toString());
      formDataToSend.append('showCorrectAnswers', formData.showCorrectAnswers.toString());
      formDataToSend.append('showStudentAnswers', formData.showStudentAnswers.toString());
      formDataToSend.append('isOfflineAssignment', formData.isOfflineAssignment.toString());
      if (formData.isGroupAssignment && formData.groupSetId) {
        formDataToSend.append('groupSet', formData.groupSetId);
      }
      if (group) {
        formDataToSend.append('group', group);
      }
      formData.attachments.forEach(file => {
        formDataToSend.append('attachments', file);
      });


      const token = localStorage.getItem('token');
      
      if (editMode && assignmentData) {
        // Update existing assignment
        const response = await axios.put(`${API_URL}/api/assignments/${assignmentData._id}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data) {
          navigate(-1); // Go back to previous page after successful update
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
      console.error(editMode ? 'Error updating assignment:' : 'Error creating assignment:', err);
      if (err.response?.status === 403) {
        setError(`You are not authorized to ${editMode ? 'update' : 'create'} assignments. Please contact your administrator.`);
      } else if (err.response?.status === 400 && err.response?.data?.submissionCount) {
        setError(`${err.response.data.message} (${err.response.data.submissionCount} submission${err.response.data.submissionCount !== 1 ? 's' : ''} exist)`);
      } else {
        setError(err.response?.data?.message || `Error ${editMode ? 'updating' : 'creating'} assignment`);
      }
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 sm:p-4 lg:p-6 overflow-x-hidden">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-800 dark:text-gray-100">
        {editMode 
          ? (formData.isGradedQuiz ? 'Edit Quiz' : 'Edit Assignment')
          : (formData.isGradedQuiz ? 'Create New Quiz' : 'Create New Assignment')
        }
      </h2>
      
      {/* Step Indicator */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 dark:text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 text-xs sm:text-sm ${currentStep >= 1 ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white' : 'border-gray-300 dark:border-gray-700 dark:border-gray-600'}`}>
              1
            </div>
            <span className="ml-2 text-xs sm:text-sm font-medium">Basic Details</span>
          </div>
          <div className={`hidden sm:block w-12 h-0.5 ${currentStep >= 2 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
          <div className={`flex items-center ${currentStep >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 dark:text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 text-xs sm:text-sm ${currentStep >= 2 ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white' : 'border-gray-300 dark:border-gray-700 dark:border-gray-600'}`}>
              2
            </div>
            <span className="ml-2 text-xs sm:text-sm font-medium">Description</span>
          </div>
          <div className={`hidden sm:block w-12 h-0.5 ${currentStep >= 3 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
          <div className={`flex items-center ${currentStep >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 dark:text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 text-xs sm:text-sm ${currentStep >= 3 ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white' : 'border-gray-300 dark:border-gray-700 dark:border-gray-600'}`}>
              3
            </div>
            <span className="ml-2 text-xs sm:text-sm font-medium">Questions & Files</span>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Warning for assignments with submissions */}
      {editMode && hasSubmissions && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Assignment has {submissionCount} submission{submissionCount !== 1 ? 's' : ''}
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>This assignment has been submitted by {submissionCount} student{submissionCount !== 1 ? 's' : ''}. Some changes are restricted:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Cannot add or remove questions</li>
                  <li>Cannot change question types (e.g., from multiple-choice to text)</li>
                  <li>Can modify question text, options, and points</li>
                  <li>Can change assignment settings (title, description, dates, etc.)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Basic Details */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="assignment-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Title</label>
                <input
                  type="text"
                  id="assignment-title"
                  name="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
              </div>
              {!(formData.isGroupAssignment && formData.groupSetId) && (
                <div>
                  <label htmlFor="assignment-module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Module</label>
                  <select
                    id="assignment-module"
                    name="moduleId"
                    value={formData.moduleId}
                    onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })}
                    required={!formData.isGroupAssignment}
                    disabled={formData.isGroupAssignment}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  >
                    <option value="" disabled>Select a module</option>
                    {modules.map((module) => (
                      <option key={module._id} value={module._id}>{module.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="isGroupAssignment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Assignment Type</label>
                <div className="mt-2 space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isGroupAssignment"
                      checked={formData.isGroupAssignment}
                      onChange={(e) => setFormData({ ...formData, isGroupAssignment: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600 rounded"
                    />
                    <label htmlFor="isGroupAssignment" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      This is a group assignment
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="assignment-group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Assignment Group</label>
                <select
                  id="assignment-group"
                  name="group"
                  value={group}
                  onChange={e => setGroup(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                >
                  <option value="">Select a group</option>
                  {courseGroups.map((g) => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Graded Quiz Checkbox */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isGradedQuiz"
                  checked={formData.isGradedQuiz}
                  onChange={(e) => setFormData({ ...formData, isGradedQuiz: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600 rounded"
                />
                <label htmlFor="isGradedQuiz" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  Graded Quiz
                </label>
              </div>
              
              {/* Offline Assignment Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isOfflineAssignment"
                  checked={formData.isOfflineAssignment}
                  onChange={(e) => setFormData({ ...formData, isOfflineAssignment: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600 rounded"
                />
                <label htmlFor="isOfflineAssignment" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  Offline Assignment (Paper Based - manual grade entry)
                </label>
              </div>
            </div>

            {/* Timer Options - Show when Graded Quiz is checked */}
            {formData.isGradedQuiz && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Quiz Timer</label>
                  <div className="mt-2 space-y-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="noTimer"
                        name="timerOption"
                        value="noTimer"
                        checked={!formData.isTimedQuiz}
                        onChange={() => setFormData({ ...formData, isTimedQuiz: false })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600"
                      />
                      <label htmlFor="noTimer" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                        No timer (unlimited time)
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="withTimer"
                        name="timerOption"
                        value="withTimer"
                        checked={formData.isTimedQuiz}
                        onChange={() => setFormData({ ...formData, isTimedQuiz: true })}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600"
                      />
                      <label htmlFor="withTimer" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                        Timed quiz
                      </label>
                    </div>
                  </div>
                </div>

                {formData.isTimedQuiz && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Time Limit (minutes)</label>
                    <input
                      type="number"
                      id="quiz-time-limit"
                      name="quizTimeLimit"
                      value={formData.quizTimeLimit}
                      onChange={(e) => setFormData({ ...formData, quizTimeLimit: parseInt(e.target.value) || 60 })}
                      min="1"
                      max="480"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      placeholder="60"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">Enter time limit in minutes (1-480 minutes)</p>
                  </div>
                )}

                {/* Quiz Feedback Options */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Quiz Feedback Options</label>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="feedbackNone"
                          name="feedbackOption"
                          checked={!formData.showCorrectAnswers && !formData.showStudentAnswers}
                          onChange={() => setFormData({ ...formData, showCorrectAnswers: false, showStudentAnswers: false })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="feedbackNone" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                          No feedback (students won't see results)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="showCorrectAnswers"
                          name="feedbackOption"
                          checked={formData.showCorrectAnswers && !formData.showStudentAnswers}
                          onChange={() => setFormData({ ...formData, showCorrectAnswers: true, showStudentAnswers: false })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="showCorrectAnswers" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                          Show students which questions they got correct after submission (green for correct, red for wrong)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="showStudentAnswers"
                          name="feedbackOption"
                          checked={formData.showStudentAnswers && !formData.showCorrectAnswers}
                          onChange={() => setFormData({ ...formData, showStudentAnswers: true, showCorrectAnswers: false })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="showStudentAnswers" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                          Show students their submitted answers after submission (green for correct, red for wrong, and show correct answer for wrong ones)
                        </label>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                      Note: These options can be modified later in the grading page for individual submissions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formData.isGroupAssignment && (
              <div>
                <label htmlFor="assignment-group-set" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Group Set</label>
                <select
                  id="assignment-group-set"
                  name="groupSetId"
                  value={formData.groupSetId || ''}
                  onChange={(e) => setFormData({ ...formData, groupSetId: e.target.value || null })}
                  required={formData.isGroupAssignment}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                >
                  <option value="">Select a group set</option>
                  {groupSets.map((set) => (
                    <option key={set._id} value={set._id}>{set.name} {set.allowSelfSignup ? '(Self-signup enabled)' : ''}</option>
                  ))}
                </select>
                {formData.isGroupAssignment && !formData.groupSetId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 dark:text-red-400">Please select a group set for the group assignment</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="assignment-available-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Available From</label>
                <input
                  type="datetime-local"
                  id="assignment-available-from"
                  name="availableFrom"
                  value={formData.availableFrom}
                  onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                  step="600"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
              </div>
              <div>
                <label htmlFor="assignment-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Due Date</label>
                <input
                  type="datetime-local"
                  id="assignment-due-date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  step="600"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                Save & Continue
              </button>
            </div>
          </div>
        )}
        {/* Step 2: Description */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="assignment-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Description</label>
              <div className="mt-1">
                <textarea
                  id="assignment-description"
                  name="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  placeholder="Enter a detailed description of the assignment..."
                />
              </div>
              <div className="mt-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allowStudentUploads"
                    checked={formData.allowStudentUploads}
                    onChange={(e) => setFormData({ ...formData, allowStudentUploads: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="allowStudentUploads" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    Allow students to upload files
                  </label>
                </div>
                {editMode && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                    Debug: allowStudentUploads = {String(formData.allowStudentUploads)}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <label htmlFor="displayModeSingle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">Assignment Display Mode</label>
                <div className="mt-2 space-y-4">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="displayModeSingle"
                      name="displayMode"
                      value="single"
                      checked={formData.displayMode === 'single'}
                      onChange={(e) => setFormData({ ...formData, displayMode: e.target.value as 'single' | 'scrollable' })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600 rounded"
                    />
                    <label htmlFor="displayModeSingle" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      Single Question View (one question at a time)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="displayModeScrollable"
                      name="displayMode"
                      value="scrollable"
                      checked={formData.displayMode === 'scrollable'}
                      onChange={(e) => setFormData({ ...formData, displayMode: e.target.value as 'single' | 'scrollable' })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 dark:border-gray-600 rounded"
                    />
                    <label htmlFor="displayModeScrollable" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      Scrollable View (all questions at once)
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button
                type="button"
                onClick={prevStep}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreview(!preview)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-700"
                >
                  {preview ? 'Edit' : 'Preview'}
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Step 3: Questions & Files */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* For offline assignments, show simplified interface */}
            {formData.isOfflineAssignment ? (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">Offline Assignment</h4>
                      <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        Since this is a paper-based assignment, you only need to specify the total points. Students will complete the assignment on paper, and you can enter grades manually in the gradebook.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Total Points Input for Offline Assignments */}
                <div>
                  <label htmlFor="totalPoints" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Points <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
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
                        // Update formData with parsed value
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
                        // Ensure we have a valid value on blur
                        const value = parseFloat(e.target.value);
                        if (isNaN(value) || value <= 0) {
                          setTotalPointsInput('');
                          setFormData({ ...formData, totalPoints: 0 });
                        } else {
                          setTotalPointsInput(value.toString());
                          setFormData({ ...formData, totalPoints: value });
                        }
                      }}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
                      placeholder="Enter total points (e.g., 100)"
                      required
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Enter the maximum points possible for this paper-based assignment or test.
                  </p>
                </div>

                {/* Attachments Section - Still available for offline assignments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attachments (Optional)</label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    You can attach the question paper or any related documents here.
                  </p>
                  <input
                    type="file"
                    id="attachments"
                    name="attachments"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setFormData({ ...formData, attachments: [...formData.attachments, ...files] });
                    }}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/70"
                  />
                  {formData.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>{file.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newAttachments = [...formData.attachments];
                              newAttachments.splice(index, 1);
                              setFormData({ ...formData, attachments: newAttachments });
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Total Points Display for regular assignments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Total Points</label>
              <div className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 shadow-sm p-2">
                {Number.isFinite(formData.totalPoints) ? formData.totalPoints : 0}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Questions</h3>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => addQuestion('text')}
                    disabled={editMode && hasSubmissions}
                    className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md ${
                      editMode && hasSubmissions 
                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-300 cursor-not-allowed' 
                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                    }`}
                    title={editMode && hasSubmissions ? 'Cannot add questions after students have submitted' : ''}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Text Question
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuestion('multiple-choice')}
                    disabled={editMode && hasSubmissions}
                    className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md ${
                      editMode && hasSubmissions 
                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-300 cursor-not-allowed' 
                        : 'text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'
                    }`}
                    title={editMode && hasSubmissions ? 'Cannot add questions after students have submitted' : ''}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Multiple Choice
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuestion('matching')}
                    disabled={editMode && hasSubmissions}
                    className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md ${
                      editMode && hasSubmissions 
                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-300 cursor-not-allowed' 
                        : 'text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                    }`}
                    title={editMode && hasSubmissions ? 'Cannot add questions after students have submitted' : ''}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Matching Question
                  </button>
                </div>
              </div>
              {formData.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 space-y-4 bg-white dark:bg-gray-800 overflow-x-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                    <div className="flex-grow w-full sm:w-auto min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Question {index + 1}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">({question.type === 'text' ? 'Text Entry' : question.type === 'multiple-choice' ? 'Multiple Choice' : 'Matching'})</span>
                      </div>
                      <input
                        type="text"
                        id={`question-text-${index}`}
                        name={`question-text-${index}`}
                        value={question.text}
                        onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                        placeholder="Enter question text"
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm sm:text-base"
                      />
                    </div>
                    <div className="flex items-center space-x-2 sm:ml-4 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
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
                        className="w-16 sm:w-20 rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm"
                      />
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">points</span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        disabled={editMode && hasSubmissions}
                        className={`${
                          editMode && hasSubmissions 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                        }`}
                        title={editMode && hasSubmissions ? 'Cannot remove questions after students have submitted' : ''}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 'up')}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                      )}
                      {index < formData.questions.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 'down')}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {question.type === 'multiple-choice' && (
                    <div className="ml-0 sm:ml-4 space-y-2 overflow-x-hidden">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Options:</h4>
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`question-${index}-correct`}
                            checked={option.isCorrect}
                            onChange={() => {
                              const newQuestions = [...formData.questions];
                              newQuestions[index].options = newQuestions[index].options?.map((opt, i) => ({ ...opt, isCorrect: i === optionIndex }));
                              setFormData({ ...formData, questions: newQuestions });
                            }}
                            className="h-4 w-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700"
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
                            className="flex-1 min-w-0 rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm sm:text-base"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optionIndex)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          id={`new-option-${index}`}
                          name={`new-option-${index}`}
                          value={newOption.text}
                          onChange={(e) => setNewOption({ ...newOption, text: e.target.value })}
                          placeholder="Add new option"
                          className="flex-1 min-w-0 rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm sm:text-base"
                        />
                        <button
                          type="button"
                          onClick={() => addOption(index)}
                          className="px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                        >
                          Add Option
                        </button>
                      </div>
                    </div>
                  )}
                  {question.type === 'matching' && (
                    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-700 overflow-x-hidden">
                      <div className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Matching Pairs</div>
                      {question.leftItems && question.leftItems.map((left, idx) => (
                        <div key={left.id} className="flex flex-col sm:flex-row items-stretch sm:items-center mb-2 gap-2">
                          <input
                            type="text"
                            className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                            value={left.text}
                            onChange={e => {
                              const updated = [...(question.leftItems || [])];
                              updated[idx].text = e.target.value;
                              updateQuestion(index, 'leftItems', updated);
                            }}
                            placeholder="Prompt (e.g., Red)"
                          />
                          <span className="hidden sm:inline mx-2 text-gray-700 dark:text-gray-300 flex-shrink-0">→</span>
                          <input
                            type="text"
                            className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                            value={question.rightItems && question.rightItems[idx] ? question.rightItems[idx].text : ''}
                            onChange={e => {
                              const updated = [...(question.rightItems || [])];
                              if (!updated[idx]) updated[idx] = { id: left.id, text: '' };
                              updated[idx].text = e.target.value;
                              updated[idx].id = left.id;
                              updateQuestion(index, 'rightItems', updated);
                            }}
                            placeholder="Correct Match (e.g., Green)"
                          />
                          <button type="button" className="sm:ml-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex-shrink-0" onClick={() => {
                            const newLeft = (question.leftItems || []).filter((_, i) => i !== idx);
                            const newRight = (question.rightItems || []).filter((_, i) => i !== idx);
                            updateQuestion(index, 'leftItems', newLeft);
                            updateQuestion(index, 'rightItems', newRight);
                          }}>Remove</button>
                        </div>
                      ))}
                      <button type="button" className="mt-2 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/70" onClick={() => {
                        const newId = Math.random().toString(36).substr(2, 9);
                        updateQuestion(index, 'leftItems', [...(question.leftItems || []), { id: newId, text: '' }]);
                        updateQuestion(index, 'rightItems', [...(question.rightItems || []), { id: newId, text: '' }]);
                      }}>Add Pair</button>
                      <div className="font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">Distractor Options (Right Side Only)</div>
                      {(question.rightItems || []).slice((question.leftItems || []).length).map((right, idx) => (
                        <div key={right.id || idx} className="flex flex-col sm:flex-row items-stretch sm:items-center mb-2 gap-2">
                          <input
                            type="text"
                            className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                            value={right.text}
                            onChange={e => {
                              const base = question.leftItems ? question.leftItems.length : 0;
                              const updated = [...(question.rightItems || [])];
                              updated[base + idx].text = e.target.value;
                              updateQuestion(index, 'rightItems', updated);
                            }}
                            placeholder="Distractor (e.g., Aqua)"
                          />
                          <button type="button" className="sm:ml-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex-shrink-0" onClick={() => {
                            const base = question.leftItems ? question.leftItems.length : 0;
                            const updated = [...(question.rightItems || [])];
                            updated.splice(base + idx, 1);
                            updateQuestion(index, 'rightItems', updated);
                          }}>Remove</button>
                        </div>
                      ))}
                      <button type="button" className="mt-2 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/70" onClick={() => {
                        const base = question.leftItems ? question.leftItems.length : 0;
                        updateQuestion(index, 'rightItems', [...(question.rightItems || []), { id: Math.random().toString(36).substr(2, 9), text: '' }]);
                      }}>Add Distractor</button>
                      {/* Preview for matching question */}
                      <div className="mt-4 overflow-x-hidden">
                        <div className="font-semibold mb-1 text-gray-900 dark:text-gray-100">Preview:</div>
                        {(question.leftItems || []).map((left, idx) => (
                          <div key={left.id} className="flex flex-col sm:flex-row items-stretch sm:items-center mb-2 gap-2">
                            <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-gray-100 break-words">{left.text || <em className="text-gray-500 dark:text-gray-400">Prompt</em>}</span>
                            <select className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm" disabled>
                              <option>[ Choose ]</option>
                              {shuffleArray((question.rightItems || []).map(r => r.text)).map((opt, i) => (
                                <option key={i}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label htmlFor="assignment-attachments" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</label>
              <input
                type="file"
                id="assignment-attachments"
                name="attachments"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setFormData({ ...formData, attachments: [...formData.attachments, ...Array.from(e.target.files)] });
                  }
                }}
                className="mt-1 block w-full"
              />
            </div>
              </>
            )}
            
            {/* Navigation buttons for both offline and regular assignments */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button
                type="button"
                onClick={prevStep}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-700"
              >
                Back
              </button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPreview(!preview)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-700"
                >
                  {preview ? 'Edit' : 'Preview'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/modules/${formData.moduleId}/assignments`)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editMode 
                    ? (formData.isGradedQuiz ? 'Update Quiz' : 'Update Assignment')
                    : (formData.isGradedQuiz ? 'Create Quiz' : 'Create Assignment')
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {preview && (
        <div className="mt-6 sm:mt-8 p-4 sm:p-6 border rounded-lg bg-gray-50 dark:bg-gray-700 overflow-x-hidden">
          <h3 className="text-lg sm:text-xl font-semibold mb-4 break-words">{formData.title}</h3>
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
                        <select className="flex-1 min-w-0 border p-2 rounded text-sm" disabled>
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
      </div>
    </div>
  );
};

// Helper function to shuffle options for preview
function shuffleArray<T>(array: T[]): T[] {
  return array.slice().sort(() => Math.random() - 0.5);
}

export default CreateAssignmentForm; 