import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search, Library } from 'lucide-react';
import type { RubricCriterion, RubricSnapshot } from './RubricViewer';
import {
  bankItemToSnapshot,
  listRubrics,
  type RubricBankItem,
  type RubricBankScope,
} from '../../services/rubricApi';

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyRubricDraft(title = 'Assignment rubric'): RubricSnapshot {
  const cId = rid('c');
  return {
    title,
    freeFormCriterionComments: true,
    pointsPossible: 5,
    criteria: [
      {
        id: cId,
        description: 'Criterion 1',
        longDescription: '',
        points: 5,
        ratings: [
          { id: rid('r'), description: 'Full marks', points: 5 },
          { id: rid('r'), description: 'Partial', points: 3 },
          { id: rid('r'), description: 'No marks', points: 0 },
        ],
      },
    ],
  };
}

function recompute(criteria: RubricCriterion[]): RubricSnapshot['pointsPossible'] {
  return criteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
}

type Props = {
  value: RubricSnapshot | null;
  onChange: (next: RubricSnapshot | null) => void;
  /** When selecting from the bank, parent should track this id for attach-by-id. */
  onBankRubricIdChange?: (id: string | null) => void;
  courseId?: string | null;
  disabled?: boolean;
};

/** Teacher editor — attach / edit rubric, or find one from the course/institution bank. */
export function AssignmentRubricEditor({
  value,
  onChange,
  onBankRubricIdChange,
  courseId,
  disabled,
}: Props) {
  const enabled = Boolean(value);
  const criteria = value?.criteria || [];
  const pointsPossible = useMemo(() => recompute(criteria), [criteria]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const setCriteria = (next: RubricCriterion[]) => {
    if (!value) return;
    onChange({
      ...value,
      criteria: next,
      pointsPossible: recompute(next),
    });
  };

  const applyBankItem = (item: RubricBankItem) => {
    const snap = bankItemToSnapshot(item);
    onChange(snap);
    onBankRubricIdChange?.(String(item._id));
    setPickerOpen(false);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Rubric</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Optional. Students see criteria before they submit. Use Find existing to reuse a course
            or institution rubric.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {courseId ? (
            <button
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
              onClick={() => setPickerOpen(true)}
            >
              <Library className="h-3.5 w-3.5" />
              Find existing
            </button>
          ) : null}
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={enabled}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange(emptyRubricDraft());
                  onBankRubricIdChange?.(null);
                } else {
                  onChange(null);
                  onBankRubricIdChange?.(null);
                }
              }}
            />
            Use a rubric
          </label>
        </div>
      </div>

      {!enabled ? null : (
        <>
          {value?.rubricId ? (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              Linked to a bank rubric. If this rubric is shared by multiple assignments, saving edits
              creates a new copy for this assignment (Canvas behavior).
            </p>
          ) : null}
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Rubric title
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={value?.title || ''}
              disabled={disabled}
              onChange={(e) =>
                onChange(value ? { ...value, title: e.target.value } : value)
              }
            />
          </label>
          <p className="text-xs text-slate-500">
            Points possible from criteria: <strong>{pointsPossible}</strong>
            {enabled ? ' (will sync to assignment total points on save)' : ''}
          </p>

          <div className="space-y-4">
            {criteria.map((c, ci) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    value={c.description}
                    disabled={disabled}
                    placeholder="Criterion name"
                    onChange={(e) => {
                      const next = criteria.map((row, i) =>
                        i === ci ? { ...row, description: e.target.value } : row
                      );
                      setCriteria(next);
                    }}
                  />
                  <label className="text-xs text-slate-600 dark:text-slate-300">
                    Max pts
                    <input
                      type="number"
                      min={0}
                      className="ml-1 w-16 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      value={c.points}
                      disabled={disabled}
                      onChange={(e) => {
                        const pts = Math.max(0, Number(e.target.value) || 0);
                        const next = criteria.map((row, i) => {
                          if (i !== ci) return row;
                          const ratings = [...(row.ratings || [])];
                          if (ratings[0]) ratings[0] = { ...ratings[0], points: pts };
                          return { ...row, points: pts, ratings };
                        });
                        setCriteria(next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={disabled || criteria.length <= 1}
                    className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-40 dark:hover:bg-slate-900"
                    onClick={() => setCriteria(criteria.filter((_, i) => i !== ci))}
                    aria-label="Remove criterion"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <ul className="mt-2 space-y-1.5">
                  {(c.ratings || []).map((r, ri) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={r.points}
                        disabled={disabled}
                        onChange={(e) => {
                          const pts = Math.max(0, Number(e.target.value) || 0);
                          const next = criteria.map((row, i) => {
                            if (i !== ci) return row;
                            const ratings = row.ratings.map((rr, j) =>
                              j === ri ? { ...rr, points: pts } : rr
                            );
                            const maxPts = ratings.reduce((m, x) => Math.max(m, x.points), 0);
                            return { ...row, ratings, points: maxPts };
                          });
                          setCriteria(next);
                        }}
                      />
                      <input
                        className="min-w-[10rem] flex-1 rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                        value={r.description}
                        disabled={disabled}
                        placeholder="Rating description"
                        onChange={(e) => {
                          const next = criteria.map((row, i) => {
                            if (i !== ci) return row;
                            const ratings = row.ratings.map((rr, j) =>
                              j === ri ? { ...rr, description: e.target.value } : rr
                            );
                            return { ...row, ratings };
                          });
                          setCriteria(next);
                        }}
                      />
                      <button
                        type="button"
                        disabled={disabled || (c.ratings || []).length <= 2}
                        className="rounded p-1 text-slate-400 hover:text-red-600 disabled:opacity-40"
                        onClick={() => {
                          const next = criteria.map((row, i) => {
                            if (i !== ci) return row;
                            const ratings = row.ratings.filter((_, j) => j !== ri);
                            const maxPts = ratings.reduce((m, x) => Math.max(m, x.points), 0);
                            return { ...row, ratings, points: maxPts };
                          });
                          setCriteria(next);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={disabled}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-400"
                  onClick={() => {
                    const next = criteria.map((row, i) =>
                      i === ci
                        ? {
                            ...row,
                            ratings: [
                              ...row.ratings,
                              { id: rid('r'), description: 'New rating', points: 0 },
                            ],
                          }
                        : row
                    );
                    setCriteria(next);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add rating
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
            onClick={() => {
              setCriteria([
                ...criteria,
                {
                  id: rid('c'),
                  description: `Criterion ${criteria.length + 1}`,
                  longDescription: '',
                  points: 5,
                  ratings: [
                    { id: rid('r'), description: 'Full marks', points: 5 },
                    { id: rid('r'), description: 'Partial', points: 3 },
                    { id: rid('r'), description: 'No marks', points: 0 },
                  ],
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4" /> Add criterion
          </button>
        </>
      )}

      {pickerOpen && courseId ? (
        <RubricBankPickerModal
          courseId={courseId}
          onClose={() => setPickerOpen(false)}
          onSelect={applyBankItem}
        />
      ) : null}
    </div>
  );
}

function RubricBankPickerModal({
  courseId,
  onClose,
  onSelect,
}: {
  courseId: string;
  onClose: () => void;
  onSelect: (item: RubricBankItem) => void;
}) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<RubricBankScope>('all');
  const [rows, setRows] = useState<RubricBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listRubrics({ courseId, scope, q: q.trim() || undefined });
        if (!cancelled) setRows(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load rubrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [courseId, scope, q]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Find existing rubric"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Find existing rubric
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Course and institution bank rubrics for this school.
          </p>
        </div>
        <div className="space-y-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-950"
              placeholder="Search by title"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 text-xs">
            {(
              [
                ['all', 'All'],
                ['course', 'Course'],
                ['account', 'Institution'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-full px-2.5 py-1 font-medium ${
                  scope === key
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
                onClick={() => setScope(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Loading…</p>
          ) : error ? (
            <p className="px-2 py-6 text-center text-sm text-red-600">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              No rubrics in the bank yet. Create one here or under Course → Rubrics.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li key={String(row._id)}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    onClick={() => onSelect(row)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {row.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {(row.criteria || []).length} criteria · {row.pointsPossible ?? 0} pts
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        row.scope === 'account'
                          ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                      }`}
                    >
                      {row.scope === 'account' ? 'Institution' : 'Course'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssignmentRubricEditor;
