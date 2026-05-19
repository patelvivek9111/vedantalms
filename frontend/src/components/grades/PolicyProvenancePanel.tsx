import React from 'react';
import type { GradeProvenance } from '../../hooks/useCourseGradeLifecycle';

interface PolicyProvenancePanelProps {
  provenance: GradeProvenance | null;
  loading?: boolean;
}

export const LifecycleBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    POSTED: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200',
    FINALIZED: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200',
    AMENDED: 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        colors[status] || colors.DRAFT
      }`}
    >
      {status}
    </span>
  );
};

const ChainStep: React.FC<{
  label: string;
  detail: string;
  active?: boolean;
}> = ({ label, detail, active }) => (
  <div
    className={`rounded-lg border px-4 py-3 ${
      active
        ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
    }`}
  >
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </span>
    <span className="mt-1 block text-sm text-gray-900 dark:text-gray-100">{detail}</span>
  </div>
);

const PolicyProvenancePanel: React.FC<PolicyProvenancePanelProps> = ({ provenance, loading }) => {
  if (loading) return <p className="text-sm text-gray-500">Loading provenance…</p>;
  if (!provenance) return null;

  const status = provenance.lifecycle?.status || 'DRAFT';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</span>
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {provenance.term} {provenance.year}
        </span>
        <LifecycleBadge status={status} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <ChainStep
          label="Institution"
          detail={
            provenance.policyChain.institution
              ? `v${provenance.policyChain.institution.version}`
              : 'Defaults'
          }
        />
        <ChainStep
          label="Course"
          detail={
            provenance.policyChain.course ? `v${provenance.policyChain.course.version}` : 'No overrides'
          }
        />
        <ChainStep label="Resolved" detail={`v${provenance.policyChain.resolved.version}`} active />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
        <p>
          <span className="font-medium">Engine:</span> {provenance.gradingEngineVersion}
        </p>
        <p className="mt-1 break-all font-mono">
          <span className="font-sans font-medium">Effective hash:</span> {provenance.effectivePolicyHash}
        </p>
        {provenance.lifecyclePolicyHash && (
          <p className="mt-1 break-all font-mono">
            <span className="font-sans font-medium">Frozen at finalize:</span>{' '}
            {provenance.lifecyclePolicyHash}
          </p>
        )}
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Snapshots: {provenance.snapshots.current} current, {provenance.snapshots.superseded} historical
          · {provenance.amendmentCount} amendment(s)
        </p>
      </div>
    </div>
  );
};

export default PolicyProvenancePanel;
