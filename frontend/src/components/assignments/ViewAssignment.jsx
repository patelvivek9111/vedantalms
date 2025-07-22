import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Lock, Unlock, HelpCircle, CheckCircle, Circle, Bookmark, BarChart3, Edit, Eye } from 'lucide-react';
import { API_URL } from '../../config';

const ViewAssignment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentGroupId, setStudentGroupId] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const [markedQuestions, setMarkedQuestions] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [showUploadSection, setShowUploadSection] = useState(false);

  // Teacher analytics state
  const [submissionStats, setSubmissionStats] = useState({
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

  // Define instructor check early
  const isInstructor = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
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
      console.error('Error fetching submission stats:', error);
      // Fallback: calculate basic stats from submissions
      try {
        const submissionsResponse = await axios.get(`/api/submissions/assignment/${assignment._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const submissions = submissionsResponse.data || [];
        const stats = {
          totalStudents: submissions.length,
          submittedCount: submissions.filter(s => s.submittedAt).length,
          averageGrade: submissions.length > 0 
            ? submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / submissions.length 
            : 0,
          averageTime: assignment.isTimedQuiz && submissions.length > 0
            ? submissions.reduce((sum, s) => sum + (s.timeSpent || 0), 0) / submissions.length
            : 0,
          questionStats: assignment.questions?.map((q, index) => ({
            questionIndex: index,
            correctCount: 0,
            incorrectCount: 0,
            averagePoints: 0
          })) || []
        };
        
        setSubmissionStats(stats);
      } catch (err) {
        console.error('Error calculating basic stats:', err);
        // Set default stats if all else fails
        setSubmissionStats({
          totalStudents: 0,
          submittedCount: 0,
          averageGrade: 0,
          averageTime: 0,
          questionStats: []
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

        // Initialize answers object for student submission
        if (assignmentRes.data.questions) {
          const initialAnswers = {};
          assignmentRes.data.questions.forEach((q, index) => {
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
          const userGroup = groupsRes.data.find(group =>
            group.members.some(member => String(member._id) === String(userId))
          );
          setStudentGroupId(userGroup ? userGroup._id : null);
        }

        // Always fetch submission for the current user
        if (user?.role === 'student') {
          try {
            const submissionRes = await axios.get(`/api/submissions/student/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            setSubmission(submissionRes.data);
            if (submissionRes.data?.answers) {
              // Parse answers back to proper format
              const parsedAnswers = {};
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
          } catch (err) {
            setSubmission(null);
            // Reset answers to empty
            if (assignmentRes.data.questions) {
              const initialAnswers = {};
              assignmentRes.data.questions.forEach((q, index) => {
                if (q.type === 'matching') {
                  initialAnswers[index] = {}; // Object for matching questions
                } else {
                  initialAnswers[index] = ''; // String for other question types
                }
              });
              setAnswers(initialAnswers);
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
        const elapsed = Math.floor((now - startTime) / 1000);
        const totalSeconds = assignment.quizTimeLimit * 60;
        
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
        const elapsed = Math.floor((now - quizStartTime) / 1000); // seconds
        const totalSeconds = assignment.quizTimeLimit * 60; // convert minutes to seconds
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
    if (assignment?.isTimedQuiz && assignment?.quizTimeLimit) {
      const startTime = new Date();
      setQuizStartTime(startTime);
      setQuizStarted(true);
      // Make timer user-specific by including user ID in the key
      const timerKey = `quiz_start_${id}_${user._id}`;
      localStorage.setItem(timerKey, startTime.toISOString());
      setTimeLeft(assignment.quizTimeLimit);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const newFiles = response.data.files.map(file => ({
        name: file.originalname,
        url: file.path,
        size: file.size
      }));

      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setError('Error uploading files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0 Hours, 0 Minutes, 0 Seconds';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours} Hour${hours !== 1 ? 's' : ''}, ${minutes} Minute${minutes !== 1 ? 's' : ''}, ${secs} Second${secs !== 1 ? 's' : ''}`;
  };

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }));
    
    // Update answered questions tracking
    const isAnswered = typeof value === 'object' ? 
      Object.keys(value).length > 0 && Object.values(value).some(v => v && v.trim() !== '') :
      value && value.trim() !== '';
    
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

  const navigateToQuestion = (questionIndex) => {
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

  const toggleMarkQuestion = (questionIndex) => {
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
      const submissionAnswers = {};
      Object.keys(answers).forEach(questionIndex => {
        const answer = answers[questionIndex];
        if (answer && typeof answer === 'object') {
          // For matching questions, convert object to string
          submissionAnswers[questionIndex] = JSON.stringify(answer);
        } else {
          submissionAnswers[questionIndex] = answer;
        }
      });

      const token = localStorage.getItem('token');
      const payload = {
        assignment: id,
        answers: submissionAnswers,
        submittedAt: new Date(),
        uploadedFiles: uploadedFiles
      };
      if (assignment?.isGroupAssignment) {
        payload.groupId = studentGroupId;
      }
      

      
      const response = await axios.post(`/api/submissions`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      

      setSubmission(response.data);
      setError('');
      
      // Dispatch event to refresh ToDo panel
      window.dispatchEvent(new Event('assignmentSubmitted'));
    } catch (err) {
      console.error('[Frontend] Submit error:', err.response?.status, err.response?.data);
      setError(err.response?.data?.message || 'Error submitting assignment');
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
        setError(err.response?.data?.message || 'Error deleting assignment');
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
      setAssignment(prev => ({ ...prev, published: res.data.published }));
    } catch (err) {
      console.error('Error toggling assignment publish:', err);
      setError(err.response?.data?.message || 'Error toggling publish status');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!assignment) {
    return <div>Assignment not found</div>;
  }

  const isStudent = user?.role === 'student';
  const isCreator = isInstructor && assignment?.createdBy?._id === user?._id;
  const isPastDue = new Date() > new Date(assignment?.dueDate);
  const isTeacherPreview = isInstructor;
  

  


  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Due: {format(new Date(assignment.dueDate), 'PPp')}
              {submission && (
                <span className="ml-4 text-green-600">Submitted: {format(new Date(submission.submittedAt), 'PPp')}</span>
              )}
            </p>
            {/* Show feedback if student and feedback exists */}
            {isStudent && submission && typeof submission.feedback === 'string' && submission.feedback.trim() !== '' && (
              <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <div className="text-yellow-800 font-semibold mb-1">Instructor Feedback</div>
                <div className="text-yellow-900 whitespace-pre-line">{submission.feedback}</div>
              </div>
            )}
            
            {/* Show auto-grading status for students */}
            {isStudent && submission && submission.autoGraded && (
              <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <div className="text-blue-800 font-semibold mb-1">
                  {submission.teacherApproved ? 'Grading Complete' : 'Auto-Graded'}
                </div>
                <div className="text-blue-900">
                  {submission.teacherApproved ? (
                    <>
                      <div>Final Grade: {(() => {
                        const grade = Number(submission.finalGrade || submission.grade);
                        return Number.isInteger(grade) ? grade.toString() : grade.toFixed(2);
                      })()} points</div>
                      <div className="text-sm text-blue-700 mt-1">
                        Multiple choice questions were auto-graded. Other questions were graded by your instructor.
                      </div>
                    </>
                  ) : (
                    <>
                      <div>Auto-Grade: {(() => {
                        const grade = Number(submission.autoGrade);
                        return Number.isInteger(grade) ? grade.toString() : grade.toFixed(2);
                      })()} points</div>
                      <div className="text-sm text-blue-700 mt-1">
                        Multiple choice questions have been auto-graded. Your instructor will review and approve the final grade.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}


          </div>
          <div className="flex space-x-2">
            {isStudent && !submission && !isPastDue && (!assignment.isTimedQuiz || quizStarted) && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            )}
            {isCreator && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>



        {/* Timer for timed quizzes - Start Quiz button only */}
        {assignment.isTimedQuiz && assignment.quizTimeLimit && isStudent && !submission && !isPastDue && !quizStarted && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Timed Quiz</h3>
              <p className="text-blue-700 mb-4">
                This quiz has a time limit of {assignment.quizTimeLimit} minutes. 
                Once you start, the timer will begin and cannot be paused.
              </p>
              <button
                onClick={startQuiz}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Start Quiz
              </button>
            </div>
          </div>
        )}



        {assignment.attachments?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900">Attachments</h3>
            <ul className="mt-2 divide-y divide-gray-200">
              {assignment.attachments.map((attachment, index) => (
                <li key={index} className="py-3">
                  <a
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {attachment.split('/').pop()}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Assignment Questions Section */}
        {assignment.questions && assignment.questions.length > 0 && (() => {
          // Check if we should show questions to students after submission
          const shouldShowQuestions = !isStudent || !submission || isPastDue || 
            (assignment.group === 'Quizzes' && 
             (submission.showCorrectAnswers || assignment.showCorrectAnswers || 
              submission.showStudentAnswers || assignment.showStudentAnswers));
          
          return (
            <div className="mt-8">
              {/* Teacher Analytics Dashboard */}
              {isTeacherPreview && (
                <div className="mb-8">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <div>
                          <h3 className="text-xl font-bold text-blue-900">Assignment Analytics</h3>
                          <p className="text-blue-700">Real-time statistics and performance metrics</p>
                        </div>
                      </div>
                      {loadingStats && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          <span>Loading stats...</span>
                        </div>
                      )}
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                      <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600">Submissions</p>
                            <p className="text-2xl font-bold text-blue-900">
                              {submissionStats.submittedCount}/{submissionStats.totalStudents}
                            </p>
                            <p className="text-xs text-gray-500">
                              {submissionStats.totalStudents > 0 
                                ? `${((submissionStats.submittedCount / submissionStats.totalStudents) * 100).toFixed(1)}% submitted`
                                : '0% submitted'
                              }
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">Submitted</p>
                            <p className="text-2xl font-bold text-green-900">{submissionStats.submittedCount}</p>
                            <p className="text-xs text-gray-500">
                              {submissionStats.totalStudents > 0 
                                ? `${((submissionStats.submittedCount / submissionStats.totalStudents) * 100).toFixed(1)}% completion`
                                : '0% completion'
                              }
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-600">Average Grade</p>
                            <p className="text-2xl font-bold text-purple-900">
                              {submissionStats.averageGrade > 0 ? submissionStats.averageGrade.toFixed(1) : '0'} pts
                            </p>
                            <p className="text-xs text-gray-500">
                              {assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)} total possible
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>


                    </div>

                    {/* Engagement Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-indigo-600">Avg. Time Spent</p>
                            <p className="text-2xl font-bold text-indigo-900">
                              {submissionStats.engagementStats.averageTimeSpent > 0 
                                ? `${Math.floor(submissionStats.engagementStats.averageTimeSpent / 60)}:${(submissionStats.engagementStats.averageTimeSpent % 60).toString().padStart(2, '0')}`
                                : '0:00'
                              }
                            </p>
                            <p className="text-xs text-gray-500">
                              {assignment.isTimedQuiz ? 'Timed quiz' : 'Not timed'}
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-teal-600">Avg. Attempts</p>
                            <p className="text-2xl font-bold text-teal-900">
                              {submissionStats.engagementStats.averageAttemptsPerStudent.toFixed(1)}
                            </p>
                            <p className="text-xs text-gray-500">
                              per student
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-pink-600">Peak Activity</p>
                            <p className="text-2xl font-bold text-pink-900">
                              {submissionStats.engagementStats.peakDay}
                            </p>
                            <p className="text-xs text-gray-500">
                              {submissionStats.engagementStats.peakHour}:00
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Assignment Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <h4 className="text-lg font-semibold text-blue-900 mb-3">Assignment Info</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Questions:</span>
                            <span className="font-medium">{assignment.questions.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Points:</span>
                            <span className="font-medium">{assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-medium">{assignment.group || 'Assignment'}</span>
                          </div>
                          {assignment.isTimedQuiz && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Time Limit:</span>
                              <span className="font-medium">{assignment.quizTimeLimit} minutes</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <h4 className="text-lg font-semibold text-blue-900 mb-3">Submission Status</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Published:</span>
                            <span className={`font-medium ${assignment.published ? 'text-green-600' : 'text-red-600'}`}>
                              {assignment.published ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Due Date:</span>
                            <span className="font-medium">{format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Past Due:</span>
                            <span className={`font-medium ${isPastDue ? 'text-red-600' : 'text-green-600'}`}>
                              {isPastDue ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <h4 className="text-lg font-semibold text-blue-900 mb-3">Quick Actions</h4>
                        <div className="space-y-2">
                          <button
                            onClick={() => navigate(`/assignments/${id}/grade`)}
                            className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center space-x-2"
                          >
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                            <span>Grade Submissions</span>
                          </button>
                          <button
                            onClick={() => navigate(`/assignments/${id}/edit`)}
                            className="w-full text-left px-3 py-2 text-sm bg-green-50 hover:bg-green-100 rounded-md transition-colors flex items-center space-x-2"
                          >
                            <Edit className="h-4 w-4 text-green-600" />
                            <span>Edit Assignment</span>
                          </button>
                          <button
                            onClick={handleTogglePublish}
                            className="w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 rounded-md transition-colors flex items-center space-x-2"
                          >
                            {assignment.published ? (
                              <>
                                <Lock className="h-4 w-4 text-purple-600" />
                                <span>Unpublish</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-4 w-4 text-purple-600" />
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
                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="bg-gray-100 rounded-lg p-3 mb-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-base font-semibold text-gray-900">
                                Question {currentQuestion + 1}
                              </h3>
                              <button
                                onClick={() => toggleMarkQuestion(currentQuestion)}
                                className={`p-1 rounded border ${
                                  markedQuestions.has(currentQuestion)
                                    ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {markedQuestions.has(currentQuestion) ? (
                                  <Bookmark className="h-3 w-3 fill-current" />
                                ) : (
                                  <Bookmark className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <span className="text-base font-semibold text-gray-900">
                              {assignment.questions[currentQuestion].points} pts
                            </span>
                          </div>
                        </div>
                        <div className="border-b border-gray-200 mb-4"></div>
                        
                        <div className="mb-6">
                          <p className="text-lg text-gray-900 leading-relaxed">{assignment.questions[currentQuestion].text}</p>
                        </div>
                        
                        {assignment.questions[currentQuestion].type === 'multiple-choice' && assignment.questions[currentQuestion].options && (
                          <div className="divide-y divide-gray-200">
                            {assignment.questions[currentQuestion].options.map((option, optionIndex) => (
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
                                      : 'border-gray-300 bg-white'
                                  }`}>
                                    {answers[currentQuestion] === option.text && (
                                      <div className="w-2 h-2 rounded-full bg-white"></div>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-900">{option.text}</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {assignment.questions[currentQuestion].type === 'text' && (
                          <div>
                            <textarea
                              id={`question-${currentQuestion}-answer`}
                              name={`question-${currentQuestion}-answer`}
                              className="w-full h-40 p-4 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                              value={answers[currentQuestion] || ''}
                              onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                              placeholder="Enter your answer here..."
                            />
                          </div>
                        )}
                        
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                          <button
                            onClick={prevQuestion}
                            disabled={currentQuestion === 0}
                            className={`px-4 py-2 border rounded-md text-sm font-medium ${
                              currentQuestion === 0
                                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                            }`}
                          >
                            Previous
                          </button>
                          
                          {currentQuestion < assignment.questions.length - 1 ? (
                            <button
                              onClick={nextQuestion}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              Next
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowUploadSection(true)}
                              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              Continue to Upload Files
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Upload files view
                      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="bg-gray-100 rounded-lg p-3 mb-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-base font-semibold text-gray-900">
                              Upload Files
                            </h3>
                          </div>
                        </div>
                        <div className="border-b border-gray-200 mb-4"></div>
                        
                        <div className="mb-6">
                          <p className="text-lg text-gray-900 leading-relaxed">
                            You have completed all questions. You can now upload any additional files if needed.
                          </p>
                        </div>
                        
                        {/* File Upload Section */}
                        {assignment.allowStudentUploads && (
                          <div className="space-y-4">
                            {/* Upload Button */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
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
                                  className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer ${
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
                                    onClick={() => document.getElementById('file-upload-final').click()}
                                    className="inline-flex items-center px-4 py-2 border border-pink-500 rounded-md shadow-sm text-sm font-medium text-pink-600 bg-white hover:bg-pink-50"
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
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</h4>
                                <div className="space-y-2">
                                  {uploadedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md">
                                      <div className="flex items-center space-x-3">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                          <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => removeFile(index)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                          <button
                            onClick={() => setShowUploadSection(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Back to Questions
                          </button>
                          
                          <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                          >
                            {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Sidebar */}
                  <div className="w-80 bg-gray-50 rounded-lg p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Questions</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {assignment.questions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => navigateToQuestion(index)}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-sm ${
                              currentQuestion === index
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {answeredQuestions.has(index) && markedQuestions.has(index) ? (
                                <div className="relative">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <Bookmark className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                                </div>
                              ) : answeredQuestions.has(index) ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : markedQuestions.has(index) ? (
                                <Bookmark className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-gray-400" />
                              )}
                              <span>Question {index + 1}</span>
                            </div>
                            <span className="text-xs text-gray-500">{question.points} pts</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                                          <div className="border-t pt-4">
                        <div className="text-sm text-gray-600 mb-2">
                          <div className="flex items-center justify-between">
                            <span>Progress</span>
                            <span>{answeredQuestions.size} of {assignment.questions.length} answered</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(answeredQuestions.size / assignment.questions.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Timer Display for timed quizzes - under the progress bar */}
                      {assignment.isTimedQuiz && (
                        <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">
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
                              <div className="text-xs text-gray-500">
                                Attempt due: {format(new Date(assignment.dueDate), 'MMM d \'at\' h:mm a')}
                              </div>
                              {quizStarted && timeLeft !== null ? (
                                <div className={`text-sm font-medium ${timeLeft <= 300 ? 'text-red-600' : 'text-gray-700'}`}>
                                  {formatTime(timeLeft)}
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-gray-700">
                                  {assignment.quizTimeLimit} minutes
                                </div>
                              )}
                              {!quizStarted && (
                                <button
                                  onClick={startQuiz}
                                  className="mt-2 w-full bg-indigo-600 text-white text-sm py-2 px-3 rounded hover:bg-indigo-700"
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
                        let isCorrect = false;
                        let showFeedback = false;
                        let correctAnswer = null;
                        

                        
                        if (submission && assignment.group === 'Quizzes' && 
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
                        
                        // Only show visual feedback if feedback options are enabled
                        const feedbackEnabled = submission && assignment.group === 'Quizzes' && 
                          (submission.showCorrectAnswers || assignment.showCorrectAnswers);
                        

                                                  
                                                  return (
                            <div key={question.id || question._id || index} className={`bg-white border-2 rounded-lg p-6 shadow-sm ${
                              isTeacherPreview 
                                ? 'border-blue-400 bg-blue-50 shadow-blue-100' 
                                : (() => {
                                    if (submission && submission.autoGraded && (question.type === 'multiple-choice' || question.type === 'matching')) {
                                      if (question.type === 'multiple-choice') {
                                        const studentAnswer = answers[index];
                                        const correctOption = question.options.find(opt => opt.isCorrect);
                                        const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                        return isCorrect 
                                          ? 'border-green-500' 
                                          : 'border-yellow-500';
                                      } else if (question.type === 'matching') {
                                        const autoGrade = submission.autoQuestionGrades instanceof Map 
                                          ? submission.autoQuestionGrades.get(index.toString())
                                          : submission.autoQuestionGrades?.[index.toString()];
                                        const maxPoints = question.points || 0;
                                        const percentageCorrect = autoGrade / maxPoints;
                                        
                                        if (percentageCorrect === 1) {
                                          return 'border-green-500'; // All correct
                                        } else if (percentageCorrect === 0) {
                                          return 'border-red-500'; // All incorrect
                                        } else {
                                          return 'border-yellow-500'; // Partially correct
                                        }
                                      }
                                    }
                                    if (feedbackEnabled && showFeedback) {
                                      return isCorrect ? 'border-green-500' : 'border-yellow-500';
                                    }
                                    return 'border-gray-200';
                                  })()
                            }`}>
                          <div className={`rounded-lg p-3 mb-3 ${isTeacherPreview ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                <h4 className="text-base font-semibold text-gray-900">Question {index + 1}</h4>
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
                                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
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
                                      <span className="text-base font-semibold text-gray-900">
                                        {(() => {
                                          const earned = Number(autoGrade || 0);
                                          const total = question.points;
                                          const earnedFormatted = Number.isInteger(earned) ? earned : earned.toFixed(2);
                                          const totalFormatted = Number.isInteger(total) ? total : total.toFixed(2);
                                          return `${earnedFormatted} / ${totalFormatted} pts`;
                                        })()}
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-base font-semibold text-gray-900">
                                    {question.points} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="border-b border-gray-200 mb-3"></div>
                          
                          <div className="mb-4">
                            <p className="text-lg text-gray-900 leading-relaxed">{question.text}</p>

                            {question.type === 'multiple-choice' && (
                              <p className="text-sm text-gray-600 mt-1">Select the correct answer.</p>
                            )}
                          </div>
                          
                          {question.type === 'multiple-choice' && question.options && (
                            <div>
                              {/* Show detailed feedback for submitted assignments */}
                              {submission && submission.autoGraded && (
                                <div className={`mb-4 p-3 rounded-lg ${
                                  (() => {
                                    const studentAnswer = answers[index];
                                    const correctOption = question.options.find(opt => opt.isCorrect);
                                    const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                    return isCorrect 
                                      ? 'bg-green-50 border border-green-200' 
                                      : 'bg-red-50 border border-red-200';
                                  })()
                                }`}>
                                  <div className="text-sm text-blue-800 font-medium mb-2">
                                    Auto-Graded Results
                                  </div>
                                  {(() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    const correctOption = question.options.find(opt => opt.isCorrect);
                                    const isCorrect = String(studentAnswer) === String(correctOption?.text);
                                    
                                    return (
                                      <div className="space-y-2">
                                        <div className="text-sm text-blue-700">
                                          {(() => {
                                            const earned = Number(autoGrade || 0);
                                            const total = maxPoints;
                                            const earnedFormatted = Number.isInteger(earned) ? earned : earned.toFixed(2);
                                            const totalFormatted = Number.isInteger(total) ? total : total.toFixed(2);
                                            return `${earnedFormatted} / ${totalFormatted} pts`;
                                          })()}
                                        </div>
                                        <div className="text-sm font-medium text-gray-700 mb-1">Student Answer:</div>
                                        <div className="text-sm text-gray-900 mb-2">{studentAnswer || 'No answer'}</div>
                                        <div className={`text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                          {isCorrect ? 'Correct!' : `Incorrect. Correct answer: ${correctOption?.text || 'Unknown'}`}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              {/* Show regular multiple-choice interface for non-submitted or non-auto-graded assignments */}
                              {(!submission || !submission.autoGraded) && (
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
                                            : 'border-gray-300 bg-white'
                                        }`}>
                                          {answers[index] === option.text && (
                                            <div className="w-2 h-2 rounded-full bg-white"></div>
                                          )}
                                        </div>
                                        <span className="text-sm text-gray-900">{option.text}</span>
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
                            <div>
                              <textarea
                                id={`question-${index}-answer`}
                                name={`question-${index}-answer`}
                                className="w-full h-32 p-4 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                                value={answers[index] || ''}
                                onChange={(e) => !submission && isStudent && handleAnswerChange(index, e.target.value)}
                                placeholder={isStudent ? "Enter your answer here" : "Student's answer will appear here"}
                                disabled={!!submission || !isStudent || isPastDue}
                              />
                            </div>
                          )}
                          
                          {question.type === 'matching' && question.leftItems && question.rightItems && (
                            <div className="space-y-2">
                              
                              {/* Show detailed feedback for submitted assignments */}
                              {submission && submission.autoGraded && (
                                <div className={`mb-4 p-3 rounded-lg ${
                                  (() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    const percentageCorrect = autoGrade / maxPoints;
                                    
                                    if (percentageCorrect === 1) {
                                      return 'bg-green-50 border border-green-200'; // All correct
                                    } else if (percentageCorrect > 0) {
                                      return 'bg-yellow-50 border border-yellow-200'; // Partially correct
                                    } else {
                                      return 'bg-red-50 border border-red-200'; // All incorrect
                                    }
                                  })()
                                }`}>
                                  <div className="text-sm text-blue-800 font-medium mb-2">
                                    Auto-Graded Results
                                  </div>
                                  {(() => {
                                    const studentAnswer = answers[index];
                                    const autoGrade = submission.autoQuestionGrades instanceof Map 
                                      ? submission.autoQuestionGrades.get(index.toString())
                                      : submission.autoQuestionGrades?.[index.toString()];
                                    const maxPoints = question.points || 0;
                                    
                                    return (
                                      <div className="space-y-2">
                                        <div className="text-sm text-blue-700">
                                          {(() => {
                                            const earned = Number(autoGrade || 0);
                                            const total = maxPoints;
                                            const earnedFormatted = Number.isInteger(earned) ? earned : earned.toFixed(2);
                                            const totalFormatted = Number.isInteger(total) ? total : total.toFixed(2);
                                            return `${earnedFormatted} / ${totalFormatted} pts`;
                                          })()}
                                        </div>
                                        <div className="text-sm font-medium text-gray-700 mb-2">Student Answer:</div>
                                        {question.leftItems.map((leftItem, leftIndex) => {
                                          const studentMatch = typeof studentAnswer === 'object' ? 
                                            studentAnswer[leftIndex] : '';
                                          const correctRightItem = question.rightItems.find(rightItem => 
                                            rightItem.id === leftItem.id
                                          );
                                          const isCorrect = studentMatch === (correctRightItem?.text || '');
                                          
                                          return (
                                            <div key={leftItem.id} className={`flex items-center justify-between p-2 rounded-lg ${
                                              isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                            }`}>
                                              <div className="flex items-center space-x-2">
                                                <span className="font-medium text-gray-900 text-sm">{leftItem.text}</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="text-gray-900">{studentMatch || 'No answer'}</span>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                {isCorrect ? (
                                                  <div className="flex items-center text-green-600">
                                                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-xs">Correct</span>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center text-red-600">
                                                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    <span className="text-xs">Incorrect</span>
                                                  </div>
                                                )}
                                              </div>
                                              {!isCorrect && correctRightItem && (
                                                <div className="text-xs text-gray-600">
                                                  Correct: {correctRightItem.text}
                                                </div>
                                              )}
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
                                  // Create stable shuffled options based on question ID and left item index
                                  const getShuffledOptions = () => {
                                    if (!question.rightItems || question.rightItems.length === 0) {
                                      return [];
                                    }
                                    
                                    // Simple rotation based on left item index to create different orders
                                    const rotation = leftIndex % question.rightItems.length;
                                    const shuffled = [...question.rightItems];
                                    
                                    // Rotate the array by the rotation amount
                                    for (let i = 0; i < rotation; i++) {
                                      shuffled.push(shuffled.shift());
                                    }
                                    
                                    return shuffled;
                                  };
                                  
                                  const shuffledOptions = getShuffledOptions();
                                  
                                  // Filter out already selected options from other dropdowns
                                  const currentAnswers = answers[index] || {};
                                  const selectedOptions = Object.values(currentAnswers).filter(option => option !== '');
                                  const availableOptions = shuffledOptions.filter(option => 
                                    // Include the currently selected option for this dropdown
                                    currentAnswers[leftIndex] === option.text ||
                                    // Include options that haven't been selected in other dropdowns
                                    !selectedOptions.includes(option.text)
                                  );
                                  
                                  return (
                                    <div key={leftItem.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex-1">
                                        <span className="font-medium text-gray-900 text-sm">{leftItem.text}</span>
                                      </div>
                                      <div className="flex items-center space-x-2 ml-2">
                                        <select
                                          id={`question-${index}-matching-${leftIndex}`}
                                          value={answers[index]?.[leftIndex] || ''}
                                          onChange={(e) => {
                                            if (!submission && isStudent && !isPastDue) {
                                              const newAnswers = { ...answers };
                                              if (!newAnswers[index]) newAnswers[index] = {};
                                              newAnswers[index][leftIndex] = e.target.value;
                                              handleAnswerChange(index, newAnswers[index]);
                                            }
                                          }}
                                          disabled={!!submission || !isStudent || isPastDue}
                                          className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white min-w-[120px]"
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
                    {assignment.allowStudentUploads && isStudent && !submission && !isPastDue && (
                      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h3>
                        <div className="space-y-4">
                          {/* Upload Button */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
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
                                className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer ${
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
                                  onClick={() => document.getElementById('file-upload-scrollable').click()}
                                  className="inline-flex items-center px-4 py-2 border border-pink-500 rounded-md shadow-sm text-sm font-medium text-pink-600 bg-white hover:bg-pink-50"
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
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</h4>
                              <div className="space-y-2">
                                {uploadedFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md">
                                    <div className="flex items-center space-x-3">
                                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => removeFile(index)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
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
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                        </button>
                      </div>
                    )}

                    {/* Teacher Preview Summary */}

                  </div>
                  
                  {/* Sidebar for scrollable mode - only show for students answering */}
                  {isStudent && !submission && !isPastDue && (
                    <div className="w-80 bg-gray-50 rounded-lg p-4 self-start">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Questions</h4>
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
                              className={`w-full flex items-center justify-between p-2 rounded-md text-sm hover:bg-gray-100`}
                            >
                              <div className="flex items-center space-x-2">
                                {answeredQuestions.has(index) && markedQuestions.has(index) ? (
                                  <div className="relative">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <Bookmark className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                                  </div>
                                ) : answeredQuestions.has(index) ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : markedQuestions.has(index) ? (
                                  <Bookmark className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <Circle className="h-4 w-4 text-gray-400" />
                                )}
                                <span>Question {index + 1}</span>
                              </div>
                              <span className="text-xs text-gray-500">{question.points} pts</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="border-t pt-4">
                        <div className="text-sm text-gray-600 mb-2">
                          <div className="flex items-center justify-between">
                            <span>Progress</span>
                            <span>{answeredQuestions.size} of {assignment.questions.length} answered</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(answeredQuestions.size / assignment.questions.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Timer Display for timed quizzes - now under the progress bar */}
                      {assignment.isTimedQuiz && (
                        <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">
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
                              <div className="text-xs text-gray-500">
                                Attempt due: {format(new Date(assignment.dueDate), 'MMM d \'at\' h:mm a')}
                              </div>
                              {quizStarted && timeLeft !== null ? (
                                <div className={`text-sm font-medium ${timeLeft <= 300 ? 'text-red-600' : 'text-gray-700'}`}>
                                  {formatTime(timeLeft)}
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-gray-700">
                                  {assignment.quizTimeLimit} minutes
                                </div>
                              )}
                              {!quizStarted && (
                                <button
                                  onClick={startQuiz}
                                  className="mt-2 w-full bg-indigo-600 text-white text-sm py-2 px-3 rounded hover:bg-indigo-700"
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
  );
};

export default ViewAssignment; 