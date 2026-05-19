import React, { useEffect, useState } from 'react';
import { fetchEffectiveCoursePolicy } from '../../services/gradingApi';
import { ErrorBanner } from '../../design-system';

interface EffectivePolicyPreviewProps {
  courseId: string;
}

const PolicyBlock: React.FC<{ title: string; data: unknown }> = ({ title, data }) => (
  <section>
    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
    <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
      {JSON.stringify(data, null, 2)}
    </pre>
  </section>
);

const EffectivePolicyPreview: React.FC<EffectivePolicyPreviewProps> = ({ courseId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchEffectiveCoursePolicy(courseId);
      if (res.success) {
        setData(res.data);
      }
    } catch {
      setError('Could not load effective policy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [courseId]);

  if (loading) return <p className="text-sm text-gray-500">Loading effective policy…</p>;
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-900/20">
        <p>
          <span className="font-medium">Resolved version:</span> {String(data.resolvedPolicyVersion)}
        </p>
        <p className="mt-1 break-all font-mono text-xs">
          <span className="font-medium font-sans">Hash:</span> {String(data.resolvedPolicyHash)}
        </p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          This is the policy snapshot used when calculating current course totals. Finalized transcript rows keep the hash from finalize time.
        </p>
        {'gradingEngineVersion' in data && data.gradingEngineVersion != null && (
          <p className="mt-1">
            <span className="font-medium">Grading engine:</span> {String(data.gradingEngineVersion)}
          </p>
        )}
      </div>
      <PolicyBlock title="Institution defaults" data={data.institutionPolicy ?? '(none)'} />
      <PolicyBlock title="Course overrides" data={data.coursePolicy ?? '(none)'} />
      <PolicyBlock title="Resolved policy (used for calculation)" data={data.resolvedPolicy} />
    </div>
  );
};

export default EffectivePolicyPreview;
