import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Copy, Library, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  AssignmentRubricEditor,
  emptyRubricDraft,
} from '../assignments/AssignmentRubricEditor';
import type { RubricSnapshot } from '../assignments/RubricViewer';
import {
  bankItemToSnapshot,
  copyRubric,
  createRubric,
  deleteRubric,
  listRubrics,
  updateRubric,
  type RubricBankItem,
  type RubricBankScope,
} from '../../services/rubricApi';

type Props = {
  courseId: string;
};

type EditorMode = null | { kind: 'create' } | { kind: 'edit'; item: RubricBankItem };

/** Course + institution rubric bank management (Canvas-style associations). */
const CourseRubricsSection: React.FC<Props> = ({ courseId }) => {
  const { user } = useAuth();
  const isAdmin = ['admin', 'platform_admin'].includes(String(user?.role || '').toLowerCase());
  const [rows, setRows] = useState<RubricBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<RubricBankScope>('all');
  const [editor, setEditor] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<RubricSnapshot | null>(null);
  const [shareWithInstitution, setShareWithInstitution] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listRubrics({
        courseId,
        scope,
        q: q.trim() || undefined,
      });
      setRows(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load rubrics');
    } finally {
      setLoading(false);
    }
  }, [courseId, scope, q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setShareWithInstitution(false);
    setDraft(emptyRubricDraft('Course rubric'));
    setEditor({ kind: 'create' });
  };

  const openEdit = (item: RubricBankItem) => {
    const usedBy = item.associationCount || 0;
    if (usedBy > 1) {
      setError(
        `"${item.title}" is attached to ${usedBy} assignments. Canvas-style rule: make a copy to edit, or remove it from other assignments first.`
      );
      return;
    }
    setShareWithInstitution(!item.courseId);
    setDraft(bankItemToSnapshot(item));
    setEditor({ kind: 'edit', item });
  };

  const makeCopyAndEdit = async (item: RubricBankItem) => {
    setError('');
    try {
      const copy = await copyRubric(String(item._id), {
        courseId,
        title: `${item.title} (copy)`,
      });
      setShareWithInstitution(false);
      setDraft(bankItemToSnapshot(copy));
      setEditor({ kind: 'edit', item: { ...copy, associationCount: 0, scope: 'course' } });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Copy failed');
    }
  };

  const saveEditor = async () => {
    if (!draft?.criteria?.length) return;
    setSaving(true);
    setError('');
    try {
      if (editor?.kind === 'create') {
        await createRubric({
          title: draft.title || 'Rubric',
          criteria: draft.criteria,
          courseId: shareWithInstitution ? null : courseId,
          freeFormCriterionComments: draft.freeFormCriterionComments !== false,
        });
      } else if (editor?.kind === 'edit') {
        await updateRubric(String(editor.item._id), {
          title: draft.title || 'Rubric',
          criteria: draft.criteria,
          freeFormCriterionComments: draft.freeFormCriterionComments !== false,
        });
      }
      setEditor(null);
      setDraft(null);
      await load();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'RUBRIC_IN_USE_COPY_REQUIRED') {
        setError(err.response.data.message);
      } else {
        setError(err?.response?.data?.message || err?.message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const archiveItem = async (item: RubricBankItem) => {
    if (
      !window.confirm(
        `Archive “${item.title}”? It will hide from Find existing. Assignments already using it keep their rubric until you remove or replace it.`
      )
    ) {
      return;
    }
    try {
      await updateRubric(String(item._id), { workflowState: 'archived' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Archive failed');
    }
  };

  const removeItem = async (item: RubricBankItem) => {
    if (item.scope === 'account' && !isAdmin) {
      setError(
        'Institution rubrics can only be deleted by an administrator. Copy into this course or archive instead.'
      );
      return;
    }
    const usedBy = item.associationCount || 0;
    const ok = window.confirm(
      usedBy > 0
        ? `Delete “${item.title}”?\n\nCanvas-style: it will be removed from ${usedBy} assignment${usedBy === 1 ? '' : 's'} and criterion score breakdowns will be cleared. Total points already in the gradebook are kept.`
        : `Delete “${item.title}” from the bank?`
    );
    if (!ok) return;
    try {
      await deleteRubric(String(item._id));
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Delete failed');
    }
  };

  const copyToCourse = async (item: RubricBankItem) => {
    try {
      await copyRubric(String(item._id), {
        courseId,
        title: `${item.title} (course copy)`,
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Copy failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            <Library className="h-5 w-5 text-sky-600" />
            Rubrics
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Course and institution bank. Attach per assignment via Find existing. Rubrics used in
            multiple assignments cannot be edited in place — copy first (Canvas behavior).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" /> New rubric
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Search rubrics"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
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
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              scope === key
                ? 'bg-sky-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
            onClick={() => setScope(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading rubrics…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-300">No rubrics in this bank yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-3 text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            Create the first rubric
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">
          {rows.map((row) => {
            const usedBy = row.associationCount || 0;
            const canDelete = row.scope !== 'account' || isAdmin;
            return (
              <li
                key={String(row._id)}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {row.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        row.scope === 'account'
                          ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                      }`}
                    >
                      {row.scope === 'account' ? 'Institution' : 'Course'}
                    </span>
                    {usedBy > 0 ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Used by {usedBy} assignment{usedBy === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {(row.criteria || []).length} criteria · {row.pointsPossible ?? 0} points
                    {usedBy > 1 ? ' · edit locked — copy to change' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {row.scope === 'account' || usedBy > 1 ? (
                    <button
                      type="button"
                      title={usedBy > 1 ? 'Make a copy to edit' : 'Copy into this course'}
                      className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-sky-700 dark:hover:bg-gray-800"
                      onClick={() =>
                        void (usedBy > 1 ? makeCopyAndEdit(row) : copyToCourse(row))
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title={usedBy > 1 ? 'Make a copy to edit' : 'Edit'}
                    className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-sky-700 dark:hover:bg-gray-800"
                    onClick={() => (usedBy > 1 ? void makeCopyAndEdit(row) : openEdit(row))}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Archive"
                    className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-amber-700 dark:hover:bg-gray-800"
                    onClick={() => void archiveItem(row)}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={
                      canDelete
                        ? 'Delete (detaches from assignments)'
                        : 'Only admins can delete institution rubrics'
                    }
                    disabled={!canDelete}
                    className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800"
                    onClick={() => void removeItem(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editor && draft ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!saving) {
              setEditor(null);
              setDraft(null);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-gray-50 p-4 shadow-xl dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-50">
              {editor.kind === 'create' ? 'New rubric' : 'Edit rubric'}
            </h3>
            {editor.kind === 'edit' && (editor.item.associationCount || 0) === 1 ? (
              <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                Attached to 1 assignment — saving updates that assignment&apos;s rubric snapshot.
              </p>
            ) : null}
            {editor.kind === 'create' ? (
              <label className="mb-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={shareWithInstitution}
                  onChange={(e) => setShareWithInstitution(e.target.checked)}
                />
                Share with institution (available in all courses)
              </label>
            ) : null}
            <AssignmentRubricEditor
              value={draft}
              onChange={(next) => setDraft(next || emptyRubricDraft())}
              disabled={saving}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => {
                  setEditor(null);
                  setDraft(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draft?.criteria?.length}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                onClick={() => void saveEditor()}
              >
                {saving ? 'Saving…' : 'Save rubric'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CourseRubricsSection;
