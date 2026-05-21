import React from 'react';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import type { NormalizedFile } from '../../utils/fileTypes';

interface AssignmentFileUploadSectionProps {
  uploadedFiles: Array<{ name: string; url: string; size?: number; fileAssetId?: string }>;
  onFilesChange: (files: NormalizedFile[]) => void;
  courseId?: string;
  assignmentId?: string;
  disabled?: boolean;
  finalized?: boolean;
  resubmit?: boolean;
  versionHistoryAssetId?: string;
}

const AssignmentFileUploadSection: React.FC<AssignmentFileUploadSectionProps> = ({
  uploadedFiles,
  onFilesChange,
  courseId,
  assignmentId,
  disabled = false,
  finalized = false,
  resubmit = false,
  versionHistoryAssetId,
}) => {
  const files: NormalizedFile[] = uploadedFiles.map((f) => ({
    name: f.name,
    url: f.url,
    size: f.size,
    fileAssetId: f.fileAssetId,
    status: 'done',
  }));

  return (
    <div className="mt-6 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Upload Files</h3>
      {resubmit && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Resubmitting adds new file versions. Earlier versions stay in history.
        </p>
      )}
      <FileAttachmentPanel
        files={files}
        onChange={onFilesChange}
        courseId={courseId}
        assignmentId={assignmentId}
        category="submission"
        disabled={disabled}
        finalized={finalized}
        confirmReplace={resubmit && files.length > 0}
        showVersionHistory={resubmit || !!versionHistoryAssetId}
        versionHistoryAssetId={versionHistoryAssetId || files[0]?.fileAssetId}
        lockedMessage={
          finalized
            ? 'This file is locked because course grades are finalized.'
            : undefined
        }
        label="Drop submission files here or browse"
      />
    </div>
  );
};

export default AssignmentFileUploadSection;
