export function isElementScrollable(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') {
    return false;
  }
  return el.scrollHeight > el.clientHeight + 1;
}

/** True when every scroll container from the touch target up to the document is at the top. */
export function isAtScrollTop(touchTarget?: EventTarget | null): boolean {
  const windowScroll =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  if (windowScroll > 0) {
    return false;
  }

  let node = touchTarget instanceof HTMLElement ? touchTarget : null;
  const visited = new Set<HTMLElement>();

  while (node && node !== document.documentElement) {
    if (visited.has(node)) break;
    visited.add(node);

    if (isElementScrollable(node) && node.scrollTop > 0) {
      return false;
    }
    node = node.parentElement;
  }

  return true;
}

/** Use the container scroll position when it scrolls; otherwise use the document. */
export function getEffectiveScrollTop(container: HTMLElement): number {
  if (isElementScrollable(container)) {
    return container.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}
