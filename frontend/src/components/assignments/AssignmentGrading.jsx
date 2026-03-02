import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { API_URL } from '../../config';
import { format } from 'date-fns';
import { safeFormatDate } from '../../utils/dateUtils';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, Save, Loader2, CheckSquare, Square, X, ChevronLeft, ChevronRight, SkipForward, FileText } from 'lucide-react';
import ConfirmationModal from '../common/ConfirmationModal';
import Breadcrumb from '../common/Breadcrumb';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FloatingLabelTextarea from '../common/FloatingLabelTextarea';
import FloatingActionButton from '../common/FloatingActionButton';
import SyncIndicator from '../common/SyncIndicator';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { offlineStorage } from '../../utils/offlineStorage';
import { hapticNavigation } from '../../utils/hapticFeedback';

const AssignmentGrading = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [assignment, setAssignment] = useState(null);
  const [course, setCourse] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [questionGrades, setQuestionGrades] = useState({});
  const [feedback, setFeedback] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const [retryCount, setRetryCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState(new Set()); // For bulk operations
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [showBulkFeedbackModal, setShowBulkFeedbackModal] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState('');
  const [gradeErrors, setGradeErrors] = useState({});
  const [showUnsavedChangesConfirm, setShowUnsavedChangesConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const feedbackTimeoutRef = useRef(null);
  const lastSavedFeedbackRef = useRef('');
  const lastSavedGradesRef = useRef({});
  const [swipeProgress, setSwipeProgress] = useState(0); // -1 to 1, negative = left swipe, positive = right swipe
  const [isSwiping, setIsSwiping] = useState(false);

  // Offline sync hook
  const {
    syncState,
    isOnline,
    saveGrade: saveGradeOffline,
    saveFeedback: saveFeedbackOffline,
    loadSavedData,
    triggerSync
  } = useOfflineSync({
    assignmentId: id || '',
    submissionId: selectedSubmission?._id,
    onSyncComplete: () => {
      toast.success('Changes synced successfully');
    },
    onSyncError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  // Calculate submissions that still need grading
  // A submission is considered graded if teacherApproved is true OR gradedBy is set
  const ungradedSubmissionsCount = useMemo(() => {
    if (!Array.isArray(submissions)) return 0;
    return submissions.filter(sub => {
      // Submission is graded if teacherApproved is true OR gradedBy is set
      return !(sub.teacherApproved || sub.gradedBy);
    }).length;
  }, [submissions]);

  // Navigate to next/previous submission
  const navigateToNextSubmission = useCallback(() => {
    if (!selectedSubmission || submissions.length === 0) return;
    const currentIndex = submissions.findIndex(s => s._id === selectedSubmission._id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % submissions.length;
    if (hasUnsavedChanges) {
      setShowUnsavedChangesConfirm(true);
      window.pendingSubmissionNavigation = submissions[nextIndex];
    } else {
      setSelectedSubmission(submissions[nextIndex]);
      hapticNavigation();
    }
  }, [selectedSubmission, submissions, hasUnsavedChanges]);

  const navigateToPreviousSubmission = useCallback(() => {
    if (!selectedSubmission || submissions.length === 0) return;
    const currentIndex = submissions.findIndex(s => s._id === selectedSubmission._id);
    if (currentIndex === -1) return;
    const prevIndex = currentIndex === 0 ? submissions.length - 1 : currentIndex - 1;
    if (hasUnsavedChanges) {
      setShowUnsavedChangesConfirm(true);
      window.pendingSubmissionNavigation = submissions[prevIndex];
    } else {
      setSelectedSubmission(submissions[prevIndex]);
      hapticNavigation();
    }
  }, [selectedSubmission, submissions, hasUnsavedChanges]);

  // Enhanced swipe gesture handlers with visual feedback
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const swipeStartRef = useRef(null);
  const swipeCurrentRef = useRef(null);

  const handleSwipeTouchStart = useCallback((e) => {
    if (!isMobile || !selectedSubmission || submissions.length <= 1 || hasUnsavedChanges) return;
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeCurrentRef.current = null;
    setIsSwiping(true);
    setSwipeProgress(0);
  }, [isMobile, selectedSubmission, submissions.length, hasUnsavedChanges]);

  const handleSwipeTouchMove = useCallback((e) => {
    if (!swipeStartRef.current || !isMobile || !selectedSubmission || submissions.length <= 1 || hasUnsavedChanges) return;
    const touch = e.touches[0];
    swipeCurrentRef.current = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - swipeStartRef.current.y);
    
    // Only show progress for horizontal swipes
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
      const progress = Math.max(-1, Math.min(1, deltaX / 150)); // Normalize to -1 to 1
      setSwipeProgress(progress);
    }
  }, [isMobile, selectedSubmission, submissions.length, hasUnsavedChanges]);

  const handleSwipeTouchEnd = useCallback(() => {
    if (!swipeStartRef.current || !swipeCurrentRef.current) {
      setIsSwiping(false);
      setSwipeProgress(0);
      swipeStartRef.current = null;
      swipeCurrentRef.current = null;
      return;
    }

    const deltaX = swipeCurrentRef.current.x - swipeStartRef.current.x;
    const deltaY = Math.abs(swipeCurrentRef.current.y - swipeStartRef.current.y);
    const distance = Math.abs(deltaX);
    
    // Reset visual feedback
    setIsSwiping(false);
    setSwipeProgress(0);
    swipeStartRef.current = null;
    swipeCurrentRef.current = null;

    // Only trigger if horizontal swipe is dominant and meets threshold
    if (Math.abs(deltaX) > deltaY && distance >= 80) {
      if (deltaX > 0) {
        navigateToPreviousSubmission();
      } else {
        navigateToNextSubmission();
      }
    }
  }, [navigateToNextSubmission, navigateToPreviousSubmission]);

  const submissionSwipeHandlers = {
    enabled: isMobile && selectedSubmission && submissions.length > 1 && !hasUnsavedChanges,
    onTouchStart: handleSwipeTouchStart,
    onTouchMove: handleSwipeTouchMove,
    onTouchEnd: handleSwipeTouchEnd
  };

  // Navigate to next ungraded submission
  const navigateToNextUngraded = useCallback(() => {
    if (!selectedSubmission || submissions.length === 0) return;
    const currentIndex = submissions.findIndex(s => s._id === selectedSubmission._id);
    if (currentIndex === -1) return;
    
    // Find next ungraded submission
    for (let i = 1; i < submissions.length; i++) {
      const nextIndex = (currentIndex + i) % submissions.length;
      const nextSubmission = submissions[nextIndex];
      if (!nextSubmission.graded && !nextSubmission.autoGraded) {
        if (hasUnsavedChanges) {
          setShowUnsavedChangesConfirm(true);
          window.pendingSubmissionNavigation = nextSubmission;
        } else {
          setSelectedSubmission(nextSubmission);
          hapticNavigation();
        }
        return;
      }
    }
    
    // If all are graded, show message
    toast.info('All submissions have been graded');
  }, [selectedSubmission, submissions, hasUnsavedChanges]);

  // Debounce function
  const debounce = useCallback((func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }, []);

  // Validate grade input
  const validateGrade = useCallback((grade, maxPoints) => {
    // Handle empty string or null - allow it for typing
    if (grade === '' || grade === null || grade === undefined || grade === '-') {
      return { valid: true, value: undefined };
    }
    
    const numGrade = parseFloat(grade);
    if (isNaN(numGrade)) {
      return { valid: false, error: 'Grade must be a number' };
    }
    
    if (numGrade < 0) {
      return { valid: false, error: 'Grade cannot be negative' };
    }
    
    // Only validate max if maxPoints is a valid positive number
    // If maxPoints is 0 or invalid, skip max validation (might be a data issue)
    if (maxPoints && !isNaN(maxPoints) && maxPoints > 0) {
      if (numGrade > maxPoints) {
        return { valid: false, error: `Grade cannot exceed ${maxPoints} points` };
      }
    } else {
      // maxPoints is 0 or invalid - log warning but allow the grade
      console.warn(`⚠️ maxPoints is ${maxPoints} (invalid or 0), allowing grade ${numGrade} anyway`);
    }
    
    return { valid: true, value: numGrade };
  }, []);

  // Sanitize feedback input
  const sanitizeFeedback = useCallback((text) => {
    // Remove potentially dangerous HTML but allow basic formatting
    return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }, []);

  // Auto-save feedback
  const autoSaveFeedback = useCallback(async (feedbackText, submissionId) => {
    if (!submissionId || feedbackText === lastSavedFeedbackRef.current) {
      return;
    }

    const sanitizedFeedback = sanitizeFeedback(feedbackText);
    
    // Always save to offline storage first
    if (id) {
      try {
        await saveFeedbackOffline(submissionId, sanitizedFeedback);
      } catch (error) {
        console.error('Error saving feedback offline:', error);
      }
    }

    // Try to save to server if online
    if (isOnline) {
    setAutoSaveStatus('saving');
    try {
      await api.put(`/submissions/${submissionId}`, {
          feedback: sanitizedFeedback,
        approveGrade: false
      });
      lastSavedFeedbackRef.current = feedbackText;
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (err) {
      setAutoSaveStatus('error');
      console.error('Auto-save error:', err);
        // Error is okay - data is saved offline and will sync later
      }
    } else {
      // Offline - just mark as saved locally
      lastSavedFeedbackRef.current = feedbackText;
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    }
  }, [sanitizeFeedback, id, isOnline, saveFeedbackOffline]);

  // Debounced auto-save
  const debouncedAutoSave = useMemo(
    () => debounce((feedbackText, submissionId) => {
      autoSaveFeedback(feedbackText, submissionId);
    }, 2000),
    [debounce, autoSaveFeedback]
  );

  // Initialize question grades when submission is selected
  useEffect(() => {
    if (selectedSubmission && assignment) {
      const initializeSubmission = async () => {
        // Try to load saved offline data first
        const savedData = await loadSavedData(selectedSubmission._id);
        
      const initialGrades = {};
      
      assignment.questions.forEach((question, index) => {
          // Prefer offline saved data, then server data, then auto-grade
          let existingGrade = savedData.questionGrades?.[index] ?? null;
        
          if (existingGrade === null) {
        if (selectedSubmission.questionGrades) {
          if (selectedSubmission.questionGrades instanceof Map) {
            existingGrade = selectedSubmission.questionGrades.get(index.toString());
          } else if (typeof selectedSubmission.questionGrades === 'object') {
            existingGrade = selectedSubmission.questionGrades[index] !== undefined 
              ? selectedSubmission.questionGrades[index] 
              : selectedSubmission.questionGrades[index.toString()];
          }
        }
          }
          
          let autoGrade = null;
          if (selectedSubmission.autoQuestionGrades) {
            if (selectedSubmission.autoQuestionGrades instanceof Map) {
              autoGrade = selectedSubmission.autoQuestionGrades.get(index.toString());
            } else if (typeof selectedSubmission.autoQuestionGrades === 'object') {
              autoGrade = selectedSubmission.autoQuestionGrades[index.toString()];
            }
          }
          // Treat undefined as null, but keep 0 as valid value
          if (autoGrade === undefined) {
            autoGrade = null;
          }
        
        if (question.type !== 'multiple-choice' && question.type !== 'matching') {
          if (existingGrade !== null && existingGrade !== undefined) {
            initialGrades[index] = existingGrade;
          } else if (autoGrade !== null && autoGrade !== undefined) {
            initialGrades[index] = autoGrade;
          } else {
            initialGrades[index] = 0;
          }
        } else {
            // For auto-graded questions (multiple-choice, matching)
            // Only set manual grade if it's explicitly different from auto-grade
          if (existingGrade !== null && existingGrade !== undefined && 
              autoGrade !== null && autoGrade !== undefined) {
            const difference = Math.abs(existingGrade - autoGrade);
              // Only keep manual grade if it's significantly different from auto-grade
              // This prevents keeping stale overrides that match the auto-grade
            if (difference > 0.01 && !(existingGrade === 0 && autoGrade > 0)) {
              initialGrades[index] = existingGrade;
            }
              // Don't set initial grade - let it use auto-grade
          }
            // If no existing grade, don't set anything - will use auto-grade
        }
      });
      
      setQuestionGrades(initialGrades);
        // Prefer offline saved feedback, then server feedback
        const feedbackText = savedData.feedback ?? selectedSubmission.feedback ?? '';
      setFeedback(feedbackText);
      lastSavedFeedbackRef.current = feedbackText;
      lastSavedGradesRef.current = { ...initialGrades };
      setHasUnsavedChanges(false);
      };
      
      initializeSubmission();
    }
  }, [selectedSubmission, assignment, loadSavedData]);

  // Handle feedback change with auto-save
  const handleFeedbackChange = useCallback((e) => {
    const newFeedback = e.target.value;
    setFeedback(newFeedback);
    setHasUnsavedChanges(true);
    
    if (selectedSubmission?._id) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        debouncedAutoSave(newFeedback, selectedSubmission._id);
      }, 2000);
    }
  }, [selectedSubmission, debouncedAutoSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && selectedSubmission) {
        e.preventDefault();
        if (!selectedSubmission.autoGraded || assignment?.questions?.some(q => q.type !== 'multiple-choice' && q.type !== 'matching')) {
          handleGradeSubmission(false);
        } else if (selectedSubmission.autoGraded) {
          handleGradeSubmission(true);
        }
      }
      // Escape to close delete modal
      if (e.key === 'Escape' && showDeleteModal) {
        setShowDeleteModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSubmission, showDeleteModal, assignment]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Fetch data with retry mechanism
  const fetchData = useCallback(async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setError('');

      const assignmentRes = await api.get(`/assignments/${id}`);
      
      if (typeof assignmentRes.data === 'string' && assignmentRes.data.trim().startsWith('<!DOCTYPE')) {
        throw new Error('API configuration error: Unable to reach backend server. Please check your network connection.');
      }
      
      const assignmentData = assignmentRes.data?.data || assignmentRes.data;
      
      if (!assignmentData || typeof assignmentData !== 'object') {
        throw new Error('Invalid assignment data received from server');
      }
      
      assignmentData.questions = Array.isArray(assignmentData.questions) ? assignmentData.questions : [];
      setAssignment(assignmentData);

      // Fetch course data if we have a module
      if (assignmentData.module) {
        try {
          const moduleId = typeof assignmentData.module === 'string' 
            ? assignmentData.module 
            : assignmentData.module._id;
          const moduleRes = await api.get(`/modules/view/${moduleId}`);
          
          if (moduleRes.data.success) {
            const courseId = moduleRes.data.data.course._id || moduleRes.data.data.course;
            const courseRes = await api.get(`/courses/${courseId}`);
            
            if (courseRes.data.success) {
              setCourse(courseRes.data.data);
            }
          }
        } catch (err) {
          console.error('Error fetching course data:', err);
          // Don't fail the whole page if course fetch fails
        }
      }

      const submissionsRes = await api.get(`/submissions/assignment/${id}`);
      
      if (typeof submissionsRes.data === 'string' && submissionsRes.data.trim().startsWith('<!DOCTYPE')) {
        setSubmissions([]);
        toast.warn('Unable to load submissions. Please refresh the page.');
      } else {
        const submissionsDataRaw = submissionsRes.data?.data || submissionsRes.data;
        const submissionsData = Array.isArray(submissionsDataRaw) ? submissionsDataRaw : [];
        setSubmissions(submissionsData);
      }
      
      setLoading(false);
      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching assignment data:', err);
      
      if (retryAttempt < 3) {
        setRetryCount(retryAttempt + 1);
        toast.warn(`Retrying... (${retryAttempt + 1}/3)`);
        setTimeout(() => fetchData(retryAttempt + 1), 2000 * (retryAttempt + 1));
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Error fetching assignment data';
        setError(errorMessage);
        setLoading(false);
        toast.error(errorMessage);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGradeSubmission = async (approveGrade = false) => {
    if (!selectedSubmission) {
      toast.error('Please select a submission to grade');
      return;
    }
    
    // Validate all grades before submission
    if (!approveGrade && assignment?.questions) {
      for (let i = 0; i < assignment.questions.length; i++) {
        const question = assignment.questions[i];
        if (question && question.type !== 'multiple-choice' && question.type !== 'matching') {
          const grade = questionGrades[i];
          if (grade !== undefined && grade !== null && grade !== '') {
            const maxPoints = parseFloat(question.points);
            const validMaxPoints = !isNaN(maxPoints) && maxPoints > 0 ? maxPoints : undefined;
            const validation = validateGrade(grade, validMaxPoints);
            if (!validation.valid) {
              toast.error(`Question ${i + 1}: ${validation.error}`);
              return;
            }
          }
        }
      }
    }
    
    setIsGrading(true);
    const previousSubmission = { ...selectedSubmission };
    const previousGrades = { ...questionGrades };
    const previousFeedback = feedback;

    // Optimistic update
    if (approveGrade) {
      setSubmissions(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.map(sub => 
          sub._id === selectedSubmission._id 
            ? { ...sub, teacherApproved: true, finalGrade: sub.autoGrade, grade: sub.autoGrade }
            : sub
        );
      });
    }

    try {
      const payload = {
        feedback: sanitizeFeedback(feedback),
        approveGrade
      };

      if (!approveGrade) {
        const gradesToSend = {};
        
        Object.keys(questionGrades).forEach(index => {
          const gradeValue = questionGrades[index];
          if (gradeValue !== undefined && gradeValue !== null && gradeValue !== '') {
            const questionIdx = parseInt(index);
            const question = assignment?.questions?.[questionIdx];
            
            if (question && (question.type === 'multiple-choice' || question.type === 'matching')) {
              const autoGrade = getAutoGradeForQuestion(questionIdx);
              // Only send manual grade if it's explicitly different from auto-grade
              // This prevents sending grades that match auto-grade (which would be redundant)
              if (autoGrade !== null && autoGrade !== undefined) {
                const difference = Math.abs(parseFloat(gradeValue) - parseFloat(autoGrade));
                // Only send if significantly different
                // For multiple-choice, be more strict - only send if user explicitly overrode
                if (question.type === 'multiple-choice') {
                  // For multiple-choice, only send if it's a real override (difference > 0.01)
                  // AND it's not the case where user set 0 but auto is > 0 (which would be clearing the override)
                  if (difference > 0.01 && !(parseFloat(gradeValue) === 0 && parseFloat(autoGrade) > 0)) {
                    gradesToSend[index.toString()] = gradeValue;
                  }
                } else {
                  // For matching questions, same logic but less strict
                  if (difference > 0.01 && !(parseFloat(gradeValue) === 0 && parseFloat(autoGrade) > 0)) {
                  gradesToSend[index.toString()] = gradeValue;
                }
              }
            } else {
                // No auto-grade available, send the manual grade
                gradesToSend[index.toString()] = gradeValue;
              }
            } else {
              // Non-auto-gradable questions - always send manual grade
              gradesToSend[index.toString()] = gradeValue;
            }
          }
        });
        
        if (Object.keys(gradesToSend).length === 0 && selectedSubmission.questionGrades) {
          if (assignment && assignment.questions) {
            assignment.questions.forEach((question, index) => {
              let existingGrade = null;
              
              if (selectedSubmission.questionGrades instanceof Map) {
                existingGrade = selectedSubmission.questionGrades.get(index.toString());
              } else if (typeof selectedSubmission.questionGrades === 'object') {
                existingGrade = selectedSubmission.questionGrades[index] !== undefined 
                  ? selectedSubmission.questionGrades[index] 
                  : selectedSubmission.questionGrades[index.toString()];
              }
              
              const autoGrade = getAutoGradeForQuestion(index);
              
              if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                if (existingGrade !== null && existingGrade !== undefined) {
                  gradesToSend[index.toString()] = existingGrade;
                }
              } else {
                if (existingGrade !== null && existingGrade !== undefined && 
                    autoGrade !== null && autoGrade !== undefined && 
                    Math.abs(existingGrade - autoGrade) > 0.01) {
                  gradesToSend[index.toString()] = existingGrade;
                }
              }
            });
          }
        }
        
        payload.questionGrades = gradesToSend;
      }

      const response = await api.put(`/submissions/${selectedSubmission._id}`, payload);

      // Mark as synced in offline storage after successful save
      if (id && selectedSubmission._id) {
        try {
          if (!approveGrade && Object.keys(questionGrades).length > 0) {
            await offlineStorage.markGradeSynced(selectedSubmission._id);
          }
          if (feedback) {
            await offlineStorage.markFeedbackSynced(selectedSubmission._id);
          }
        } catch (error) {
          console.error('Error marking items as synced:', error);
        }
      }

      setSubmissions(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.map(sub => 
          sub._id === selectedSubmission._id ? response.data : sub
        );
      });
      
      setSelectedSubmission(response.data);
      
      // Re-initialize question grades using the same logic as the useEffect
      // This ensures auto-grades are preserved and displayed correctly
      const updatedGrades = {};
      if (assignment && assignment.questions) {
        assignment.questions.forEach((question, index) => {
          let existingGrade = null;
          
          // Check for manual grades from response
          if (response.data.questionGrades) {
            if (response.data.questionGrades instanceof Map) {
              existingGrade = response.data.questionGrades.get(index.toString());
            } else if (typeof response.data.questionGrades === 'object') {
              existingGrade = response.data.questionGrades[index] !== undefined 
                ? response.data.questionGrades[index] 
                : response.data.questionGrades[index.toString()];
            }
          }
          
          // Get auto-grade from response
          let autoGrade = null;
          if (response.data.autoQuestionGrades) {
            if (response.data.autoQuestionGrades instanceof Map) {
              autoGrade = response.data.autoQuestionGrades.get(index.toString());
            } else if (typeof response.data.autoQuestionGrades === 'object') {
              autoGrade = response.data.autoQuestionGrades[index.toString()];
            }
          }
          // Treat undefined as null, but keep 0 as valid value
          if (autoGrade === undefined) {
            autoGrade = null;
          }
          
          if (question.type !== 'multiple-choice' && question.type !== 'matching') {
            // For non-auto-graded questions, use manual grade or auto-grade or 0
            if (existingGrade !== null && existingGrade !== undefined) {
              updatedGrades[index] = existingGrade;
            } else if (autoGrade !== null && autoGrade !== undefined) {
            updatedGrades[index] = autoGrade;
            } else {
              updatedGrades[index] = 0;
            }
          } else {
            // For auto-graded questions, only set if there's a manual override
            if (existingGrade !== null && existingGrade !== undefined && 
                autoGrade !== null && autoGrade !== undefined) {
              const difference = Math.abs(existingGrade - autoGrade);
              if (difference > 0.01 && !(existingGrade === 0 && autoGrade > 0)) {
                updatedGrades[index] = existingGrade;
              }
            }
          }
        });
      }
      setQuestionGrades(updatedGrades);
      lastSavedGradesRef.current = { ...updatedGrades };
      lastSavedFeedbackRef.current = feedback;
      setHasUnsavedChanges(false);
      
      // Check notification status from server response
      const studentId = response.data.student?._id || response.data.student;
      const notificationWasCreated = response.data.notificationCreated;
      
      if (notificationWasCreated) {
        toast.success(approveGrade ? 'Auto-grade approved and notification sent!' : 'Submission graded and notification sent!');
      } else {
        toast.success(approveGrade ? 'Auto-grade approved successfully' : 'Submission graded successfully');
      }
      
      setError('');
      
      // Trigger notification refresh for the student (though this won't work across browsers)
      window.dispatchEvent(new CustomEvent('notificationCreated', {
        detail: { userId: studentId }
      }));
    } catch (err) {
      // Revert optimistic update
      setSubmissions(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.map(sub => 
          sub._id === selectedSubmission._id ? previousSubmission : sub
        );
      });
      setQuestionGrades(previousGrades);
      setFeedback(previousFeedback);
      
      const errorMessage = err.response?.data?.message || 'Error grading submission';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGrading(false);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!selectedSubmission) return;
    
    setIsDeleting(true);
    const submissionToDelete = selectedSubmission;
    
    // Optimistic update
    setSubmissions(prev => prev.filter(s => s._id !== selectedSubmission._id));
    setSelectedSubmission(null);
    
    try {
      await api.delete(`/submissions/${selectedSubmission._id}`);
      toast.success('Submission deleted successfully');
      setError('');
      setShowDeleteModal(false);
    } catch (err) {
      // Revert optimistic update
      setSubmissions(prev => [...prev, submissionToDelete]);
      setSelectedSubmission(submissionToDelete);
      
      const errorMessage = err.response?.data?.message || 'Error deleting submission';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk operations
  const handleToggleSelection = useCallback((submissionId) => {
    setSelectedSubmissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(submissionId)) {
        newSet.delete(submissionId);
      } else {
        newSet.add(submissionId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedSubmissions.size === submissions.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(submissions.map(s => s._id)));
    }
  }, [selectedSubmissions, submissions]);

  const handleBulkApproveAutoGrades = async () => {
    const selectedIds = Array.from(selectedSubmissions);
    if (selectedIds.length === 0) {
      toast.warn('Please select at least one submission');
      return;
    }

    const autoGradedSubmissions = submissions.filter(s => 
      selectedIds.includes(s._id) && s.autoGraded && !s.teacherApproved
    );

    if (autoGradedSubmissions.length === 0) {
      toast.warn('No auto-graded submissions selected or all are already approved');
      return;
    }

    setIsBulkOperating(true);
    setBulkProgress({ current: 0, total: autoGradedSubmissions.length });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < autoGradedSubmissions.length; i++) {
        const submission = autoGradedSubmissions[i];
        setBulkProgress({ current: i + 1, total: autoGradedSubmissions.length });
        
        try {
          await api.put(`/submissions/${submission._id}`, {
            approveGrade: true,
            feedback: submission.feedback || ''
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to approve submission ${submission._id}:`, err);
          failCount++;
        }
      }

      // Refresh submissions
      const submissionsRes = await api.get(`/submissions/assignment/${id}`);
      const submissionsDataRaw = submissionsRes.data?.data || submissionsRes.data;
      const submissionsData = Array.isArray(submissionsDataRaw) ? submissionsDataRaw : [];
      setSubmissions(submissionsData);

      setSelectedSubmissions(new Set());
      
      if (successCount > 0) {
        toast.success(`Successfully approved ${successCount} submission${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to approve ${failCount} submission${failCount !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      toast.error('Error during bulk approval');
    } finally {
      setIsBulkOperating(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  const handleBulkApplyFeedback = async () => {
    const selectedIds = Array.from(selectedSubmissions);
    if (selectedIds.length === 0) {
      toast.warn('Please select at least one submission');
      return;
    }

    if (!bulkFeedback.trim()) {
      toast.warn('Please enter feedback to apply');
      return;
    }

    setShowBulkFeedbackModal(false);
    setIsBulkOperating(true);
    setBulkProgress({ current: 0, total: selectedIds.length });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selectedIds.length; i++) {
        const submissionId = selectedIds[i];
        setBulkProgress({ current: i + 1, total: selectedIds.length });
        
        try {
          const submission = submissions.find(s => s._id === submissionId);
          await api.put(`/submissions/${submissionId}`, {
            feedback: sanitizeFeedback(bulkFeedback),
            approveGrade: submission?.autoGraded ? true : false
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to apply feedback to submission ${submissionId}:`, err);
          failCount++;
        }
      }

      // Refresh submissions
      const submissionsRes = await api.get(`/submissions/assignment/${id}`);
      const submissionsDataRaw = submissionsRes.data?.data || submissionsRes.data;
      const submissionsData = Array.isArray(submissionsDataRaw) ? submissionsDataRaw : [];
      setSubmissions(submissionsData);

      setSelectedSubmissions(new Set());
      setBulkFeedback('');
      
      if (successCount > 0) {
        toast.success(`Successfully applied feedback to ${successCount} submission${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to apply feedback to ${failCount} submission${failCount !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      toast.error('Error during bulk feedback application');
    } finally {
      setIsBulkOperating(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedSubmissions);
    if (selectedIds.length === 0) {
      toast.warn('Please select at least one submission');
      return;
    }

    setIsBulkOperating(true);
    setBulkProgress({ current: 0, total: selectedIds.length });

    const submissionsToDelete = submissions.filter(s => selectedIds.includes(s._id));
    
    // Optimistic update
    setSubmissions(prev => prev.filter(s => !selectedIds.includes(s._id)));
    setSelectedSubmissions(new Set());
    if (selectedSubmission && selectedIds.includes(selectedSubmission._id)) {
      setSelectedSubmission(null);
    }

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selectedIds.length; i++) {
        const submissionId = selectedIds[i];
        setBulkProgress({ current: i + 1, total: selectedIds.length });
        
        try {
          await api.delete(`/submissions/${submissionId}`);
          successCount++;
        } catch (err) {
          console.error(`Failed to delete submission ${submissionId}:`, err);
          failCount++;
        }
      }

      if (failCount > 0) {
        // Revert optimistic update for failed deletions
        const failedSubmissions = submissionsToDelete.slice(selectedIds.length - failCount);
        setSubmissions(prev => [...prev, ...failedSubmissions]);
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} submission${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} submission${failCount !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      // Revert all on complete failure
      setSubmissions(prev => [...prev, ...submissionsToDelete]);
      toast.error('Error during bulk deletion');
    } finally {
      setIsBulkOperating(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  const handleGradeChange = useCallback((index, value) => {
    // Allow empty string while typing
    if (value === '' || value === '-') {
      setQuestionGrades(prev => ({
        ...prev,
        [index]: ''
      }));
      // Clear error when field is cleared
      setGradeErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
      setHasUnsavedChanges(true);
      return;
    }
    
    const maxPoints = getMaxPointsForQuestion(index);
    
    // Debug logging
    if (maxPoints <= 0) {
      console.warn(`⚠️ maxPoints is ${maxPoints} for question ${index}. Question data:`, assignment?.questions?.[index]);
    }
    
    const validation = validateGrade(value, maxPoints);
    
    if (!validation.valid && value !== '' && value !== null && value !== undefined) {
      // Show error inline
      setGradeErrors(prev => ({
        ...prev,
        [index]: validation.error
      }));
      return;
    }
    
    // Clear error on valid input
    setGradeErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
    
    // Update the grade
    const finalValue = validation.value !== undefined ? validation.value : (parseFloat(value) || 0);
    const updatedGrades = {
      ...questionGrades,
      [index]: finalValue
    };
    setQuestionGrades(updatedGrades);
    setHasUnsavedChanges(true);
    
    // Update last saved grades ref for comparison
    lastSavedGradesRef.current = updatedGrades;

    // Save to offline storage
    if (selectedSubmission?._id && id) {
      saveGradeOffline(selectedSubmission._id, updatedGrades).catch(error => {
        console.error('Error saving grade offline:', error);
      });
    }
  }, [questionGrades, validateGrade, assignment, selectedSubmission, id, saveGradeOffline]);

  const getQuestionType = (questionIndex) => {
    if (!assignment?.questions) return 'unknown';
    const question = assignment.questions[questionIndex];
    return question?.type || 'unknown';
  };

  const getAutoGradeForQuestion = (questionIndex) => {
    if (!selectedSubmission?.autoQuestionGrades) {
      return null;
    }
    
    let autoGrade = undefined;
    const key = questionIndex.toString();
    
    if (selectedSubmission.autoQuestionGrades instanceof Map) {
      autoGrade = selectedSubmission.autoQuestionGrades.get(key);
    } else if (typeof selectedSubmission.autoQuestionGrades === 'object' && selectedSubmission.autoQuestionGrades !== null) {
      // Check if key exists in object (handles both numeric and string keys)
      if (key in selectedSubmission.autoQuestionGrades) {
        autoGrade = selectedSubmission.autoQuestionGrades[key];
      } else if (questionIndex in selectedSubmission.autoQuestionGrades) {
        autoGrade = selectedSubmission.autoQuestionGrades[questionIndex];
      }
    }
    
    const result = autoGrade !== undefined ? autoGrade : null;
    // Return null only if not found (undefined), otherwise return the value (including 0)
    // This distinguishes between "not auto-graded" (null) and "auto-graded with 0 points" (0)
    return result;
  };

  // Helper to check if auto-grade should be displayed for a question
  const shouldShowAutoGrade = (questionIndex, questionType) => {
    // Only show for auto-gradable question types
    if (questionType !== 'multiple-choice' && questionType !== 'matching') {
      return false;
    }
    
    // Check if submission is auto-graded
    if (!selectedSubmission?.autoGraded) {
      return false;
    }
    
    // Check if autoQuestionGrades exists and has data
    if (!selectedSubmission?.autoQuestionGrades) {
      return false;
    }
    
    // Check if this question has an auto-grade value (including 0)
    const autoGrade = getAutoGradeForQuestion(questionIndex);
    const isNumber = typeof autoGrade === 'number';
    // Return true if autoGrade is a number (including 0), false if null/undefined
    return isNumber;
  };

  const getMaxPointsForQuestion = (questionIndex) => {
    if (!assignment?.questions) return 0;
    const question = assignment.questions[questionIndex];
    if (!question) return 0;
    // Ensure points is a valid number
    const points = parseFloat(question.points);
    return isNaN(points) || points < 0 ? 0 : points;
  };

  const getStudentAnswer = (questionIndex) => {
    if (!selectedSubmission?.answers) return '';
    
    let answer = '';
    if (selectedSubmission.answers instanceof Map) {
      answer = selectedSubmission.answers.get(questionIndex.toString()) || '';
    } else if (typeof selectedSubmission.answers === 'object') {
      answer = selectedSubmission.answers[questionIndex.toString()] || '';
    }
    
    const questionType = getQuestionType(questionIndex);
    if (questionType === 'matching' && typeof answer === 'string') {
      try {
        return JSON.parse(answer);
      } catch (e) {
        return {};
      }
    }
    
    return answer;
  };

  // Memoized submission list
  const submissionList = useMemo(() => {
    if (!Array.isArray(submissions)) return null;
    return submissions.map((submission) => {
      const isSelected = selectedSubmissions.has(submission._id);
      return (
        <div
          key={submission._id}
          className={`p-4 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            selectedSubmission?._id === submission._id
              ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
              : isSelected
              ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
          }`}
        >
          <div className="flex items-start space-x-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSelection(submission._id);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center mt-1 flex-shrink-0 touch-manipulation active:scale-95 transition-transform"
              aria-label={`${isSelected ? 'Deselect' : 'Select'} submission from ${submission.student?.firstName} ${submission.student?.lastName}`}
            >
              {isSelected ? (
                <CheckSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Square className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              )}
            </button>
            <div
              onClick={() => setSelectedSubmission(submission)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedSubmission(submission);
                }
              }}
              tabIndex={0}
              role="button"
              className="flex-1 cursor-pointer"
              aria-label={`Grade submission from ${submission.student?.firstName} ${submission.student?.lastName}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {submission.student?.firstName} {submission.student?.lastName}
                </div>
                <div className="flex items-center space-x-2">
                  {submission.autoGraded && (
                    <div className="flex items-center text-blue-600 dark:text-blue-400" aria-label="Auto-graded">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Auto</span>
                    </div>
                  )}
                  {submission.teacherApproved && (
                    <div className="flex items-center text-green-600 dark:text-green-400" aria-label="Graded">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Graded</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Submitted: {safeFormatDate(submission.submittedAt, 'MMM d, yyyy h:mm a', 'No date')}
              </div>
              {submission.autoGraded && (
                <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Auto-grade: {submission.autoGrade} points
                </div>
              )}
              {submission.teacherApproved && (
                <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Final grade: {submission.finalGrade || submission.grade} points
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  }, [submissions, selectedSubmission, selectedSubmissions, handleToggleSelection]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading assignment data...</p>
        {retryCount > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Retry attempt {retryCount}/3</p>
        )}
      </div>
    );
  }

  if (error && !assignment) {
    return (
      <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{error}</p>
            {retryCount > 0 && (
              <p className="text-sm mt-1">Failed after {retryCount} retry attempts</p>
            )}
          </div>
          <button
            onClick={() => fetchData()}
            className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-gray-900 dark:text-gray-100 text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Assignment not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm safe-area-inset-top">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowUnsavedChangesConfirm(true);
              } else {
                navigate(-1);
              }
            }}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate px-2">
            {assignment.title} - Grading
          </h1>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pt-16 lg:pt-4">
        {/* Breadcrumb Navigation - Desktop Only */}
        {assignment && course && (
          <div className="hidden lg:block mb-4">
            <Breadcrumb
              items={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Courses', path: '/courses' },
                { 
                  label: course.catalog?.courseCode || course.title || 'Course', 
                  path: `/courses/${course._id}` 
                },
                { 
                  label: assignment.isGradedQuiz ? 'Quizzes' : 'Assignments', 
                  path: `/courses/${course._id}/${assignment.isGradedQuiz ? 'quizzes' : 'assignments'}` 
                },
                { 
                  label: assignment.title || 'Assignment', 
                  path: `/assignments/${id}/view` 
                },
                { 
                  label: 'Grading', 
                  path: location.pathname 
                }
              ]}
            />
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 border dark:border-gray-700">
          {/* Desktop Header */}
          <div className="mb-4 sm:mb-6 hidden lg:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">
                  {assignment.title} - Grading
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {ungradedSubmissionsCount} submission{ungradedSubmissionsCount !== 1 ? 's' : ''} to grade
                </p>
              </div>
              {hasUnsavedChanges && (
                <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Unsaved changes
                </div>
              )}
            </div>
          </div>

          {/* Mobile Header Info */}
          <div className="mb-4 sm:mb-6 lg:hidden">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2">
              {ungradedSubmissionsCount} submission{ungradedSubmissionsCount !== 1 ? 's' : ''} to grade
            </p>
            {hasUnsavedChanges && (
              <div className="flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs mt-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved changes
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Submissions List */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Submissions
                </h2>
                {submissions.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    aria-label={selectedSubmissions.size === submissions.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedSubmissions.size === submissions.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              
              {/* Bulk Actions Bar */}
              {selectedSubmissions.size > 0 && (
                <div className="mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                      {selectedSubmissions.size} selected
                    </span>
                    <button
                      onClick={() => setSelectedSubmissions(new Set())}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {submissions.some(s => selectedSubmissions.has(s._id) && s.autoGraded && !s.teacherApproved) && (
                      <button
                        onClick={handleBulkApproveAutoGrades}
                        disabled={isBulkOperating}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve Auto-Grades
                      </button>
                    )}
                    <button
                      onClick={() => setShowBulkFeedbackModal(true)}
                      disabled={isBulkOperating}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply Feedback
                    </button>
                    <button
                      onClick={() => {
                        setShowBulkDeleteConfirm(true);
                      }}
                      disabled={isBulkOperating}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                  {isBulkOperating && bulkProgress.total > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>Processing...</span>
                        <span>{bulkProgress.current}/{bulkProgress.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto" role="list">
                {submissionList || (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                    <p className="text-sm">No submissions available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Grading Interface */}
            <div 
              className="lg:col-span-2 relative"
              {...(submissionSwipeHandlers.enabled ? {
                onTouchStart: submissionSwipeHandlers.onTouchStart,
                onTouchMove: submissionSwipeHandlers.onTouchMove,
                onTouchEnd: submissionSwipeHandlers.onTouchEnd
              } : {})}
            >
              {/* Swipe Visual Feedback Overlay */}
              {isSwiping && isMobile && (
                <div 
                  className="absolute inset-0 bg-black/5 dark:bg-white/5 pointer-events-none z-10 transition-opacity"
                  style={{
                    transform: `translateX(${swipeProgress * 20}px)`,
                    opacity: Math.abs(swipeProgress) * 0.3
                  }}
                />
              )}
            {selectedSubmission ? (
              <div>
                <div className="mb-6">
                  {/* Navigation buttons for mobile - On top */}
                    {isMobile && submissions.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <button
                          onClick={navigateToPreviousSubmission}
                          disabled={hasUnsavedChanges}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label="Previous submission"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {submissions.findIndex(s => s._id === selectedSubmission._id) + 1} / {submissions.length}
                        </span>
                        <button
                          onClick={navigateToNextSubmission}
                          disabled={hasUnsavedChanges}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          aria-label="Next submission"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  <div className="mb-2">
                    <div className="flex items-center justify-between w-full">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Grading: {selectedSubmission.student?.firstName} {selectedSubmission.student?.lastName}
                      </h2>
                      {/* Sync Indicator */}
                      <SyncIndicator
                        status={syncState.status}
                        pendingCount={syncState.pendingCount}
                        isOnline={isOnline}
                        onClick={triggerSync}
                      />
                    </div>
                  </div>
                  
                  {/* Auto-grading status */}
                  {selectedSubmission.autoGraded && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center mb-2">
                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="font-medium text-blue-900 dark:text-blue-200">Auto-Graded Submission</span>
                      </div>
                      <div className="text-blue-800 dark:text-blue-200">
                        <div>Auto-grade: {selectedSubmission.autoGrade} points</div>
                        {selectedSubmission.teacherApproved ? (
                          <div className="text-green-700 dark:text-green-300 font-medium">
                            Final grade: {selectedSubmission.finalGrade || selectedSubmission.grade} points
                          </div>
                        ) : (
                          <div className="text-sm">
                            Multiple choice questions have been auto-graded. You can review, edit grades, and provide feedback before approving.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Questions */}
                {assignment.questions && Array.isArray(assignment.questions) && (
                  <div className="space-y-4">
                    {assignment.questions.map((question, index) => {
                        const questionType = getQuestionType(index);
                        const autoGrade = getAutoGradeForQuestion(index);
                        const maxPoints = getMaxPointsForQuestion(index);
                        const studentAnswer = getStudentAnswer(index);
                        const shouldShow = shouldShowAutoGrade(index, questionType);
                        
                        return (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                  Question {index + 1}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{question.text}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600 dark:text-gray-400">{maxPoints} pts</div>
                                {shouldShow && (
                                  <div className={`text-sm ${autoGrade > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Auto: {autoGrade}/{maxPoints}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Student Answer */}
                            <div className="mb-3">
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Student Answer:
                              </div>
                              {questionType === 'multiple-choice' ? (
                                <div className="text-sm text-gray-900 dark:text-gray-100">
                                  {studentAnswer || 'No answer'}
                                </div>
                              ) : questionType === 'matching' ? (
                                <div className="space-y-2">
                                  {question.leftItems && Array.isArray(question.leftItems) && question.leftItems.map((leftItem, leftIndex) => {
                                    const studentMatch = typeof studentAnswer === 'object' ? 
                                      studentAnswer[leftIndex] : '';
                                    const correctMatch = question.rightItems && question.rightItems.find(rightItem => 
                                      rightItem.id === leftItem.id
                                    );
                                    const isCorrect = studentMatch === (correctMatch?.text || '');
                                    
                                    return (
                                      <div key={leftItem.id} className={`p-2 rounded border ${
                                        isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                      }`}>
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-gray-900 dark:text-gray-100">{leftItem.text}</span>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 dark:text-gray-400">→</span>
                                            <span className={`text-sm ${
                                              isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                                            }`}>
                                              {studentMatch || 'No answer'}
                                            </span>
                                            {isCorrect ? (
                                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" aria-label="Correct" />
                                            ) : (
                                              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="Incorrect" />
                                            )}
                                          </div>
                                        </div>
                                        {!isCorrect && correctMatch && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            Correct: {correctMatch.text}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <textarea
                                  value={studentAnswer}
                                  readOnly
                                  className="w-full h-24 p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  placeholder="No answer provided"
                                  aria-label={`Student answer for question ${index + 1}`}
                                />
                              )}
                            </div>

                            {/* Grading */}
                            {questionType === 'multiple-choice' && typeof autoGrade === 'number' ? (
                              <div>
                                {/* Multiple-choice questions are fully auto-graded, no manual input */}
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  This question is auto-graded. You can override the grade by using "Grade with Edits" and modifying the question grades.
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-start space-x-3">
                                  <div className="w-32 flex-shrink-0">
                                    <FloatingLabelInput
                                      key={`grade-${index}-${questionGrades[index] || 0}`}
                                      id={`grade-${index}`}
                                      name={`grade-${index}`}
                                      type="number"
                                      label={`Grade (0-${maxPoints || 'N/A'})`}
                                      min="0"
                                      max={maxPoints > 0 ? maxPoints : undefined}
                                      step="0.1"
                                      value={(() => {
                                        // Priority: manual grade > auto-grade > 0
                                        const manualGrade = questionGrades[index];
                                        let finalValue;
                                        
                                        if (manualGrade !== undefined && manualGrade !== null && manualGrade !== '') {
                                          finalValue = manualGrade;
                                        } else if (autoGrade !== null && autoGrade !== undefined) {
                                          finalValue = autoGrade;
                                        } else {
                                          finalValue = 0;
                                        }
                                        
                                        return finalValue;
                                      })()}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        // Allow empty input while typing
                                        if (value === '' || value === '-') {
                                          // For matching questions, clear the manual override to use auto-grade
                                          if (questionType === 'matching') {
                                            setQuestionGrades(prev => {
                                              const newGrades = { ...prev };
                                              delete newGrades[index];
                                              return newGrades;
                                            });
                                          } else {
                                          setQuestionGrades(prev => ({
                                            ...prev,
                                            [index]: ''
                                          }));
                                          }
                                          return;
                                        }
                                        handleGradeChange(index, value);
                                      }}
                                      onBlur={(e) => {
                                        // If empty on blur, handle based on question type
                                        if (e.target.value === '' || e.target.value === '-') {
                                          if (questionType === 'matching') {
                                            // For matching questions, remove from questionGrades to use auto-grade
                                            setQuestionGrades(prev => {
                                              const newGrades = { ...prev };
                                              delete newGrades[index];
                                              return newGrades;
                                            });
                                          } else {
                                            // For text questions, set to 0 or autoGrade
                                            const finalValue = autoGrade !== null && autoGrade !== undefined ? autoGrade : 0;
                                          setQuestionGrades(prev => ({
                                            ...prev,
                                            [index]: finalValue
                                          }));
                                          }
                                        }
                                      }}
                                      onFocus={(e) => {
                                        if (e.target.value === '0' || e.target.value === '') {
                                          e.target.select();
                                        }
                                      }}
                                      error={gradeErrors[index]}
                                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      aria-label={`Grade for question ${index + 1}, maximum ${maxPoints || 'unlimited'} points`}
                                    />
                                  </div>
                                  {shouldShow && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400 pt-2 flex-shrink-0">
                                      Auto: {autoGrade}/{maxPoints || 'N/A'}
                                    </div>
                                  )}
                                </div>
                                {questionType === 'matching' && autoGrade !== null && autoGrade !== undefined && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    You can override the auto-grade if needed
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                    })}
                  </div>
                )}

                {/* Feedback */}
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-xs">
                        {autoSaveStatus === 'saving' && (
                          <span className="text-gray-500 dark:text-gray-400 flex items-center">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Saving...
                          </span>
                        )}
                        {autoSaveStatus === 'saved' && (
                          <span className="text-green-600 dark:text-green-400 flex items-center">
                            <Save className="h-3 w-3 mr-1" />
                            Saved
                          </span>
                        )}
                        {autoSaveStatus === 'error' && (
                          <span className="text-red-600 dark:text-red-400 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Save failed
                          </span>
                        )}
                      </div>
                    </div>
                    <FloatingLabelTextarea
                      id="feedback"
                      name="feedback"
                      label="Feedback"
                      value={feedback}
                      onChange={handleFeedbackChange}
                      rows={6}
                      placeholder="Provide feedback for the student..."
                      aria-label="Feedback for student"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Auto-saves after 2 seconds
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-wrap gap-3">
                    {selectedSubmission.autoGraded ? (
                      <>
                        <button
                          onClick={() => handleGradeSubmission(true)}
                          disabled={isGrading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Approve auto-grade"
                        >
                          {isGrading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Approving...
                            </>
                          ) : (
                            'Approve Auto-Grade'
                          )}
                        </button>
                        {assignment.questions && assignment.questions.some(q => q.type !== 'multiple-choice' && q.type !== 'matching') && (
                          <button
                            onClick={() => handleGradeSubmission(false)}
                            disabled={isGrading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Grade with edits"
                          >
                            {isGrading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Grading...
                              </>
                            ) : (
                              'Grade with Edits'
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleGradeSubmission(false)}
                        disabled={isGrading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Grade submission"
                      >
                        {isGrading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Grading...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Grade Submission
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Delete Submission Button */}
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      disabled={isDeleting || isGrading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete submission"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Submission'
                      )}
                    </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <p>Select a submission to grade</p>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteSubmission}
        title="Delete Submission"
        message="Are you sure you want to delete this submission? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Bulk Feedback Modal */}
      {showBulkFeedbackModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="bulk-feedback-modal" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowBulkFeedbackModal(false);
                setBulkFeedback('');
              }}
              aria-hidden="true"
            />
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 border-t-4 border-blue-200 dark:border-blue-800">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1 w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="bulk-feedback-modal">
                      Apply Feedback to Selected Submissions
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Enter feedback to apply to {selectedSubmissions.size} selected submission(s):
                      </p>
                      <textarea
                        value={bulkFeedback}
                        onChange={(e) => setBulkFeedback(e.target.value)}
                        className="w-full h-32 p-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                        placeholder="Enter feedback to apply to all selected submissions..."
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowBulkFeedbackModal(false);
                      setBulkFeedback('');
                    }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    aria-label="Close"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleBulkApplyFeedback}
                  disabled={isBulkOperating || !bulkFeedback.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkOperating ? 'Applying...' : 'Apply Feedback'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkFeedbackModal(false);
                    setBulkFeedback('');
                  }}
                  disabled={isBulkOperating}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmationModal
        isOpen={showUnsavedChangesConfirm}
        onClose={() => {
          setShowUnsavedChangesConfirm(false);
          window.pendingSubmissionNavigation = null;
        }}
        onConfirm={() => {
          setShowUnsavedChangesConfirm(false);
          // Check if there's a pending submission navigation
          if (window.pendingSubmissionNavigation) {
            setSelectedSubmission(window.pendingSubmissionNavigation);
            hapticNavigation();
            window.pendingSubmissionNavigation = null;
          } else {
            navigate(-1);
          }
        }}
        title="Unsaved Changes"
        message={window.pendingSubmissionNavigation 
          ? "You have unsaved changes. Are you sure you want to switch submissions?"
          : "You have unsaved changes. Are you sure you want to leave?"
        }
        confirmText={window.pendingSubmissionNavigation ? "Switch" : "Leave"}
        cancelText="Stay"
        variant="warning"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={() => {
          setShowBulkDeleteConfirm(false);
          handleBulkDelete();
        }}
        title="Delete Submissions"
        message={`Delete ${selectedSubmissions.size} submission(s)? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isBulkOperating}
      />

      {/* Floating Action Button (Mobile Only) */}
      {isMobile && selectedSubmission && submissions && submissions.length > 0 && (
        <FloatingActionButton
          mainIcon={<FileText className="w-5 h-5" strokeWidth={2.5} />}
          actions={[
            {
              icon: <SkipForward className="w-5 h-5" strokeWidth={2.5} />,
              label: 'Next Ungraded',
              onClick: navigateToNextUngraded,
              disabled: hasUnsavedChanges || submissions.every(s => s.graded || s.autoGraded)
            },
            {
              icon: <Save className="w-5 h-5" strokeWidth={2.5} />,
              label: hasUnsavedChanges ? 'Save Changes' : 'All Saved',
              onClick: () => {
                if (hasUnsavedChanges) {
                  handleGradeSubmission(selectedSubmission.autoGraded || false);
                } else {
                  toast.info('All changes are saved');
                }
              },
              disabled: !hasUnsavedChanges || isGrading
            },
            {
              icon: <ChevronRight className="w-5 h-5" strokeWidth={2.5} />,
              label: 'Next Submission',
              onClick: navigateToNextSubmission,
              disabled: hasUnsavedChanges || submissions.length <= 1
            },
            {
              icon: <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />,
              label: 'Previous Submission',
              onClick: navigateToPreviousSubmission,
              disabled: hasUnsavedChanges || submissions.length <= 1
            }
          ]}
          position="bottom-right"
          disabled={false}
          ariaLabel="Quick actions"
        />
      )}
    </div>
  );
};

export default AssignmentGrading;
