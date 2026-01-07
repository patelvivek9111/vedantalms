import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { API_URL } from '../../config';
import { format } from 'date-fns';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const AssignmentGrading = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [questionGrades, setQuestionGrades] = useState({});
  const [feedback, setFeedback] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize question grades when submission is selected
  useEffect(() => {
    if (selectedSubmission && assignment) {
      const initialGrades = {};
      
      assignment.questions.forEach((question, index) => {
        // Load existing grades from questionGrades if available
        // This includes all grades that were previously set (both auto and manual)
        let existingGrade = null;
        
        if (selectedSubmission.questionGrades) {
          if (selectedSubmission.questionGrades instanceof Map) {
            existingGrade = selectedSubmission.questionGrades.get(index.toString());
          } else if (typeof selectedSubmission.questionGrades === 'object') {
            existingGrade = selectedSubmission.questionGrades[index] !== undefined 
              ? selectedSubmission.questionGrades[index] 
              : selectedSubmission.questionGrades[index.toString()];
          }
        }
        
        // Get auto-grade for comparison
        const autoGrade = selectedSubmission.autoQuestionGrades instanceof Map
          ? selectedSubmission.autoQuestionGrades.get(index.toString())
          : selectedSubmission.autoQuestionGrades?.[index.toString()];
        
        if (question.type !== 'multiple-choice' && question.type !== 'matching') {
          // Text questions - use existing grade if available, otherwise use auto-grade or 0
          if (existingGrade !== null && existingGrade !== undefined) {
            initialGrades[index] = existingGrade;
          } else if (autoGrade !== null && autoGrade !== undefined) {
            initialGrades[index] = autoGrade;
          } else {
            initialGrades[index] = 0;
          }
        } else {
          // Auto-graded questions - only include if teacher manually changed it
          // IMPORTANT: Don't include if stored value is 0 and auto-grade is non-zero
          // This filters out incorrect stored data
          if (existingGrade !== null && existingGrade !== undefined && 
              autoGrade !== null && autoGrade !== undefined) {
            const difference = Math.abs(existingGrade - autoGrade);
            // Only include if significantly different AND it's a legitimate change
            // (not just incorrect 0 stored when auto-grade is correct)
            if (difference > 0.01 && !(existingGrade === 0 && autoGrade > 0)) {
              // Teacher manually changed this auto-graded question
              initialGrades[index] = existingGrade;
            }
          }
          // Otherwise don't include it - backend will use auto-grade
        }
      });
      
      setQuestionGrades(initialGrades);
      setFeedback(selectedSubmission.feedback || '');
    }
  }, [selectedSubmission, assignment]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch assignment details using the api service (which has proper baseURL)
        const assignmentRes = await api.get(`/assignments/${id}`);
        
        // Check if response is HTML (means API call failed and returned frontend page)
        if (typeof assignmentRes.data === 'string' && assignmentRes.data.trim().startsWith('<!DOCTYPE')) {
          console.error('API returned HTML instead of JSON. Check API_URL configuration.');
          setError('API configuration error: Unable to reach backend server. Please check your network connection.');
          setLoading(false);
          return;
        }
        
        // Handle both { success: true, data: {...} } and direct object responses
        const assignmentData = assignmentRes.data?.data || assignmentRes.data;
        
        // Ensure assignmentData is an object, not a string
        if (!assignmentData || typeof assignmentData !== 'object') {
          console.error('Invalid assignment data:', assignmentData);
          setError('Invalid assignment data received from server');
          setLoading(false);
          return;
        }
        
        // Ensure questions is always an array
        assignmentData.questions = Array.isArray(assignmentData.questions) ? assignmentData.questions : [];
        setAssignment(assignmentData);

        // Fetch submissions using the api service
        const submissionsRes = await api.get(`/submissions/assignment/${id}`);
        
        // Check if response is HTML
        if (typeof submissionsRes.data === 'string' && submissionsRes.data.trim().startsWith('<!DOCTYPE')) {
          console.error('Submissions API returned HTML instead of JSON.');
          setSubmissions([]);
        } else {
          // Handle both { success: true, data: [...] } and direct array responses
          const submissionsDataRaw = submissionsRes.data?.data || submissionsRes.data;
          const submissionsData = Array.isArray(submissionsDataRaw) ? submissionsDataRaw : [];
          console.log('Submissions response:', { 
            raw: submissionsRes.data, 
            processed: submissionsData,
            isArray: Array.isArray(submissionsDataRaw)
          });
          setSubmissions(submissionsData);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching assignment data:', err);
        console.error('Error response:', err.response?.data);
        console.error('Error config:', err.config);
        
        // Check if error response is HTML
        if (err.response?.data && typeof err.response.data === 'string' && err.response.data.trim().startsWith('<!DOCTYPE')) {
          setError('API configuration error: Backend server not reachable. Please check your network connection and API configuration.');
        } else {
          setError(err.response?.data?.message || 'Error fetching assignment data');
        }
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleGradeSubmission = async (approveGrade = false) => {
    if (!selectedSubmission) return;
    
    setIsGrading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        feedback,
        approveGrade
      };

      // Only include questionGrades if not approving auto-grade
      // Always send existing grades when re-grading to ensure backend recalculates correctly
      if (!approveGrade) {
        // Build complete grades object: include all question grades from state
        // The state should already have all existing grades loaded from the submission
        const gradesToSend = {};
        
        // Send grades from state, but filter out auto-graded questions unless manually changed
        // This ensures we don't send incorrect stored values for auto-graded questions
        Object.keys(questionGrades).forEach(index => {
          const gradeValue = questionGrades[index];
          if (gradeValue !== undefined && gradeValue !== null) {
            const questionIdx = parseInt(index);
            const question = assignment?.questions?.[questionIdx];
            
            // For auto-graded questions, only send if teacher manually changed it
            if (question && (question.type === 'multiple-choice' || question.type === 'matching')) {
              const autoGrade = getAutoGradeForQuestion(questionIdx);
              // Only send if it's different from auto-grade AND not incorrect stored data
              // Filter out cases where stored value is 0 but auto-grade is correct (non-zero)
              if (autoGrade !== null && autoGrade !== undefined) {
                const difference = Math.abs(gradeValue - autoGrade);
                if (difference > 0.01 && !(gradeValue === 0 && autoGrade > 0)) {
                  // Teacher manually changed this auto-graded question
                  gradesToSend[index.toString()] = gradeValue;
                }
              }
              // Otherwise don't send - backend will use auto-grade
            } else {
              // Text questions - always send
              gradesToSend[index.toString()] = gradeValue;
            }
          }
        });
        
        // If questionGrades is empty but submission has existing grades, load them
        if (Object.keys(gradesToSend).length === 0 && selectedSubmission.questionGrades) {
          if (assignment && assignment.questions) {
            assignment.questions.forEach((question, index) => {
              let existingGrade = null;
              
              // Get existing grade from submission
              if (selectedSubmission.questionGrades instanceof Map) {
                existingGrade = selectedSubmission.questionGrades.get(index.toString());
              } else if (typeof selectedSubmission.questionGrades === 'object') {
                existingGrade = selectedSubmission.questionGrades[index] !== undefined 
                  ? selectedSubmission.questionGrades[index] 
                  : selectedSubmission.questionGrades[index.toString()];
              }
              
              // Get auto-grade for comparison
              const autoGrade = getAutoGradeForQuestion(index);
              
              if (question.type !== 'multiple-choice' && question.type !== 'matching') {
                // Text questions - always send if grade exists
                if (existingGrade !== null && existingGrade !== undefined) {
                  gradesToSend[index.toString()] = existingGrade;
                }
              } else {
                // Auto-graded questions - only send if manually changed
                if (existingGrade !== null && existingGrade !== undefined && 
                    autoGrade !== null && autoGrade !== undefined && 
                    Math.abs(existingGrade - autoGrade) > 0.01) {
                  gradesToSend[index.toString()] = existingGrade;
                }
              }
            });
          }
        }
        
        // Always send questionGrades when grading with edits (even if empty, backend will use existing)
        payload.questionGrades = gradesToSend;
      }

      const response = await api.put(`/submissions/${selectedSubmission._id}`, payload);

      // Update the submission in the list
      setSubmissions(prev => {
        if (!Array.isArray(prev)) return [];
        return prev.map(sub => 
          sub._id === selectedSubmission._id ? response.data : sub
        );
      });
      
      setSelectedSubmission(response.data);
      
      // Reset questionGrades to reflect the updated submission
      const updatedGrades = {};
      if (assignment && assignment.questions) {
        assignment.questions.forEach((question, index) => {
          // For text questions, use the grade from the response if available
          if (response.data.questionGrades && response.data.questionGrades[index] !== undefined) {
            updatedGrades[index] = response.data.questionGrades[index];
          } else {
            // Fallback to auto-grade for multiple-choice or 0 for text questions
            const autoGrade = question.type === 'multiple-choice' ? 
              (question.options.find(opt => opt.isCorrect) ? question.points : 0) : 
              0;
            updatedGrades[index] = autoGrade;
          }
        });
      }
      setQuestionGrades(updatedGrades);
      
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error grading submission');
    } finally {
      setIsGrading(false);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!selectedSubmission) return;
    
    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await api.delete(`/submissions/${selectedSubmission._id}`);
      
      // Remove the deleted submission from the list
      setSubmissions(prev => prev.filter(s => s._id !== selectedSubmission._id));
      setSelectedSubmission(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting submission');
    } finally {
      setIsDeleting(false);
    }
  };

  const getQuestionType = (questionIndex) => {
    if (!assignment?.questions) return 'unknown';
    const question = assignment.questions[questionIndex];
    return question?.type || 'unknown';
  };

  const getAutoGradeForQuestion = (questionIndex) => {
    if (!selectedSubmission?.autoQuestionGrades) return null;
    
    // Handle both Map and object formats
    if (selectedSubmission.autoQuestionGrades instanceof Map) {
      return selectedSubmission.autoQuestionGrades.get(questionIndex.toString());
    } else if (typeof selectedSubmission.autoQuestionGrades === 'object') {
      return selectedSubmission.autoQuestionGrades[questionIndex.toString()];
    }
    
    return null;
  };

  const getMaxPointsForQuestion = (questionIndex) => {
    if (!assignment?.questions) return 0;
    const question = assignment.questions[questionIndex];
    return question?.points || 0;
  };

  const getStudentAnswer = (questionIndex) => {
    if (!selectedSubmission?.answers) return '';
    
    // Handle both Map and object formats
    let answer = '';
    if (selectedSubmission.answers instanceof Map) {
      answer = selectedSubmission.answers.get(questionIndex.toString()) || '';
    } else if (typeof selectedSubmission.answers === 'object') {
      answer = selectedSubmission.answers[questionIndex.toString()] || '';
    }
    
    // For matching questions, try to parse JSON string back to object
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
    return <div className="text-gray-900 dark:text-gray-100">Assignment not found</div>;
  }

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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate px-2">
            {assignment.title} - Grading
          </h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </nav>

      <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pt-16 lg:pt-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 border dark:border-gray-700">
          {/* Desktop Header */}
          <div className="mb-4 sm:mb-6 hidden lg:block">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">{assignment.title} - Grading</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''} to grade
            </p>
          </div>

          {/* Mobile Header Info */}
          <div className="mb-4 sm:mb-6 lg:hidden">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''} to grade
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-500">
              Select a submission to grade
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Submissions List */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">Submissions</h2>
              <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
                {Array.isArray(submissions) ? submissions.map((submission) => (
                  <div
                    key={submission._id}
                    onClick={() => setSelectedSubmission(submission)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedSubmission?._id === submission._id
                        ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {submission.student?.firstName} {submission.student?.lastName}
                      </div>
                      <div className="flex items-center space-x-2">
                        {submission.autoGraded && (
                          <div className="flex items-center text-blue-600 dark:text-blue-400">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Auto</span>
                          </div>
                        )}
                        {submission.teacherApproved && (
                          <div className="flex items-center text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Graded</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy h:mm a')}
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
                    )) : (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                        <p className="text-sm">No submissions available</p>
                        <p className="text-xs mt-1">Submissions data format error</p>
                      </div>
                    )}
              </div>
            </div>

            {/* Grading Interface */}
            <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    Grading: {selectedSubmission.student?.firstName} {selectedSubmission.student?.lastName}
                  </h2>
                  
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
                        
                        return (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-gray-100">Question {index + 1}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{question.text}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600 dark:text-gray-400">{maxPoints} pts</div>
                                {(questionType === 'multiple-choice' || questionType === 'matching') && autoGrade !== null && (
                                  <div className={`text-sm ${autoGrade > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Auto: {autoGrade}/{maxPoints}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Student Answer */}
                            <div className="mb-3">
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student Answer:</div>
                              {questionType === 'multiple-choice' ? (
                                <div className="text-sm text-gray-900 dark:text-gray-100">{studentAnswer || 'No answer'}</div>
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
                                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            ) : (
                                              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
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
                                />
                              )}
                            </div>

                            {/* Grading */}
                            {(questionType === 'multiple-choice' || questionType === 'matching') && autoGrade !== null ? (
                              <div>
                                {/* Auto-graded questions - no manual input needed */}
                              </div>
                            ) : questionType === 'matching' ? (
                              <div>
                                <label htmlFor={`grade-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Grade (0-{maxPoints}):
                                </label>
                                <div className="flex items-center space-x-3">
                                  <input
                                    key={`grade-${index}-${questionGrades[index] || 0}`}
                                    id={`grade-${index}`}
                                    name={`grade-${index}`}
                                    type="number"
                                    min="0"
                                    max={maxPoints}
                                    value={questionGrades[index] !== undefined ? questionGrades[index] : (autoGrade !== null ? autoGrade : 0)}
                                    onChange={(e) => setQuestionGrades(prev => ({
                                      ...prev,
                                      [index]: parseFloat(e.target.value) || 0
                                    }))}
                                    onFocus={(e) => {
                                      // Clear the input when focused to allow easy editing
                                      if (e.target.value === '0' || e.target.value === '') {
                                        e.target.select();
                                      }
                                    }}
                                    className="w-20 p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  {autoGrade !== null && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      Auto: {autoGrade}/{maxPoints}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label htmlFor={`grade-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Grade (0-{maxPoints}):
                                </label>
                                <div className="flex items-center space-x-3">
                                  <input
                                    key={`grade-${index}-${questionGrades[index] || 0}`}
                                    id={`grade-${index}`}
                                    name={`grade-${index}`}
                                    type="number"
                                    min="0"
                                    max={maxPoints}
                                    value={questionGrades[index] !== undefined ? questionGrades[index] : (autoGrade !== null ? autoGrade : 0)}
                                    onChange={(e) => setQuestionGrades(prev => ({
                                      ...prev,
                                      [index]: parseFloat(e.target.value) || 0
                                    }))}
                                    onFocus={(e) => {
                                      // Clear the input when focused to allow easy editing
                                      if (e.target.value === '0' || e.target.value === '') {
                                        e.target.select();
                                      }
                                    }}
                                    className="w-20 p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  {questionType === 'multiple-choice' && autoGrade !== null && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      Auto: {autoGrade}/{maxPoints}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                    })}
                  </div>
                )}

                {/* Feedback */}
                <div className="mt-6">
                    <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Feedback:
                    </label>
                    <textarea
                      id="feedback"
                      name="feedback"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                      placeholder="Provide feedback for the student..."
                    />
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex space-x-3">
                    {selectedSubmission.autoGraded ? (
                      <>
                        <button
                          onClick={() => handleGradeSubmission(true)}
                          disabled={isGrading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600"
                        >
                          {isGrading ? 'Approving...' : 'Approve Auto-Grade'}
                        </button>
                        {assignment.questions && assignment.questions.some(q => q.type !== 'multiple-choice' && q.type !== 'matching') && (
                          <button
                            onClick={() => handleGradeSubmission(false)}
                            disabled={isGrading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
                          >
                            {isGrading ? 'Grading...' : 'Grade with Edits'}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleGradeSubmission(false)}
                        disabled={isGrading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
                      >
                        {isGrading ? 'Grading...' : 'Grade Submission'}
                      </button>
                    )}
                    
                    {/* Delete Submission Button */}
                    <button
                      onClick={handleDeleteSubmission}
                      disabled={isDeleting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Submission'}
                    </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                Select a submission to grade
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentGrading;