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
        setAssignment(assignmentRes.data);

        if (currentUserRole === 'student') {
          try {
            const submissionRes = await axios.get(`${API_URL}/api/submissions/student/${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (submissionRes.data) {
              setSubmission(submissionRes.data);
              setAnswers(submissionRes.data.answers || {});
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
        console.error('Error fetching assignment details:', err);
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
      console.error('Error toggling assignment publish:', err);
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

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-2 text-sm text-gray-600">
              Due: {format(new Date(assignment.dueDate), 'PPp')}
            </p>
            {console.log('userRole:', userRole, 'assignment.submission:', assignment.submission)}
            {userRole === 'student' && assignment.submission && (
              <span className="ml-4 text-green-600">
                Submitted: {format(new Date(assignment.submission.submittedAt), 'PPp')}
              </span>
            )}
          </div>
          <div className="flex space-x-4">
            {(userRole === 'teacher' || userRole === 'admin') && (
              <>
                <button
                  onClick={handleTogglePublish}
                  disabled={isPublishing}
                  className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium 
                    ${assignment?.published 
                      ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100' 
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
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
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Edit Assignment
                </button>
                <button
                  onClick={() => navigate(`/assignments/${id}/grade`)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Grade Submissions
                </button>
              </>
            )}
            {userRole === 'student' && (
              <button
                onClick={() => navigate(`/assignments/${id}/view`)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Start Assignment
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 prose max-w-none">
          <ReactMarkdown>{assignment.description}</ReactMarkdown>
        </div>

        {assignment.content && (
          <div className="mt-6 prose max-w-none">
            <ReactMarkdown>{assignment.content}</ReactMarkdown>
          </div>
        )}

        {userRole === 'student' && !isSubmitting && assignment.questions && assignment.questions.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900">Questions</h3>
            <div className="mt-4 space-y-6">
              {assignment.questions.map((q, index) => (
                <div key={index}>
                  <p className="font-semibold">{index + 1}. {q.text} ({q.points} pts)</p>
                  {q.type === 'multiple-choice' && (
                    <ul className="list-disc ml-8 mt-2 space-y-1">
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">Your Submission</h3>
            {assignment.questions.map((q, index) => (
              <div key={index} className="mb-6">
                <p className="font-semibold">{index + 1}. {q.text} ({q.points} pts)</p>
                {q.type === 'multiple-choice' && q.options.map((opt, optIndex) => (
                  <div key={optIndex} className="ml-4">
                    <label className="flex items-center space-x-2">
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
                    value={answers[index] || ''}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    rows="4"
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setIsSubmitting(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                Submit
              </button>
            </div>
          </form>
        ) : (
          <>
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

            {(userRole === 'teacher' || userRole === 'admin') && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900">Submissions</h3>
                {submission && submission.length === 0 ? (
                  <p className="mt-2 text-gray-500">No submissions yet</p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-200">
                    {submission && submission.map((sub) => (
                      <li key={sub._id} className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {sub.student?.firstName} {sub.student?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              Submitted at: {format(new Date(sub.submittedAt), 'PPp')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${sub.grade ? 'text-green-600' : 'text-yellow-600'}`}>
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