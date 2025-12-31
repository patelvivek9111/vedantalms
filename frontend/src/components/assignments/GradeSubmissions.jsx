import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

const GradeSubmissions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [formData, setFormData] = useState({
    grade: '',
    feedback: '',
    showCorrectAnswers: false,
    showStudentAnswers: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await axios.get(`/api/submissions/${id}`);
        setSubmission(response.data);
        setFormData({
          grade: response.data.grade || '',
          feedback: response.data.feedback || '',
          showCorrectAnswers: response.data.showCorrectAnswers || false,
          showStudentAnswers: response.data.showStudentAnswers || false
        });
        setLoading(false);
      } catch (err) {
        setError('Error fetching submission');
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [id]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await axios.put(`/api/submissions/${id}/grade`, formData);
      setSuccess('Grade and feedback updated successfully');
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating grade');
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

  if (!submission) {
    return <div>Submission not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">Grade Submission</h1>

        {success && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-3 sm:px-4 py-2 sm:py-3 rounded mb-4 text-sm sm:text-base">
            {success}
          </div>
        )}

        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">Student Information</h2>
          <p className="mt-1 text-sm sm:text-base text-gray-800 dark:text-gray-200">
            {submission.student.firstName} {submission.student.lastName}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Submitted: {format(new Date(submission.submittedAt), 'PPp')}
          </p>
        </div>

        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">Submission</h2>
          <div className="mt-2 prose max-w-none text-sm sm:text-base">
            <p className="text-gray-700 dark:text-gray-300">{submission.submissionText}</p>
          </div>
          {submission.files?.length > 0 && (
            <div className="mt-3 sm:mt-4">
              <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">Files:</h3>
              <ul className="mt-2 space-y-2">
                {submission.files.map((file, index) => (
                  <li key={index}>
                    <a
                      href={file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm sm:text-base break-all"
                    >
                      {file.split('/').pop()}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-gray-700">Grade</label>
            <input
              type="number"
              id="grade"
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              min="0"
              max="100"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">Feedback</label>
            <textarea
              id="feedback"
              name="feedback"
              value={formData.feedback}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {/* Quiz Feedback Options - Only show for quiz assignments */}
          {submission.assignment?.group === 'Quizzes' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Quiz Feedback Options</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showCorrectAnswers"
                    name="showCorrectAnswers"
                    checked={formData.showCorrectAnswers}
                    onChange={(e) => setFormData({ ...formData, showCorrectAnswers: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showCorrectAnswers" className="ml-2 block text-sm text-gray-900">
                    Show correct answers to student
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showStudentAnswers"
                    name="showStudentAnswers"
                    checked={formData.showStudentAnswers}
                    onChange={(e) => setFormData({ ...formData, showStudentAnswers: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showStudentAnswers" className="ml-2 block text-sm text-gray-900">
                    Show student's submitted answers
                  </label>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                These settings control what the student can see when they view their graded submission.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Save Grade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GradeSubmissions; 