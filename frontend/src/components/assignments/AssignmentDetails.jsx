import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Lock, Unlock } from 'lucide-react';
import { API_URL } from '../../config';

const AssignmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    const currentUserRole = user?.role || '';
    setUserRole(currentUserRole);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        const assignmentRes = await axios.get(`${API_URL}/api/assignments/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const assignmentData = assignmentRes.data;
        // Ensure questions and attachments are arrays
        if (assignmentData) {
          assignmentData.questions = Array.isArray(assignmentData.questions) ? assignmentData.questions : [];
          assignmentData.attachments = Array.isArray(assignmentData.attachments) ? assignmentData.attachments : [];
        }
        setAssignment(assignmentData);

        if (currentUserRole === 'student') {
          try {
            const submissionRes = await axios.get(`${API_URL}/api/submissions/student/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (submissionRes.data) {
              const submissionData = submissionRes.data;
              // Ensure submission is an array if it's a list, or ensure answers is an object
              if (Array.isArray(submissionData)) {
                setSubmission(submissionData);
              } else {
                setSubmission(submissionData);
                setAnswers(submissionData.answers || {});
              }
            }
          } catch (err) {
            if (err.response && err.response.status === 404) {
              setSubmission(null);
            } else {
              throw err;
            }
          }
        }
        setLoading(false);
      } catch (err) {
        setError('Error fetching assignment details');
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: value }));
  };

  const handleSubmission = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/submissions`, {
        assignment: id,
        answers,
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      setSubmission(response.data);
      setIsSubmitting(false);
      
      // Dispatch event to refresh ToDo panel
      window.dispatchEvent(new Event('assignmentSubmitted'));
    } catch (err) {
      setError('Error submitting assignment');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/assignments/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        navigate(-1);
      } catch (err) {
        setError('Error deleting assignment');
      }
    }
  };

  const handleTogglePublish = async () => {
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
    return <div className="text-gray-900 dark:text-gray-100">Assignment not found</div>;
  }

  return (
    <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 sm:mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">{assignment.title}</h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="block sm:inline">Due: {format(new Date(assignment.dueDate), 'PPp')}</span>
              {userRole === 'student' && assignment.submission && (
                <span className="block sm:inline sm:ml-4 mt-1 sm:mt-0 text-green-600 dark:text-green-400">
                  Submitted: {format(new Date(assignment.submission.submittedAt), 'PPp')}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
            {(userRole === 'teacher' || userRole === 'admin') && (
              <>
                <button
                  onClick={handleTogglePublish}
                  disabled={isPublishing}
                  className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium 
                    ${assignment?.published 
                      ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/70' 
                      : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400`}
                >
                  {assignment?.published ? (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Published
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Unpublished
                    </>
                  )}
                </button>
                <button
                  onClick={() => navigate(`/assignments/${id}/edit`)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                >
                  Edit Assignment
                </button>
                <button
                  onClick={() => navigate(`/assignments/${id}/grade`)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                >
                  Grade Submissions
                </button>
              </>
            )}
            {userRole === 'student' && (
              <button
                onClick={() => navigate(`/assignments/${id}/view`)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              >
                Start Assignment
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300">
          <ReactMarkdown>{assignment.description}</ReactMarkdown>
        </div>

        {assignment.content && (
          <div className="mt-6 prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300">
            <ReactMarkdown>{assignment.content}</ReactMarkdown>
          </div>
        )}

        {userRole === 'student' && !isSubmitting && assignment.questions && assignment.questions.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Questions</h3>
            <div className="mt-4 space-y-6">
              {(Array.isArray(assignment.questions) ? assignment.questions : []).map((q, index) => (
                <div key={index}>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{index + 1}. {q.text} ({q.points} pts)</p>
                  {q.type === 'multiple-choice' && (
                    <ul className="list-disc ml-8 mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                      {(Array.isArray(q.options) ? q.options : []).map((opt, optIndex) => (
                        <li key={optIndex}>{opt.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isSubmitting ? (
          <form onSubmit={handleSubmission} className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Your Submission</h3>
            {assignment.questions.map((q, index) => (
              <div key={index} className="mb-6">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{index + 1}. {q.text} ({q.points} pts)</p>
                {q.type === 'multiple-choice' && q.options.map((opt, optIndex) => (
                  <div key={optIndex} className="ml-4">
                    <label className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={opt.text}
                        checked={answers[index] === opt.text}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        className="h-4 w-4"
                      />
                      <span>{opt.text}</span>
                    </label>
                  </div>
                ))}
                {q.type === 'text' && (
                  <div className="mt-2">
                    <label htmlFor={`question-${index}-answer`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Answer:
                    </label>
                  <textarea
                      id={`question-${index}-answer`}
                    value={answers[index] || ''}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                      className="block w-full min-h-[120px] p-3 sm:p-4 rounded-md border-2 border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:border-indigo-400 resize-y text-sm sm:text-base"
                      placeholder="Enter your answer here..."
                      rows={5}
                  />
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setIsSubmitting(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600">
                Submit
              </button>
            </div>
          </form>
        ) : (
          <>
            {assignment.attachments?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Attachments</h3>
                <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                  {(Array.isArray(assignment.attachments) ? assignment.attachments : []).map((attachment, index) => (
                    <li key={index} className="py-3">
                      <a
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                      >
                        {attachment.split('/').pop()}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(userRole === 'teacher' || userRole === 'admin') && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Submissions</h3>
                {submission && submission.length === 0 ? (
                  <p className="mt-2 text-gray-500 dark:text-gray-400">No submissions yet</p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                    {submission && Array.isArray(submission) && submission.map((sub) => (
                      <li key={sub._id} className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {sub.student?.firstName} {sub.student?.lastName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Submitted at: {format(new Date(sub.submittedAt), 'PPp')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${sub.grade ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                              {sub.grade !== null && sub.grade !== undefined ? `Grade: ${sub.grade}` : 'Not Graded'}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AssignmentDetails; 