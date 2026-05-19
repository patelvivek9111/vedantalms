import { useEffect } from 'react';

/** Warn before leaving when form has unsaved edits. */
export function useUnsavedChangesGuard(dirty: boolean, message = 'You have unsaved changes.') {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, message]);
}
