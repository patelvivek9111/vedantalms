import React, { useState } from 'react';
import BaseModal from '../common/BaseModal';
import { LoadingInline } from '../../design-system';
import { copyCourse } from '../../services/courseOpsApi';
import { useAsyncJob } from '../../hooks/useAsyncJob';

interface CourseCopyModalProps {
  open: boolean;
  courseId: string;
  sourceTitle: string;
  onClose: () => void;
  onSuccess: (newCourseId: string) => void;
}

const CourseCopyModal: React.FC<CourseCopyModalProps> = ({
  open,
  courseId,
  sourceTitle,
  onClose,
  onSuccess,
}) => {
  const [targetTitle, setTargetTitle] = useState(`${sourceTitle} (Copy)`);
  const [includeAnnouncements, setIncludeAnnouncements] = useState(true);
  const [includeDiscussions, setIncludeDiscussions] = useState(true);
  const [useAsync, setUseAsync] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const { job, pollJob } = useAsyncJob();

  const handleCopy = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await copyCourse(courseId, {
        targetTitle,
        includeAnnouncements,
        includeDiscussions,
        async: useAsync,
      });
      if (res.success && res.data?.async && res.data?.jobId) {
        setJobId(res.data.jobId);
        void pollJob(res.data.jobId);
      } else if (res.success && res.data?.course?._id) {
        onSuccess(res.data.course._id);
        onClose();
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Course copy failed');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const copyResult = job?.result as { newCourseId?: string } | undefined;
    if (job?.status === 'completed' && copyResult?.newCourseId) {
      onSuccess(copyResult.newCourseId);
      onClose();
    }
    if (job?.status === 'failed') {
      setError(job.error || 'Copy job failed');
    }
  }, [job, onClose, onSuccess]);

  if (!open) return null;

  return (
    <BaseModal isOpen={open} onClose={onClose} title="Copy course" size="md">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Copies modules, pages, assignments, and file attachments. Grades, transcripts, and lifecycle
        records are not copied.
      </p>
      <label className="block text-sm font-medium mb-1">New course title</label>
      <input
        className="w-full border rounded px-3 py-2 mb-3 dark:bg-gray-900 dark:border-gray-700"
        value={targetTitle}
        onChange={(e) => setTargetTitle(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm mb-2">
        <input type="checkbox" checked={includeDiscussions} onChange={(e) => setIncludeDiscussions(e.target.checked)} />
        Include discussions
      </label>
      <label className="flex items-center gap-2 text-sm mb-2">
        <input type="checkbox" checked={includeAnnouncements} onChange={(e) => setIncludeAnnouncements(e.target.checked)} />
        Include announcements
      </label>
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={useAsync} onChange={(e) => setUseAsync(e.target.checked)} />
        Run as background job (recommended for large courses)
      </label>
      {jobId && <LoadingInline label={`Copy in progress… ${job?.progress?.completed || 0}/${job?.progress?.total || '?'}`} />}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={loading || !targetTitle.trim()}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Starting…' : 'Copy course'}
        </button>
      </div>
    </BaseModal>
  );
};

export default CourseCopyModal;
