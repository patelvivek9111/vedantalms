import { useCallback, useEffect, useRef, useState } from 'react';
import { useMobileLayout } from './useMobileLayout';

const KEYBOARD_HEIGHT_THRESHOLD = 120;
const BLUR_SETTLE_MS = 180;
const SCROLL_INTO_VIEW_DELAY_MS = 320;

function isTextEntryElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.closest('[data-keyboard-ignore]')) return false;

  if (target.tagName === 'IFRAME' && target.closest('.tox, .rich-text-editor, .mce-content-body')) {
    return true;
  }

  if (!target.matches('input, textarea, select, [contenteditable="true"]')) {
    return false;
  }

  if (target.tagName === 'INPUT') {
    const type = ((target as HTMLInputElement).type || 'text').toLowerCase();
    if (['button', 'submit', 'checkbox', 'radio', 'range', 'hidden', 'file', 'reset', 'image'].includes(type)) {
      return false;
    }
  }

  return true;
}

function getVisualKeyboardOffset(): number {
  if (typeof window === 'undefined' || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function scrollFieldIntoView(target: HTMLElement) {
  window.setTimeout(() => {
    const vv = window.visualViewport;
    const rect = target.getBoundingClientRect();
    const headerOffset = 76;
    const bottomPadding = 20;

    if (vv) {
      const visibleTop = vv.offsetTop + headerOffset;
      const visibleBottom = vv.offsetTop + vv.height - bottomPadding;
      if (rect.top < visibleTop || rect.bottom > visibleBottom) {
        const targetTop = window.scrollY + rect.top - headerOffset - 8;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
      return;
    }

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, SCROLL_INTO_VIEW_DELAY_MS);
}

/** Tracks virtual keyboard visibility on mobile via focus + visualViewport. */
export function useVirtualKeyboardOpen(): boolean {
  const isMobile = useMobileLayout();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const blurTimerRef = useRef<number | null>(null);

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current != null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  const syncKeyboardState = useCallback(() => {
    const focused = isTextEntryElement(document.activeElement);
    const viewportKeyboard = getVisualKeyboardOffset() > KEYBOARD_HEIGHT_THRESHOLD;
    setKeyboardOpen(focused || viewportKeyboard);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setKeyboardOpen(false);
      document.documentElement.removeAttribute('data-keyboard-open');
      return;
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!isTextEntryElement(event.target)) return;
      clearBlurTimer();
      setKeyboardOpen(true);
      if (event.target instanceof HTMLElement) {
        scrollFieldIntoView(event.target);
      }
    };

    const onFocusOut = () => {
      clearBlurTimer();
      blurTimerRef.current = window.setTimeout(syncKeyboardState, BLUR_SETTLE_MS);
    };

    const onViewportChange = () => syncKeyboardState();

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);

    return () => {
      clearBlurTimer();
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
      document.documentElement.removeAttribute('data-keyboard-open');
    };
  }, [isMobile, clearBlurTimer, syncKeyboardState]);

  useEffect(() => {
    if (!isMobile) return;
    document.documentElement.toggleAttribute('data-keyboard-open', keyboardOpen);
  }, [isMobile, keyboardOpen]);

  return keyboardOpen;
}
