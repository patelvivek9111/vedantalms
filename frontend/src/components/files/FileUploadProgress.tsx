import React from 'react';

interface FileUploadProgressProps {
  progress: number;
  label?: string;
}

const FileUploadProgress: React.FC<FileUploadProgressProps> = ({ progress, label }) => (
  <div className="w-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
      <span>{label || 'Uploading'}</span>
      <span>{progress}%</span>
    </div>
    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
      <div
        className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-200"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  </div>
);

export default FileUploadProgress;
