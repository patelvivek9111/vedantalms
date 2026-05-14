/**
 * Prints only the course page region using a hidden iframe + blob URL (no extra browser tab).
 * Inlines shared CSS when possible so typography works even when blob documents treat <link> oddly.
 *
 * Chrome/Edge may still add date, title, URL, and page count unless the user disables
 * "Headers and footers" in the print dialog — that part cannot be removed from web code.
 */

function courseHtmlSharedHref(): string {
  return new URL('course-html-shared.css', new URL(import.meta.env.BASE_URL || '/', window.location.href)).href;
}

/** Ink rules — appended last in merged print stylesheet so overrides win. */
const PRINT_POPUP_INK = `
@page {
  margin: 0;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
  box-sizing: border-box;
  min-height: 0 !important;
}
.course-page-print-region {
  max-width: 100% !important;
  margin: 0 !important;
  /* ~5mm top: enough air under the print header, without the old double-margin gap */
  padding: 5mm 7mm 9mm 7mm !important;
  box-sizing: border-box;
}
.course-page-print-region > h1 {
  margin: 1mm 0 0.5rem 0 !important;
  padding: 0 !important;
}
.course-page-print-region .course-page-body,
.course-page-print-region .course-page-body * {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  color: #0f172a !important;
  background: transparent !important;
  box-shadow: none !important;
  text-shadow: none !important;
}
.course-page-print-region .course-page-body a {
  color: #1d4ed8 !important;
  text-decoration: underline !important;
}
.course-page-print-region .course-page-body code {
  background: #f1f5f9 !important;
  border: 1px solid #cbd5e1 !important;
  color: #0f172a !important;
}
.course-page-print-region .course-page-body pre {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  color: #0f172a !important;
}
.course-page-print-region .course-page-body th {
  background: #f1f5f9 !important;
}
.course-page-print-region .page-resource-banner {
  background: #152c48 !important;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.course-page-print-region .page-resource-banner,
.course-page-print-region .page-resource-banner * {
  color: #fff !important;
}
.course-page-print-region .page-resource-banner a {
  color: #fff !important;
  text-decoration: underline !important;
}
.course-page-print-region .course-page-body th,
.course-page-print-region .course-page-body td {
  border-color: #94a3b8 !important;
}
.course-page-print-region .course-page-body blockquote {
  background: #f8fafc !important;
  border-left-color: #64748b !important;
  color: #334155 !important;
}
`;

function buildPrintDocument(region: HTMLElement, courseSharedCssText: string): string {
  const ink = PRINT_POPUP_INK.trim();
  const styles =
    courseSharedCssText.trim().length > 0
      ? `<style>/* course-html-shared */\n${courseSharedCssText}\n/* course-page-print */\n${ink}</style>`
      : `<link rel="stylesheet" href="${courseHtmlSharedHref()}"/><style>${ink}</style>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>\u200b</title>
${styles}
</head><body>${region.outerHTML}</body></html>`;
}

export async function printCoursePageRegion(region: HTMLElement | null): Promise<void> {
  if (!region) return;

  let courseSharedCssText = '';
  try {
    const res = await fetch(courseHtmlSharedHref(), { cache: 'force-cache' });
    if (res.ok) {
      courseSharedCssText = await res.text();
    }
  } catch {
    /* use <link> fallback in document */
  }

  const html = buildPrintDocument(region, courseSharedCssText);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print');
  iframe.setAttribute('aria-hidden', 'true');
  /* Off-screen but laid out — 0×0 iframes sometimes print blank in Chrome */
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:816px;height:1056px;border:0;opacity:0;pointer-events:none';

  let cleaned = false;
  let longTimer: number | undefined;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (longTimer !== undefined) {
      window.clearTimeout(longTimer);
    }
    URL.revokeObjectURL(blobUrl);
    iframe.remove();
  };

  document.body.appendChild(iframe);

  iframe.onload = () => {
    const cw = iframe.contentWindow;
    if (!cw) {
      cleanup();
      window.print();
      return;
    }

    const schedulePrint = () => {
      try {
        cw.focus();
        cw.print();
      } catch {
        cleanup();
        window.print();
        return;
      }
    };

    cw.addEventListener('afterprint', () => cleanup(), { once: true });
    longTimer = window.setTimeout(cleanup, 120_000) as unknown as number;

    window.requestAnimationFrame(() => {
      window.setTimeout(schedulePrint, 0);
    });
  };

  iframe.onerror = () => {
    cleanup();
    window.print();
  };

  iframe.src = blobUrl;
}
