import React, { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import api from '../../services/api';
import type { NormalizedFile } from '../../utils/fileTypes';

interface FilePreviewThumbnailProps {
  file: NormalizedFile;
  className?: string;
  onClick?: () => void;
}

const FilePreviewThumbnail: React.FC<FilePreviewThumbnailProps> = ({ file, className = '', onClick }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!file.fileAssetId) return;
    setLoading(true);
    api
      .get(`/files/${file.fileAssetId}/preview`)
      .then((res) => {
        if (res.data.success && res.data.data.thumbnailUrl) {
          setThumbUrl(res.data.data.thumbnailUrl);
        } else {
          setUnsupported(true);
        }
      })
      .catch(() => setUnsupported(true))
      .finally(() => setLoading(false));
  }, [file.fileAssetId]);

  const inner = loading ? (
    <Loader2 className="w-6 h-6 animate-spin text-gray-400" aria-label="Loading preview" />
  ) : thumbUrl ? (
    <img src={thumbUrl} alt="" className="w-full h-full object-cover rounded" />
  ) : (
    <FileText className="w-6 h-6 text-gray-400" aria-hidden />
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-12 h-12 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden ${className}`}
      aria-label={unsupported ? `Preview unavailable for ${file.name}` : `Preview ${file.name}`}
    >
      {inner}
    </button>
  );
};

export default FilePreviewThumbnail;
