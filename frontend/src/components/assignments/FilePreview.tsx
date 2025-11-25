import React, { useState } from 'react';
import { X, Download, File, Image as ImageIcon, FileText } from 'lucide-react';
import { API_URL } from '../../config';

interface FilePreviewProps {
  fileUrl: string;
  fileName?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  fileUrl,
  fileName,
  onClose,
  showCloseButton = false,
  className = ''
}) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Construct full URL if needed (for relative paths)
  const getFullUrl = (url: string): string => {
    if (!url) return '';
    // If it's already a full URL (http/https), return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's a Cloudinary URL (starts with res.cloudinary.com), ensure it has https
    if (url.includes('cloudinary.com')) {
      if (url.startsWith('//')) {
        return `https:${url}`;
      } else if (url.startsWith('/')) {
        return `https:${url}`;
      } else if (!url.startsWith('http')) {
        return `https://${url}`;
      }
      return url;
    }
    // For relative paths, prepend API_URL
    return API_URL ? `${API_URL}${url.startsWith('/') ? url : `/${url}`}` : url;
  };
  
  const fullUrl = getFullUrl(fileUrl);
  
  // For PDFs from Cloudinary, use proxy endpoint to avoid 401 errors
  const getPdfUrl = (): string => {
    if (fileType === 'pdf' && fullUrl.includes('cloudinary.com')) {
      return `${API_URL || ''}/api/files/proxy?url=${encodeURIComponent(fullUrl)}`;
    }
    return fullUrl;
  };

  // Determine file type from URL or filename
  const getFileType = (url: string, name?: string): 'image' | 'pdf' | 'document' | 'other' => {
    const lowerUrl = url.toLowerCase();
    const lowerName = (name || '').toLowerCase();
    const combined = lowerUrl + ' ' + lowerName;

    if (combined.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
      return 'image';
    }
    if (combined.match(/\.(pdf)$/i)) {
      return 'pdf';
    }
    if (combined.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i)) {
      return 'document';
    }
    return 'other';
  };

  const fileType = getFileType(fullUrl, fileName);
  const displayName = fileName || fullUrl.split('/').pop() || 'File';

  const handleImageError = () => {
    setError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(fullUrl, '_blank');
  };

  return (
    <div className={`relative ${className}`}>
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="fixed top-20 left-4 sm:top-4 sm:left-4 z-[60] p-2 sm:p-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-full text-white transition-all duration-200 shadow-2xl active:scale-95 border-2 border-white"
          aria-label="Close preview"
        >
          <X className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      )}

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* File Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {fileType === 'image' && <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
            {fileType === 'pdf' && <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />}
            {fileType === 'document' && <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />}
            {fileType === 'other' && <File className="w-4 h-4 text-gray-500 flex-shrink-0" />}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg text-white transition-all duration-200 active:scale-95 sm:hidden"
                aria-label="Close preview"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleDownload}
              className="ml-2 p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File Content */}
        <div className="relative bg-gray-100 dark:bg-gray-900">
          {fileType === 'image' && (
            <div className="relative min-h-[200px] max-h-[600px] flex items-center justify-center">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              )}
              {error ? (
                <div className="p-8 text-center">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load image</p>
                  <button
                    onClick={handleDownload}
                    className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Download instead
                  </button>
                </div>
              ) : (
                <img
                  src={fullUrl}
                  alt={displayName}
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  className={`max-w-full max-h-[600px] object-contain ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                />
              )}
            </div>
          )}

          {fileType === 'pdf' && (
            <div className="w-full relative" style={{ height: '600px' }}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              )}
              {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    PDF preview not available
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 text-center">
                    The file may not be publicly accessible. Try downloading it instead.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </button>
                </div>
              ) : (
                <iframe
                  src={getPdfUrl()}
                  className="w-full h-full border-0"
                  title={displayName}
                  allow="fullscreen"
                  onLoad={() => {
                    setLoading(false);
                    // Check if iframe loaded successfully by checking if we can access its content
                    setTimeout(() => {
                      try {
                        const iframe = document.querySelector('iframe[title="' + displayName + '"]') as HTMLIFrameElement;
                        if (iframe && iframe.contentWindow) {
                          // Iframe loaded successfully
                          setError(false);
                        }
                      } catch (e) {
                        // Cross-origin, which is expected for Cloudinary
                        // This is fine, the iframe should still work
                      }
                    }, 1000);
                  }}
                  onError={() => {
                    setError(true);
                    setLoading(false);
                  }}
                />
              )}
            </div>
          )}

          {(fileType === 'document' || fileType === 'other') && (
            <div className="p-8 text-center">
              {fileType === 'document' ? (
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              ) : (
                <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Preview not available for this file type
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreview;

