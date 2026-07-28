import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  CANVAS_BLUE,
  CANVAS_BLUE_HOVER,
  DEFAULT_CANVAS_FILE_TYPES,
  formatCanvasAvailableRange,
  formatCanvasDateTime,
  formatCanvasDue,
  getEffectiveLockAt,
  resolveCanvasAvailability,
  resolveCanvasSubmittingLabel,
} from './canvasFormat';

export type CanvasShowAssignment = {
  title: string;
  description?: string;
  content?: string;
  dueDate?: string | Date | null;
  availableFrom?: string | Date | null;
  lockAt?: string | Date | null;
  lockAfterDue?: boolean;
  locked?: boolean;
  totalPoints?: number;
  questions?: Array<{ points?: number }>;
  isOfflineAssignment?: boolean;
  isGradedQuiz?: boolean;
  quizSubmissionMode?: string;
  allowStudentUploads?: boolean;
  group?: string;
  isTimedQuiz?: boolean;
  quizTimeLimit?: number;
  fileTypes?: string[];
};

type Props = {
  assignment: CanvasShowAssignment;
  mode?: 'assignment' | 'quiz';
  hasSubmission?: boolean;
  showPrimaryAction?: boolean;
  primaryActionLabel?: string;
  primaryActionDisabled?: boolean;
  onPrimaryAction?: () => void;
  scoreLabel?: string | null;
  late?: boolean;
  className?: string;
  hidePageTitle?: boolean;
  showViewRubric?: boolean;
  viewRubricExpanded?: boolean;
  onViewRubric?: () => void;
  attachmentsContent?: React.ReactNode;
  children?: React.ReactNode;
};

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

/**
 * Assignment / quiz show header — LMS layout with clear hierarchy.
 */
