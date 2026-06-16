import React, { memo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import RichTextEditor from '../common/RichTextEditor';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import { useMobileLayout } from '../../hooks/useMobileLayout';
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
  layout?: 'default' | 'mobile' | 'inline';
  hideActions?: boolean;
}

const cancelButtonClass =
  'inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editorStats(html: string): { words: number; chars: number } {
  const plain = plainTextFromHtml(html);
  return {
    words: plain ? plain.split(' ').filter(Boolean).length : 0,
    chars: plain.length,
  };
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
    layout = 'default',
    hideActions = false,
  }) => {
    const isMobileViewport = useMobileLayout();
    const effectiveLayout =
      layout === 'mobile' || layout === 'inline'
        ? layout
        : isMobileViewport
          ? 'inline'
          : 'default';

    const isMobileLayout = effectiveLayout === 'mobile';
    const isInlineLayout = effectiveLayout === 'inline';
    const isCompactViewport = isMobileLayout || isInlineLayout;

    const [showAttachments, setShowAttachments] = useState(
      attachmentFiles.length > 0 || effectiveLayout === 'default'
    );

    const textPlain = plainTextFromHtml(content);
    const { words, chars } = editorStats(content);
    const canSubmit = !isSubmitting && (textPlain.length > 0 || attachmentFiles.length > 0);

    const statsBar = (
      <div
        className="flex w-full shrink-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs tabular-nums text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"
        data-testid="discussion-editor-stats"
        aria-label={`${words} words, ${chars} characters`}
      >
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span>{chars} {isCompactViewport ? 'chars' : 'characters'}</span>
      </div>
    );

    return (
      <form
        onSubmit={(e) => {
          if (!canSubmit || courseArchived) {
            e.preventDefault();
            return;
          }
          onSubmit(e);
        }}
        className="w-full min-w-0 max-w-full space-y-3"
      >
        {courseArchived && (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            This course is archived. New replies and uploads are disabled.
          </p>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <RichTextEditor
            content={content}
            onChange={onContentChange}
            placeholder={placeholder}
            variant="composer"
            className={
              isMobileLayout
                ? 'mb-0 min-h-[160px] border-0'
                : isInlineLayout
                  ? 'mb-0 min-h-[120px] border-0'
                  : compact
                    ? 'mb-0 min-h-[140px] border-0'
                    : 'mb-0 min-h-[160px] border-0'
            }
          />
        </div>

        {isCompactViewport ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAttachments((v) => !v)}
              className="inline-flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Paperclip className="h-4 w-4" />
              {showAttachments ? 'Hide attachments' : 'Add attachment'}
              {attachmentFiles.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {attachmentFiles.length}
                </span>
              )}
            </button>
            {showAttachments && (
              <FileAttachmentPanel
                files={attachmentFiles}
                onChange={onAttachmentsChange}
                courseId={courseId}
                category="discussion"
                disabled={courseArchived}
                finalized={courseArchived}
                label="Tap to attach files"
                className="text-sm"
              />
            )}
          </div>
        ) : (
          <FileAttachmentPanel
            files={attachmentFiles}
            onChange={onAttachmentsChange}
            courseId={courseId}
            category="discussion"
            disabled={courseArchived}
            finalized={courseArchived}
            label="Choose files to attach"
            className="text-sm"
          />
        )}

        {!hideActions && (
          <div className="flex w-full shrink-0 flex-col gap-2 pt-1" data-testid="discussion-reply-actions">
            {statsBar}
            <div className="flex w-full gap-2">
            {onCancel && (
              <button type="button" onClick={onCancel} className={`${cancelButtonClass} w-1/2`}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              data-testid="discussion-post-reply-btn"
              className="inline-flex min-h-[48px] w-1/2 items-center justify-center rounded-xl border border-indigo-600 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isSubmitting ? 'Posting…' : submitLabel}
            </button>
            </div>
          </div>
        )}
      </form>
    );
  }
);

DiscussionReplyComposer.displayName = 'DiscussionReplyComposer';

export default DiscussionReplyComposer;
