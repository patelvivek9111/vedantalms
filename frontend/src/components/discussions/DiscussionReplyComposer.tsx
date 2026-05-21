import React, { memo } from 'react';
import RichTextEditor from '../common/RichTextEditor';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import type { NormalizedFile } from '../../utils/fileTypes';

interface DiscussionReplyComposerProps {
  content: string;
  onContentChange: (html: string) => void;
  attachmentFiles: NormalizedFile[];
  onAttachmentsChange: (files: NormalizedFile[]) => void;
  courseId?: string;
  courseArchived?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  placeholder?: string;
  compact?: boolean;
}

const DiscussionReplyComposer: React.FC<DiscussionReplyComposerProps> = memo(
  ({
    content,
    onContentChange,
    attachmentFiles,
    onAttachmentsChange,
    courseId,
    courseArchived = false,
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel = 'Post Reply',
    placeholder = 'Share your thoughts...',
    compact = false,
  }) => {
    const textPlain = content.replace(/<[^>]+>/g, '').trim();
    const canSubmit = !isSubmitting && (textPlain.length > 0 || attachmentFiles.length > 0);

    return (
      <form onSubmit={onSubmit} className="space-y-3">
        {courseArchived && (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            This course is archived. New replies and uploads are disabled.
          </p>
        )}
        <div onClick={(e) => e.stopPropagation()}>
          <RichTextEditor
            content={content}
            onChange={onContentChange}
            placeholder={placeholder}
            className={compact ? 'mb-2' : 'mb-4'}
          />
        </div>
        <FileAttachmentPanel
          files={attachmentFiles}
          onChange={onAttachmentsChange}
          courseId={courseId}
          category="discussion"
          disabled={courseArchived}
          finalized={courseArchived}
          label="Drop files to attach"
          className="text-sm"
        />
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || courseArchived}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
            aria-live="polite"
          >
            {isSubmitting ? 'Posting…' : submitLabel}
          </button>
        </div>
      </form>
    );
  }
);

DiscussionReplyComposer.displayName = 'DiscussionReplyComposer';

export default DiscussionReplyComposer;
