import React from 'react';
import BaseModal from '../components/common/BaseModal';
import { ds } from './tokens';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <BaseModal isOpen={open} onClose={onCancel} title={title} size="sm" ariaLabelledBy="confirm-dialog-title">
    <p id="confirm-dialog-desc" className="text-sm text-gray-600 dark:text-gray-400">
      {message}
    </p>
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" className={ds.btn.secondary} onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={destructive ? 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50' : ds.btn.primary}
        onClick={onConfirm}
        disabled={loading}
      >
        {confirmLabel}
      </button>
    </div>
  </BaseModal>
);

export default ConfirmDialog;
