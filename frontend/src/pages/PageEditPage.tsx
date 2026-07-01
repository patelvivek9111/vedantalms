import React, { useState, useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../utils/authToken';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import BackButton from '../components/common/BackButton';
import RichTextEditor from '../components/common/RichTextEditor';
import { coursePageBodyHtmlClass, sanitizePageHtml } from '../components/pages/PageView';
import FileAttachmentPanel, { normalizeLegacyFiles } from '../components/files/FileAttachmentPanel';
import type { NormalizedFile } from '../utils/fileTypes';
import { API_URL } from '../config';
import { MobileAppShell } from '../components/common/MobileAppShell';

const PageEditPage: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string>('');
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [attachmentFiles, setAttachmentFiles] = useState<NormalizedFile[]>([]);
  const [removeAssetIds, setRemoveAssetIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      if (!pageId) return;
      try {
        const token = getMemoryAuthToken();
        const response = await axios.get(`${API_URL}/api/pages/view/${pageId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data.success) {
          const pageData = response.data.data;
          setFormData({ title: pageData.title, content: pageData.content || '' });
          const legacy = pageData.attachments || pageData.fileAssets || [];
          setAttachmentFiles(normalizeLegacyFiles(legacy));
          if (pageData.module?.course) {
            setCourseId(typeof pageData.module.course === 'string' ? pageData.module.course : pageData.module.course._id);
          }
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
    void fetchPage();
  }, [pageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const token = getMemoryAuthToken();
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      const newIds = attachmentFiles.map((f) => f.fileAssetId).filter(Boolean);
      if (newIds.length) formDataToSend.append('fileAssetIds', JSON.stringify(newIds));
      if (removeAssetIds.length) formDataToSend.append('removeFileAssetIds', JSON.stringify(removeAssetIds));

      const response = await axios.put(`${API_URL}/api/pages/${pageId}`, formDataToSend, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) navigate(-1);
      else throw new Error(response.data.message || 'Failed to update page');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Error updating page');
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
        <p className="text-red-600">{error}</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </button>
      </div>
    );
  }

  const backPath = courseId ? `/courses/${courseId}/pages` : '/courses';

  return (
    <MobileAppShell title="Edit Page" backButtonPath={backPath}>
    <div className="mx-auto max-w-4xl p-3 sm:p-4 lg:p-6">
      <div className="mb-4 hidden lg:flex items-center justify-between">
        <BackButton />
        {previewToggle}
      </div>
      <div className="mb-4 flex lg:hidden items-center justify-end">
        {previewToggle}
      </div>
      <h1 className="hidden lg:block text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Edit Page</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {!preview ? (
          <>
            <input
              className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Page title"
            />
            <RichTextEditor content={formData.content} onChange={(c) => setFormData({ ...formData, content: c })} height={400} />
            <FileAttachmentPanel
              files={attachmentFiles}
              onChange={setAttachmentFiles}
              onRemoveFile={(f) => {
                if (f.fileAssetId) setRemoveAssetIds((prev) => [...prev, f.fileAssetId!]);
              }}
              courseId={courseId}
              category="page"
              label="Manage page attachments"
              showVersionHistory
              versionHistoryAssetId={attachmentFiles[0]?.fileAssetId}
            />
          </>
        ) : (
          <div className={coursePageBodyHtmlClass} dangerouslySetInnerHTML={{ __html: sanitizePageHtml(formData.content) }} />
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save page'}
        </button>
      </form>
    </div>
    </MobileAppShell>
  );
};

export default PageEditPage;
