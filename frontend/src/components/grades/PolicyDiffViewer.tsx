import React from 'react';
import { diffPolicies } from '../../utils/gradeUtils';

interface PolicyDiffViewerProps {
  oldPolicy: Record<string, unknown> | null;
  newPolicy: Record<string, unknown> | null;
}

const PolicyDiffViewer: React.FC<PolicyDiffViewerProps> = ({ oldPolicy, newPolicy }) => {
  const diff = diffPolicies(oldPolicy || {}, newPolicy || {});

  if (!diff.changed.length && !diff.added.length && !diff.removed.length) {
    return <p className="text-sm text-gray-500">No differences.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {diff.changed.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Changed</h4>
          <ul className="mt-2 space-y-2">
            {diff.changed.map((row) => (
              <li
                key={row.path}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <code className="text-xs text-blue-700 dark:text-blue-300">{row.path}</code>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  <span className="text-red-700 dark:text-red-300">
                    Before: {JSON.stringify(row.before)}
                  </span>
                  <span className="text-green-700 dark:text-green-300">
                    After: {JSON.stringify(row.after)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {diff.added.length > 0 && (
        <div>
          <h4 className="font-medium text-green-700 dark:text-green-300">Added</h4>
          <ul className="mt-1 list-inside list-disc text-gray-600 dark:text-gray-400">
            {diff.added.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {diff.removed.length > 0 && (
        <div>
          <h4 className="font-medium text-red-700 dark:text-red-300">Removed</h4>
          <ul className="mt-1 list-inside list-disc text-gray-600 dark:text-gray-400">
            {diff.removed.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PolicyDiffViewer;
