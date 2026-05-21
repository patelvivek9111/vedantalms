import React, { useEffect, useState } from 'react';
import { fetchFileVersions, restoreFileVersion } from '../../services/recoveryApi';

interface VersionRow {
  _id: string;
  versionNumber?: number;
  isCurrentVersion?: boolean;
  createdAt?: string;
}

interface FileVersionRestoreDialogProps {
  fileAssetId: string | null;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const FileVersionRestoreDialog: React.FC<FileVersionRestoreDialogProps> = ({
  fileAssetId,
  open,
  onClose,
  onRestored,
}) => {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !fileAssetId) return;
    setLoading(true);
    void fetchFileVersions(fileAssetId)
      .then((res) => {
        if (res.success) {
          const prev = res.data?.versions || [];
          const cur = res.data?.current;
          setVersions(cur ? [cur, ...prev] : prev);
        }
      })
      .finally(() => setLoading(false));
  }, [open, fileAssetId]);

  if (!open || !fileAssetId) return null;

  const handleRestore = async (versionId: string) => {
    setBusy(true);
    try {
      await restoreFileVersion(fileAssetId, versionId);
      onRestored();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restore version</h3>
        {loading ? (
          <p className="text-sm text-gray-500 mt-2">Loading versions…</p>
        ) : (
          <ul className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {versions.map((v) => (
              <li key={v._id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  v{v.versionNumber ?? '?'}
                  {v.isCurrentVersion && ' (current)'}
                </span>
                {!v.isCurrentVersion && (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-indigo-600 text-xs font-medium"
                    onClick={() => void handleRestore(v._id)}
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileVersionRestoreDialog;
