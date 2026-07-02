import React, { useState } from 'react';
import FileRecoveryTable from './FileRecoveryTable';
import FileAuditTimeline from './FileAuditTimeline';
import FileVersionRestoreDialog from './FileVersionRestoreDialog';
import { useDebounce } from '../../hooks/useDebounce';
import {
  restoreFile,
  previewRestore,
  quarantineFile,
  releaseQuarantine,
  postBulkRecovery,
  type RecoverableFile,
} from '../../services/recoveryApi';

const AdminRecoveryCenter: React.FC = () => {
  const [filter, setFilter] = useState('deleted');
  const [selected, setSelected] = useState<RecoverableFile | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [versionOpen, setVersionOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [restorePreview, setRestorePreview] = useState<Record<string, unknown> | null>(null);

  const bump = () => setRefreshKey((k) => k + 1);

  const runAction = async (fn: () => Promise<unknown>) => {
    setMessage('');
    try {
      await fn();
      setMessage('Action completed.');
      bump();
    } catch {
      setMessage('Action failed.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">File Recovery Center</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Restore deleted files, manage quarantine, and review audit trails. All actions are logged.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search by filename…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-600 min-w-[200px]"
          aria-label="Search recoverable files"
        />
        {(['deleted', 'quarantine', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              filter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <FileRecoveryTable
            filter={filter}
            search={debouncedSearch}
            selectedId={selected?._id || null}
            onSelect={(f) => {
              setSelected(f);
              setSelectedIds(new Set([f._id]));
              setRestorePreview(null);
            }}
            refreshKey={refreshKey}
          />
        </div>
        <div className="space-y-3">
          {selected ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selected.originalName}</p>
              <div className="flex flex-wrap gap-2">
                {filter === 'deleted' && (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs rounded border"
                      onClick={async () => {
                        try {
                          const res = await previewRestore(selected._id);
                          if (res.success) setRestorePreview(res.data as Record<string, unknown>);
                        } catch {
                          setMessage('Restore preview failed.');
                        }
                      }}
                    >
                      Preview restore
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs rounded bg-green-600 text-white"
                      onClick={() => void runAction(() => restoreFile(selected._id))}
                    >
                      Restore file
                    </button>
                  </>
                )}
                {restorePreview && (
                  <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32 w-full">
                    {JSON.stringify(restorePreview, null, 2)}
                  </pre>
                )}
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded border"
                  onClick={() => setVersionOpen(true)}
                >
                  Version history
                </button>
                {selected.scanStatus !== 'unsafe' ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white"
                    onClick={() => void runAction(() => quarantineFile(selected._id, 'admin'))}
                  >
                    Quarantine
                  </button>
                ) : (
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white"
                    onClick={() => void runAction(() => releaseQuarantine(selected._id))}
                  >
                    Release
                  </button>
                )}
              </div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Audit timeline</h4>
              <FileAuditTimeline fileAssetId={selected._id} />
            </>
          ) : (
            <p className="text-sm text-gray-500">Select a file from the list.</p>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded border"
            onClick={() =>
              void runAction(() =>
                postBulkRecovery({
                  action: 'enqueue',
                  jobType: 'files.bulk.restore',
                  fileAssetIds: [...selectedIds],
                })
              )
            }
          >
            Bulk restore (async job)
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded border"
            onClick={() =>
              void runAction(() =>
                postBulkRecovery({ action: 'zip_export', fileAssetIds: [...selectedIds] })
              )
            }
          >
            Bulk export bundle
          </button>
        </div>
      )}

      {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}

      <FileVersionRestoreDialog
        fileAssetId={selected?._id || null}
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        onRestored={bump}
      />
    </div>
  );
};

export default AdminRecoveryCenter;
