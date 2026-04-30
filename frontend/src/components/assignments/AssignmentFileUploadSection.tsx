import React from 'react';
import { Eye, X } from 'lucide-react';
import FilePreview from './FilePreview';

interface UploadedFileLike {
  name: string;
  url: string;
  size?: number;
}

interface PreviewFileLike {
  url: string;
  name: string;
}

interface AssignmentFileUploadSectionProps {
  uploadedFiles: UploadedFileLike[];
  isUploading: boolean;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  previewFile: PreviewFileLike | null;
  onPreviewFile: (file: PreviewFileLike) => void;
  onClosePreview: () => void;
}

const AssignmentFileUploadSection: React.FC<AssignmentFileUploadSectionProps> = ({
  uploadedFiles,
  isUploading,
  onFileInputChange,
  onRemoveFile,
  previewFile,
  onPreviewFile,
  onClosePreview,
}) => {
  return (
    <div className="mt-6 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Files</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              multiple
              onChange={onFileInputChange}
              disabled={isUploading}
              className="hidden"
              id="file-upload-scrollable"
            />
            <label
              htmlFor="file-upload-scrollable"
              className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-700 cursor-pointer ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {isUploading ? 'Uploading...' : 'Upload File'}
            </label>
            {uploadedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById('file-upload-scrollable')?.click()}
                className="inline-flex items-center px-4 py-2 border border-pink-500 rounded-md shadow-sm text-sm font-medium text-pink-600 bg-white dark:bg-gray-800 hover:bg-pink-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Another File
              </button>
            )}
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Uploaded Files:</h4>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {file.size ? `${((file.size || 0) / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <button
                      type="button"
                      onClick={() => onPreviewFile({ url: file.url, name: file.name })}
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1"
                      title="Preview file"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(index)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {previewFile && previewFile.url && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={onClosePreview}
              >
                <div
                  className="relative max-w-4xl w-full max-h-[90vh] overflow-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FilePreview
                    fileUrl={previewFile.url || ''}
                    fileName={previewFile.name || ''}
                    onClose={onClosePreview}
                    showCloseButton={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentFileUploadSection;

