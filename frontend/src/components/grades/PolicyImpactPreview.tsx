import React from 'react';
import type { PolicyImpactPreview as PolicyImpactPreviewData } from '../../services/gradingApi';
import type { PolicyApplyMode } from './PolicyApplyModeSelector';
import { downloadPolicyImpactCsv } from '../../utils/exportImpactCsv';

interface PolicyImpactPreviewProps {
  impact: PolicyImpactPreviewData | null;
  loading?: boolean;
  lifecycleStatus?: string;
  applyMode?: PolicyApplyMode;
  saveReason: string;
  onSaveReasonChange: (value: string) => void;
  onExportCsv?: () => void;
}

function deltaClass(delta: number): string {
  if (Math.abs(delta) < 0.005) return 'text-gray-600 dark:text-gray-400';
  return delta < 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300';
}

function formatDelta(delta: number): string {
  if (Math.abs(delta) < 0.005) return '0.00';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
}

const PolicyImpactPreview: React.FC<PolicyImpactPreviewProps> = ({
  impact,
  loading,
  lifecycleStatus,
  applyMode = 'retroactive_all',
  saveReason,
  onSaveReasonChange,
  onExportCsv,
}) => {
  if (loading) {
    return <p className="text-sm text-gray-500">Calculating impact for enrolled students…</p>;
  }

  if (!impact) {
    return (
      <p className="text-sm text-gray-500">
        Review impact shows how each student&apos;s current grade would change under the edited policy.
      </p>
    );
  }

  const { summary, students, policyDiff, policyUnchanged } = impact;
  const reasonRequired = lifecycleStatus === 'POSTED';

  const applyModeLabel =
    applyMode === 'prospective_only'
      ? 'prospective'
      : applyMode === 'from_assignment'
        ? 'from assignment forward'
        : 'retroactive';

  const cutoffDetail =
    applyMode === 'prospective_only' && impact?.effectiveAt
      ? ` (cutoff ${new Date(impact.effectiveAt).toLocaleString()})`
      : applyMode === 'from_assignment' && impact?.effectiveAssignmentId
        ? (() => {
            const match = impact.assignments?.find(
              (a) => a.id === impact.effectiveAssignmentId
            );
            return match ? ` (from "${match.title}")` : '';
          })()
        : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Previewing <strong>{applyModeLabel}</strong> apply mode{cutoffDetail}.
        </p>
        {students.length > 0 && impact && (
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={() => (onExportCsv ? onExportCsv() : downloadPolicyImpactCsv(impact))}
          >
            Export CSV
          </button>
        )}
      </div>

      {policyUnchanged && summary.affectedCount > 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
          No policy changes detected — saving will not alter grade calculations.
        </p>
      ) : null}

      {students.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Students</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {summary.studentCount}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Affected
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-900 dark:text-amber-100">
              {summary.affectedCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Max |Δ|</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {summary.maxDeltaPercent.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Letter changes
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {summary.letterChanges}
            </p>
          </div>
        </div>
      )}

      {policyDiff.summaryLines.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Policy changes</h3>
          <ul className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-mono text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
            {policyDiff.summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {lifecycleStatus === 'POSTED' && !policyUnchanged && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
          This course is <strong>posted</strong>. Saving will recalculate live grades for all students
          immediately. Students may have already seen their previous totals.
        </p>
      )}

      {reasonRequired && (
        <div>
          <label
            htmlFor="policy-save-reason"
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            Reason for change {lifecycleStatus === 'POSTED' ? '(required)' : ''}
          </label>
          <textarea
            id="policy-save-reason"
            rows={2}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={saveReason}
            onChange={(e) => onSaveReasonChange(e.target.value)}
            placeholder="e.g. Align missing-work policy with department standard"
          />
        </div>
      )}

      {students.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Student
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Current
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Proposed
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  Δ
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Letter
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {students.map((row) => (
                <tr
                  key={row.studentId}
                  className={
                    row.changed
                      ? 'bg-amber-50/50 dark:bg-amber-900/10'
                      : 'bg-white dark:bg-gray-900'
                  }
                >
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.displayName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.currentPercent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.proposedPercent.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums font-medium ${deltaClass(row.deltaPercent)}`}>
                    {formatDelta(row.deltaPercent)}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {row.currentLetter === row.proposedLetter ? (
                      row.currentLetter
                    ) : (
                      <span>
                        {row.currentLetter} → <strong>{row.proposedLetter}</strong>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PolicyImpactPreview;
