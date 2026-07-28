import React, { useState } from 'react';

export type RubricRating = {
  id: string;
  description: string;
  longDescription?: string;
  points: number;
};

export type RubricCriterion = {
  id: string;
  description: string;
  longDescription?: string;
  points: number;
  ratings: RubricRating[];
};

export type RubricSnapshot = {
  title?: string;
  pointsPossible?: number;
  criteria?: RubricCriterion[];
  freeFormCriterionComments?: boolean;
  /** Bank document id when attached from / created in the rubric bank */
  rubricId?: string | null;
};

export type CriterionAssessmentMap = Record<
  string,
  { points?: number; ratingId?: string | null; comments?: string }
>;

type ViewerProps = {
  rubric: RubricSnapshot | null | undefined;
  className?: string;
  title?: string;
};

type AssessmentProps = {
  rubric?: RubricSnapshot | null;
  assessment?: {
    score?: number;
    pointsPossible?: number;
    criterionAssessments?: CriterionAssessmentMap;
  } | null;
  showComments?: boolean;
  compact?: boolean;
  className?: string;
  onClose?: () => void;
  assessedByLabel?: string;
};

function sortedRatings(ratings: RubricRating[] = []) {
  return ratings.slice().sort((a, b) => Number(b.points) - Number(a.points));
}

function selectionTone(points: number, max: number): 'green' | 'orange' | 'none' {
  if (!Number.isFinite(points) || max <= 0) return 'none';
  const ratio = points / max;
  if (ratio >= 0.85) return 'green';
  if (ratio >= 0.4) return 'orange';
  return 'orange';
}

/** Canvas-style empty rubric definition (before grading). */
export function RubricViewer({ rubric, className = '', title }: ViewerProps) {
  return (
    <CanvasRubricTable
      rubric={rubric}
      className={className}
      title={title}
      showPointsColumn
    />
  );
}

/** Canvas-style graded rubric with selected rating bars + optional comments. */
export function RubricAssessmentViewer({
  rubric,
  assessment,
  showComments = true,
  compact = false,
  className = '',
  onClose,
  assessedByLabel,
}: AssessmentProps) {
  if (!rubric?.criteria?.length || !assessment) return null;
  return (
    <CanvasRubricTable
      rubric={rubric}
      assessment={assessment}
      showComments={showComments}
      compact={compact}
      className={className}
      onClose={onClose}
      assessedByLabel={assessedByLabel}
      showPointsColumn
    />
  );
}

type TableProps = {
  rubric?: RubricSnapshot | null;
  assessment?: AssessmentProps['assessment'];
  showComments?: boolean;
  compact?: boolean;
  className?: string;
  title?: string;
  onClose?: () => void;
  assessedByLabel?: string;
  showPointsColumn?: boolean;
};

export function CanvasRubricTable({
  rubric,
  assessment,
  showComments = true,
  compact = false,
  className = '',
  title,
  onClose,
  assessedByLabel,
  showPointsColumn = true,
}: TableProps) {
  const criteria = Array.isArray(rubric?.criteria) ? rubric!.criteria! : [];
  const [expandedLong, setExpandedLong] = useState<Record<string, boolean>>({});
  if (!criteria.length) return null;

  const map = assessment?.criterionAssessments || {};
  const hasAssessment = Boolean(assessment?.criterionAssessments);
  const pointsPossible =
    assessment?.pointsPossible ??
    rubric?.pointsPossible ??
    criteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
  const totalScore =
    assessment?.score ??
    (hasAssessment
      ? criteria.reduce((sum, c) => sum + (Number(map[c.id]?.points) || 0), 0)
      : null);

  return (
    <div className={`${className}`}>
      {onClose || assessedByLabel ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              Close Rubric
            </button>
          ) : (
            <span />
          )}
          {assessedByLabel ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{assessedByLabel}</span>
          ) : null}
        </div>
      ) : null}

      <div
        className={`overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {title || rubric?.title || 'Rubric'}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-white dark:bg-slate-900">
                <th
                  className="w-[22%] border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
                >
                  Criteria
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Ratings
                </th>
                {showPointsColumn ? (
                  <th className="w-[5.5rem] whitespace-nowrap border-b border-l border-slate-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Pts
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => {
                const ratings = sortedRatings(c.ratings || []);
                const entry = map[c.id];
                const selectedId = entry?.ratingId ? String(entry.ratingId) : null;
                const earned =
                  entry?.points != null && Number.isFinite(Number(entry.points))
                    ? Number(entry.points)
                    : null;
                const comment = showComments ? String(entry?.comments || '').trim() : '';
                const longOpen = expandedLong[c.id];

                return (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td className="align-top border-b border-r border-slate-200 px-3 py-3 text-slate-900 dark:border-slate-700 dark:text-slate-100">
                        <div className="font-semibold">{c.description}</div>
                        {c.longDescription ? (
                          <button
                            type="button"
                            className="mt-1 text-left text-sky-600 hover:underline dark:text-sky-400"
                            onClick={() =>
                              setExpandedLong((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                            }
                          >
                            {longOpen ? 'hide longer description' : 'view longer description'}
                          </button>
                        ) : null}
                        {longOpen && c.longDescription ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {c.longDescription}
                          </p>
                        ) : null}
                      </td>
                      <td className="align-top border-b border-slate-200 p-0 dark:border-slate-700">
                        <div className="flex min-h-[4.5rem] divide-x divide-slate-200 dark:divide-slate-700">
                          {ratings.map((r) => {
                            const isSelected =
                              hasAssessment &&
                              (selectedId
                                ? selectedId === String(r.id)
                                : earned != null && Number(r.points) === earned);
                            const tone = isSelected
                              ? selectionTone(Number(r.points), Number(c.points) || 1)
                              : 'none';
                            return (
                              <div
                                key={r.id}
                                className="relative flex min-w-[7rem] flex-1 flex-col px-2.5 py-2 text-slate-900 dark:text-slate-100"
                              >
                                <div className="text-xs font-semibold">
                                  {Number(r.points)} pts
                                </div>
                                <div
                                  className={`mt-0.5 flex-1 text-xs leading-snug ${
                                    isSelected ? 'font-semibold' : 'font-normal'
                                  }`}
                                >
                                  {r.description}
                                </div>
                                {isSelected ? (
                                  <div
                                    className="absolute bottom-0 left-1 right-1 h-1.5"
                                    style={{
                                      backgroundColor:
                                        tone === 'green' ? '#00AC18' : '#FC5E13',
                                    }}
                                  >
                                    <span
                                      className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 -translate-y-full border-x-[5px] border-b-[6px] border-x-transparent"
                                      style={{
                                        borderBottomColor:
                                          tone === 'green' ? '#00AC18' : '#FC5E13',
                                      }}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      {showPointsColumn ? (
                        <td className="whitespace-nowrap align-top border-b border-l border-slate-200 px-3 py-3 text-right font-semibold tabular-nums text-slate-900 dark:border-slate-700 dark:text-slate-100">
                          {hasAssessment && earned != null
                            ? `${earned} / ${c.points}`
                            : c.points}
                        </td>
                      ) : null}
                    </tr>
                    {comment ? (
                      <tr>
                        <td
                          colSpan={showPointsColumn ? 3 : 2}
                          className="border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50"
                        >
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Comments
                          </div>
                          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                            {comment}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
            {hasAssessment && totalScore != null ? (
              <tfoot>
                <tr>
                  <td
                    colSpan={showPointsColumn ? 2 : 1}
                    className="px-3 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Total Points:
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {totalScore} / {pointsPossible}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}

export default RubricViewer;
