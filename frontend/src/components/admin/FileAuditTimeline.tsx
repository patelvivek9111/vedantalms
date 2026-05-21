import React, { useEffect, useState } from 'react';
import { fetchFileAuditTimeline } from '../../services/recoveryApi';
import { LoadingInline } from '../../design-system';

interface AuditEvent {
  _id?: string;
  action: string;
  severity?: string;
  createdAt: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

const FileAuditTimeline: React.FC<{ fileAssetId: string | null }> = ({ fileAssetId }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fileAssetId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    void fetchFileAuditTimeline(fileAssetId)
      .then((res) => {
        if (res.success) setEvents(res.data?.events || []);
      })
      .finally(() => setLoading(false));
  }, [fileAssetId]);

  if (!fileAssetId) return <p className="text-sm text-gray-500">Select a file to view audit history.</p>;
  if (loading) return <LoadingInline label="Loading audit timeline…" />;
  if (!events.length) return <p className="text-sm text-gray-500">No audit events recorded.</p>;

  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto text-xs" aria-label="File audit timeline">
      {events.map((e, i) => (
        <li key={e._id || i} className="border-l-2 border-indigo-400 pl-2 py-1">
          <span className="font-medium text-gray-800 dark:text-gray-200">{e.action}</span>
          {e.severity && (
            <span className="ml-2 text-gray-500">({e.severity})</span>
          )}
          <div className="text-gray-500">{new Date(e.createdAt).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
};

export default FileAuditTimeline;
