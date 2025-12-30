import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import FilePreview from './FilePreview';
import logger from '../../utils/logger';
import { API_URL } from '../../config';

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Assignment {
  _id: string;
  showCorrectAnswers?: boolean;
  showStudentAnswers?: boolean;
}

interface Submission {
  _id: string;
  assignment: {
    _id?: string;
    group?: string;
  } | string | Assignment;
  student: Student;
  submittedAt: string;
  submissionText?: string;
  answers?: Record<string, any>;
  grade?: number | null;
  feedback?: string;
  files?: Array<string | { url?: string; path?: string; name?: string; originalname?: string }>;
  showCorrectAnswers?: boolean;
  showStudentAnswers?: boolean;
}

interface FormData {
  grade: string;
  feedback: string;
  showCorrectAnswers: boolean;
  showStudentAnswers: boolean;
}

const GradeSubmissions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState<FormData>({
    grade: '',
    feedback: '',
    showCorrectAnswers: false,
    showStudentAnswers: false
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get<Submission>(`${API_URL}/api/submissions/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setSubmission(response.data);
        
        // Get assignment ID from submission
        const assignmentId = typeof response.data.assignment === 'string' 
          ? response.data.assignment 
          : response.data.assignment?._id;
        
        // Fetch assignment to get default feedback options
        let assignmentData: Assignment | null = null;
        if (assignmentId) {
          try {
            const assignmentResponse = await axios.get<Assignment>(`${API_URL}/api/assignments/${assignmentId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            assignmentData = assignmentResponse.data;
            setAssignment(assignmentData);
          } catch (err) {
            logger.warn('Error fetching assignment for defaults', err);
          }
        }
        
        // Use submission values if set, otherwise fall back to assignment defaults
        setFormData({
          grade: response.data.grade?.toString() || '',
          feedback: response.data.feedback || '',
          showCorrectAnswers: response.data.showCorrectAnswers !== undefined 
            ? response.data.showCorrectAnswers 
            : (assignmentData?.showCorrectAnswers || false),
          showStudentAnswers: response.data.showStudentAnswers !== undefined 
            ? response.data.showStudentAnswers 
            : (assignmentData?.showStudentAnswers || false)
        });
        setLoading(false);
      } catch (err) {
        const axiosError = err as AxiosError;
        logger.error('Error fetching submission', err instanceof Error ? err : new Error(String(err)));
        setError('Error fetching submission');
        setLoading(false);
      }
    };

    if (id) {
      fetchSubmission();
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/submissions/${id}/grade`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSuccess('Grade and feedback updated successfully');
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      logger.error('Error updating grade', err instanceof Error ? err : new Error(String(err)));
      setError(axiosError.response?.data?.message || 'Error updating grade');
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

  if (!submission) {
    return <div className="text-gray-900 dark:text-gray-100">Submission not found</div>;
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
          <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mt-1">
            {submission.student?.firstName} {submission.student?.lastName}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Submitted: {format(new Date(submission.submittedAt), 'MMM d, yyyy, h:mm a')}
          </p>
        </div>

        {submission.files && submission.files.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Submitted Files</h2>
            <div className="space-y-2">
              {submission.files.map((file, index) => {
                const fileUrl: string = typeof file === 'string' ? file : (file.url || file.path || '');
                const fileName: string = typeof file === 'string' 
                  ? file.split('/').pop() || `File ${index + 1}`
                  : (file.name || file.originalname || `File ${index + 1}`);
                const previewFileObj: { url: string; name: string } = typeof file === 'string' 
                  ? { url: file, name: fileName }
                  : { url: fileUrl, name: fileName };
                
                return (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                    >
                      {fileName}
                    </a>
                    <button
                      onClick={() => setPreviewFile(previewFileObj)}
                      className="ml-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {previewFile && (
          <div className="mb-4 sm:mb-6">
            <FilePreview fileUrl={previewFile.url} onClose={() => setPreviewFile(null)} />
          </div>
        )}

        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">Submission</h2>
          {submission.submissionText && (
            <div className="mt-2 prose max-w-none text-sm sm:text-base">
              <p className="text-gray-700 dark:text-gray-300">{submission.submissionText}</p>
            </div>
          )}
          {submission.files && submission.files.length > 0 && (
            <div className="mt-3 sm:mt-4">
              <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Files:</h3>
              <div className="space-y-2">
                {submission.files.map((file, index) => {
                  const fileUrl = typeof file === 'string' ? file : (file.url || file.path || '');
                  const fileName = typeof file === 'string' 
                    ? file.split('/').pop() || `File ${index + 1}`
                    : (file.name || file.originalname || `File ${index + 1}`);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
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
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm sm:text-base"
                          title="Open in new tab"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {previewFile && previewFile.url && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPreviewFile(null)}>
                  <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                    <FilePreview
                      fileUrl={previewFile.url}
                      fileName={previewFile.name}
                      onClose={() => setPreviewFile(null)}
                      showCloseButton={true}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Grade
            </label>
            <input
              type="number"
              id="grade"
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Feedback
            </label>
            <textarea
              id="feedback"
              name="feedback"
              value={formData.feedback}
              onChange={handleChange}
              rows={6}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 sm:text-sm"
            />
          </div>

          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Quiz Feedback Options</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              These options can be changed at any time, even after the student has submitted. Changes will immediately update what the student sees.
            </p>
            <div className="flex items-start">
              <input
                type="radio"
                id="showCorrectAnswers"
                name="feedbackOption"
                checked={formData.showCorrectAnswers && !formData.showStudentAnswers}
                onChange={() => {
                  setFormData({ ...formData, showCorrectAnswers: true, showStudentAnswers: false });
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 mt-0.5"
              />
            <label htmlFor="showCorrectAnswers" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
              Show student answers with correctness and reveal correct answers
            </label>
          </div>

            <div className="flex items-start">
              <input
                type="radio"
                id="showStudentAnswers"
                name="feedbackOption"
                checked={formData.showStudentAnswers && !formData.showCorrectAnswers}
                onChange={() => {
                  setFormData({ ...formData, showStudentAnswers: true, showCorrectAnswers: false });
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 mt-0.5"
              />
              <label htmlFor="showStudentAnswers" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                Show student answers with correctness only (no correct answers revealed)
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600"
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

