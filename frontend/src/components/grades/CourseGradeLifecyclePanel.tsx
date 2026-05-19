import React, { useMemo, useState } from 'react';
import { useCourseGradeLifecycle } from '../../hooks/useCourseGradeLifecycle';
import { ErrorBanner, LoadingInline } from '../../design-system';
import ConfirmDialog from '../../design-system/ConfirmDialog';
import AsyncJobBanner from '../common/AsyncJobBanner';
import AuditFilterBar, { type AuditFilters } from '../../features/audit/AuditFilterBar';
import { filterTimelineEntries } from '../../features/audit/filterAuditEntries';
import PolicyProvenancePanel, { LifecycleBadge } from './PolicyProvenancePanel';
import AmendmentTimeline from './AmendmentTimeline';

interface CourseGradeLifecyclePanelProps {
  courseId: string;
  userRole?: string;
  defaultExpanded?: boolean;
}

const CourseGradeLifecyclePanel: React.FC<CourseGradeLifecyclePanelProps> = ({
  courseId,
  userRole,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [amendReason, setAmendReason] = useState('');
  const [tab, setTab] = useState<'provenance' | 'timeline'>('provenance');
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'amend' | null>(null);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    search: '',
    category: '',
    severity: '',
  });

  const {
    lifecycleData,
    provenance,
    timeline,
    loading,
    error,
    actionLoading,
    canPost,
    canFinalize,
    canAmend,
    refresh,
    postGrades,
    finalizeGrades,
    amendGrades,
    asyncJob,
  } = useCourseGradeLifecycle(courseId, userRole);

  const status = lifecycleData?.lifecycle?.status || 'DRAFT';

  const categories = useMemo(
    () => [...new Set(timeline.map((t) => t.category).filter(Boolean))],
    [timeline]
  );

  const filteredTimeline = useMemo(
    () => filterTimelineEntries(timeline, auditFilters),
    [timeline, auditFilters]
  );

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="grade-lifecycle-panel-content"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Grade lifecycle & provenance
            </span>
            <LifecycleBadge status={status} />
            {status === 'FINALIZED' && (
              <span className="text-xs text-green-700 dark:text-green-300" title="Term grades frozen for transcript">
                Finalized — transcript snapshots are locked
              </span>
            )}
            {lifecycleData?.gradingEngineVersion && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Engine {lifecycleData.gradingEngineVersion}
              </span>
            )}
          </div>
          <span className="text-gray-400" aria-hidden>
            {expanded ? '▼' : '▶'}
          </span>
        </button>

        {expanded && (
          <div id="grade-lifecycle-panel-content" className="border-t border-gray-200 px-4 py-4 dark:border-gray-700">
            <AsyncJobBanner
              job={asyncJob.job}
              polling={asyncJob.polling}
              error={asyncJob.error}
              label="Grading operation"
              onDismiss={asyncJob.reset}
            />
            {error && (
              <ErrorBanner className="mb-3" message={error} onRetry={() => void refresh()} />
            )}
            {loading && !lifecycleData && <LoadingInline label="Loading lifecycle…" />}

            <div className="mb-4 flex flex-wrap gap-2">
              {canPost && status === 'DRAFT' && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void postGrades()}
                  className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                >
                  Post grades
                </button>
              )}
              {canFinalize && (status === 'DRAFT' || status === 'POSTED') && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setConfirmAction('finalize')}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Finalize term
                </button>
              )}
              {canAmend && status === 'FINALIZED' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={amendReason}
                    onChange={(e) => setAmendReason(e.target.value)}
                    placeholder="Amendment reason (required)"
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    aria-label="Amendment reason"
                  />
                  <button
                    type="button"
                    disabled={actionLoading || amendReason.trim().length < 3}
                    onClick={() => setConfirmAction('amend')}
                    className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    Amend finalized grades
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3 flex gap-2 border-b border-gray-200 dark:border-gray-700">
              {(['provenance', 'timeline'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 text-sm font-medium capitalize ${
                    tab === key
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {key === 'provenance' ? 'Policy chain' : 'Audit timeline'}
                </button>
              ))}
            </div>

            {tab === 'provenance' ? (
              <PolicyProvenancePanel provenance={provenance} loading={loading} />
            ) : (
              <>
                <AuditFilterBar
                  filters={auditFilters}
                  onChange={setAuditFilters}
                  categories={categories}
                />
                <AmendmentTimeline entries={filteredTimeline} loading={loading} />
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === 'finalize'}
        title="Finalize term grades?"
        message="This freezes grade snapshots used on transcripts. This action is intended for end-of-term processing."
        confirmLabel="Finalize"
        destructive
        loading={actionLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          void finalizeGrades();
        }}
      />
      <ConfirmDialog
        open={confirmAction === 'amend'}
        title="Amend finalized grades?"
        message="Creates an audit record and allows controlled changes. Finalized snapshots remain append-only."
        confirmLabel="Amend"
        loading={actionLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          void amendGrades(amendReason.trim());
        }}
      />
    </>
  );
};

export default CourseGradeLifecyclePanel;
