import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Lock, Unlock, Download } from 'lucide-react';
import { API_URL } from '../../config';
import logger from '../../utils/logger';

// Helper function to sanitize HTML content
function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Basic sanitization: remove script/style tags and event handlers
  let sanitized = html.replace(/<\/(script|style)>/gi, '</removed>');
  sanitized = sanitized.replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '');
  sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/ on\w+='[^']*'/gi, '');
  return sanitized;
}

interface AssignmentDetailsProps {
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

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Submission {
  _id: string;
  assignment: string;
  student: Student;
  submittedAt: string;
  answers?: Record<number, string>;
  grade?: number | null;
  files?: string[];
}

interface Assignment {
  _id: string;
  title: string;
  description: string;
  content?: string;
  dueDate: string;
  availableFrom?: string;
  questions?: Question[];
  attachments?: string[];
  published?: boolean;
  module?: string | { _id: string };
}

interface User {
  _id: string;
  role: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

const AssignmentDetails: React.FC<AssignmentDetailsProps> = ({ courseId: propCourseId }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState<string | undefined>(propCourseId);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | Submission[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    let user: User | null = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        user = JSON.parse(userStr);
      }
    } catch (e) {
      logger.error('Error parsing user from localStorage', e instanceof Error ? e : new Error(String(e)));
    }
    const currentUserRole = user?.role || '';
    setUserRole(currentUserRole);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          setLoading(false);
          return;
        }
        
        const assignmentRes = await axios.get<Assignment>(`${API_URL}/api/assignments/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAssignment(assignmentRes.data);
        
        // Fetch courseId if not provided
        if (!courseId && assignmentRes.data?.module) {
          const moduleId = typeof assignmentRes.data.module === 'string' 
            ? assignmentRes.data.module 
            : assignmentRes.data.module._id;
          try {
            const moduleRes = await axios.get<{ success: boolean; data: { course: { _id: string } | string } }>(`${API_URL}/api/modules/view/${moduleId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (moduleRes.data.success) {
              const fetchedCourseId = typeof moduleRes.data.data.course === 'string' 
                ? moduleRes.data.data.course 
                : moduleRes.data.data.course._id;
              setCourseId(fetchedCourseId);
            }
          } catch (err) {
            logger.error('Error fetching module for courseId', err instanceof Error ? err : new Error(String(err)));
          }
        }

        if (currentUserRole === 'student') {
          try {
            const submissionRes = await axios.get<Submission>(`${API_URL}/api/submissions/student/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (submissionRes.data) {
              setSubmission(submissionRes.data);
              setAnswers(submissionRes.data.answers || {});
            }
          } catch (err) {
            const axiosError = err as AxiosError;
            if (axiosError.response && axiosError.response.status === 404) {
              setSubmission(null);
            } else {
              throw err;
            }
          }
        }
        setLoading(false);
      } catch (err) {
        logger.error('Error fetching assignment details', err instanceof Error ? err : new Error(String(err)));
        setError('Error fetching assignment details');
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, courseId]);

  const handleAnswerChange = (questionIndex: number, value: string): void => {
    setAnswers(prev => ({ ...prev, [questionIndex]: value }));
  };

  const handleSubmission = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }
      const response = await axios.post<Submission>(`${API_URL}/api/submissions`, {
        assignment: id,
        answers,
      }, { headers: { 'Authorization': `Bearer ${token}` } });
      setSubmission(response.data);
      setIsSubmitting(false);
      
      // Dispatch event to refresh ToDo panel
      window.dispatchEvent(new Event('assignmentSubmitted'));
    } catch (err) {
      logger.error('Error submitting assignment', err instanceof Error ? err : new Error(String(err)));
      setError('Error submitting assignment');
    }
  };

  const handleDelete = async (): Promise<void> => {
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
        logger.error('Error deleting assignment', err instanceof Error ? err : new Error(String(err)));
        setError('Error deleting assignment');
      }
    }
  };

  const handleTogglePublish = async (): Promise<void> => {
    setIsPublishing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch<{ published: boolean }>(
        `${API_URL}/api/assignments/${id}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignment(prev => prev ? { ...prev, published: res.data.published } : null);
    } catch (err) {
      logger.error('Error toggling assignment publish', err instanceof Error ? err : new Error(String(err)));
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

  const submissions = Array.isArray(submission) ? submission : (submission ? [submission] : []);

  return (
    <div className="w-full px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 sm:mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">{assignment.title}</h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="block sm:inline">Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy, h:mm a')}</span>
              {userRole === 'student' && submission && !Array.isArray(submission) && (
                <span className="block sm:inline sm:ml-4 mt-1 sm:mt-0 text-green-600 dark:text-green-400">
                  Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy, h:mm a')}
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
                  onClick={() => {
                    if (courseId) {
                      navigate(`/courses/${courseId}/assignments/${id}/edit`);
                    } else {
                      navigate(`/assignments/${id}/edit`);
                    }
                  }}
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
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.description || '') }} />
        </div>

        {assignment.content && (
          <div className="mt-6 prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300">
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.content || '') }} />
          </div>
        )}

