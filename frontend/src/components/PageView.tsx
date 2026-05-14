import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useModule } from '../contexts/ModuleContext';
import { Pencil, Printer, MoreHorizontal, ExternalLink } from 'lucide-react';
import { printCoursePageRegion } from '../utils/printCoursePageRegion';
import Breadcrumb from './common/Breadcrumb';

export function sanitizePageHtml(html: string): string {
  if (!html) return '';
  let sanitized = html.replace(/<\/(script|style)>/gi, '</removed>');
  sanitized = sanitized.replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '');
  sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/ on\w+='[^']*'/gi, '');
  return sanitized;
}

export interface PageViewProps {
  /** When set, shows course-style breadcrumb, “View all pages”, and optional edit actions */
  courseId?: string;
  courseLabel?: string;
  canEdit?: boolean;
  /**
   * When provided with `courseId` + `courseLabel`, the course breadcrumb is omitted here so the
   * parent (e.g. `PageViewWrapper`) can render it above the shell.
   */
  onCoursePageHead?: (head: { _id: string; title: string } | null) => void;
}

/** Shared HTML body wrapper — typography from public/course-html-shared.css (not Tailwind prose). */
export const coursePageBodyHtmlClass =
  'course-page-body max-w-none ' +
  '[&_a[target=_blank]]:inline-flex [&_a[target=_blank]]:items-baseline [&_a[target=_blank]]:gap-0.5 ' +
  "[&_a[target=_blank]]:after:content-['↗'] [&_a[target=_blank]]:after:text-[0.65em] [&_a[target=_blank]]:after:opacity-70 [&_a[target=_blank]]:after:font-sans " +
  '[&_.page-resource-banner]:mt-8 [&_.page-resource-banner]:flex [&_.page-resource-banner]:items-center [&_.page-resource-banner]:gap-3 ' +
  '[&_.page-resource-banner]:rounded-md [&_.page-resource-banner]:bg-[#152c48] dark:[&_.page-resource-banner]:bg-[#1e3a5f] [&_.page-resource-banner]:px-4 [&_.page-resource-banner]:py-3.5 ' +
  '[&_.page-resource-banner]:shadow-md [&_.page-resource-banner_a]:text-white [&_.page-resource-banner_a]:no-underline [&_.page-resource-banner_a]:font-medium ' +
  '[&_.page-resource-banner_a]:hover:underline [&_.page-resource-banner_a]:underline-offset-2 ' +
  '[&_.page-resource-banner_.page-resource-banner-icon]:text-2xl [&_.page-resource-banner_.page-resource-banner-icon]:leading-none ' +
  '[&_.page-video-grid]:my-8 [&_.page-video-grid]:grid [&_.page-video-grid]:gap-4 [&_.page-video-grid]:sm:grid-cols-2 [&_.page-video-grid]:lg:grid-cols-3 ' +
  '[&_.page-video-card]:overflow-hidden [&_.page-video-card]:rounded-lg [&_.page-video-card]:border [&_.page-video-card]:border-slate-200 dark:[&_.page-video-card]:border-slate-600 ' +
  '[&_.page-video-card]:bg-white dark:[&_.page-video-card]:bg-slate-900 [&_.page-video-card]:shadow-sm';

const PageView: React.FC<PageViewProps> = ({ courseId, courseLabel, canEdit, onCoursePageHead }) => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { getPage } = useModule();
  const printRegionRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      if (!pageId) return;

      try {
        setLoading(true);
        const pageData = await getPage(pageId);
        if (!pageData) {
          throw new Error('Page not found');
        }
        setPage(pageData);
      } catch (err) {
        setError('Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [pageId, getPage]);

  const shellBreadcrumb = Boolean(onCoursePageHead && courseId && courseLabel);

  useEffect(() => {
    if (!onCoursePageHead) return;
    if (!courseId || !courseLabel) {
      onCoursePageHead(null);
      return;
    }
    if (!pageId) {
      onCoursePageHead(null);
      return;
    }
    if (loading || error || !page) {
      onCoursePageHead(null);
      return;
    }
    onCoursePageHead({ _id: page._id, title: page.title });
  }, [onCoursePageHead, courseId, courseLabel, pageId, loading, error, page]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
        <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
        <div className="mb-4 text-slate-500 dark:text-slate-400">Page not found</div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const showCourseChrome = Boolean(courseId && courseLabel);

  return (
    <article className="mx-auto max-w-4xl px-1 print:mx-0 print:max-w-none print:px-0 sm:px-2">
      {showCourseChrome && (
        <header className="course-page-print-chrome mb-6 space-y-3 border-b border-slate-200 pb-4 print:hidden dark:border-slate-700">
          {!shellBreadcrumb && (
            <div className="flex flex-col gap-3">
              <Breadcrumb
                className="mb-0"
                lastItemClassName="max-w-[min(100%,28rem)] min-w-0 shrink truncate"
                lastItemTitle={page.title}
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'Courses', path: '/courses' },
                  {
                    label: courseLabel || 'Course',
                    path: `/courses/${courseId}`,
                  },
                  { label: 'Pages', path: `/courses/${courseId}/pages` },
                  {
                    label: page.title,
                    path: `/courses/${courseId}/pages/${page._id}`,
                  },
                ]}
              />
              <div className="h-px w-full shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-1">
            {canEdit && pageId && (
              <Link
                to={`/pages/${pageId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Link>
            )}
            <details className="relative group">
              <summary className="flex cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 [&::-webkit-details-marker]:hidden">
                <span className="sr-only">More options</span>
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </summary>
              <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => {
                    document.querySelectorAll('details[open]').forEach((el) => el.removeAttribute('open'));
                    printCoursePageRegion(printRegionRef.current);
                  }}
                >
                  <Printer className="h-4 w-4 shrink-0" aria-hidden />
                  Print
                </button>
              </div>
            </details>
          </div>
        </header>
      )}

      <div ref={printRegionRef} className="course-page-print-region">
        <h1 className="mb-3 break-words text-2xl font-normal tracking-tight text-slate-400 print:text-slate-900 dark:text-slate-500 sm:text-3xl md:text-[2rem]">
          {page.title}
        </h1>
        <div
          className="mb-8 border-b border-slate-200 print:border-slate-300 dark:border-slate-600"
          role="presentation"
        />

        <div className={coursePageBodyHtmlClass} dangerouslySetInnerHTML={{ __html: sanitizePageHtml(page.content || '') }} />

        {page.attachments && page.attachments.length > 0 && (
          <section className="mt-10 border-t border-slate-200 pt-6 print:border-slate-300 print:text-slate-900 dark:border-slate-700">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 print:text-slate-800 dark:text-slate-400">
              Attachments
            </h2>
            <ul className="space-y-2">
              {page.attachments.map((url: string, idx: number) => (
                <li key={idx}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 print:text-blue-800 hover:underline dark:text-blue-400"
                  >
                    {url.split('/').pop()}
                    <ExternalLink className="h-3.5 w-3.5 opacity-70 print:hidden" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

    </article>
  );
};

export default PageView;
