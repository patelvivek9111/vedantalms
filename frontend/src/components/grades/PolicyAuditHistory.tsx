import React, { useEffect, useMemo, useState } from 'react';
import { fetchPolicyAudit } from '../../services/gradingApi';
import { ErrorBanner } from '../../design-system';
import AuditFilterBar, { type AuditFilters } from '../../features/audit/AuditFilterBar';
import { filterPolicyAuditEntries, type PolicyAuditEntry } from '../../features/audit/filterAuditEntries';
import PolicyDiffViewer from './PolicyDiffViewer';

interface PolicyAuditHistoryProps {
  entityType: 'institution' | 'course';
  entityId: string;
}

const PolicyAuditHistory: React.FC<PolicyAuditHistoryProps> = ({ entityType, entityId }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<PolicyAuditEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<AuditFilters>({ search: '', category: '', severity: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPolicyAudit(entityType, entityId);
      if (res.success) {
        setEntries(res.data || []);
      }
    } catch {
      setError('Could not load policy history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [entityType, entityId]);

  const filtered = useMemo(() => filterPolicyAuditEntries(entries, filters), [entries, filters]);

  if (loading) return <p className="text-sm text-gray-500">Loading history…</p>;
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No policy changes recorded yet.</p>;
  }

  return (
    <div>
      <AuditFilterBar filters={filters} onChange={setFilters} />
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No entries match your filters.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => {
            const actorName = entry.actor
              ? `${entry.actor.firstName || ''} ${entry.actor.lastName || ''}`.trim() ||
                entry.actor.email
              : 'Unknown';
            const isOpen = expandedId === entry._id;
            return (
              <li key={entry._id} className="rounded-lg border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => setExpandedId(isOpen ? null : entry._id)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(entry.createdAt).toLocaleString()} — {actorName}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {entry.oldHash?.slice(0, 12)} → {entry.newHash?.slice(0, 12)}
                  </span>
                  {entry.reason && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">Reason: {entry.reason}</span>
                  )}
                  {entry.applyMode && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Apply mode: {entry.applyMode.replace(/_/g, ' ')}
                    </span>
                  )}
                  {entry.impactSummary && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Impact: {entry.impactSummary.affectedCount} affected, max Δ{' '}
                      {entry.impactSummary.maxDeltaPercent?.toFixed?.(2) ?? entry.impactSummary.maxDeltaPercent}%
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                    <PolicyDiffViewer oldPolicy={entry.oldPolicy || null} newPolicy={entry.newPolicy || null} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PolicyAuditHistory;
