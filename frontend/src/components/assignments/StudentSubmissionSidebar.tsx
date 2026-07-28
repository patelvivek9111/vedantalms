import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Eye, FileText } from 'lucide-react';
import { formatCanvasDateTime } from './canvas/canvasFormat';
import type { NormalizedFile } from '../../utils/fileTypes';
import { useFileDownload } from '../../hooks/useFileDownload';

type Props = {
  submittedAt?: string | Date | null;
  late?: boolean;
  feedback?: string | null;
  submissionFiles?: NormalizedFile[];
  feedbackFiles?: NormalizedFile[];
  gradeHidden?: boolean;
  autoGraded?: boolean;
  teacherApproved?: boolean;
  autoGradeLabel?: string | null;
  finalGradeLabel?: string | null;
  onPreviewFile?: (file: NormalizedFile) => void;
  className?: string;
};

const linkClass =
  'inline-flex items-center gap-1.5 text-sm font-medium text-[#9c2b2e] hover:underline dark:text-rose-400';

/**
 * Canvas-style right-rail submission status for the student assignment view.
 */
export default function StudentSubmissionSidebar({
  submittedAt,
  late = false,
  feedback,
  submissionFiles = [],
  feedbackFiles = [],
  gradeHidden = false,
  autoGraded = false,
  teacherApproved = false,
  autoGradeLabel,
  finalGradeLabel,
  onPreviewFile,
  className = '',
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const { downloadFile } = useFileDownload();
  const hasSubmission = Boolean(submittedAt) || submissionFiles.length > 0;
  const feedbackText = typeof feedback === 'string' ? feedback.trim() : '';
  const allDetailFiles = [...submissionFiles, ...feedbackFiles];

  return (
    <aside
      className={`overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
      aria-label="Submission status"
    >
      <div className="px-4 pt-4 pb-1 sm:px-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Submission
        </h2>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {hasSubmission ? (
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {late ? 'Turned In Late' : 'Turned In!'}
              </span>
            </div>
            {submittedAt ? (
              <p className="mt-0.5 pl-7 text-sm text-slate-500 dark:text-slate-400">
                {formatCanvasDateTime(submittedAt)}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Not submitted</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Submit your work when you are ready.
            </p>
          </div>
        )}

        {gradeHidden ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            Grade awaiting instructor release.
          </p>
        ) : null}

        {autoGraded ? (
          <div className="rounded border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
            <p className="font-semibold">{teacherApproved ? 'Grading complete' : 'Auto-graded'}</p>
            {teacherApproved && finalGradeLabel ? (
              <p className="mt-0.5">Final grade: {finalGradeLabel}</p>
            ) : null}
            {!teacherApproved && autoGradeLabel ? (
              <p className="mt-0.5">Auto-grade: {autoGradeLabel}</p>
            ) : null}
          </div>
        ) : null}

        {hasSubmission ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className={linkClass}
              aria-expanded={detailsOpen}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${detailsOpen ? 'rotate-90' : ''}`}
                aria-hidden
              />
              Submission Details
            </button>

            {detailsOpen ? (
              <div className="space-y-2 pl-0.5">
                {allDetailFiles.length > 0 ? (
                  allDetailFiles.map((file, index) => (
                    <div key={file.fileAssetId || file.url || index} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => void downloadFile(file.url, file.name, file.fileAssetId)}
                        className={linkClass}
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="break-all text-left">
                          Download {file.name || `file ${index + 1}`}
                        </span>
                      </button>
                      {onPreviewFile ? (
                        <button
                          type="button"
                          onClick={() => onPreviewFile(file)}
                          className={`${linkClass} ml-5`}
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Preview
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    No files attached
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="pt-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Comments:</p>
          {feedbackText ? (
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {feedbackText}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No Comments</p>
          )}
        </div>
      </div>
    </aside>
  );
}
