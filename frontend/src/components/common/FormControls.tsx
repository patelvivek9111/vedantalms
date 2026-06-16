import React, { ChangeEvent } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY } from './formStyles';

export function FormCheckboxOption({
  id,
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-xl border p-4 transition ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        checked
          ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200 dark:border-indigo-700 dark:bg-indigo-950/30 dark:ring-indigo-900/50'
          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600'
      }`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function FormRadioOption({
  id,
  name,
  checked,
  onChange,
  title,
  description,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
        checked
          ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200 dark:border-indigo-700 dark:bg-indigo-950/30 dark:ring-indigo-900/50'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
      }`}
    >
      <input
        type="radio"
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function FormNavBar({
  onBack,
  children,
}: {
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-sticky-form-actions mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between max-lg:sticky max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] max-lg:z-30 max-lg:-mx-4 max-lg:px-4 max-lg:pb-3 max-lg:bg-white/95 max-lg:backdrop-blur-sm max-lg:dark:bg-gray-900/95">
      {onBack ? (
        <button type="button" onClick={onBack} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
          Back
        </button>
      ) : (
        <div className="hidden sm:block" />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
    </div>
  );
}

export function FormActions({
  onCancel,
  cancelLabel = 'Cancel',
  submitLabel,
  loading,
  loadingLabel,
  disabled,
}: {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <FormNavBar>
      {onCancel ? (
        <button type="button" onClick={onCancel} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
          {cancelLabel}
        </button>
      ) : null}
      <button
        type="submit"
        disabled={loading || disabled}
        className={`${BTN_PRIMARY} w-full sm:w-auto`}
      >
        {loading ? loadingLabel ?? 'Saving…' : submitLabel}
      </button>
    </FormNavBar>
  );
}

export function FormPageHeader({
  title,
  subtitle,
  isDraftSaved,
  onReset,
  resetLabel = 'Reset',
  onClose,
}: {
  title: string;
  subtitle?: string;
  isDraftSaved?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  onClose?: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isDraftSaved ? (
          <div className="flex items-center text-sm text-emerald-600 dark:text-emerald-400">
            <Save className="mr-1 h-4 w-4" />
            Draft saved
          </div>
        ) : null}
        {onReset ? (
          <button type="button" onClick={onReset} className={BTN_GHOST} title="Clear form and start fresh">
            <RefreshCw className="h-4 w-4" />
            {resetLabel}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
