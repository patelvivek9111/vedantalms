import React from 'react';
import ConfirmDialog from '../../design-system/ConfirmDialog';

interface FileReplaceDialogProps {
  open: boolean;
  fileName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const FileReplaceDialog: React.FC<FileReplaceDialogProps> = ({ open, fileName, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <ConfirmDialog
      open={open}
      title="Replace files?"
      message={
        fileName
          ? `Uploading will add a new version. Previous versions of "${fileName}" remain in history and stay immutable after grades are finalized.`
          : 'Uploading will create new file versions. Previous versions remain in history.'
      }
      confirmLabel="Continue"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default FileReplaceDialog;
