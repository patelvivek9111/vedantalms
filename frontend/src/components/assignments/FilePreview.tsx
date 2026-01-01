import React, { useState } from 'react';
import { FileText, Image, File, X, Download, Eye } from 'lucide-react';
import { getImageUrl } from '../../services/api';

interface FilePreviewProps {
  // Object format
  file?: {
    name: string;
    url: string;
    type?: string;
    size?: number;
  };
  // Individual prop format (for backward compatibility)
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  onRemove?: () => void;
  onClose?: () => void;
  showRemove?: boolean;
  showClose?: boolean;
  showCloseButton?: boolean; // Alias for showClose
}

const FilePreview: React.FC<FilePreviewProps> = ({ 
  file, 
  fileUrl, 
  fileName, 
  fileType,
  fileSize,
  onRemove, 
  onClose,
  showRemove = false,
  showClose = false,
  showCloseButton = false
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Support both formats: object or individual props
  const fileData = file || {
    name: fileName || '',
    url: fileUrl || '',
    type: fileType,
    size: fileSize
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setPreviewOpen(false);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    }
  };

  const getFileIcon = () => {
    const extension = fileData.name.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const docExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
    
    if (imageExtensions.includes(extension || '')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    } else if (docExtensions.includes(extension || '')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const getFileUrl = () => {
    if (fileData.url.startsWith('http')) {
      return fileData.url;
    }
    return getImageUrl(fileData.url);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isImage = () => {
    const extension = fileData.name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '');
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {getFileIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {fileData.name}
            </p>
            {fileData.size && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(fileData.size)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {isImage() && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <a
            href={getFileUrl()}
            download={fileData.name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
          {(showRemove || showClose || showCloseButton) && (onRemove || onClose) && (
            <button
              onClick={handleRemove}
              className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
              title={(showClose || showCloseButton) ? "Close" : "Remove"}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewOpen && isImage() && (
        <div
          className="fixed inset-0 z-[200] bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {!previewError ? (
              <img
                src={getFileUrl()}
                alt={fileData.name}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onError={() => setPreviewError(true)}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-lg text-center">
                <p className="text-gray-600 dark:text-gray-400">Failed to load image preview</p>
                <a
                  href={getFileUrl()}
                  download={fileData.name}
                  className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Download file instead
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FilePreview;