export function CanvasAssignmentShowHeader({
  assignment,
  mode,
  hasSubmission = false,
  showPrimaryAction = false,
  primaryActionLabel,
  primaryActionDisabled = false,
  onPrimaryAction,
  scoreLabel,
  late = false,
  className = '',
  hidePageTitle = false,
  showViewRubric = false,
  viewRubricExpanded = false,
  onViewRubric,
  attachmentsContent,
  children,
}: Props) {
  const isQuiz =
    mode === 'quiz' ||
    assignment.isGradedQuiz === true ||
    String(assignment.group || '')
      .toLowerCase()
      .includes('quiz');

  const availability = resolveCanvasAvailability(assignment);
  const points =
    (assignment.questions?.length
      ? assignment.questions.reduce((s, q) => s + (Number(q.points) || 0), 0)
      : 0) ||
    Number(assignment.totalPoints) ||
    0;
  const questionCount = assignment.questions?.length || 0;
  const submitting = resolveCanvasSubmittingLabel(assignment);
  const fileTypes =
    assignment.fileTypes?.length && assignment.allowStudentUploads
      ? assignment.fileTypes
      : assignment.allowStudentUploads ||
          (assignment.isGradedQuiz && assignment.quizSubmissionMode === 'paper_upload')
        ? DEFAULT_CANVAS_FILE_TYPES
        : null;
  const availableLine = formatCanvasAvailableRange(
    assignment.availableFrom,
    getEffectiveLockAt(assignment)
  );

  const defaultLabel = isQuiz
    ? hasSubmission
      ? 'View Results'
      : 'Take the Quiz'
    : hasSubmission
      ? 'Re-submit Assignment'
      : 'Submit Assignment';
  const actionLabel = primaryActionLabel || defaultLabel;

  const instructions =
    (assignment.description && String(assignment.description).trim()) ||
    (assignment.content && String(assignment.content).trim()) ||
    '';

  const lockedManual = availability.kind === 'locked_manual';
  const lockedUntil = availability.kind === 'locked_until';
  const lockedAfter = availability.kind === 'locked_after';
  const isAvailabilityLocked = lockedManual || lockedUntil || lockedAfter;
  const canShowMeta = !lockedUntil;
  const showTopPrimary =
    showPrimaryAction &&
    Boolean(onPrimaryAction) &&
    !isAvailabilityLocked &&
    !(isQuiz && instructions && !hasSubmission);

  const fileTypesLabel = fileTypes
    ? fileTypes.length <= 2
      ? fileTypes.join(' and ')
      : `${fileTypes.slice(0, -1).join(', ')}, and ${fileTypes[fileTypes.length - 1]}`
    : null;

  return (
    <div className={className}>
      {!hidePageTitle ? (
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {isQuiz ? 'View Quiz' : 'View Assignment'}
        </h1>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {assignment.title}
              </h2>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {scoreLabel ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-600 dark:bg-slate-800/80">
                  {late ? (
                    <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Late
                    </span>
                  ) : null}
                  <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {scoreLabel}
                  </span>
                </div>
              ) : null}
              {showTopPrimary ? (
                <button
                  type="button"
                  disabled={primaryActionDisabled}
                  onClick={onPrimaryAction}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                  style={{ backgroundColor: CANVAS_BLUE }}
                  onMouseEnter={(e) => {
                    if (!primaryActionDisabled) e.currentTarget.style.backgroundColor = CANVAS_BLUE_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = CANVAS_BLUE;
                  }}
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          </div>

          {lockedManual ? (
            <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-100">
              This {isQuiz ? 'quiz' : 'assignment'} is locked.
            </p>
          ) : null}

          {lockedUntil ? (
            <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-100">
              This {isQuiz ? 'quiz' : 'assignment'} is locked until{' '}
              {formatCanvasDateTime(availability.until)}.
            </p>
          ) : null}
        </div>

        {canShowMeta ? (
          <div className="border-t border-slate-200/90 px-5 py-4 sm:px-6 dark:border-slate-700">
            <dl className="space-y-2.5">
              {assignment.dueDate ? (
                <MetaRow label="Due">{formatCanvasDue(assignment.dueDate)}</MetaRow>
              ) : null}
              <MetaRow label="Points">{points}</MetaRow>
              {isQuiz && questionCount > 0 ? (
                <MetaRow label="Questions">{questionCount}</MetaRow>
              ) : (
                <MetaRow label="Submitting">{submitting}</MetaRow>
              )}
              {isQuiz ? (
                <>
                  <MetaRow label="Time Limit">
                    {assignment.isTimedQuiz && assignment.quizTimeLimit
                      ? `${assignment.quizTimeLimit} Minutes`
                      : 'None'}
                  </MetaRow>
                  <MetaRow label="Attempts">Unlimited</MetaRow>
                </>
              ) : (
                <>
                  {fileTypesLabel ? <MetaRow label="File Types">{fileTypesLabel}</MetaRow> : null}
                  {hasSubmission ? <MetaRow label="Attempts">1</MetaRow> : null}
                </>
              )}
              {availableLine ? <MetaRow label="Available">{availableLine}</MetaRow> : null}
            </dl>

            {attachmentsContent ? (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                {attachmentsContent}
              </div>
            ) : null}

            {showViewRubric && onViewRubric ? (
              <div className={attachmentsContent ? 'mt-3' : 'mt-4'}>
                <button
                  type="button"
                  onClick={onViewRubric}
                  className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                  aria-expanded={viewRubricExpanded}
                >
                  {viewRubricExpanded ? 'Hide Rubric' : 'View Rubric'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {lockedAfter ? (
          <div className="border-t border-slate-200/90 px-5 py-4 sm:px-6 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              This {isQuiz ? 'quiz' : 'assignment'} was locked {formatCanvasDateTime(availability.at)}.
            </p>
          </div>
        ) : null}

        {isQuiz && instructions && !lockedUntil ? (
          <div className="border-t border-slate-200/90 px-5 py-5 sm:px-6 dark:border-slate-700">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Instructions
            </h3>
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-300">
              <ReactMarkdown>{instructions}</ReactMarkdown>
            </div>
            {showPrimaryAction && onPrimaryAction && !hasSubmission && !isAvailabilityLocked ? (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  disabled={primaryActionDisabled}
                  onClick={onPrimaryAction}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg px-5 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-60"
                  style={{ backgroundColor: CANVAS_BLUE }}
                  onMouseEnter={(e) => {
                    if (!primaryActionDisabled) {
                      e.currentTarget.style.backgroundColor = CANVAS_BLUE_HOVER;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = CANVAS_BLUE;
                  }}
                >
                  {primaryActionDisabled ? 'Starting…' : 'Take the Quiz'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}

export default CanvasAssignmentShowHeader;
