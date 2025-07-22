import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const AssignmentGrading = () => {
  const { id } = useParams();
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
        const autoGrade = getAutoGradeForQuestion(index);
        // Initialize with auto-grade if available, otherwise with existing grade or 0
        if (autoGrade !== null) {
          initialGrades[index] = autoGrade;
        } else if (selectedSubmission.questionGrades && selectedSubmission.questionGrades[index] !== undefined) {
          initialGrades[index] = selectedSubmission.questionGrades[index];
        } else {
          initialGrades[index] = 0;
        }
      });
      
      setQuestionGrades(initialGrades);
      setFeedback(selectedSubmission.feedback || '');
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

      // Only include questionGrades if not approving auto-grade
      if (!approveGrade) {
        payload.questionGrades = questionGrades;
      }

      const response = await axios.put(`/api/submissions/${selectedSubmission._id}`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Update the submission in the list
      setSubmissions(prev => 
        prev.map(sub => 
          sub._id === selectedSubmission._id ? response.data : sub
        )
      );
      
      setSelectedSubmission(response.data);
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
    
    console.log('[Frontend] Attempting to delete submission:', selectedSubmission._id);
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      console.log('[Frontend] Making DELETE request to:', `/api/submissions/${selectedSubmission._id}`);
      
      const response = await axios.delete(`/api/submissions/${selectedSubmission._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[Frontend] Delete response:', response.data);
      
      // Remove the deleted submission from the list
      setSubmissions(prev => prev.filter(s => s._id !== selectedSubmission._id));
      setSelectedSubmission(null);
      setError('');
    } catch (err) {
      console.error('[Frontend] Delete error:', err.response?.data || err.message);
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
        console.log(`Failed to parse matching answer for question ${questionIndex}:`, answer);
        return {};
      }
    }
    
    return answer;
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

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title} - Grading</h1>
          <p className="text-sm text-gray-600">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} to grade
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Submissions</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {submissions.map((submission) => (
                <div
                  key={submission._id}
                  onClick={() => setSelectedSubmission(submission)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSubmission?._id === submission._id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">
                      {submission.student?.firstName} {submission.student?.lastName}
                    </div>
                    <div className="flex items-center space-x-2">
                      {submission.autoGraded && (
                        <div className="flex items-center text-blue-600">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs">Auto</span>
                        </div>
                      )}
                      {submission.teacherApproved && (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span className="text-xs">Graded</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy h:mm a')}
                  </div>
                  {submission.autoGraded && (
                    <div className="text-sm text-blue-600 mt-1">
                      Auto-grade: {submission.autoGrade} points
                    </div>
                  )}
                  {submission.teacherApproved && (
                    <div className="text-sm text-green-600 mt-1">
                      Final grade: {submission.finalGrade || submission.grade} points
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Grading Interface */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2">
                    Grading: {selectedSubmission.student?.firstName} {selectedSubmission.student?.lastName}
                  </h2>
                  
                  {/* Auto-grading status */}
                  {selectedSubmission.autoGraded && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center mb-2">
                        <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                        <span className="font-medium text-blue-900">Auto-Graded Submission</span>
                      </div>
                      <div className="text-blue-800">
                        <div>Auto-grade: {selectedSubmission.autoGrade} points</div>
                        {selectedSubmission.teacherApproved ? (
                          <div className="text-green-700 font-medium">
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

                  {/* Questions */}
                  {assignment.questions && (
                    <div className="space-y-4">
                      {assignment.questions.map((question, index) => {
                        const questionType = getQuestionType(index);
                        const autoGrade = getAutoGradeForQuestion(index);
                        const maxPoints = getMaxPointsForQuestion(index);
                        const studentAnswer = getStudentAnswer(index);
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-medium">Question {index + 1}</h3>
                                <p className="text-sm text-gray-600">{question.text}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600">{maxPoints} pts</div>
                                {(questionType === 'multiple-choice' || questionType === 'matching') && autoGrade !== null && (
                                  <div className={`text-sm ${autoGrade > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Auto: {autoGrade}/{maxPoints}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Student Answer */}
                            <div className="mb-3">
                              <div className="text-sm font-medium text-gray-700 mb-1">Student Answer:</div>
                              {questionType === 'multiple-choice' ? (
                                <div className="text-sm text-gray-900">{studentAnswer || 'No answer'}</div>
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
                                        isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                      }`}>
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-gray-900">{leftItem.text}</span>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-gray-500">→</span>
                                            <span className={`text-sm ${
                                              isCorrect ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                              {studentMatch || 'No answer'}
                                            </span>
                                            {isCorrect ? (
                                              <CheckCircle className="h-4 w-4 text-green-600" />
                                            ) : (
                                              <XCircle className="h-4 w-4 text-red-600" />
                                            )}
                                          </div>
                                        </div>
                                        {!isCorrect && correctMatch && (
                                          <div className="text-xs text-gray-600 mt-1">
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
                                  className="w-full h-24 p-2 border border-gray-300 rounded text-sm"
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
                                <label htmlFor={`grade-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                                  Grade (0-{maxPoints}):
                                </label>
                                <div className="flex items-center space-x-3">
                                  <input
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
                                    className="w-20 p-2 border border-gray-300 rounded text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  {autoGrade !== null && (
                                    <div className="text-sm text-gray-600">
                                      Auto: {autoGrade}/{maxPoints}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label htmlFor={`grade-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                                  Grade (0-{maxPoints}):
                                </label>
                                <div className="flex items-center space-x-3">
                                  <input
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
                                    className="w-20 p-2 border border-gray-300 rounded text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  {questionType === 'multiple-choice' && autoGrade !== null && (
                                    <div className="text-sm text-gray-600">
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
                    <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                      Feedback:
                    </label>
                    <textarea
                      id="feedback"
                      name="feedback"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
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
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          {isGrading ? 'Approving...' : 'Approve Auto-Grade'}
                        </button>
                        {assignment.questions && assignment.questions.some(q => q.type !== 'multiple-choice' && q.type !== 'matching') && (
                          <button
                            onClick={() => handleGradeSubmission(false)}
                            disabled={isGrading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                          >
                            {isGrading ? 'Grading...' : 'Grade with Edits'}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleGradeSubmission(false)}
                        disabled={isGrading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isGrading ? 'Grading...' : 'Grade Submission'}
                      </button>
                    )}
                    
                    {/* Delete Submission Button */}
                    <button
                      onClick={handleDeleteSubmission}
                      disabled={isDeleting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Submission'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
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