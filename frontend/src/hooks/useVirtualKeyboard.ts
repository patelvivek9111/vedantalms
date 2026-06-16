import { useEffect } from 'react';

const TEXT_ENTRY_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';

function isTextEntryTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.matches(TEXT_ENTRY_SELECTOR);
}

function keyboardInsetPx(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

/** Toggles `keyboard-open` on <html> so fixed bottom chrome can hide while typing. */
export function useVirtualKeyboard(): void {
  useEffect(() => {
    const root = document.documentElement;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    const setOpen = (open: boolean) => {
      root.classList.toggle('keyboard-open', open);
    };

    const syncFromViewport = () => {
      setOpen(keyboardInsetPx() > 120);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTextEntryTarget(event.target)) return;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      setOpen(true);
      syncFromViewport();
    };

    const onFocusOut = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (isTextEntryTarget(document.activeElement)) return;
        syncFromViewport();
        if (keyboardInsetPx() <= 120) {
          setOpen(false);
        }
      }, 150);
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', syncFromViewport);
    vv?.addEventListener('scroll', syncFromViewport);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      vv?.removeEventListener('resize', syncFromViewport);
      vv?.removeEventListener('scroll', syncFromViewport);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      root.classList.remove('keyboard-open');
    };
  }, []);
}
