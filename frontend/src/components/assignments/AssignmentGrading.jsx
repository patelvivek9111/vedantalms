import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { CheckCircle, XCircle, AlertCircle, Download, Eye, Upload, X } from 'lucide-react';
import FilePreview from './FilePreview';

const AssignmentGrading = () => {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [questionGrades, setQuestionGrades] = useState({});
  const [feedback, setFeedback] = useState('');
  const [grade, setGrade] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [teacherFeedbackFiles, setTeacherFeedbackFiles] = useState([]);
  const [selectedFeedbackFiles, setSelectedFeedbackFiles] = useState([]);

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
      // Set grade for upload-only assignments (no questions)
      if (!assignment.questions || assignment.questions.length === 0) {
        setGrade(selectedSubmission.grade || selectedSubmission.finalGrade || '');
      } else {
        setGrade('');
      }
      // Load existing teacher feedback files
      if (selectedSubmission.teacherFeedbackFiles && selectedSubmission.teacherFeedbackFiles.length > 0) {
        setTeacherFeedbackFiles(selectedSubmission.teacherFeedbackFiles);
      } else {
        setTeacherFeedbackFiles([]);
      }
      // Reset selected files when switching submissions
      setSelectedFeedbackFiles([]);
    }
  }, [selectedSubmission, assignment]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch assignment details
        const assignmentRes = await axios.get(`/api/assignments/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAssignment(assignmentRes.data);

        // Fetch submissions
        const submissionsRes = await axios.get(`/api/submissions/assignment/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setSubmissions(submissionsRes.data);
        
        setLoading(false);
      } catch (err) {
        setError('Error fetching assignment data');
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
      
      // For upload-only assignments (no questions), include the grade
      if (!assignment.questions || assignment.questions.length === 0) {
        if (grade !== '' && grade !== null && grade !== undefined) {
          payload.grade = parseFloat(grade);
        }
      }

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

      // If there are files to upload, use FormData
      let response;
      if (selectedFeedbackFiles.length > 0) {
        const formData = new FormData();
        
        // Add all form fields to FormData
        formData.append('feedback', feedback || '');
        formData.append('approveGrade', approveGrade);
        
        if (!assignment.questions || assignment.questions.length === 0) {
          if (grade !== '' && grade !== null && grade !== undefined) {
            const gradeValue = parseFloat(grade);
            if (!isNaN(gradeValue)) {
              formData.append('grade', gradeValue.toString());
            }
          }
        }
        
        if (!approveGrade && payload.questionGrades) {
          formData.append('questionGrades', JSON.stringify(payload.questionGrades));
        }
        
        // Add files
        selectedFeedbackFiles.forEach((file) => {
          formData.append('teacherFeedbackFiles', file);
        });
        
        response = await axios.put(`/api/submissions/${selectedSubmission._id}`, formData, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // No files, use regular JSON payload
        response = await axios.put(`/api/submissions/${selectedSubmission._id}`, payload, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      // Update the submission in the list
      setSubmissions(prev => 
        prev.map(sub => 
          sub._id === selectedSubmission._id ? response.data : sub
        )
      );
      
      setSelectedSubmission(response.data);
      
      // Update teacher feedback files from response
      if (response.data.teacherFeedbackFiles) {
        setTeacherFeedbackFiles(response.data.teacherFeedbackFiles);
      }
      // Clear selected files after successful upload
      setSelectedFeedbackFiles([]);
      
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
      
      const response = await axios.delete(`/api/submissions/${selectedSubmission._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove the deleted submission from the list
      setSubmissions(prev => prev.filter(s => s._id !== selectedSubmission._id));
      setSelectedSubmission(null);
      setError('');
    } catch (err) {
      console.error('Delete error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Error deleting submission');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadSubmissions = async () => {
    if (!assignment || submissions.length === 0) return;
    
    setIsDownloading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`/api/submissions/assignment/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${assignment.title.replace(/[^a-z0-9]/gi, '_')}_submissions.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(err.response?.data?.message || 'Error downloading submissions');
    } finally {
      setIsDownloading(false);
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
    <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 border dark:border-gray-700">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">{assignment.title} - Grading</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''} to grade
              </p>
            </div>
            {submissions.length > 0 && (
              <button
                onClick={handleDownloadSubmissions}
                disabled={isDownloading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download All Submissions'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">Submissions</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {submissions.map((submission) => (
                <div
                  key={submission._id}
                  onClick={() => setSelectedSubmission(submission)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedSubmission?._id === submission._id
                      ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm bg-white dark:bg-gray-900'
                  }`}
                >
                  {/* Header with name and status badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                        {submission.student?.firstName} {submission.student?.lastName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {submission.autoGraded && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Auto
                        </span>
                      )}
                      {submission.teacherApproved && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Graded
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submission details */}
                  <div className="space-y-2 mb-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy h:mm a')}
                    </div>
                    {submission.autoGraded && (
                      <div className="flex items-center text-xs">
                        <span className="text-gray-500 dark:text-gray-400 mr-2">Auto-grade:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {submission.autoGrade} points
                        </span>
                      </div>
                    )}
                    {submission.teacherApproved && (
                      <div className="flex items-center text-xs">
                        <span className="text-gray-500 dark:text-gray-400 mr-2">Final grade:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {submission.finalGrade || submission.grade} points
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Download button */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const token = localStorage.getItem('token');
                        const response = await axios.get(`/api/submissions/${submission._id}/download`, {
                          headers: { Authorization: `Bearer ${token}` },
                          responseType: 'blob'
                        });
                        
                        // Get filename from Content-Disposition header or use default
                        const contentDisposition = response.headers['content-disposition'];
                        let filename = 'submission';
                        
                        if (contentDisposition) {
                          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                          if (filenameMatch) {
                            filename = filenameMatch[1];
                          }
                        } else {
                          // Fallback: if single file, use file name; if multiple, use zip
                          if (submission.files && submission.files.length === 1) {
                            filename = submission.files[0].split('/').pop() || 'submission';
                          } else {
                            const studentName = `${submission.student?.firstName || 'Student'}_${submission.student?.lastName || ''}`.replace(/[^a-z0-9]/gi, '_');
                            filename = `${assignment?.title?.replace(/[^a-z0-9]/gi, '_') || 'submission'}_${studentName}.zip`;
                          }
                        }
                        
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', filename);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('Download error:', err);
                        setError(err.response?.data?.message || 'Error downloading submission');
                      }
                    }}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 active:bg-indigo-800 dark:active:bg-indigo-700 transition-colors shadow-sm"
                    title="Download this submission"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </button>
                </div>
              ))}
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

                  {/* Submission Files */}
                  {selectedSubmission.files && selectedSubmission.files.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Submitted Files:</h3>
                      <div className="space-y-2">
                        {selectedSubmission.files.map((file, index) => {
                          const fileUrl = typeof file === 'string' ? file : (file.url || file.path || '');
                          const fileName = typeof file === 'string' 
                            ? file.split('/').pop() || `File ${index + 1}`
                            : (file.name || file.originalname || `File ${index + 1}`);
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{fileName}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 ml-2">
                                <button
                                  onClick={() => setPreviewFile({ url: fileUrl, name: fileName })}
                                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                                  title="Preview file"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm"
                                  title="Open in new tab"
                                >
                                  Open
                                </a>
                              </div>
                            </div>
                          );
                        })}
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

                  {/* Questions */}
                  {assignment.questions && (
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
                                  {question.leftItems && question.leftItems.map((leftItem, leftIndex) => {
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

                  {/* Grade Input for Upload-Only Assignments (no questions) */}
                  {(!assignment.questions || assignment.questions.length === 0) && (
                    <div className="mt-6">
                      <label htmlFor="grade" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Grade:
                        {assignment.totalPoints && (
                          <span className="text-gray-500 dark:text-gray-400 ml-2">(out of {assignment.totalPoints} points)</span>
                        )}
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          id="grade"
                          name="grade"
                          type="number"
                          min="0"
                          max={assignment.totalPoints || 100}
                          step="0.01"
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          className="w-32 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="Enter grade"
                        />
                        {assignment.totalPoints && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            / {assignment.totalPoints}
                          </span>
                        )}
                      </div>
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

                  {/* Teacher Feedback Files Upload */}
                  <div className="mt-6">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upload Feedback Files (Optional):
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 break-words">
                      Upload annotated PDFs, DOCX files, or other documents with your feedback
                    </p>
                    
                    {/* File Input */}
                    <div className="mb-4">
                      <label className="flex items-center justify-center w-full px-2 sm:px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors bg-gray-50 dark:bg-gray-800 overflow-hidden">
                        <div className="flex flex-col items-center text-center">
                          <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mb-2" />
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
                            Click to upload or drag and drop
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-500 mt-1 px-2">
                            PDF, DOCX, DOC, or other document files
                          </span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.rtf"
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            setSelectedFeedbackFiles(prev => [...prev, ...files]);
                          }}
                        />
                      </label>
                    </div>

                    {/* Selected Files (before upload) */}
                    {selectedFeedbackFiles.length > 0 && (
                      <div className="mb-4 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                        <h4 className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                          Files to upload ({selectedFeedbackFiles.length}):
                        </h4>
                        <div className="space-y-2">
                          {selectedFeedbackFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-gray-900 rounded border border-blue-200 dark:border-blue-700 overflow-hidden">
                              <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0 break-words">
                                {file.name}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedFeedbackFiles(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="ml-2 flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Existing Teacher Feedback Files */}
                    {teacherFeedbackFiles && teacherFeedbackFiles.length > 0 && (
                      <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Uploaded Feedback Files ({teacherFeedbackFiles.length}):
                        </h4>
                        <div className="space-y-2">
                          {teacherFeedbackFiles.map((file, index) => {
                            const fileUrl = typeof file === 'string' ? file : (file.url || file.path || '');
                            const fileName = typeof file === 'string' 
                              ? file.split('/').pop() || `File ${index + 1}`
                              : (file.name || file.originalname || `File ${index + 1}`);
                            return (
                              <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-600 overflow-hidden">
                                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate break-all">{fileName}</span>
                                </div>
                                <div className="flex items-center space-x-2 sm:ml-2 flex-shrink-0">
                                  <button
                                    onClick={() => setPreviewFile({ url: fileUrl, name: fileName })}
                                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1.5 sm:p-1"
                                    title="Preview file"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-xs sm:text-sm whitespace-nowrap"
                                    title="Open in new tab"
                                  >
                                    Open
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                        disabled={isGrading || ((!assignment.questions || assignment.questions.length === 0) && (!grade || grade === ''))}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default AssignmentGrading;