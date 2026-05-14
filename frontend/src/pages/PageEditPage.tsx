import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import BackButton from '../components/common/BackButton';
import RichTextEditor from '../components/RichTextEditor';
import { coursePageBodyHtmlClass, sanitizePageHtml } from '../components/PageView';

import { API_URL } from '../config';

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
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        setError(ax.response?.data?.message || 'Error loading page');
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

      const response = await axios.put(`${API_URL}/api/pages/${pageId}`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        navigate(-1);
      } else {
        throw new Error(response.data.message || 'Failed to update page');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || 'Error updating page');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewToggle = (
    <button
      type="button"
      onClick={() => setPreview(!preview)}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:text-sm"
    >
      {preview ? 'Edit' : 'Preview'}
    </button>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 dark:border-indigo-400" />
      </div>
    );
  }

  if (error && !formData.title && !formData.content) {
    return (
      <div className="mx-auto max-w-4xl p-3 sm:p-4 lg:p-6">
        <div
          className="relative rounded border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:px-4 sm:py-3 sm:text-base"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div
          className="relative rounded border border-yellow-400 bg-yellow-100 px-4 py-3 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
          role="alert"
        >
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don&apos;t have permission to edit pages.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="fixed left-0 right-0 top-0 z-[150] border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:hidden">
        <div className="relative flex items-center justify-between gap-2 px-4 py-3">
          <BackButton fallbackPath="/dashboard" className="shrink-0" ariaLabel="Go back" />
          <h1 className="flex-1 text-center text-lg font-semibold text-gray-800 dark:text-gray-100">
            {preview ? 'Preview' : 'Edit Page'}
          </h1>
          <div className="flex w-[4.5rem] shrink-0 justify-end">{previewToggle}</div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl p-3 pt-[4.25rem] sm:p-4 lg:px-6 lg:pb-6 lg:pt-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="mb-4 hidden items-center justify-between gap-3 lg:flex sm:mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">Edit Page</h1>
            {previewToggle}
          </div>

          {error && (
            <div
              className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
              role="status"
            >
              {error}
            </div>
          )}

          {preview ? (
            <div className="space-y-4">
              <h2 className="break-words text-2xl font-normal tracking-tight text-slate-400 dark:text-slate-500 sm:text-3xl">
                {formData.title}
              </h2>
              <div className="border-b border-slate-200 dark:border-slate-600" role="presentation" />
              <div
                className={coursePageBodyHtmlClass}
                dangerouslySetInnerHTML={{ __html: sanitizePageHtml(formData.content || '') }}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Matches the live course page. Use Edit to change content, then save.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                />
              </div>

              <div>
                <label htmlFor="page-content-editor" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Content
                </label>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Use the toolbar for headings, lists, links, tables, and media. Content is saved as HTML, same as when
                  you create a page from the course.
                </p>
                <RichTextEditor
                  id="page-content-editor"
                  content={formData.content}
                  onChange={(html) => setFormData({ ...formData, content: html })}
                  height={440}
                  className="rounded-md border border-gray-200 dark:border-gray-600"
                />
              </div>

              <div className="flex flex-col justify-end gap-2 sm:flex-row sm:space-x-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-transform hover:bg-gray-50 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:w-auto sm:py-2 touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] w-full rounded-md border border-transparent bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-indigo-400 sm:w-auto sm:py-2 touch-manipulation"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageEditPage;
