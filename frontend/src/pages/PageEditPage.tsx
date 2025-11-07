import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useModule } from '../contexts/ModuleContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

const PageEditPage: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      if (!pageId) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/pages/view/${pageId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          const pageData = response.data.data;
          setFormData({
            title: pageData.title,
            content: pageData.content || ''
          });
        } else {
          setError('Failed to load page data');
        }
      } catch (err: any) {
        console.error('Error fetching page:', err);
        setError(err.response?.data?.message || 'Error loading page');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [pageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);

      const response = await axios.put(
        `${API_URL}/api/pages/${pageId}`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        navigate(-1); // Go back to previous page after successful update
      } else {
        throw new Error(response.data.message || 'Failed to update page');
      }
    } catch (err: any) {
      console.error('Error updating page:', err);
      setError(err.response?.data?.message || 'Error updating page');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don't have permission to edit pages.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Page</h1>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        
        {preview ? (
          <div className="prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300">
            <h1>{formData.title}</h1>
            <ReactMarkdown>{formData.content}</ReactMarkdown>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Content (Markdown supported)
              </label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={15}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-mono"
              />
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
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PageEditPage; 