        {userRole === 'student' && !isSubmitting && assignment.questions && assignment.questions.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Questions</h3>
            <div className="mt-4 space-y-6">
              {assignment.questions.map((q, index) => (
                <div key={index}>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{index + 1}. {q.text} ({q.points} pts)</p>
                  {q.type === 'multiple-choice' && q.options && (
                    <ul className="list-disc ml-8 mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                      {q.options.map((opt, optIndex) => (
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
            {assignment.questions && assignment.questions.map((q, index) => (
              <div key={index} className="mb-6">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{index + 1}. {q.text} ({q.points} pts)</p>
                {q.type === 'multiple-choice' && q.options && q.options.map((opt, optIndex) => (
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
                  <textarea
                    id={`question-${index}-answer`}
                    name={`question-${index}-answer`}
                    value={answers[index] || ''}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm"
                    rows={4}
                  />
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
            {assignment.attachments && assignment.attachments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Attachments</h3>
                <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                  {assignment.attachments.map((attachment, index) => (
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Submissions</h3>
                  {submissions.length > 0 && (
                    <button
                      onClick={async () => {
                        setIsDownloading(true);
                        setError('');
                        try {
                          const token = localStorage.getItem('token');
                          const response = await axios.get(`${API_URL}/api/submissions/assignment/${id}/download`, {
                            headers: { Authorization: `Bearer ${token}` },
                            responseType: 'blob'
                          });
                          const url = window.URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `${assignment?.title?.replace(/[^a-z0-9]/gi, '_') || 'submissions'}_submissions.zip`);
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          const axiosError = err as AxiosError;
                          logger.error('Download error', err instanceof Error ? err : new Error(String(err)));
                          const errorData = axiosError.response?.data as { message?: string } | undefined;
                          const errorMessage = errorData?.message;
                          setError(errorMessage || 'Error downloading submissions');
                        } finally {
                          setIsDownloading(false);
                        }
                      }}
                      disabled={isDownloading}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isDownloading ? 'Downloading...' : 'Download All'}
                    </button>
                  )}
                </div>
                {submissions.length === 0 ? (
                  <p className="mt-2 text-gray-500 dark:text-gray-400">No submissions yet</p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                    {submissions.map((sub) => (
                      <li key={sub._id} className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {sub.student?.firstName} {sub.student?.lastName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Submitted at: {format(new Date(sub.submittedAt), 'MMM d, yyyy, h:mm a')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-sm font-medium ${sub.grade ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                {sub.grade !== null && sub.grade !== undefined ? `Grade: ${sub.grade}` : 'Not Graded'}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token');
                                  const response = await axios.get(`${API_URL}/api/submissions/${sub._id}/download`, {
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
                                    if (sub.files && sub.files.length === 1) {
                                      filename = sub.files[0].split('/').pop() || 'submission';
                                    } else {
                                      const studentName = `${sub.student?.firstName || 'Student'}_${sub.student?.lastName || ''}`.replace(/[^a-z0-9]/gi, '_');
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
                                  const axiosError = err as AxiosError;
                                  logger.error('Download error', err instanceof Error ? err : new Error(String(err)));
                                  const errorData = axiosError.response?.data as { message?: string } | undefined;
                                  const errorMessage = errorData?.message;
                                  setError(errorMessage || 'Error downloading submission');
                                }
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                              title="Download this submission"
                            >
                              <Download className="h-3.5 w-3.5 mr-1.5" />
                              Download
                            </button>
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





