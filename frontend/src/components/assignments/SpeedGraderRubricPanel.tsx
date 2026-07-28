import React, { useMemo } from 'react';
import type { RubricCriterion, RubricSnapshot } from './RubricViewer';

export type CriterionAssessmentMap = Record<
  string,
  { points: number; ratingId?: string | null; comments?: string }
>;

type Props = {
  rubric: RubricSnapshot;
  value: CriterionAssessmentMap;
  onChange: (next: CriterionAssessmentMap, score: number) => void;
  disabled?: boolean;
  useForGrading?: boolean;
};

function scoreFromMap(criteria: RubricCriterion[], map: CriterionAssessmentMap): number {
  let sum = 0;
  for (const c of criteria) {
    const entry = map[c.id];
    if (entry && Number.isFinite(Number(entry.points))) sum += Number(entry.points);
  }
  return Math.round(sum * 100) / 100;
}

/** SpeedGrader Phase 2 — click ratings to fill score. */
export function SpeedGraderRubricPanel({
  rubric,
  value,
  onChange,
  disabled,
  useForGrading = true,
}: Props) {
  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  const score = useMemo(() => scoreFromMap(criteria, value), [criteria, value]);
  const pointsPossible =
    rubric.pointsPossible ?? criteria.reduce((s, c) => s + (Number(c.points) || 0), 0);

  const setCriterion = (criterionId: string, patch: CriterionAssessmentMap[string]) => {
    const next = { ...value, [criterionId]: { ...value[criterionId], ...patch } };
    onChange(next, scoreFromMap(criteria, next));
  };

  if (!criteria.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {rubric.title || 'Rubric'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Click a rating for each criterion
            {useForGrading ? ' — total becomes the submission grade.' : ' (feedback only).'}
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50">
          {score} / {pointsPossible}
        </div>
      </div>

      <div className="space-y-4">
        {criteria.map((c) => {
          const selected = value[c.id]?.ratingId;
          const comments = value[c.id]?.comments || '';
          const ratings = [...(c.ratings || [])].sort((a, b) => b.points - a.points);
          return (
            <div
              key={c.id}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div className="font-medium text-slate-900 dark:text-slate-100">{c.description}</div>
                <div className="text-xs text-slate-500">max {c.points}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ratings.map((r) => {
                  const active = selected === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setCriterion(c.id, {
                          ratingId: r.id,
                          points: r.points,
                          comments,
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                        active
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-sky-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200'
                      }`}
                    >
                      <span className="font-semibold">{r.points}</span>
                      <span className="opacity-80"> · {r.description}</span>
                    </button>
                  );
                })}
              </div>
              {rubric.freeFormCriterionComments !== false && (
                <input
                  className="mt-2 w-full rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950"
                  placeholder="Criterion comment (optional)"
                  disabled={disabled}
                  value={comments}
                  onChange={(e) =>
                    setCriterion(c.id, {
                      ratingId: selected || null,
                      points: value[c.id]?.points ?? 0,
                      comments: e.target.value,
                    })
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { RubricAssessmentViewer } from './RubricViewer';

export default SpeedGraderRubricPanel;
